import { useState, type CSSProperties, type ReactNode } from "react";
import {
  CURRENCY_LABEL,
  type Currency,
  type Loan,
  type LoanRequest,
  type Offer,
  type OwnedBoy,
} from "@/types/lending";
import { MAX_BUNDLE } from "@/lib/contracts";
import {
  formatAmount,
  formatDuration,
  formatInterest,
  interestOn,
  parseAmount,
  shortAddress,
  timeLeft,
} from "@/lib/format";
import { useNow } from "@/hooks/useLending";
import { BoyCard, Button, Panel, Pill, Stat } from "@/components/lending/primitives";

/* ── Shared controls ─────────────────────────────────────────────────────*/

function CurrencyToggle({
  value,
  onChange,
}: {
  value: Currency;
  onChange: (c: Currency) => void;
}) {
  return (
    <div
      className="inline-flex gap-1 rounded-full p-1"
      style={{ background: "rgba(255,255,255,0.07)" }}
      role="tablist"
      aria-label="Currency"
    >
      {(["usdg", "eth"] as Currency[]).map((c) => (
        <button
          key={c}
          type="button"
          role="tab"
          aria-selected={value === c}
          onClick={() => onChange(c)}
          className="rounded-full px-5 py-2 text-[13px] font-bold"
          style={{
            background: value === c ? "var(--lime)" : "transparent",
            color: value === c ? "var(--ink)" : "var(--fg-dim)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {CURRENCY_LABEL[c]}
        </button>
      ))}
    </div>
  );
}

function BoyPicker({
  boys,
  selected,
  onToggle,
  max,
}: {
  boys: OwnedBoy[];
  selected: number[];
  onToggle: (tokenId: number) => void;
  max: number;
}) {
  if (boys.length === 0) {
    return (
      <p className="m-0 text-[13.5px]" style={{ color: "var(--fg-dim)" }}>
        No Boys in this wallet. You need at least one to borrow against.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {boys.map((boy) => {
        const active = selected.includes(boy.tokenId);
        return (
          <BoyCard
            key={boy.tokenId}
            tokenId={boy.tokenId}
            selected={active}
            disabled={selected.length >= max && !active}
            onToggle={() => onToggle(boy.tokenId)}
          />
        );
      })}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--hairline)",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "16px",
  fontFamily: "var(--mono)",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  suffix,
  children,
}: {
  label: string;
  suffix?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2.5 flex items-center justify-between text-[12.5px] font-semibold">
        <span style={{ color: "var(--fg-dim)" }}>{label}</span>
        {suffix && (
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}>
            {suffix}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const DURATIONS: [string, number][] = [
  ["1 day", 86_400],
  ["3 days", 259_200],
  ["7 days", 604_800],
  ["14 days", 1_209_600],
  ["30 days", 2_592_000],
];

function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (secs: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DURATIONS.map(([label, secs]) => (
        <button
          key={secs}
          type="button"
          onClick={() => onChange(secs)}
          aria-pressed={value === secs}
          className="rounded-full px-4 py-2 text-[13px] font-bold"
          style={{
            background: value === secs ? "var(--lime)" : "rgba(255,255,255,0.06)",
            color: value === secs ? "var(--ink)" : "var(--fg-dim)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Shown with any amount in a currency, so nobody mistakes one for the other. */
function CurrencyBadge({ currency }: { currency: Currency }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
      style={{
        fontFamily: "var(--mono)",
        background: currency === "eth" ? "var(--sky)" : "var(--lime)",
        color: "var(--ink)",
      }}
    >
      {CURRENCY_LABEL[currency]}
    </span>
  );
}

/* ── Borrower: post a request ────────────────────────────────────────────*/

export function CreateRequestForm({
  boys,
  onSubmit,
  pending,
  error,
}: {
  boys: OwnedBoy[];
  onSubmit: (input: {
    tokenIds: number[];
    principal: bigint;
    interestBps: number;
    durationSecs: number;
    currency: Currency;
  }) => void;
  pending: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [currency, setCurrency] = useState<Currency>("usdg");
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("10");
  const [duration, setDuration] = useState(604_800);

  const principal = parseAmount(amount, currency);
  const interestNum = Number(interest);
  const interestBps = Math.round(interestNum * 100);

  const valid =
    selected.length > 0 &&
    principal !== null &&
    principal > 0n &&
    Number.isFinite(interestNum) &&
    interestNum >= 0 &&
    interestNum <= 100;

  const repay =
    principal && principal > 0n ? principal + interestOn(principal, interestBps) : null;

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[17px] font-extrabold">Borrow against your Boys</p>
          <p
            className="m-0 mt-1.5 max-w-[58ch] text-[13.5px] leading-relaxed"
            style={{ color: "var(--fg-dim)" }}
          >
            Pick what you'll pledge, name your price, post it. You need no
            capital to do this, only gas. Your Boys sit in escrow until someone
            funds you, or until you cancel.
          </p>
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <div className="mt-6">
        <p className="m-0 mb-3 text-[12.5px] font-semibold" style={{ color: "var(--fg-dim)" }}>
          Collateral {selected.length > 0 && `· ${selected.length} selected`}
        </p>
        <BoyPicker
          boys={boys}
          selected={selected}
          max={MAX_BUNDLE}
          onToggle={(id) =>
            setSelected((s) => (s.includes(id) ? s.filter((t) => t !== id) : [...s, id]))
          }
        />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Amount you want" suffix={CURRENCY_LABEL[currency]}>
          <input
            inputMode="decimal"
            value={amount}
            placeholder={currency === "eth" ? "0.1" : "25"}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Interest you'll pay" suffix="%">
          <input
            inputMode="decimal"
            value={interest}
            placeholder="10"
            onChange={(e) => setInterest(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="mt-5">
        <p className="m-0 mb-2.5 text-[12.5px] font-semibold" style={{ color: "var(--fg-dim)" }}>
          Term
        </p>
        <DurationPicker value={duration} onChange={setDuration} />
      </div>

      {repay !== null && selected.length > 0 && (
        <p
          className="m-0 mt-5 text-[13px] leading-relaxed"
          style={{ color: "var(--fg-dim)", fontFamily: "var(--mono)" }}
        >
          You repay {formatAmount(repay, currency)} {CURRENCY_LABEL[currency]} within{" "}
          {formatDuration(duration)} or {selected.length}{" "}
          {selected.length === 1 ? "Boy goes" : "Boys go"} to your lender.
        </p>
      )}

      {error && (
        <p className="m-0 mt-4 text-[13.5px] font-bold" style={{ color: "var(--punch)" }}>
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button
          onClick={() =>
            valid &&
            principal &&
            onSubmit({
              tokenIds: selected,
              principal,
              interestBps,
              durationSecs: duration,
              currency,
            })
          }
          disabled={!valid || pending}
        >
          {pending
            ? "Posting…"
            : selected.length === 0
              ? "Pick your collateral"
              : "Post request"}
        </Button>
      </div>
    </Panel>
  );
}

/* ── Lender: post an offer ───────────────────────────────────────────────*/

export function CreateOfferForm({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (input: {
    principal: bigint;
    interestBps: number;
    durationSecs: number;
    tokenCount: number;
    currency: Currency;
  }) => void;
  pending: boolean;
  error: string | null;
}) {
  const [currency, setCurrency] = useState<Currency>("usdg");
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("10");
  const [duration, setDuration] = useState(604_800);
  const [tokenCount, setTokenCount] = useState("1");

  const principal = parseAmount(amount, currency);
  const interestNum = Number(interest);
  const count = Number(tokenCount);
  const interestBps = Math.round(interestNum * 100);

  const valid =
    principal !== null &&
    principal > 0n &&
    Number.isFinite(interestNum) &&
    interestNum >= 0 &&
    interestNum <= 100 &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= MAX_BUNDLE;

  const repay =
    principal && principal > 0n ? principal + interestOn(principal, interestBps) : null;

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[17px] font-extrabold">Offer to lend</p>
          <p
            className="m-0 mt-1.5 max-w-[58ch] text-[13.5px] leading-relaxed"
            style={{ color: "var(--fg-dim)" }}
          >
            Your funds are escrowed now, so the offer is always good for its
            full amount. Any holder can take it with Boys of their choosing.
          </p>
        </div>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Amount to lend" suffix={CURRENCY_LABEL[currency]}>
          <input
            inputMode="decimal"
            value={amount}
            placeholder={currency === "eth" ? "0.1" : "25"}
            onChange={(e) => setAmount(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Interest you earn" suffix="%">
          <input
            inputMode="decimal"
            value={interest}
            placeholder="10"
            onChange={(e) => setInterest(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Boys required" suffix={`1–${MAX_BUNDLE}`}>
          <input
            inputMode="numeric"
            value={tokenCount}
            onChange={(e) => setTokenCount(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="mt-5">
        <p className="m-0 mb-2.5 text-[12.5px] font-semibold" style={{ color: "var(--fg-dim)" }}>
          Term
        </p>
        <DurationPicker value={duration} onChange={setDuration} />
      </div>

      {repay !== null && (
        <p
          className="m-0 mt-5 text-[13px]"
          style={{ color: "var(--fg-dim)", fontFamily: "var(--mono)" }}
        >
          Borrower repays {formatAmount(repay, currency)} {CURRENCY_LABEL[currency]},
          or you keep the {count === 1 ? "Boy" : "Boys"}.
        </p>
      )}

      {error && (
        <p className="m-0 mt-4 text-[13.5px] font-bold" style={{ color: "var(--punch)" }}>
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button
          onClick={() =>
            valid &&
            principal &&
            onSubmit({
              principal,
              interestBps,
              durationSecs: duration,
              tokenCount: count,
              currency,
            })
          }
          disabled={!valid || pending}
        >
          {pending ? "Posting…" : "Post offer"}
        </Button>
      </div>
    </Panel>
  );
}

/* ── Token strip ─────────────────────────────────────────────────────────*/

function TokenStrip({ tokenIds }: { tokenIds: number[] }) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
      {tokenIds.map((tokenId) => (
        <BoyCard key={tokenId} tokenId={tokenId} />
      ))}
    </div>
  );
}

/* ── A request on the book ───────────────────────────────────────────────*/

export function RequestCard({
  request,
  mine,
  busy,
  onFund,
  onCancel,
}: {
  request: LoanRequest;
  mine: boolean;
  busy: boolean;
  onFund: () => void;
  onCancel: () => void;
}) {
  const repay = request.principal + interestOn(request.principal, request.interestBps);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p
              className="m-0 text-[24px] font-extrabold leading-none"
              style={{ fontFamily: "var(--mono)" }}
            >
              {formatAmount(request.principal, request.currency)}
            </p>
            <CurrencyBadge currency={request.currency} />
            {mine && <Pill tone="sky">Yours</Pill>}
          </div>
          <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
            from {shortAddress(request.borrower)}
          </p>
        </div>

        {mine ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel"}
          </Button>
        ) : (
          <Button onClick={onFund} disabled={busy}>
            {busy ? "Funding…" : "Fund this"}
          </Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Interest" value={formatInterest(request.interestBps)} tone="lime" />
        <Stat label="Term" value={formatDuration(request.durationSecs)} />
        <Stat label="They repay" value={formatAmount(repay, request.currency)} />
        <Stat
          label="Collateral"
          value={`${request.tokenIds.length} ${request.tokenIds.length === 1 ? "Boy" : "Boys"}`}
        />
      </div>

      <TokenStrip tokenIds={request.tokenIds} />
    </Panel>
  );
}

/* ── An offer on the book ────────────────────────────────────────────────*/

export function OfferCard({
  offer,
  boys,
  mine,
  busy,
  onTake,
  onCancel,
}: {
  offer: Offer;
  boys: OwnedBoy[];
  mine: boolean;
  busy: boolean;
  onTake: (tokenIds: number[]) => void;
  onCancel: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const repay = offer.principal + interestOn(offer.principal, offer.interestBps);
  const enough = boys.length >= offer.tokenCount;
  const ready = selected.length === offer.tokenCount;

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p
              className="m-0 text-[24px] font-extrabold leading-none"
              style={{ fontFamily: "var(--mono)" }}
            >
              {formatAmount(offer.principal, offer.currency)}
            </p>
            <CurrencyBadge currency={offer.currency} />
            {mine && <Pill tone="sky">Yours</Pill>}
          </div>
          <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
            from {shortAddress(offer.lender)}
          </p>
        </div>

        {mine ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel"}
          </Button>
        ) : !enough ? (
          <Button disabled>Need {offer.tokenCount} Boys</Button>
        ) : picking ? (
          <Button variant="ghost" onClick={() => setPicking(false)} disabled={busy}>
            Back
          </Button>
        ) : (
          <Button onClick={() => setPicking(true)}>Take offer</Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Interest" value={formatInterest(offer.interestBps)} tone="lime" />
        <Stat label="Term" value={formatDuration(offer.durationSecs)} />
        <Stat label="You repay" value={formatAmount(repay, offer.currency)} />
        <Stat
          label="Collateral"
          value={`${offer.tokenCount} ${offer.tokenCount === 1 ? "Boy" : "Boys"}`}
        />
      </div>

      {picking && (
        <div className="mt-5 rounded-[14px] p-4" style={{ background: "rgba(255,255,255,0.04)" }}>
          <p className="m-0 text-[13.5px] font-bold">Pick exactly {offer.tokenCount}</p>
          <p
            className="m-0 mb-4 mt-1 text-[12.5px] leading-relaxed"
            style={{ color: "var(--fg-dim)" }}
          >
            Locked for {formatDuration(offer.durationSecs)}. Repay{" "}
            {formatAmount(repay, offer.currency)} {CURRENCY_LABEL[offer.currency]} before
            the deadline or the lender keeps them.
          </p>

          <BoyPicker
            boys={boys}
            selected={selected}
            max={offer.tokenCount}
            onToggle={(id) =>
              setSelected((s) => (s.includes(id) ? s.filter((t) => t !== id) : [...s, id]))
            }
          />

          <div className="mt-4">
            <Button onClick={() => onTake(selected)} disabled={!ready || busy}>
              {busy
                ? "Confirming…"
                : ready
                  ? `Borrow ${formatAmount(offer.principal, offer.currency)} ${CURRENCY_LABEL[offer.currency]}`
                  : `${selected.length} of ${offer.tokenCount} picked`}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ── An active or closed loan ────────────────────────────────────────────*/

export function LoanCard({
  loan,
  role,
  busy,
  onRepay,
  onClaim,
}: {
  loan: Loan;
  role: "borrower" | "lender";
  busy: boolean;
  onRepay: () => void;
  onClaim: () => void;
}) {
  const now = useNow();
  const remaining = timeLeft(loan.dueAt, now);
  const active = loan.status === "active";

  const pill =
    loan.status === "repaid" ? (
      <Pill tone="lime">Repaid</Pill>
    ) : loan.status === "defaulted" ? (
      <Pill tone="punch">Defaulted</Pill>
    ) : remaining.expired ? (
      <Pill tone="punch">Overdue</Pill>
    ) : (
      <Pill tone="neutral">Active</Pill>
    );

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="m-0 text-[17px] font-extrabold leading-none">
              {loan.tokenIds.length} {loan.tokenIds.length === 1 ? "Boy" : "Boys"} in escrow
            </p>
            <CurrencyBadge currency={loan.currency} />
            {pill}
          </div>
          <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
            {role === "borrower"
              ? `borrowed from ${shortAddress(loan.lender)}`
              : `lent to ${shortAddress(loan.borrower)}`}
          </p>
        </div>

        {active && role === "borrower" && !remaining.expired && (
          <Button onClick={onRepay} disabled={busy}>
            {busy
              ? "Repaying…"
              : `Repay ${formatAmount(loan.totalDue, loan.currency)} ${CURRENCY_LABEL[loan.currency]}`}
          </Button>
        )}
        {active && role === "lender" && remaining.expired && (
          <Button variant="danger" onClick={onClaim} disabled={busy}>
            {busy ? "Claiming…" : "Claim collateral"}
          </Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Principal" value={formatAmount(loan.principal, loan.currency)} />
        <Stat
          label={role === "borrower" ? "You repay" : "You're owed"}
          value={formatAmount(
            role === "borrower" ? loan.totalDue : loan.repayAmount,
            loan.currency,
          )}
        />
        <Stat
          label={active ? "Time left" : "Closed"}
          value={
            active
              ? remaining.label
              : loan.status === "repaid"
                ? "Repaid"
                : "Collateral taken"
          }
          tone={active && remaining.urgent ? "punch" : "default"}
        />
        <Stat label="Collateral" value={`${loan.tokenIds.length} pledged`} />
      </div>

      <TokenStrip tokenIds={loan.tokenIds} />

      {active && remaining.urgent && role === "borrower" && (
        <p className="m-0 mt-4 text-[13px] leading-relaxed" style={{ color: "var(--punch)" }}>
          {remaining.expired
            ? "The deadline has passed. This loan can no longer be repaid."
            : "Under a day left. Miss it and every pledged Boy transfers to the lender."}
        </p>
      )}
    </Panel>
  );
}
