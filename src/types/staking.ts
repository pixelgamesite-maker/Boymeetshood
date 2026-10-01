/**
 * Shapes returned by JuiceStaking. Reward amounts are $JUICE base units
 * (18 decimals) — always format with formatJuice, not a raw bigint.
 *
 * A Boy is locked for a fixed term — 3, 6 or 12 months — chosen at stake
 * time. It earns continuously at a rate snapshotted when staked
 * (baseDailyReward x rarity x duration), and can't be withdrawn until the
 * term ends; rewards can be claimed anytime during the term.
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
 * Lock durations, keyed by month count. The string values map to the
 * contract's Duration enum by index via DURATION_TO_ENUM — order matters.
 */
export type StakeDuration = "3" | "6" | "12";

export const DURATIONS: StakeDuration[] = ["3", "6", "12"];

/** Matches the contract's Duration enum: THREE_MONTHS=0, SIX=1, ONE_YEAR=2. */
export const DURATION_TO_ENUM: Record<StakeDuration, number> = {
  "3": 0,
  "6": 1,
  "12": 2,
};

export const DURATION_LABEL: Record<StakeDuration, string> = {
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

export const DURATION_SECONDS: Record<StakeDuration, number> = {
  "3": 90 * 86_400,
  "6": 180 * 86_400,
  "12": 365 * 86_400,
};

/** Lock-length booster, matching the contract's durationMultiplierBps. */
export const DURATION_BOOSTER: Record<StakeDuration, number> = {
  "3": 1,
  "6": 1.5,
  "12": 2.5,
};

export function durationFromEnum(n: number): StakeDuration {
  return DURATIONS[n] ?? DURATIONS[0];
}

export interface Stake {
  tokenId: number;
  owner: Address;
  stakedAt: number;
  /** When the lock ends and the Boy can be unstaked. */
  unlockTime: number;
  /** Rewards are accrued from this timestamp forward (see calculateRewards). */
  lastClaimAt: number;
  duration: StakeDuration;
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
