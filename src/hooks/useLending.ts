import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import {
  readContract,
  readContracts,
  writeContract,
  waitForTransactionReceipt,
  getPublicClient,
} from "wagmi/actions";
import { parseAbiItem } from "viem";
import { wagmiConfig } from "@/lib/wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { lendingAbi } from "@/lib/abis/lending";
import { erc20Abi, erc721Abi } from "@/lib/abis/tokens";
import type { Address, Loan, Offer, OwnedBoy } from "@/types/lending";

/**
 * Every read and write against BoyMeetsHoodLending.
 *
 * Reads are batched through Multicall3, which is deployed on Robinhood Chain,
 * so listing every offer costs one request rather than one per offer.
 *
 * The Boys collection is NOT ERC721Enumerable — tokenOfOwnerByIndex reverts —
 * so a wallet's tokens are found from Transfer logs and then confirmed with
 * ownerOf. The RPC serves logs from block 0 without a range cap, which is what
 * makes this possible without an indexer.
 */

/** Deployment block. Starting the log scan here rather than 0 saves work. */
const DEPLOY_BLOCK = 62_915_406n;

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

/* ── Shared query shape ──────────────────────────────────────────────────*/

interface Query<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  enabled = true,
): Query<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setData(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't reach the chain.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  return { data, loading, error, refetch };
}

/** The connected wallet, or undefined. */
export function useMyAddress(): Address | undefined {
  const { address } = useAccount();
  return address;
}

/* ── Reads ───────────────────────────────────────────────────────────────*/

type OfferTuple = readonly [
  Address, bigint, number, number, bigint, number, bigint, boolean,
];

function toOffer(id: bigint, t: OfferTuple): Offer {
  return {
    id: id.toString(),
    lender: t[0],
    principal: t[1],
    interestBps: t[2],
    durationSecs: t[3],
    collateral:
      t[5] === 1 ? { kind: "tokens", tokenIds: [Number(t[6])] } : { kind: "any" },
    createdAt: 0, // not stored on-chain; offers are sorted by id instead
  };
}

/** Every offer currently open and takeable. */
export function useOffers(): Query<Offer[]> {
  return useQuery(async () => {
    const next = await readContract(wagmiConfig, {
      address: CONTRACTS.escrow,
      abi: lendingAbi,
      functionName: "nextOfferId",
    });

    const count = Number(next) - 1;
    if (count <= 0) return [];

    const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
    const results = await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: ids.map((id) => ({
        address: CONTRACTS.escrow,
        abi: lendingAbi,
        functionName: "offers" as const,
        args: [id] as const,
      })),
    });

    const now = BigInt(Math.floor(Date.now() / 1000));

    return (results as unknown as OfferTuple[])
      .map((tuple, i) => ({ tuple, id: ids[i] }))
      .filter(({ tuple }) => {
        const active = tuple[7];
        const expiresAt = tuple[4];
        return active && (expiresAt === 0n || now <= expiresAt);
      })
      .map(({ tuple, id }) => toOffer(id, tuple))
      .reverse(); // newest first
  }, []);
}

type LoanTuple = readonly [
  Address, Address, bigint, bigint, bigint, bigint, bigint, bigint, number,
];

function toLoan(id: bigint, t: LoanTuple): Loan {
  return {
    id: id.toString(),
    offerId: "",
    lender: t[0],
    borrower: t[1],
    tokenId: Number(t[2]),
    principal: t[3],
    interest: t[4] - t[3],
    repayAmount: t[4] + t[5], // repayAmount + fee, what the borrower pays
    startedAt: Number(t[6]),
    dueAt: Number(t[7]),
    status: t[8] === 2 ? "repaid" : t[8] === 3 ? "defaulted" : "active",
  };
}

/** Every loan touching the connected wallet, as borrower or lender. */
export function useMyLoans(): Query<Loan[]> {
  const me = useMyAddress();

  return useQuery(
    async () => {
      const next = await readContract(wagmiConfig, {
        address: CONTRACTS.escrow,
        abi: lendingAbi,
        functionName: "nextLoanId",
      });

      const count = Number(next) - 1;
      if (count <= 0) return [];

      const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
      const results = await readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: ids.map((id) => ({
          address: CONTRACTS.escrow,
          abi: lendingAbi,
          functionName: "loans" as const,
          args: [id] as const,
        })),
      });

      const mine = me?.toLowerCase();

      return (results as unknown as LoanTuple[])
        .map((tuple, i) => toLoan(ids[i], tuple))
        .filter(
          (loan) =>
            loan.lender.toLowerCase() === mine ||
            loan.borrower.toLowerCase() === mine,
        )
        .reverse();
    },
    [me],
    Boolean(me),
  );
}

/**
 * Boys held by the connected wallet.
 *
 * The collection isn't Enumerable, so: collect every tokenId ever transferred
 * TO this address from logs, then confirm with ownerOf which are still held.
 */
export function useMyBoys(): Query<OwnedBoy[]> {
  const me = useMyAddress();

  return useQuery(
    async () => {
      const client = getPublicClient(wagmiConfig);
      if (!client || !me) return [];

      const logs = await client.getLogs({
        address: CONTRACTS.boys,
        event: TRANSFER_EVENT,
        args: { to: me },
        fromBlock: DEPLOY_BLOCK,
        toBlock: "latest",
      });

      const candidates = [
        ...new Set(logs.map((log) => log.args.tokenId as bigint)),
      ];
      if (candidates.length === 0) return [];

      // A token may have been transferred away again — confirm each.
      const owners = await readContracts(wagmiConfig, {
        allowFailure: true,
        contracts: candidates.map((tokenId) => ({
          address: CONTRACTS.boys,
          abi: erc721Abi,
          functionName: "ownerOf" as const,
          args: [tokenId] as const,
        })),
      });

      const held = candidates.filter(
        (_, i) =>
          owners[i].status === "success" &&
          (owners[i].result as Address).toLowerCase() === me.toLowerCase(),
      );

      // A Boy in escrow is owned by the contract, so anything still held is
      // free to pledge.
      return held.map((tokenId) => ({
        tokenId: Number(tokenId),
        available: true,
      }));
    },
    [me],
    Boolean(me),
  );
}

/** USDG credited to the connected wallet, waiting to be withdrawn. */
export function useOwed(): Query<bigint> {
  const me = useMyAddress();

  return useQuery(
    async () =>
      readContract(wagmiConfig, {
        address: CONTRACTS.escrow,
        abi: lendingAbi,
        functionName: "owed",
        args: [me as Address],
      }),
    [me],
    Boolean(me),
  );
}

/* ── Writes ──────────────────────────────────────────────────────────────*/

interface Action<Args extends unknown[]> {
  run: (...args: Args) => Promise<boolean>;
  pending: boolean;
  error: string | null;
  reset: () => void;
}

/** Turn a chain revert into something a person can read. */
function readableError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);

  if (/User rejected|denied transaction/i.test(raw)) return "You cancelled it.";
  if (/OfferInactive/.test(raw)) return "That offer is already gone.";
  if (/OfferExpired/.test(raw)) return "That offer has expired.";
  if (/SelfBorrow/.test(raw)) return "You can't take your own offer.";
  if (/NotTokenOwner/.test(raw)) return "You don't own that Boy.";
  if (/TokenNotEligible/.test(raw)) return "That Boy isn't accepted here.";
  if (/DeadlinePassed/.test(raw)) return "Past the deadline — this loan defaulted.";
  if (/DeadlineNotPassed/.test(raw)) return "Not past the deadline yet.";
  if (/LoanNotActive/.test(raw)) return "That loan is already closed.";
  if (/NothingOwed/.test(raw)) return "Nothing to withdraw.";
  if (/insufficient funds/i.test(raw)) return "Not enough ETH for gas.";
  if (/transfer amount exceeds balance/i.test(raw)) return "Not enough USDG.";

  return "Transaction failed.";
}

function useAction<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>,
): Action<Args> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      setPending(true);
      setError(null);
      try {
        await fn(...args);
        return true;
      } catch (e) {
        setError(readableError(e));
        return false;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  return { run, pending, error, reset: useCallback(() => setError(null), []) };
}

async function send(hash: `0x${string}`) {
  return waitForTransactionReceipt(wagmiConfig, { hash });
}

/** Approve USDG if the current allowance is short. */
async function ensureUsdgAllowance(owner: Address, amount: bigint) {
  const allowance = await readContract(wagmiConfig, {
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, CONTRACTS.escrow],
  });

  if (allowance >= amount) return;

  const hash = await writeContract(wagmiConfig, {
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "approve",
    args: [CONTRACTS.escrow, amount],
  });
  await send(hash);
}

/** Approve the escrow for the collection if it isn't already. */
async function ensureBoysApproval(owner: Address) {
  const approved = await readContract(wagmiConfig, {
    address: CONTRACTS.boys,
    abi: erc721Abi,
    functionName: "isApprovedForAll",
    args: [owner, CONTRACTS.escrow],
  });

  if (approved) return;

  const hash = await writeContract(wagmiConfig, {
    address: CONTRACTS.boys,
    abi: erc721Abi,
    functionName: "setApprovalForAll",
    args: [CONTRACTS.escrow, true],
  });
  await send(hash);
}

export function useCreateOffer() {
  const me = useMyAddress();
  return useAction(
    async (input: {
      principal: bigint;
      interestBps: number;
      durationSecs: number;
      expiresAt?: number;
    }) => {
      if (!me) throw new Error("Connect a wallet first.");
      await ensureUsdgAllowance(me, input.principal);

      const hash = await writeContract(wagmiConfig, {
        address: CONTRACTS.escrow,
        abi: lendingAbi,
        functionName: "createOffer",
        args: [
          input.principal,
          input.interestBps,
          input.durationSecs,
          BigInt(input.expiresAt ?? 0),
          0, // Collateral.Any
          0n,
        ],
      });
      return send(hash);
    },
  );
}

export function useTakeOffer() {
  const me = useMyAddress();
  return useAction(async (offerId: string, tokenId: number) => {
    if (!me) throw new Error("Connect a wallet first.");
    await ensureBoysApproval(me);

    const hash = await writeContract(wagmiConfig, {
      address: CONTRACTS.escrow,
      abi: lendingAbi,
      functionName: "takeOffer",
      args: [BigInt(offerId), BigInt(tokenId)],
    });
    return send(hash);
  });
}

export function useRepayLoan() {
  const me = useMyAddress();
  return useAction(async (loanId: string) => {
    if (!me) throw new Error("Connect a wallet first.");

    const due = await readContract(wagmiConfig, {
      address: CONTRACTS.escrow,
      abi: lendingAbi,
      functionName: "totalDue",
      args: [BigInt(loanId)],
    });
    await ensureUsdgAllowance(me, due);

    const hash = await writeContract(wagmiConfig, {
      address: CONTRACTS.escrow,
      abi: lendingAbi,
      functionName: "repay",
      args: [BigInt(loanId)],
    });
    return send(hash);
  });
}

export function useCancelOffer() {
  return useAction(async (offerId: string) => {
    const hash = await writeContract(wagmiConfig, {
      address: CONTRACTS.escrow,
      abi: lendingAbi,
      functionName: "cancelOffer",
      args: [BigInt(offerId)],
    });
    return send(hash);
  });
}

export function useClaimCollateral() {
  return useAction(async (loanId: string) => {
    const hash = await writeContract(wagmiConfig, {
      address: CONTRACTS.escrow,
      abi: lendingAbi,
      functionName: "claimDefault",
      args: [BigInt(loanId)],
    });
    return send(hash);
  });
}

/** Pull credited USDG out of the contract. */
export function useWithdraw() {
  return useAction(async () => {
    const hash = await writeContract(wagmiConfig, {
      address: CONTRACTS.escrow,
      abi: lendingAbi,
      functionName: "withdraw",
    });
    return send(hash);
  });
}

/* ── Countdown ───────────────────────────────────────────────────────────*/

/** Unix seconds, ticking once a second. Drives every deadline on the page. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
