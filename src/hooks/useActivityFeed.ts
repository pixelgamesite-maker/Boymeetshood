import { useCallback, useEffect, useState } from "react";
import { getPublicClient } from "wagmi/actions";
import { parseAbiItem } from "viem";
import { wagmiConfig } from "@/lib/wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { formatAmount, shortAddress } from "@/lib/format";
import { currencyFromEnum } from "@/types/lending";

/**
 * A public, no-wallet-needed feed of real on-chain activity, so a visitor
 * who hasn't connected anything can still see the platform is actually
 * being used. Built the same way `useMyBoys` scans Transfer logs — these
 * events aren't in the ABI used for reads/writes (no need, the contract's
 * getter functions cover that), so they're declared here with the exact
 * signatures from the contract source.
 */

const REQUEST_CREATED = parseAbiItem(
  "event RequestCreated(uint256 indexed requestId, address indexed borrower, uint256[] tokenIds, uint128 principal, uint16 interestBps, uint32 duration, uint64 expiresAt, uint8 currency)",
);
const OFFER_CREATED = parseAbiItem(
  "event OfferCreated(uint256 indexed offerId, address indexed lender, uint128 principal, uint16 interestBps, uint32 duration, uint64 expiresAt, uint8 tokenCount, uint8 currency)",
);
const LOAN_STARTED = parseAbiItem(
  "event LoanStarted(uint256 indexed loanId, address indexed borrower, address indexed lender, uint256[] tokenIds, uint128 principal, uint128 repayAmount, uint128 fee, uint64 dueAt, uint8 currency)",
);
const LOAN_REPAID = parseAbiItem(
  "event LoanRepaid(uint256 indexed loanId, address indexed borrower)",
);

/** How far back to look each refresh. Recent-only by design — this is a
 * "the lights are on" signal, not a history browser. */
const LOOKBACK_BLOCKS = 100_000n;
const MAX_ITEMS = 12;
const POLL_MS = 45_000;

export interface FeedItem {
  id: string;
  text: string;
  timestamp: number;
  blockNumber: bigint;
}

interface FeedState {
  items: FeedItem[];
  loading: boolean;
  error: string | null;
}

export function useActivityFeed(): FeedState {
  const [state, setState] = useState<FeedState>({ items: [], loading: true, error: null });

  const load = useCallback(async () => {
    const client = getPublicClient(wagmiConfig);
    if (!client) return;

    try {
      const latest = await client.getBlockNumber();
      const fromBlock = latest > LOOKBACK_BLOCKS ? latest - LOOKBACK_BLOCKS : 0n;

      const logs = await client.getLogs({
        address: CONTRACTS.escrow,
        events: [REQUEST_CREATED, OFFER_CREATED, LOAN_STARTED, LOAN_REPAID],
        fromBlock,
        toBlock: "latest",
      });

      if (logs.length === 0) {
        setState({ items: [], loading: false, error: null });
        return;
      }

      const recent = logs
        .sort((a, b) => {
          const byBlock = Number(b.blockNumber - a.blockNumber);
          return byBlock !== 0 ? byBlock : b.logIndex - a.logIndex;
        })
        .slice(0, MAX_ITEMS);

      const uniqueBlocks = [...new Set(recent.map((l) => l.blockNumber))];
      const blocks = await Promise.all(
        uniqueBlocks.map((bn) => client.getBlock({ blockNumber: bn })),
      );
      const timeOf = new Map(uniqueBlocks.map((bn, i) => [bn, Number(blocks[i].timestamp)]));

      const items = recent.map((log) => ({
        id: `${log.transactionHash}-${log.logIndex}`,
        text: describe(log),
        timestamp: timeOf.get(log.blockNumber) ?? 0,
        blockNumber: log.blockNumber,
      }));

      setState({ items, loading: false, error: null });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Couldn't reach the chain.",
      }));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return state;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describe(log: any): string {
  const currency = currencyFromEnum(Number(log.args.currency ?? 0));

  switch (log.eventName) {
    case "RequestCreated": {
      const count = log.args.tokenIds.length;
      return `New request: ${formatAmount(log.args.principal, currency)} ${currency.toUpperCase()} against ${count} ${count === 1 ? "Boy" : "Boys"}`;
    }
    case "OfferCreated": {
      const count = Number(log.args.tokenCount);
      return `New offer: ${formatAmount(log.args.principal, currency)} ${currency.toUpperCase()} for ${count} ${count === 1 ? "Boy" : "Boys"}`;
    }
    case "LoanStarted": {
      const count = log.args.tokenIds.length;
      return `Loan funded: ${formatAmount(log.args.principal, currency)} ${currency.toUpperCase()} against ${count} ${count === 1 ? "Boy" : "Boys"}`;
    }
    case "LoanRepaid":
      return `${shortAddress(log.args.borrower)} repaid their loan`;
    default:
      return "Activity on the platform";
  }
}
