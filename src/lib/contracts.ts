import type { Address } from "@/types/lending";

/** Every contract address the app touches. Nothing else hardcodes one. */

export const CONTRACTS = {
  /** The Boys ERC-721. Confirmed: totalSupply() returns 2666. */
  boys: "0xB036c31a01d7D056f70f339a299111775613cbac" as Address,

  /** USDG (Global Dollar) on Robinhood Chain. 6 decimals, issuer Paxos. */
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address,

  /** Receives the protocol fee on every repayment. */
  treasury: "0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2" as Address,

  /** BoyMeetsHoodLending v2, deployed in block 68208840. */
  escrow: "0x5be2edeeb3d76f1214De7ee35c52d3B9bD5f6762" as Address,
} as const;

/** Largest bundle the contract accepts. Mirrors MAX_BUNDLE. */
export const MAX_BUNDLE = 20;
