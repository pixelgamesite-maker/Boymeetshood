/**
 * Shapes returned by BoyMeetsHoodLending v2.
 * Amounts are bigint in USDG base units, as the contract returns them.
 */

export type Address = `0x${string}`;

/** Posted by a borrower. Collateral is already escrowed. */
export interface LoanRequest {
  id: string;
  borrower: Address;
  tokenIds: number[];
  /** USDG the borrower wants. */
  principal: bigint;
  /** Interest for the full term, in basis points. 1000 = 10%. */
  interestBps: number;
  durationSecs: number;
  /** Unix seconds, 0 = never expires. */
  expiresAt: number;
}

/** Posted by a lender. USDG is already escrowed. */
export interface Offer {
  id: string;
  lender: Address;
  principal: bigint;
  interestBps: number;
  durationSecs: number;
  expiresAt: number;
  /** How many Boys the borrower must pledge. */
  tokenCount: number;
}

export type LoanStatus = "active" | "repaid" | "defaulted";

export interface Loan {
  id: string;
  lender: Address;
  borrower: Address;
  tokenIds: number[];
  principal: bigint;
  /** principal + interest, owed to the lender. */
  repayAmount: bigint;
  /** Protocol fee, owed to the treasury. */
  fee: bigint;
  /** repayAmount + fee. What the borrower actually pays. */
  totalDue: bigint;
  startedAt: number;
  dueAt: number;
  status: LoanStatus;
}

/** A Boy in the connected wallet. */
export interface OwnedBoy {
  tokenId: number;
}
