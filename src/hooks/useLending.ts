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
import {
  currencyFromEnum,
  currencyToEnum,
  type Address,
  type Currency,
  type Loan,
  type LoanRequest,
  type Offer,
  type OwnedBoy,
} from "@/types/lending";

/** Collection deployment block — where the Transfer log scan starts. */
const DEPLOY_BLOCK = 62_915_406n;

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

const escrow = { address: CONTRACTS.escrow, abi: lendingAbi } as const;

/* ── Query plumbing ──────────────────────────────────────────────────────*/

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
      .then((r) => !cancelled && setData(r))
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't reach the chain.");
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  return { data, loading, error, refetch };
}

export function useMyAddress(): Address | undefined {
  return useAccount().address;
}

async function countOf(name: "nextRequestId" | "nextOfferId" | "nextLoanId") {
  const n = await readContract(wagmiConfig, { ...escrow, functionName: name });
  return Number(n) - 1;
}

/* ── Requests ────────────────────────────────────────────────────────────*/

type RequestTuple = readonly [
  Address, bigint, number, number, bigint, number, boolean,
];

export function useRequests(): Query<LoanRequest[]> {
  return useQuery(async () => {
    const count = await countOf("nextRequestId");
    if (count <= 0) return [];

    const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
    const rows = (await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: ids.map((id) => ({
        ...escrow,
        functionName: "requests" as const,
        args: [id] as const,
      })),
    })) as unknown as RequestTuple[];

    const live = rows.map((t, i) => ({ t, id: ids[i] })).filter(({ t }) => t[6]);
    if (live.length === 0) return [];

    const tokenLists = (await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: live.map(({ id }) => ({
        ...escrow,
        functionName: "requestTokens" as const,
        args: [id] as const,
      })),
    })) as unknown as bigint[][];

    const now = Math.floor(Date.now() / 1000);

    return live
      .map(({ t, id }, i) => ({
        id: id.toString(),
        borrower: t[0],
        principal: t[1],
        interestBps: t[2],
        durationSecs: t[3],
        expiresAt: Number(t[4]),
        currency: currencyFromEnum(t[5]),
        tokenIds: tokenLists[i].map(Number),
      }))
      .filter((r) => r.expiresAt === 0 || now <= r.expiresAt)
      .reverse();
  }, []);
}

/* ── Offers ──────────────────────────────────────────────────────────────*/

type OfferTuple = readonly [
  Address, bigint, number, number, bigint, number, number, boolean,
];

export function useOffers(): Query<Offer[]> {
  return useQuery(async () => {
    const count = await countOf("nextOfferId");
    if (count <= 0) return [];

    const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
    const rows = (await readContracts(wagmiConfig, {
      allowFailure: false,
      contracts: ids.map((id) => ({
        ...escrow,
        functionName: "offers" as const,
        args: [id] as const,
      })),
    })) as unknown as OfferTuple[];

    const now = Math.floor(Date.now() / 1000);

    return rows
      .map((t, i) => ({
        id: ids[i].toString(),
        lender: t[0],
        principal: t[1],
        interestBps: t[2],
        durationSecs: t[3],
        expiresAt: Number(t[4]),
        tokenCount: t[5],
        currency: currencyFromEnum(t[6]),
        active: t[7],
      }))
      .filter((o) => o.active && (o.expiresAt === 0 || now <= o.expiresAt))
      .map(({ active: _a, ...o }) => o)
      .reverse();
  }, []);
}

/* ── Loans ───────────────────────────────────────────────────────────────*/

type LoanTuple = readonly [
  Address, Address, bigint, bigint, bigint, bigint, bigint, number, number,
];

export function useMyLoans(): Query<Loan[]> {
  const me = useMyAddress();

  return useQuery(
    async () => {
      const count = await countOf("nextLoanId");
      if (count <= 0) return [];

      const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
      const rows = (await readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: ids.map((id) => ({
          ...escrow,
          functionName: "loans" as const,
          args: [id] as const,
        })),
      })) as unknown as LoanTuple[];

      const mine = me?.toLowerCase();
      const relevant = rows
        .map((t, i) => ({ t, id: ids[i] }))
        .filter(
          ({ t }) => t[0].toLowerCase() === mine || t[1].toLowerCase() === mine,
        );

      if (relevant.length === 0) return [];

      const tokenLists = (await readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: relevant.map(({ id }) => ({
          ...escrow,
          functionName: "loanTokens" as const,
          args: [id] as const,
        })),
      })) as unknown as bigint[][];

      return relevant
        .map(({ t, id }, i) => ({
          id: id.toString(),
          lender: t[0],
          borrower: t[1],
          principal: t[2],
          repayAmount: t[3],
          fee: t[4],
          totalDue: t[3] + t[4],
          startedAt: Number(t[5]),
          dueAt: Number(t[6]),
          currency: currencyFromEnum(t[7]),
          status:
            t[8] === 2 ? ("repaid" as const)
            : t[8] === 3 ? ("defaulted" as const)
            : ("active" as const),
          tokenIds: tokenLists[i].map(Number),
        }))
        .reverse();
    },
    [me],
    Boolean(me),
  );
}

/* ── Wallet ──────────────────────────────────────────────────────────────*/

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
        ...new Set(
          logs.map((l: { args: { tokenId?: bigint } }) => l.args.tokenId as bigint),
        ),
      ];
      if (candidates.length === 0) return [];

      const owners = await readContracts(wagmiConfig, {
        allowFailure: true,
        contracts: candidates.map((tokenId) => ({
          address: CONTRACTS.boys,
          abi: erc721Abi,
          functionName: "ownerOf" as const,
          args: [tokenId] as const,
        })),
      });

      return candidates
        .filter(
          (_, i) =>
            owners[i].status === "success" &&
            (owners[i].result as Address).toLowerCase() === me.toLowerCase(),
        )
        .map((tokenId) => ({ tokenId: Number(tokenId) }))
        .sort((a, b) => a.tokenId - b.tokenId);
    },
    [me],
    Boolean(me),
  );
}

/** Credited balances in both currencies. */
export function useOwed(): Query<{ usdg: bigint; eth: bigint }> {
  const me = useMyAddress();

  return useQuery(
    async () => {
      const [usdg, eth] = (await readContracts(wagmiConfig, {
        allowFailure: false,
        contracts: [
          { ...escrow, functionName: "owedUsdg" as const, args: [me as Address] },
          { ...escrow, functionName: "owedEth" as const, args: [me as Address] },
        ],
      })) as unknown as [bigint, bigint];

      return { usdg, eth };
    },
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

function readableError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);

  if (/User rejected|denied transaction/i.test(raw)) return "You cancelled it.";
  if (/BadValue/.test(raw)) return "Wrong amount sent. Try again.";
  if (/Inactive/.test(raw)) return "That's already gone.";
  if (/Expired/.test(raw)) return "That has expired.";
  if (/SelfDeal/.test(raw)) return "You can't take your own post.";
  if (/NotTokenOwner/.test(raw)) return "You don't own one of those Boys.";
  if (/WrongTokenCount/.test(raw)) return "Wrong number of Boys for this offer.";
  if (/BadBundle/.test(raw)) return "Pick between 1 and 20 Boys.";
  if (/DeadlinePassed/.test(raw)) return "Past the deadline — this loan defaulted.";
  if (/DeadlineNotPassed/.test(raw)) return "Not past the deadline yet.";
  if (/LoanNotActive/.test(raw)) return "That loan is already closed.";
  if (/NotOwnerOfPost/.test(raw)) return "That isn't yours to cancel.";
  if (/NothingOwed/.test(raw)) return "Nothing to withdraw.";
  if (/insufficient funds/i.test(raw)) return "Not enough ETH in your wallet.";
  if (/exceeds balance/i.test(raw)) return "Not enough USDG.";

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

const send = (hash: `0x${string}`) =>
  waitForTransactionReceipt(wagmiConfig, { hash });

/** USDG needs an allowance; ETH rides along as msg.value. */
async function ensureUsdg(owner: Address, amount: bigint) {
  const allowance = await readContract(wagmiConfig, {
    address: CONTRACTS.usdg,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, CONTRACTS.escrow],
  });
  if (allowance >= amount) return;

  await send(
    await writeContract(wagmiConfig, {
      address: CONTRACTS.usdg,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACTS.escrow, amount],
    }),
  );
}

async function ensureBoys(owner: Address) {
  const approved = await readContract(wagmiConfig, {
    address: CONTRACTS.boys,
    abi: erc721Abi,
    functionName: "isApprovedForAll",
    args: [owner, CONTRACTS.escrow],
  });
  if (approved) return;

  await send(
    await writeContract(wagmiConfig, {
      address: CONTRACTS.boys,
      abi: erc721Abi,
      functionName: "setApprovalForAll",
      args: [CONTRACTS.escrow, true],
    }),
  );
}

export interface RequestInput {
  tokenIds: number[];
  principal: bigint;
  interestBps: number;
  durationSecs: number;
  currency: Currency;
}

export function useCreateRequest() {
  const me = useMyAddress();
  return useAction(async (input: RequestInput) => {
    if (!me) throw new Error("Connect a wallet first.");
    await ensureBoys(me);

    return send(
      await writeContract(wagmiConfig, {
        ...escrow,
        functionName: "createRequest",
        args: [
          input.tokenIds.map(BigInt),
          input.principal,
          input.interestBps,
          input.durationSecs,
          0n,
          currencyToEnum(input.currency),
        ],
      }),
    );
  });
}

export function useCancelRequest() {
  return useAction(async (requestId: string) =>
    send(
      await writeContract(wagmiConfig, {
        ...escrow,
        functionName: "cancelRequest",
        args: [BigInt(requestId)],
      }),
    ),
  );
}

export function useFundRequest() {
  const me = useMyAddress();
  return useAction(
    async (requestId: string, principal: bigint, currency: Currency) => {
      if (!me) throw new Error("Connect a wallet first.");
      if (currency === "usdg") await ensureUsdg(me, principal);

      return send(
        await writeContract(wagmiConfig, {
          ...escrow,
          functionName: "fundRequest",
          args: [BigInt(requestId)],
          value: currency === "eth" ? principal : 0n,
        }),
      );
    },
  );
}

export interface OfferInput {
  principal: bigint;
  interestBps: number;
  durationSecs: number;
  tokenCount: number;
  currency: Currency;
}

export function useCreateOffer() {
  const me = useMyAddress();
  return useAction(async (input: OfferInput) => {
    if (!me) throw new Error("Connect a wallet first.");
    if (input.currency === "usdg") await ensureUsdg(me, input.principal);

    return send(
      await writeContract(wagmiConfig, {
        ...escrow,
        functionName: "createOffer",
        args: [
          input.principal,
          input.interestBps,
          input.durationSecs,
          0n,
          input.tokenCount,
          currencyToEnum(input.currency),
        ],
        value: input.currency === "eth" ? input.principal : 0n,
      }),
    );
  });
}

export function useCancelOffer() {
  return useAction(async (offerId: string) =>
    send(
      await writeContract(wagmiConfig, {
        ...escrow,
        functionName: "cancelOffer",
        args: [BigInt(offerId)],
      }),
    ),
  );
}

export function useTakeOffer() {
  const me = useMyAddress();
  return useAction(async (offerId: string, tokenIds: number[]) => {
    if (!me) throw new Error("Connect a wallet first.");
    await ensureBoys(me);

    return send(
      await writeContract(wagmiConfig, {
        ...escrow,
        functionName: "takeOffer",
        args: [BigInt(offerId), tokenIds.map(BigInt)],
      }),
    );
  });
}

export function useRepayLoan() {
  const me = useMyAddress();
  return useAction(async (loanId: string, currency: Currency) => {
    if (!me) throw new Error("Connect a wallet first.");

    const due = await readContract(wagmiConfig, {
      ...escrow,
      functionName: "totalDue",
      args: [BigInt(loanId)],
    });

    if (currency === "usdg") await ensureUsdg(me, due);

    return send(
      await writeContract(wagmiConfig, {
        ...escrow,
        functionName: "repay",
        args: [BigInt(loanId)],
        value: currency === "eth" ? due : 0n,
      }),
    );
  });
}

export function useClaimCollateral() {
  return useAction(async (loanId: string) =>
    send(
      await writeContract(wagmiConfig, {
        ...escrow,
        functionName: "claimDefault",
        args: [BigInt(loanId)],
      }),
    ),
  );
}

export function useWithdraw() {
  return useAction(async (currency: Currency) =>
    send(
      await writeContract(wagmiConfig, {
        ...escrow,
        functionName: "withdraw",
        args: [currencyToEnum(currency)],
      }),
    ),
  );
}

/* ── Countdown ───────────────────────────────────────────────────────────*/

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
