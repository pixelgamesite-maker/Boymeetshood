/**
 * JuiceStaking + JuiceToken — only the functions the app actually calls.
 * No duration/lock: stake and unstake anytime, rewards accrue continuously.
 */
export const juiceStakingAbi = [
  /* ── Reads ────────────────────────────────────────────────────────────── */
  {
    type: "function",
    name: "getUserStakes",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getStake",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "owner", type: "address" },
          { name: "stakedAt", type: "uint40" },
          { name: "lastClaimAt", type: "uint40" },
          { name: "claimedReward", type: "uint256" },
          { name: "isStaked", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "calculateRewards",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "dailyRewardRate",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "baseDailyReward",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenRarity",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "rarityMultiplierBps",
    stateMutability: "view",
    inputs: [{ name: "rarity", type: "string" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "stakeFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },

  /* ── Writes ───────────────────────────────────────────────────────────── */
  {
    type: "function",
    name: "stake",
    stateMutability: "payable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "stakeAll",
    stateMutability: "payable",
    inputs: [{ name: "tokenIds", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimRewards",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimAllRewards",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

/** $JUICE is a plain ERC-20 — balanceOf is all the staking page needs. */
export const juiceTokenAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;
