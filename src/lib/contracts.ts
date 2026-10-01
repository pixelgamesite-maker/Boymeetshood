import type { Address } from "@/types/lending";

/** Every contract address the app touches. Nothing else hardcodes one. */

export const CONTRACTS = {
  /** The Boys ERC-721. Confirmed: totalSupply() returns 2666. */
  boys: "0xB036c31a01d7D056f70f339a299111775613cbac" as Address,

  /** USDG (Global Dollar) on Robinhood Chain. 6 decimals, issuer Paxos. */
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address,

  /** Receives the protocol fee on every repayment. */
  treasury: "0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2" as Address,

  /** BoyMeetsHoodLending v3, deployed in block 68280723. */
  escrow: "0x912de88eAb23c048E43d112396211a007D047d65" as Address,

  /** $JUICE ERC-20 (editable-durations staking). */
  juice: "0x02C0B72779234E7a8666190917D3327f1554dED6" as Address,
  /** JuiceStaking with editable lock tiers (30/90/180/365d seeded). */
  juiceStaking: "0xF5039f5C62B9434dFE5FeE4FACb2bf4b59b6b567" as Address,
} as const;

/** Largest bundle the contract accepts. Mirrors MAX_BUNDLE. */
export const MAX_BUNDLE = 20;
