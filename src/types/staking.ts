/**
 * Shapes returned by JuiceStaking. Reward amounts are $JUICE base units
 * (18 decimals) — always format with formatJuice, not a raw bigint.
 *
 * No duration/lock: a Boy earns continuously from the moment it's staked
 * until it's claimed or unstaked (which can happen anytime), at
 * `baseDailyReward * rarityMultiplier`.
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

export interface Stake {
  tokenId: number;
  owner: Address;
  stakedAt: number;
  /** Rewards are accrued from this timestamp forward (see calculateRewards). */
  lastClaimAt: number;
  /** Lifetime total already minted out via claimRewards / unstake. */
  claimedReward: bigint;
  isStaked: boolean;
  rarity: Rarity | null;
  /** Live $JUICE/day this stake currently earns (baseDailyReward x rarity). */
  dailyRate: bigint;
}

export interface OwnedBoy {
  tokenId: number;
}
