import { useState, type CSSProperties, type ReactNode } from "react";
import type { Loan, LoanRequest, Offer, OwnedBoy } from "@/types/lending";
import { MAX_BUNDLE } from "@/lib/contracts";
import {
  formatDuration,
  formatInterest,
  formatUsdg,
  interestOn,
  parseUsdg,
  shortAddress,
  timeLeft,
} from "@/lib/format";
import { useNow } from "@/hooks/useLending";
import { BoyAvatar, Button, Panel, Pill, Stat } from "@/components/lending/primitives";

/* ── Boy picker, shared by the request form and the offer flow ───────────*/

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
    <div className="flex flex-wrap gap-2.5">
      {boys.map((boy) => {
        const active = selected.includes(boy.tokenId);
        const full = selected.length >= max && !active;
        return (
          <button
            key={boy.tokenId}
            type="button"
            onClick={() => onToggle(boy.tokenId)}
            disabled={full}
            aria-pressed={active}
            className="flex items-center gap-2.5 rounded-[12px] p-2 pr-3.5 transition-colors"
            style={{
              background: active ? "var(--lime)" : "rgba(255,255,255,0.06)",
              color: active ? "var(--ink)" : "#fff",
              border: "none",
              opacity: full ? 0.35 : 1,
              cursor: full ? "not-allowed" : "pointer",
            }}
          >
            <BoyAvatar tokenId={boy.tokenId} size={32} />
            <span className="text-[13px] font-bold" style={{ fontFamily: "var(--mono)" }}>
              #{boy.tokenId}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Inputs ──────────────────────────────────────────────────────────────*/

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
  }) => void;
  pending: boolean;
  error: string | null;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("10");
  const [duration, setDuration] = useState(604_800);

  const principal = parseUsdg(amount);
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
    principal && principal > 0n && interestBps >= 0
      ? principal + interestOn(principal, interestBps)
      : null;

  function toggle(tokenId: number) {
    setSelected((s) =>
      s.includes(tokenId) ? s.filter((t) => t !== tokenId) : [...s, tokenId],
    );
  }

  return (
    <Panel>
      <p className="m-0 text-[17px] font-extrabold">Borrow against your Boys</p>
      <p
        className="m-0 mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed"
        style={{ color: "var(--fg-dim)" }}
      >
        Pick the Boys you'll pledge, say what you want for them, and post it.
        You need no USDG to do this — only gas. Your Boys sit in escrow until
        someone funds you, or until you cancel.
      </p>

      <div className="mt-6">
        <p className="m-0 mb-3 text-[12.5px] font-semibold" style={{ color: "var(--fg-dim)" }}>
          Collateral {selected.length > 0 && `· ${selected.length} selected`}
        </p>
        <BoyPicker boys={boys} selected={selected} onToggle={toggle} max={MAX_BUNDLE} />
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Amount you want" suffix="USDG">
          <input
            inputMode="decimal"
            value={amount}
            placeholder="25"
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
          You repay {formatUsdg(repay, { decimals: 2 })} USDG within{" "}
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
  }) => void;
  pending: boolean;
  error: string | null;
}) {
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("10");
  const [duration, setDuration] = useState(604_800);
  const [tokenCount, setTokenCount] = useState("1");

  const principal = parseUsdg(amount);
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
      <p className="m-0 text-[17px] font-extrabold">Offer to lend</p>
      <p
        className="m-0 mt-1.5 max-w-[60ch] text-[13.5px] leading-relaxed"
        style={{ color: "var(--fg-dim)" }}
      >
        Your USDG is escrowed now, so the offer is always good for its full
        amount. Any holder can take it with Boys of their choosing.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Amount to lend" suffix="USDG">
          <input
            inputMode="decimal"
            value={amount}
            placeholder="25"
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
        <Field label="Boys required as collateral" suffix={`1–${MAX_BUNDLE}`}>
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
          Borrower repays {formatUsdg(repay, { decimals: 2 })} USDG, or you keep
          the {count === 1 ? "Boy" : "Boys"}.
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
          <div className="flex items-center gap-2.5">
            <p
              className="m-0 text-[24px] font-extrabold leading-none"
              style={{ fontFamily: "var(--mono)" }}
            >
              {formatUsdg(request.principal, { decimals: 0 })}
              <span className="ml-1.5 text-[14px]" style={{ color: "var(--fg-dim)" }}>
                USDG
              </span>
            </p>
            {mine && <Pill tone="sky">Your request</Pill>}
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
        <Stat label="They repay" value={formatUsdg(repay, { decimals: 0 })} />
        <Stat
          label="Collateral"
          value={`${request.tokenIds.length} ${request.tokenIds.length === 1 ? "Boy" : "Boys"}`}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {request.tokenIds.map((tokenId) => (
          <span
            key={tokenId}
            className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <BoyAvatar tokenId={tokenId} size={22} />
            <span className="text-[12px] font-bold" style={{ fontFamily: "var(--mono)" }}>
              #{tokenId}
            </span>
          </span>
        ))}
      </div>
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

  function toggle(tokenId: number) {
    setSelected((s) =>
      s.includes(tokenId) ? s.filter((t) => t !== tokenId) : [...s, tokenId],
    );
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className="m-0 text-[24px] font-extrabold leading-none"
            style={{ fontFamily: "var(--mono)" }}
          >
            {formatUsdg(offer.principal, { decimals: 0 })}
            <span className="ml-1.5 text-[14px]" style={{ color: "var(--fg-dim)" }}>
              USDG
            </span>
          </p>
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
        <Stat label="You repay" value={formatUsdg(repay, { decimals: 0 })} />
        <Stat
          label="Collateral"
          value={`${offer.tokenCount} ${offer.tokenCount === 1 ? "Boy" : "Boys"}`}
        />
      </div>

      {picking && (
        <div
          className="mt-5 rounded-[14px] p-4"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <p className="m-0 text-[13.5px] font-bold">
            Pick exactly {offer.tokenCount}
          </p>
          <p
            className="m-0 mb-4 mt-1 text-[12.5px] leading-relaxed"
            style={{ color: "var(--fg-dim)" }}
          >
            Locked for {formatDuration(offer.durationSecs)}. Repay{" "}
            {formatUsdg(repay, { decimals: 0 })} USDG before the deadline or the
            lender keeps them.
          </p>

          <BoyPicker
            boys={boys}
            selected={selected}
            onToggle={toggle}
            max={offer.tokenCount}
          />

          <div className="mt-4">
            <Button onClick={() => onTake(selected)} disabled={!ready || busy}>
              {busy
                ? "Confirming…"
                : ready
                  ? `Borrow ${formatUsdg(offer.principal, { decimals: 0 })} USDG`
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
          <div className="flex items-center gap-2.5">
            <p className="m-0 text-[17px] font-extrabold leading-none">
              {loan.tokenIds.length}{" "}
              {loan.tokenIds.length === 1 ? "Boy" : "Boys"} in escrow
            </p>
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
              : `Repay ${formatUsdg(loan.totalDue, { decimals: 2 })} USDG`}
          </Button>
        )}
        {active && role === "lender" && remaining.expired && (
          <Button variant="danger" onClick={onClaim} disabled={busy}>
            {busy ? "Claiming…" : "Claim collateral"}
          </Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Principal" value={formatUsdg(loan.principal, { decimals: 0 })} />
        <Stat
          label={role === "borrower" ? "You repay" : "You're owed"}
          value={formatUsdg(
            role === "borrower" ? loan.totalDue : loan.repayAmount,
            { decimals: 2 },
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

      <div className="mt-5 flex flex-wrap gap-2">
        {loan.tokenIds.map((tokenId) => (
          <span
            key={tokenId}
            className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <BoyAvatar tokenId={tokenId} size={22} />
            <span className="text-[12px] font-bold" style={{ fontFamily: "var(--mono)" }}>
              #{tokenId}
            </span>
          </span>
        ))}
      </div>

      {active && remaining.urgent && role === "borrower" && (
        <p
          className="m-0 mt-4 text-[13px] leading-relaxed"
          style={{ color: "var(--punch)" }}
        >
          {remaining.expired
            ? "The deadline has passed. This loan can no longer be repaid."
            : "Under a day left. Miss it and every pledged Boy transfers to the lender."}
        </p>
      )}
    </Panel>
  );
}
