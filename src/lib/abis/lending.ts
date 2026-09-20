/**
 * BoyMeetsHoodLending, deployed at 0x2d8314C6… on Robinhood Chain.
 * Hand-written from the contract source: only what the app calls, so viem can
 * infer argument and return types precisely.
 *
 * Collateral enum: 0 = Any, 1 = Specific
 * Status enum:     0 = None, 1 = Active, 2 = Repaid, 3 = Defaulted
 */
export const lendingAbi = [
  /* ── Reads ────────────────────────────────────────────────────────────── */
  {
    type: "function",
    name: "offers",
    stateMutability: "view",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [
      { name: "lender", type: "address" },
      { name: "principal", type: "uint128" },
      { name: "interestBps", type: "uint16" },
      { name: "duration", type: "uint32" },
      { name: "expiresAt", type: "uint64" },
      { name: "mode", type: "uint8" },
      { name: "tokenId", type: "uint96" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "loans",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [
      { name: "lender", type: "address" },
      { name: "borrower", type: "address" },
      { name: "tokenId", type: "uint96" },
      { name: "principal", type: "uint128" },
      { name: "repayAmount", type: "uint128" },
      { name: "fee", type: "uint128" },
      { name: "startedAt", type: "uint64" },
      { name: "dueAt", type: "uint64" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "activeOffers",
    stateMutability: "view",
    inputs: [
      { name: "cursor", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      { name: "ids", type: "uint256[]" },
      { name: "nextCursor", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "owed",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextOfferId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "nextLoanId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalDue",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "isDefaulted",
    stateMutability: "view",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },

  /* ── Writes ───────────────────────────────────────────────────────────── */
  {
    type: "function",
    name: "createOffer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "principal", type: "uint128" },
      { name: "interestBps", type: "uint16" },
      { name: "duration", type: "uint32" },
      { name: "expiresAt", type: "uint64" },
      { name: "mode", type: "uint8" },
      { name: "tokenId", type: "uint96" },
    ],
    outputs: [{ name: "offerId", type: "uint256" }],
  },
  {
    type: "function",
    name: "cancelOffer",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "takeOffer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "offerId", type: "uint256" },
      { name: "tokenId", type: "uint96" },
    ],
    outputs: [{ name: "loanId", type: "uint256" }],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimDefault",
    stateMutability: "nonpayable",
    inputs: [{ name: "loanId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "amount", type: "uint256" }],
  },

  /* ── Events ───────────────────────────────────────────────────────────── */
  {
    type: "event",
    name: "LoanStarted",
    inputs: [
      { name: "loanId", type: "uint256", indexed: true },
      { name: "offerId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "lender", type: "address", indexed: false },
      { name: "tokenId", type: "uint96", indexed: false },
      { name: "principal", type: "uint128", indexed: false },
      { name: "repayAmount", type: "uint128", indexed: false },
      { name: "fee", type: "uint128", indexed: false },
      { name: "dueAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OfferCreated",
    inputs: [
      { name: "offerId", type: "uint256", indexed: true },
      { name: "lender", type: "address", indexed: true },
      { name: "principal", type: "uint128", indexed: false },
      { name: "interestBps", type: "uint16", indexed: false },
      { name: "duration", type: "uint32", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
      { name: "mode", type: "uint8", indexed: false },
      { name: "tokenId", type: "uint96", indexed: false },
    ],
  },
] as const;
