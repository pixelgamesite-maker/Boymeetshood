/**
 * Shapes returned by BoyMeetsHoodLending v3.
 * Amounts are bigint in the base units of their own currency — 6 decimals for
 * USDG, 18 for ETH — so always format with the loan's currency, never a
 * hardcoded one.
 */

export type Address = `0x${string}`;

/** Matches the contract's Currency enum: 0 = USDG, 1 = ETH. */
export type Currency = "usdg" | "eth";

export const currencyToEnum = (c: Currency): number => (c === "eth" ? 1 : 0);
export const currencyFromEnum = (n: number): Currency =>
  n === 1 ? "eth" : "usdg";

export const CURRENCY_LABEL: Record<Currency, string> = {
  usdg: "USDG",
  eth: "ETH",
};

export const CURRENCY_DECIMALS: Record<Currency, number> = {
  usdg: 6,
  eth: 18,
};

/** Posted by a borrower. Collateral is already escrowed. */
export interface LoanRequest {
  id: string;
  borrower: Address;
  tokenIds: number[];
  principal: bigint;
  /** Interest for the full term, in basis points. 1000 = 10%. */
  interestBps: number;
  durationSecs: number;
  expiresAt: number;
  currency: Currency;
}

/** Posted by a lender. Funds are already escrowed. */
export interface Offer {
  id: string;
  lender: Address;
  principal: bigint;
  interestBps: number;
  durationSecs: number;
  expiresAt: number;
  tokenCount: number;
  currency: Currency;
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
  fee: bigint;
  /** repayAmount + fee. What the borrower actually pays. */
  totalDue: bigint;
  startedAt: number;
  dueAt: number;
  status: LoanStatus;
  currency: Currency;
}

export interface OwnedBoy {
  tokenId: number;
}
