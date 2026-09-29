import { useCallback, useEffect, useState } from "react";
import {
  readContract,
  readContracts,
  writeContract,
  waitForTransactionReceipt,
} from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { juiceStakingAbi, juiceTokenAbi } from "@/lib/abis/staking";
import { erc721Abi } from "@/lib/abis/tokens";
import {
  DURATION_TO_ENUM,
  type Address,
  type Rarity,
  type Stake,
  type StakeDuration,
} from "@/types/staking";
import { useMyAddress, useMyBoys } from "@/hooks/useLending";

// Re-exported so a page importing from this hook doesn't also need to know
// staking shares its wallet-Boys scan with the lending feature.
export { useMyAddress, useMyBoys };

const staking = { address: CONTRACTS.juiceStaking, abi: juiceStakingAbi } as const;
const juice = { address: CONTRACTS.juice, abi: juiceTokenAbi } as const;

/* ── Query plumbing — same shape as useLending's, kept local so this hook
   has no dependency beyond wagmi/viem. ────────────────────────────────── */

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

/* ── Reads ───────────────────────────────────────────────────────────────*/

const RARITY_TIERS: Rarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
];

function durationFromEnum(n: number): StakeDuration {
  return (["30", "90", "180", "365"] as const)[n] ?? "30";
}

/** Every $JUICE the connected wallet has claimed out so far. */
export function useJuiceBalance(): Query<bigint> {
  const me = useMyAddress();
  return useQuery(
    async () => readContract(wagmiConfig, { ...juice, functionName: "balanceOf", args: [me as Address] }),
    [me],
    Boolean(me),
  );
}

/** Rarity tier for a set of tokens, read fresh (used by the stake picker). */
export function useTokenRarities(tokenIds: number[]): Query<Record<number, Rarity | null>> {
  return useQuery(
    async () => {
      if (tokenIds.length === 0) return {};

      const rarities = await readContracts(wagmiConfig, {
        allowFailure: true,
        contracts: tokenIds.map((tokenId) => ({
          ...staking,
          functionName: "tokenRarity" as const,
          args: [BigInt(tokenId)] as const,
        })),
      });

      const out: Record<number, Rarity | null> = {};
      tokenIds.forEach((id, i) => {
        const r = rarities[i];
        const value = r.status === "success" ? (r.result as string) : "";
        out[id] = (RARITY_TIERS as string[]).includes(value) ? (value as Rarity) : null;
      });
      return out;
    },
    [tokenIds.join(",")],
    tokenIds.length > 0,
  );
}

/** Every Boy the connected wallet currently has staked, with live rewards. */
export function useMyStakes(): Query<Stake[]> {
  const me = useMyAddress();

  return useQuery(
    async () => {
      if (!me) return [];

      const ids = (await readContract(wagmiConfig, {
        ...staking,
        functionName: "getUserStakes",
        args: [me],
      })) as readonly bigint[];

      if (ids.length === 0) return [];

      const [infos, rarities] = await Promise.all([
        readContracts(wagmiConfig, {
          allowFailure: false,
          contracts: ids.map((id) => ({
            ...staking,
            functionName: "getStake" as const,
            args: [id] as const,
          })),
        }),
        readContracts(wagmiConfig, {
          allowFailure: true,
          contracts: ids.map((id) => ({
            ...staking,
            functionName: "tokenRarity" as const,
            args: [id] as const,
          })),
        }),
      ]);

      type StakeTuple = {
        owner: Address;
        stakedAt: number;
        unlockTime: number;
        duration: number;
        totalReward: bigint;
        claimedReward: bigint;
        isStaked: boolean;
      };

      return ids
        .map((id, i) => {
          const info = infos[i] as unknown as StakeTuple;
          const rarityResult = rarities[i];
          const rarityValue =
            rarityResult.status === "success" ? (rarityResult.result as string) : "";

          return {
            tokenId: Number(id),
            owner: info.owner,
            stakedAt: Number(info.stakedAt),
            unlockTime: Number(info.unlockTime),
            duration: durationFromEnum(info.duration),
            totalReward: info.totalReward,
            claimedReward: info.claimedReward,
            isStaked: info.isStaked,
            rarity: (RARITY_TIERS as string[]).includes(rarityValue)
              ? (rarityValue as Rarity)
              : null,
          };
        })
        .filter((s) => s.isStaked)
        .sort((a, b) => a.stakedAt - b.stakedAt);
    },
    [me],
    Boolean(me),
  );
}

/** Pending, unclaimed rewards for one staked token, refetched on demand. */
export function usePendingRewards(tokenId: number, enabled: boolean): Query<bigint> {
  return useQuery(
    async () =>
      readContract(wagmiConfig, {
        ...staking,
        functionName: "calculateRewards",
        args: [BigInt(tokenId)],
      }),
    [tokenId],
    enabled,
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
  if (/RarityNotSet/.test(raw)) return "That Boy doesn't have a rarity set yet — try again shortly.";
  if (/AlreadyStaked/.test(raw)) return "That Boy is already staked.";
  if (/NotTokenOwner/.test(raw)) return "You don't own that Boy.";
  if (/NotStaked/.test(raw)) return "That Boy isn't staked.";
  if (/NotStakeOwner/.test(raw)) return "That isn't your stake.";
  if (/StillLocked/.test(raw)) return "This one's still locked — use emergency unstake to exit early.";
  if (/InsufficientFee/.test(raw)) return "The staking fee wasn't fully covered.";
  if (/NothingToClaim/.test(raw)) return "Nothing to claim yet.";
  if (/BadBundle/.test(raw)) return "Pick between 1 and 50 Boys.";
  if (/insufficient funds/i.test(raw)) return "Not enough ETH in your wallet for the fee.";

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

const send = (hash: `0x${string}`) => waitForTransactionReceipt(wagmiConfig, { hash });

async function ensureBoysApprovedForStaking(owner: Address) {
  const approved = await readContract(wagmiConfig, {
    address: CONTRACTS.boys,
    abi: erc721Abi,
    functionName: "isApprovedForAll",
    args: [owner, CONTRACTS.juiceStaking],
  });
  if (approved) return;

  await send(
    await writeContract(wagmiConfig, {
      address: CONTRACTS.boys,
      abi: erc721Abi,
      functionName: "setApprovalForAll",
      args: [CONTRACTS.juiceStaking, true],
    }),
  );
}

async function currentStakeFee(): Promise<bigint> {
  return readContract(wagmiConfig, { ...staking, functionName: "stakeFee" });
}

export function useStake() {
  const me = useMyAddress();
  return useAction(async (tokenId: number, duration: StakeDuration) => {
    if (!me) throw new Error("Connect a wallet first.");
    await ensureBoysApprovedForStaking(me);
    const fee = await currentStakeFee();

    return send(
      await writeContract(wagmiConfig, {
        ...staking,
        functionName: "stake",
        args: [BigInt(tokenId), DURATION_TO_ENUM[duration]],
        value: fee,
      }),
    );
  });
}

export function useStakeAll() {
  const me = useMyAddress();
  return useAction(async (tokenIds: number[], duration: StakeDuration) => {
    if (!me) throw new Error("Connect a wallet first.");
    await ensureBoysApprovedForStaking(me);
    const fee = (await currentStakeFee()) * BigInt(tokenIds.length);

    return send(
      await writeContract(wagmiConfig, {
        ...staking,
        functionName: "stakeAll",
        args: [tokenIds.map(BigInt), DURATION_TO_ENUM[duration]],
        value: fee,
      }),
    );
  });
}

export function useUnstake() {
  return useAction(async (tokenId: number) =>
    send(
      await writeContract(wagmiConfig, {
        ...staking,
        functionName: "unstake",
        args: [BigInt(tokenId)],
      }),
    ),
  );
}

export function useEmergencyUnstake() {
  return useAction(async (tokenId: number) => {
    const fee = await readContract(wagmiConfig, {
      ...staking,
      functionName: "emergencyUnstakeFee",
    });

    return send(
      await writeContract(wagmiConfig, {
        ...staking,
        functionName: "emergencyUnstake",
        args: [BigInt(tokenId)],
        value: fee,
      }),
    );
  });
}

export function useClaimRewards() {
  return useAction(async (tokenId: number) =>
    send(
      await writeContract(wagmiConfig, {
        ...staking,
        functionName: "claimRewards",
        args: [BigInt(tokenId)],
      }),
    ),
  );
}

export function useClaimAllRewards() {
  return useAction(async () =>
    send(
      await writeContract(wagmiConfig, { ...staking, functionName: "claimAllRewards" }),
    ),
  );
}
