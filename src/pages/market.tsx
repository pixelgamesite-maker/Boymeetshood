import { useState, type ReactNode } from "react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { OfferCard } from "@/components/lending/OfferCard";
import { LoanCard } from "@/components/lending/LoanCard";
import { CreateOfferForm } from "@/components/lending/CreateOfferForm";
import {
  Button,
  EmptyState,
  ErrorState,
  SkeletonRows,
} from "@/components/lending/primitives";
import {
  MY_ADDRESS,
  useCancelOffer,
  useClaimCollateral,
  useCreateOffer,
  useMyBoys,
  useMyLoans,
  useOffers,
  useRepayLoan,
  useTakeOffer,
} from "@/hooks/useLending";

type Side = "borrow" | "lend";

export default function Market() {
  const [side, setSide] = useState<Side>("borrow");

  return (
    <div style={{ background: "var(--ink)", minHeight: "100vh" }}>
      <SiteHeader />
      <main className="px-5 pb-28 pt-[120px] sm:px-8 sm:pt-[140px]">
        <div className="mx-auto max-w-[900px]">
          <h1
            className="m-0 font-black leading-[1.02]"
            style={{ fontSize: "clamp(2rem, 5vw, 2.9rem)", letterSpacing: "-0.02em" }}
          >
            Market
          </h1>

          <div
            className="mt-7 inline-flex gap-1 rounded-full p-1"
            style={{ background: "rgba(255,255,255,0.07)" }}
            role="tablist"
            aria-label="Borrow or lend"
          >
            {(["borrow", "lend"] as Side[]).map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={side === s}
                onClick={() => setSide(s)}
                className="rounded-full px-6 py-2.5 text-[14px] font-bold capitalize"
                style={{
                  background: side === s ? "var(--lime)" : "transparent",
                  color: side === s ? "var(--ink)" : "var(--fg-dim)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-10">
            {side === "borrow" ? <BorrowView /> : <LendView />}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Borrow ──────────────────────────────────────────────────────────────*/

function BorrowView() {
  const offers = useOffers();
  const loans = useMyLoans();
  const boys = useMyBoys();

  const take = useTakeOffer();
  const repay = useRepayLoan();

  const [pendingId, setPendingId] = useState<string | null>(null);

  const open = (offers.data ?? []).filter((o) => o.lender !== MY_ADDRESS);
  const myBorrows = (loans.data ?? []).filter((l) => l.borrower === MY_ADDRESS);

  async function handleTake(offerId: string, tokenId: number) {
    setPendingId(offerId);
    await take.run(offerId, tokenId);
    setPendingId(null);
  }

  async function handleRepay(loanId: string) {
    setPendingId(loanId);
    await repay.run(loanId);
    setPendingId(null);
  }

  return (
    <div className="flex flex-col gap-12">
      <Section
        title="Open offers"
        note="Pick one and your Boy goes into escrow the same block."
      >
        {offers.loading && !offers.data ? (
          <SkeletonRows />
        ) : offers.error ? (
          <ErrorState message={offers.error} onRetry={offers.refetch} />
        ) : open.length === 0 ? (
          <EmptyState
            title="No offers on the book"
            body="Nobody is lending right now. Check back, or post your own offer from the lend side."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                boys={boys.data ?? []}
                mine={false}
                busy={pendingId === offer.id}
                onTake={(tokenId) => handleTake(offer.id, tokenId)}
                onCancel={() => {}}
              />
            ))}
          </div>
        )}
        {take.error && <ActionError message={take.error} onDismiss={take.reset} />}
      </Section>

      <Section title="Your loans">
        {loans.loading && !loans.data ? (
          <SkeletonRows count={2} />
        ) : loans.error ? (
          <ErrorState message={loans.error} onRetry={loans.refetch} />
        ) : myBorrows.length === 0 ? (
          <EmptyState
            title="You haven't borrowed yet"
            body="Take an offer above to unlock USDG against a Boy without selling it."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {myBorrows.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                role="borrower"
                busy={pendingId === loan.id}
                onRepay={() => handleRepay(loan.id)}
                onClaim={() => {}}
              />
            ))}
          </div>
        )}
        {repay.error && <ActionError message={repay.error} onDismiss={repay.reset} />}
      </Section>
    </div>
  );
}

/* ── Lend ────────────────────────────────────────────────────────────────*/

function LendView() {
  const offers = useOffers();
  const loans = useMyLoans();

  const create = useCreateOffer();
  const cancel = useCancelOffer();
  const claim = useClaimCollateral();

  const [pendingId, setPendingId] = useState<string | null>(null);

  const myOffers = (offers.data ?? []).filter((o) => o.lender === MY_ADDRESS);
  const funded = (loans.data ?? []).filter((l) => l.lender === MY_ADDRESS);

  async function handleCancel(offerId: string) {
    setPendingId(offerId);
    await cancel.run(offerId);
    setPendingId(null);
  }

  async function handleClaim(loanId: string) {
    setPendingId(loanId);
    await claim.run(loanId);
    setPendingId(null);
  }

  return (
    <div className="flex flex-col gap-12">
      <CreateOfferForm
        onSubmit={(input) => create.run(input)}
        pending={create.pending}
        error={create.error}
      />

      <Section title="Your open offers">
        {offers.loading && !offers.data ? (
          <SkeletonRows count={2} />
        ) : offers.error ? (
          <ErrorState message={offers.error} onRetry={offers.refetch} />
        ) : myOffers.length === 0 ? (
          <EmptyState
            title="Nothing on the book"
            body="Post an offer above and it goes live immediately for any holder to take."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {myOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                boys={[]}
                mine
                busy={pendingId === offer.id}
                onTake={() => {}}
                onCancel={() => handleCancel(offer.id)}
              />
            ))}
          </div>
        )}
        {cancel.error && <ActionError message={cancel.error} onDismiss={cancel.reset} />}
      </Section>

      <Section title="Loans you funded">
        {loans.loading && !loans.data ? (
          <SkeletonRows count={2} />
        ) : loans.error ? (
          <ErrorState message={loans.error} onRetry={loans.refetch} />
        ) : funded.length === 0 ? (
          <EmptyState
            title="No active loans"
            body="Once a holder takes one of your offers, it shows up here with a live countdown."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {funded.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                role="lender"
                busy={pendingId === loan.id}
                onRepay={() => {}}
                onClaim={() => handleClaim(loan.id)}
              />
            ))}
          </div>
        )}
        {claim.error && <ActionError message={claim.error} onDismiss={claim.reset} />}
      </Section>
    </div>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────────*/

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="m-0 text-[20px] font-extrabold">{title}</h2>
        {note && (
          <p className="m-0 mt-1.5 text-[13.5px]" style={{ color: "var(--fg-dim)" }}>
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function ActionError({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-5 py-4"
      style={{ background: "rgba(255,61,113,0.12)" }}
    >
      <p className="m-0 text-[13.5px] font-bold" style={{ color: "var(--punch)" }}>
        {message} Nothing was sent.
      </p>
      <Button variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
