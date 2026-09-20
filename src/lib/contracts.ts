import type { Address } from "@/types/lending";

/** Every contract address the app touches. Nothing else hardcodes one. */

const UNSET = "0x0000000000000000000000000000000000000000" as const;

export const CONTRACTS = {
  /** The Boys ERC-721. Confirmed: totalSupply() returns 2666. */
  boys: "0xB036c31a01d7D056f70f339a299111775613cbac" as Address,

  /** USDG (Global Dollar) on Robinhood Chain. 6 decimals, issuer Paxos. */
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address,

  /** Receives the protocol fee on every repayment. */
  treasury: "0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2" as Address,

  /** BoyMeetsHoodLending, deployed in block 67935354. */
  escrow: "0x2d8314C63d1151a028fD224bdF88A46369A40b94" as Address,
} as const;

export const isSet = (addr: Address) => addr !== UNSET;

export const READY = {
  boys: isSet(CONTRACTS.boys),
  usdg: isSet(CONTRACTS.usdg),
  lending: isSet(CONTRACTS.escrow),
} as const;
