# BoyMeetsH00d

**NFT-Collateralized Lending & Borrowing Platform**
Platform Specification & Functional Overview — v1.0 (Single Collection)

## 1. Executive Summary

BoyMeetsH00d is a peer-to-peer NFT-collateralized lending platform. It allows holders of a specific NFT collection to unlock liquidity from their NFTs without selling them, by using the NFTs as collateral for a short-term, interest-bearing loan funded by another user (the lender). At the end of the agreed loan term, the borrower repays the loan plus interest and a platform fee (if included) to reclaim their NFT(s). If the loan is not repaid, ownership of the collateral transfers to the lender.

Version 1 is scoped to a single, specific NFT collection. Once validated, the same contract architecture is designed to extend to additional collections in a future phase.

## 2. Core Concept

The platform solves a simple problem for NFT holders: their NFT may be worth more than they need to sell it for, but they still want access to cash without giving up ownership. BoyMeetsH00d lets them borrow against it instead.

| Role | What they do |
|---|---|
| **Borrower** | Owns NFT(s) in the collection. Lists them as collateral, requests a loan amount, sets (or negotiates) the term and interest rate. |
| **Lender** | Browses open listings, funds a loan in USDG, and earns interest when the borrower repays. |
| **Platform** | Escrows the NFT(s) for the duration of the loan, enforces repayment terms and default handling on-chain, and collects a small fee (if included) per transaction. |

## 3. How a Loan Works: Step by Step

1. Borrower selects one or more NFTs from the collection they hold, and creates a loan listing: requested loan amount (in USDG), loan duration, and either a fixed interest rate or an "open to offers" flag.
2. Borrower chooses if the listing is for a single NFT or a bundle (multiple NFTs grouped together as collateral for one loan).
3. Listing appears on the marketplace for lenders to review.
4. A lender either accepts the listing as-is, or submits a counter-offer (different amount, rate, and/or duration).
5. Once terms are agreed, the lender's USDG is sent to the borrower and the NFT(s) are locked in the platform's smart contract for the duration of the loan. The borrower retains no access to the NFT(s) while the loan is active.
6. Before the term ends, the borrower repays the loan principal plus interest plus the platform fee (if included), in USDG.
7. On confirmed repayment, the smart contract automatically releases the NFT(s) back to the borrower's wallet.
8. If the borrower does not repay by the deadline, the contract transfers the NFT(s) directly to the lender. No auction, the lender simply becomes the new owner.

> **Worked example from the initial brief:** a borrower holds 10 NFTs from the collection (floor price roughly $5 each). They list all 10 as one bundle, requesting a $40 loan over a 7-day term. A lender accepts and sends $40 USDG. By day 7 the borrower repays $40 + 10% interest to reclaim all 10 NFTs. If they miss the deadline, the lender receives all 10 NFTs.

## 4. Listing & Negotiation Model

### 4.1 Individual vs. Bundle Listings

Borrowers choose, per listing, if to:

- List a single NFT as collateral for its own loan, or
- Bundle multiple NFTs together as one combined collateral package backing a single loan.

A bundled loan is all-or-nothing: repayment releases every NFT in the bundle; default transfers every NFT in the bundle to the lender.

### 4.2 Loan Terms

| Term | Set by | Notes |
|---|---|---|
| Loan amount (USDG) | Borrower | The amount requested against the listed collateral. |
| Duration | Borrower | e.g. 7 days, as in the worked example above. |
| Interest rate | Borrower, fixed or negotiable | Borrower can set a fixed rate, or mark the listing open to lender counter-offers. |

### 4.3 Offer & Counter-Offer Flow

Because interest and amount can be negotiable, the platform will be built to support a lightweight offer system rather than a simple fixed-price listing:

- Lender can accept a listing exactly as posted, or
- Lender can submit a counter-offer with a different amount, rate, or duration.
- Borrower can accept, reject, or counter back.
- A loan only becomes active once both sides agree on final terms.

## 5. Repayment & Default Handling

### 5.1 Repayment

- Repayment = principal + interest + platform fee, paid in USDG before the deadline.
- On successful repayment, the smart contract releases the collateral NFT(s) back to the borrower automatically with no manual approval needed from the lender.

### 5.2 Default

- If the deadline passes without full repayment, the collateral NFT(s) are transferred directly to the lender by the contract.
- There is no auction step, the lender receives the NFT(s) themselves, consistent with how peer-to-peer NFT collateral loans typically work.

### 5.3 Loan Extension (open decision: see Section 8)

The brief raised the option for a borrower to pay a small additional fee to extend the loan term instead of repaying or defaulting. The mechanics of this (see Section 8) still need to be defined if its something that should be added, but might be a gppd feature, since they materially affect lender risk.

## 6. Platform Economics

| Fee | Paid by | When |
|---|---|---|
| Interest | Borrower → Lender | On repayment |
| Platform fee | Borrower (in the worked example) | On repayment, alongside principal + interest |

> if the platform also takes a fee on the lender's side, or only on repayment vs. also on funding, is worth confirming explicitly before i will start building the platform, as part of finalizing the fee model.

## 7. Technical Architecture

### 7.1 Chain & Currency

- **Network:** Robinhood Chain.
- **Settlement currency:** USDG (Global Dollar) Chosen specifically to avoid the price volatility of using a chain's native gas/asset token as the loan currency.
- **Smart contracts:** written in Solidity, standard Ethereum tooling (Hardhat/Foundry) and good security measures will be put in place to combat bad actors.

### 7.2 Core Contract Components

| Component | Responsibility |
|---|---|
| Listing Registry | Stores active loan listings: collateral NFT(s), requested amount, duration, rate/negotiation status. |
| Offer/Negotiation Module | Handles lender counter-offers and borrower accept/reject/counter responses. |
| Escrow Vault | Holds the NFT(s) in custody for the duration of an active loan. |
| Loan Manager | Tracks active loan terms, deadlines, and triggers repayment or default outcomes. |
| Repayment Handler | Verifies USDG repayment amount, releases collateral, distributes interest and platform fee. |
| Default Handler | Transfers collateral to the lender if the deadline passes unpaid. |

## 8. Open Decisions Needed From Client

The following points are not yet finalized and directly affect contract design. We'd like the client's input before development begins:

1. **Loan extension mechanics** : if i am to add an extension mechanism, does the lender have any approval right over an extension, or is it automatic once the borrower pays the extension fee? and Is there a cap on how many times a loan can be extended?
2. **Bundle default value** : in the worked example, a $40 loan is backed by 10 NFTs worth roughly $50 at floor. On default, the lender receives all 10. Is this outcome intentional, or should partial-release logic be considered for bundles?
3. **Interest rate policy** : should v1 launch with a platform-wide fixed rate, fully borrower-set rates, or fully negotiable rates from day one?
4. **Fee structure** : i will also need you to confirm if a platform fee should be applied or it should be a free market.

## 9. Phased Roadmap

| Phase | Scope |
|---|---|
| **Phase 1 (this spec)** | Single collection only. Individual and bundle listings, negotiated or fixed terms, repayment and default handling, USDG on Robinhood Chain. |

if there is a need for an expansion later on:

| **Phase 2** | Open the platform to additional NFT collections; introduce collection-level risk parameters (e.g. floor-price-aware limits) as the pool of supported collections grows. |
| **Phase 3** | Potential additions depending on adoption: refinancing/extension automation, secondary market for active loan positions, lender analytics dashboard. |

## 10. Next Steps

- i will need you to review and confirm the open decisions in Section 8.
- upon clarification, worked will be commenced and platform will built and delivered withing 3-4 days.
