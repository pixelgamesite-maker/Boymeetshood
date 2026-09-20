import { useState, type ReactNode } from "react";
import { formatUsdgLabel } from "@/lib/format";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import {
  CreateOfferForm,
  CreateRequestForm,
  LoanCard,
  OfferCard,
  RequestCard,
} from "@/components/lending/cards";
import {
  Button,
  EmptyState,
  ErrorState,
  SkeletonRows,
} from "@/components/lending/primitives";
import {
  useCancelOffer,
  useCancelRequest,
  useClaimCollateral,
  useCreateOffer,
  useCreateRequest,
  useFundRequest,
  useMyAddress,
  useMyBoys,
  useMyLoans,
  useOffers,
  useOwed,
  useRepayLoan,
  useRequests,
  useTakeOffer,
  useWithdraw,
} from "@/hooks/useLending";

type Side = "borrow" | "lend";

export default function Market() {
  const [side, setSide] = useState<Side>("borrow");
  const me = useMyAddress();

  return (
    <div style={{ background: "var(--ink)", minHeight: "100vh" }}>
      <SiteHeader />
      <main className="px-5 pb-28 pt-[120px] sm:px-8 sm:pt-[140px]">
        <div className="mx-auto max-w-[900px]">
          <h1
            className="m-0 font-black leading-[1.02]"
            style={{ fontSize: "clamp(2rem, 5vw, 2.9rem)", letterSpacing: "-0.02em" }}
          >
            P2P Lending
          </h1>

          <div
            className="mt-7 inline-flex gap-1 rounded-full p-1"
            style={{ background: "rgba(255,255,255,0.07)" }}
            role="tablist"
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
            {!me ? (
              <EmptyState
                title="Connect your wallet"
                body="You'll need a wallet on Robinhood Chain to borrow against your Boys or lend USDG."
              />
            ) : side === "borrow" ? (
              <BorrowView />
            ) : (
              <LendView />
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Borrow ──────────────────────────────────────────────────────────────*/

function BorrowView() {
  const me = useMyAddress();
  const boys = useMyBoys();
  const requests = useRequests();
  const offers = useOffers();
  const loans = useMyLoans();

  const createRequest = useCreateRequest();
  const cancelRequest = useCancelRequest();
  const takeOffer = useTakeOffer();
  const repay = useRepayLoan();

  const [busyId, setBusyId] = useState<string | null>(null);

  const mine = me?.toLowerCase();
  const myRequests = (requests.data ?? []).filter(
    (r) => r.borrower.toLowerCase() === mine,
  );
  const openOffers = (offers.data ?? []).filter(
    (o) => o.lender.toLowerCase() !== mine,
  );
  const myBorrows = (loans.data ?? []).filter(
    (l) => l.borrower.toLowerCase() === mine,
  );

  function refreshAll() {
    boys.refetch();
    requests.refetch();
    offers.refetch();
    loans.refetch();
  }

  return (
    <div className="flex flex-col gap-12">
      <CreateRequestForm
        boys={boys.data ?? []}
        pending={createRequest.pending}
        error={createRequest.error}
        onSubmit={async (input) => {
          if (await createRequest.run(input)) refreshAll();
        }}
      />

      {myRequests.length > 0 && (
        <Section title="Your open requests" note="Waiting for someone to fund them.">
          <div className="flex flex-col gap-3">
            {myRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                mine
                busy={busyId === request.id}
                onFund={() => {}}
                onCancel={async () => {
                  setBusyId(request.id);
                  const ok = await cancelRequest.run(request.id);
                  setBusyId(null);
                  if (ok) refreshAll();
                }}
              />
            ))}
          </div>
          {cancelRequest.error && (
            <ActionError message={cancelRequest.error} onDismiss={cancelRequest.reset} />
          )}
        </Section>
      )}

      <Section
        title="Offers you can take"
        note="Lenders with USDG already escrowed. Instant, no waiting."
      >
        {offers.loading && !offers.data ? (
          <SkeletonRows count={2} />
        ) : offers.error ? (
          <ErrorState message={offers.error} onRetry={offers.refetch} />
        ) : openOffers.length === 0 ? (
          <EmptyState
            title="No offers right now"
            body="Post a request above instead and let a lender come to you."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {openOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                boys={boys.data ?? []}
                mine={false}
                busy={busyId === offer.id}
                onCancel={() => {}}
                onTake={async (tokenIds) => {
                  setBusyId(offer.id);
                  const ok = await takeOffer.run(offer.id, tokenIds);
                  setBusyId(null);
                  if (ok) refreshAll();
                }}
              />
            ))}
          </div>
        )}
        {takeOffer.error && (
          <ActionError message={takeOffer.error} onDismiss={takeOffer.reset} />
        )}
      </Section>

      <Section title="Your loans">
        {loans.loading && !loans.data ? (
          <SkeletonRows count={2} />
        ) : loans.error ? (
          <ErrorState message={loans.error} onRetry={loans.refetch} />
        ) : myBorrows.length === 0 ? (
          <EmptyState
            title="Nothing borrowed yet"
            body="Post a request or take an offer to unlock USDG against your Boys."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {myBorrows.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                role="borrower"
                busy={busyId === loan.id}
                onClaim={() => {}}
                onRepay={async () => {
                  setBusyId(loan.id);
                  const ok = await repay.run(loan.id);
                  setBusyId(null);
                  if (ok) refreshAll();
                }}
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
  const me = useMyAddress();
  const requests = useRequests();
  const offers = useOffers();
  const loans = useMyLoans();

  const createOffer = useCreateOffer();
  const cancelOffer = useCancelOffer();
  const fundRequest = useFundRequest();
  const claim = useClaimCollateral();

  const [busyId, setBusyId] = useState<string | null>(null);

  const mine = me?.toLowerCase();
  const openRequests = (requests.data ?? []).filter(
    (r) => r.borrower.toLowerCase() !== mine,
  );
  const myOffers = (offers.data ?? []).filter(
    (o) => o.lender.toLowerCase() === mine,
  );
  const funded = (loans.data ?? []).filter((l) => l.lender.toLowerCase() === mine);

  function refreshAll() {
    requests.refetch();
    offers.refetch();
    loans.refetch();
  }

  return (
    <div className="flex flex-col gap-12">
      <ClaimEarnings />

      <Section
        title="Requests you can fund"
        note="Holders who've already put their Boys in escrow."
      >
        {requests.loading && !requests.data ? (
          <SkeletonRows count={2} />
        ) : requests.error ? (
          <ErrorState message={requests.error} onRetry={requests.refetch} />
        ) : openRequests.length === 0 ? (
          <EmptyState
            title="Nobody's asking right now"
            body="Post an offer below and let borrowers come to you instead."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {openRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                mine={false}
                busy={busyId === request.id}
                onCancel={() => {}}
                onFund={async () => {
                  setBusyId(request.id);
                  const ok = await fundRequest.run(request.id, request.principal);
                  setBusyId(null);
                  if (ok) refreshAll();
                }}
              />
            ))}
          </div>
        )}
        {fundRequest.error && (
          <ActionError message={fundRequest.error} onDismiss={fundRequest.reset} />
        )}
      </Section>

      <CreateOfferForm
        pending={createOffer.pending}
        error={createOffer.error}
        onSubmit={async (input) => {
          if (await createOffer.run(input)) refreshAll();
        }}
      />

      {myOffers.length > 0 && (
        <Section title="Your open offers">
          <div className="flex flex-col gap-3">
            {myOffers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                boys={[]}
                mine
                busy={busyId === offer.id}
                onTake={() => {}}
                onCancel={async () => {
                  setBusyId(offer.id);
                  const ok = await cancelOffer.run(offer.id);
                  setBusyId(null);
                  if (ok) refreshAll();
                }}
              />
            ))}
          </div>
          {cancelOffer.error && (
            <ActionError message={cancelOffer.error} onDismiss={cancelOffer.reset} />
          )}
        </Section>
      )}

      <Section title="Loans you funded">
        {loans.loading && !loans.data ? (
          <SkeletonRows count={2} />
        ) : funded.length === 0 ? (
          <EmptyState
            title="No active loans"
            body="Fund a request or wait for someone to take an offer."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {funded.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                role="lender"
                busy={busyId === loan.id}
                onRepay={() => {}}
                onClaim={async () => {
                  setBusyId(loan.id);
                  const ok = await claim.run(loan.id);
                  setBusyId(null);
                  if (ok) refreshAll();
                }}
              />
            ))}
          </div>
        )}
        {claim.error && <ActionError message={claim.error} onDismiss={claim.reset} />}
      </Section>
    </div>
  );
}

/* ── Shared ──────────────────────────────────────────────────────────────*/

/**
 * Repayments credit a balance rather than pushing USDG out, so lenders
 * collect here. That's what stops a frozen address blocking a repayment.
 */
function ClaimEarnings() {
  const owed = useOwed();
  const withdraw = useWithdraw();

  const amount = owed.data ?? 0n;
  if (owed.loading || amount === 0n) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] p-6"
      style={{ background: "var(--ink-2)", border: "1px solid var(--lime)" }}
    >
      <div>
        <p className="m-0 text-[13px]" style={{ color: "var(--fg-faint)" }}>
          Ready to claim
        </p>
        <p
          className="m-0 mt-1 text-[24px] font-extrabold leading-none"
          style={{ fontFamily: "var(--mono)", color: "var(--lime)" }}
        >
          {formatUsdgLabel(amount)}
        </p>
      </div>
      <Button
        onClick={async () => {
          if (await withdraw.run()) owed.refetch();
        }}
        disabled={withdraw.pending}
      >
        {withdraw.pending ? "Claiming…" : "Claim earnings"}
      </Button>
    </div>
  );
}

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
        {message}
      </p>
      <Button variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
