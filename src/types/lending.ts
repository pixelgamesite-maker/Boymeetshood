/**
 * The shape of everything the lending protocol returns.
 *
 * This file is the contract between the mock data layer and the real chain
 * calls. Keep it exact: when useOffers() stops reading mock.ts and starts
 * reading the escrow contract, nothing in the UI should need to change.
 *
 * Amounts are bigint in USDG base units, the same way a contract returns them.
 * Never store a display number here — format at the edge, in lib/format.ts.
 */

export type Address = `0x${string}`;

/** What a lender will accept as collateral against their offer. */
export type CollateralSpec =
  | { kind: "any" }
  | { kind: "tokens"; tokenIds: number[] };

export interface Offer {
  id: string;
  lender: Address;
  /** USDG base units the borrower receives. */
  principal: bigint;
  /** Interest for the full term, in basis points. 1000 = 10%. */
  interestBps: number;
  /** Loan length in seconds. */
  durationSecs: number;
  collateral: CollateralSpec;
  /** Unix seconds. */
  createdAt: number;
}

export type LoanStatus = "active" | "repaid" | "defaulted";

export interface Loan {
  id: string;
  offerId: string;
  lender: Address;
  borrower: Address;
  /** The Boy held in escrow. */
  tokenId: number;
  principal: bigint;
  interest: bigint;
  /** principal + interest. What clears the loan. */
  repayAmount: bigint;
  /** Unix seconds. */
  startedAt: number;
  dueAt: number;
  status: LoanStatus;
}

/** A Boy in the connected wallet, and whether it can back a loan right now. */
export interface OwnedBoy {
  tokenId: number;
  /** False while the Boy is already locked in an active loan. */
  available: boolean;
}
