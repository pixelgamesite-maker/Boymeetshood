/**
 * Shapes returned by JuiceStaking. Reward amounts are $JUICE base units
 * (18 decimals) — always format with formatJuice, not a raw bigint.
 *
 * A Boy is locked for a fixed term, chosen at stake time from the tiers the
 * contract currently offers (read live via getDurations). It earns
 * continuously at a rate snapshotted when staked
 * (baseDailyReward x rarity x duration), can't be withdrawn until the term
 * ends, and rewards can be claimed anytime during the term.
 */

export type Address = `0x${string}`;

export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary" | "Mythic";

/** Rarity -> booster, matching the contract's rarityMultiplierBps at launch. */
export const RARITY_BOOSTER: Record<Rarity, number> = {
  Common: 1,
  Uncommon: 1.15,
  Rare: 1.35,
  Epic: 1.6,
  Legendary: 2,
  Mythic: 2.5,
};

export const RARITY_ORDER: Rarity[] = [
  "Mythic",
  "Legendary",
  "Epic",
  "Rare",
  "Uncommon",
  "Common",
];

/**
 * A lock tier, read live from the contract: a length in days and its reward
 * multiplier in basis points (10000 = 1x). Tiers are editable on-chain, so
 * the UI never hardcodes them.
 */
export interface DurationTier {
  days: number;
  bps: number;
}

/** bps (10000 = 1x) -> plain multiplier, e.g. 15000 -> 1.5. */
export function boosterFromBps(bps: number): number {
  return bps / 10_000;
}

/** Friendly label for a day-count. Falls back to "<n> days". */
export function durationLabel(days: number): string {
  const map: Record<number, string> = {
    7: "1 week",
    14: "2 weeks",
    30: "1 month",
    60: "2 months",
    90: "3 months",
    180: "6 months",
    270: "9 months",
    365: "12 months",
  };
  return map[days] ?? `${days} days`;
}

export interface Stake {
  tokenId: number;
  owner: Address;
  stakedAt: number;
  /** When the lock ends and the Boy can be unstaked. */
  unlockTime: number;
  /** Rewards are accrued from this timestamp forward (see calculateRewards). */
  lastClaimAt: number;
  /** Lock length in days, as chosen at stake time. */
  durationDays: number;
  /** Snapshotted $JUICE/day for this stake (base x rarity x duration). */
  dailyRate: bigint;
  /** Lifetime total already minted out via claimRewards / unstake. */
  claimedReward: bigint;
  isStaked: boolean;
  rarity: Rarity | null;
}

export interface OwnedBoy {
  tokenId: number;
}
