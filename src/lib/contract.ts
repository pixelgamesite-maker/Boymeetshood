import type { Address } from "@/types/lending";

/**
 * Every contract address the app touches. Nothing else hardcodes an address.
 *
 * Status:
 *   BOYS   — supplied by the client, UNCONFIRMED which contract it is
 *   USDG   — not yet supplied
 *   ESCROW — not yet deployed; the lending contract doesn't exist
 */

const UNSET = "0x0000000000000000000000000000000000000000" as const;

export const CONTRACTS = {
  /**
   * ⚠️ Confirm this is the Boys ERC-721 collection and not USDG or something
   * else. If it turns out to be the token, move it to `usdg` below.
   */
  boys: "0xb036c31a01d7d056f70f339a299111775613cbac" as Address,

  /** TODO: USDG (Global Dollar) token on Robinhood Chain. */
  usdg: UNSET as Address,

  /** TODO: the lending escrow contract, once it is written and deployed. */
  escrow: UNSET as Address,
} as const;

export const isSet = (addr: Address) => addr !== UNSET;

/** Which parts of the app can run against the chain right now. */
export const READY = {
  boys: isSet(CONTRACTS.boys),
  usdg: isSet(CONTRACTS.usdg),
  lending: isSet(CONTRACTS.escrow),
} as const;
