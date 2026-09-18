import type {
  Address,
  CollateralSpec,
  Loan,
  Offer,
  OwnedBoy,
} from "@/types/lending";
import { interestOn } from "@/lib/format";

/**
 * A fake protocol that behaves like the real one: latency, failures you can
 * trigger, and state that actually changes when you act on it.
 *
 * Delete this file once the escrow contract is deployed. Nothing outside
 * hooks/ should import it.
 */

/** Pretend this wallet is connected. Swap for useAccount() later. */
export const MOCK_ME: Address = "0x8Fc4b21A07e0B4A9C1d6e5Fa3B2c7D8E9f0A1b2C";

const DAY = 86_400;
const now = () => Math.floor(Date.now() / 1000);
const usdg = (whole: number) => BigInt(whole) * 1_000_000n;

let offers: Offer[] = [
  {
    id: "offer-01",
    lender: "0x3aB5C7d9E1f2A4b6C8d0E2f4A6b8C0d2E4f6A8b0",
    principal: usdg(400),
    interestBps: 1000,
    durationSecs: 7 * DAY,
    collateral: { kind: "any" },
    createdAt: now() - 3 * 3600,
  },
  {
    id: "offer-02",
    lender: "0x9dE1f3A5b7C9d1E3f5A7b9C1d3E5f7A9b1C3d5E7",
    principal: usdg(250),
    interestBps: 600,
    durationSecs: 3 * DAY,
    collateral: { kind: "any" },
    createdAt: now() - 9 * 3600,
  },
  {
    id: "offer-03",
    lender: "0x5f7A9b1C3d5E7f9A1b3C5d7E9f1A3b5C7d9E1f3A",
    principal: usdg(1200),
    interestBps: 1450,
    durationSecs: 14 * DAY,
    collateral: { kind: "tokens", tokenIds: [88, 512, 1204] },
    createdAt: now() - 26 * 3600,
  },
  {
    id: "offer-04",
    lender: MOCK_ME,
    principal: usdg(150),
    interestBps: 450,
    durationSecs: 2 * DAY,
    collateral: { kind: "any" },
    createdAt: now() - 40 * 3600,
  },
  {
    id: "offer-05",
    lender: "0x1b3C5d7E9f1A3b5C7d9E1f3A5b7C9d1E3f5A7b9C",
    principal: usdg(800),
    interestBps: 1150,
    durationSecs: 10 * DAY,
    collateral: { kind: "any" },
    createdAt: now() - 52 * 3600,
  },
];

let loans: Loan[] = [
  {
    id: "loan-01",
    offerId: "offer-99",
    lender: "0x7d9E1f3A5b7C9d1E3f5A7b9C1d3E5f7A9b1C3d5E",
    borrower: MOCK_ME,
    tokenId: 1204,
    principal: usdg(300),
    interest: usdg(30),
    repayAmount: usdg(330),
    startedAt: now() - 6 * DAY,
    dueAt: now() + 18 * 3600, // due tomorrow — exercises the urgent state
    status: "active",
  },
  {
    id: "loan-02",
    offerId: "offer-98",
    lender: MOCK_ME,
    borrower: "0x2c4E6f8A0b2C4d6E8f0A2b4C6d8E0f2A4b6C8d0E",
    tokenId: 733,
    principal: usdg(500),
    interest: usdg(55),
    repayAmount: usdg(555),
    startedAt: now() - 9 * DAY,
    dueAt: now() - 2 * 3600, // already overdue — exercises the claim state
    status: "active",
  },
  {
    id: "loan-03",
    offerId: "offer-97",
    lender: MOCK_ME,
    borrower: "0x6d8E0f2A4b6C8d0E2f4A6b8C0d2E4f6A8b0C2d4E",
    tokenId: 2401,
    principal: usdg(220),
    interest: usdg(13),
    repayAmount: usdg(233),
    startedAt: now() - 20 * DAY,
    dueAt: now() - 13 * DAY,
    status: "repaid",
  },
];

const wallet: OwnedBoy[] = [
  { tokenId: 1204, available: false }, // locked in loan-01
  { tokenId: 88, available: true },
  { tokenId: 1976, available: true },
  { tokenId: 2310, available: true },
];

/* ── Subscriptions ───────────────────────────────────────────────────────*/

const listeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn();
}

/* ── Reads ───────────────────────────────────────────────────────────────*/

const latency = () => 260 + Math.random() * 320;

function settle<T>(value: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (FAIL_NEXT.read) {
        FAIL_NEXT.read = false;
        reject(new Error("Could not reach the network."));
        return;
      }
      resolve(value());
    }, latency());
  });
}

/** Flip these in the console to exercise error states. */
export const FAIL_NEXT = { read: false, write: false };

export function fetchOffers(): Promise<Offer[]> {
  return settle(() => [...offers].sort((a, b) => b.createdAt - a.createdAt));
}

export function fetchLoans(): Promise<Loan[]> {
  return settle(() => [...loans].sort((a, b) => b.startedAt - a.startedAt));
}

export function fetchWallet(): Promise<OwnedBoy[]> {
  return settle(() => wallet.map((b) => ({ ...b })));
}

/* ── Writes ──────────────────────────────────────────────────────────────*/

function write<T>(mutate: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (FAIL_NEXT.write) {
        FAIL_NEXT.write = false;
        reject(new Error("Transaction rejected."));
        return;
      }
      const result = mutate();
      emit();
      resolve(result);
    }, latency() + 400);
  });
}

/** Borrower takes a live offer. Boy goes to escrow, USDG goes to borrower. */
export function takeOffer(offerId: string, tokenId: number): Promise<Loan> {
  return write(() => {
    const offer = offers.find((o) => o.id === offerId);
    if (!offer) throw new Error("That offer is gone.");

    const boy = wallet.find((b) => b.tokenId === tokenId);
    if (!boy || !boy.available) throw new Error("That Boy can't be used right now.");

    const interest = interestOn(offer.principal, offer.interestBps);
    const loan: Loan = {
      id: `loan-${Math.random().toString(36).slice(2, 8)}`,
      offerId: offer.id,
      lender: offer.lender,
      borrower: MOCK_ME,
      tokenId,
      principal: offer.principal,
      interest,
      repayAmount: offer.principal + interest,
      startedAt: now(),
      dueAt: now() + offer.durationSecs,
      status: "active",
    };

    offers = offers.filter((o) => o.id !== offerId);
    boy.available = false;
    loans = [loan, ...loans];
    return loan;
  });
}

/** Borrower repays in full. Escrow releases the Boy. */
export function repayLoan(loanId: string): Promise<void> {
  return write(() => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) throw new Error("That loan no longer exists.");
    if (loan.status !== "active") throw new Error("That loan is already closed.");
    if (now() > loan.dueAt) throw new Error("Past the deadline. This loan defaulted.");

    loan.status = "repaid";
    const boy = wallet.find((b) => b.tokenId === loan.tokenId);
    if (boy) boy.available = true;
  });
}

/** Lender claims collateral on a loan that blew its deadline. */
export function claimCollateral(loanId: string): Promise<void> {
  return write(() => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) throw new Error("That loan no longer exists.");
    if (loan.status !== "active") throw new Error("That loan is already closed.");
    if (now() <= loan.dueAt) throw new Error("Not past the deadline yet.");

    loan.status = "defaulted";
  });
}

export function createOffer(input: {
  principal: bigint;
  interestBps: number;
  durationSecs: number;
  collateral: CollateralSpec;
}): Promise<Offer> {
  return write(() => {
    const offer: Offer = {
      id: `offer-${Math.random().toString(36).slice(2, 8)}`,
      lender: MOCK_ME,
      createdAt: now(),
      ...input,
    };
    offers = [offer, ...offers];
    return offer;
  });
}

export function cancelOffer(offerId: string): Promise<void> {
  return write(() => {
    const offer = offers.find((o) => o.id === offerId);
    if (!offer) throw new Error("That offer is already gone.");
    if (offer.lender !== MOCK_ME) throw new Error("That isn't your offer.");
    offers = offers.filter((o) => o.id !== offerId);
  });
}
