import type { Address } from "@/types/lending";

/**
 * Every contract address the app touches. Nothing else hardcodes an address.
 */

const UNSET = "0x0000000000000000000000000000000000000000" as const;

export const CONTRACTS = {
  /**
   * The Boys ERC-721 collection.
   * ⚠️ Still unconfirmed that this is the collection and not another contract.
   * Check it on the explorer before wiring reads against it.
   */
  boys: "0xb036c31a01d7d056f70f339a299111775613cbac" as Address,

  /** USDG (Global Dollar) on Robinhood Chain. 6 decimals, issuer Paxos. */
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as Address,

  /** Receives the protocol fee on every repayment. */
  treasury: "0x05a04a21A20905cF37AE46fBc2a83A3774dbffD2" as Address,

  /** TODO: the lending escrow contract, once deployed. */
  escrow: UNSET as Address,
} as const;

export const isSet = (addr: Address) => addr !== UNSET;

/** Which parts of the app can run against the chain right now. */
export const READY = {
  boys: isSet(CONTRACTS.boys),
  usdg: isSet(CONTRACTS.usdg),
  lending: isSet(CONTRACTS.escrow),
} as const;

/**
 * Constructor arguments for BoyMeetsHoodLending, in order. Kept here so the
 * deployed contract and the frontend can't drift apart.
 *
 *   _collection  CONTRACTS.boys
 *   _currency    CONTRACTS.usdg
 *   _treasury    CONTRACTS.treasury
 *   _feeBps      see below
 *   _owner       your deployer address
 */
export const DEPLOY = {
  /** Protocol fee on repayment, in basis points. 0 = free market. Max 500. */
  feeBps: 0,
} as const;
