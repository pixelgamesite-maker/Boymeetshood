import { useState, type CSSProperties, type ReactNode } from "react";
import type { CollateralSpec } from "@/types/lending";
import { formatUsdg, interestOn, parseUsdg } from "@/lib/format";
import { Button, Panel } from "@/components/lending/primitives";

const DURATIONS: [string, number][] = [
  ["1 day", 86_400],
  ["3 days", 259_200],
  ["7 days", 604_800],
  ["14 days", 1_209_600],
  ["30 days", 2_592_000],
];

export function CreateOfferForm({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (input: {
    principal: bigint;
    interestBps: number;
    durationSecs: number;
    collateral: CollateralSpec;
  }) => void;
  pending: boolean;
  error: string | null;
}) {
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("10");
  const [duration, setDuration] = useState(604_800);
  const [touched, setTouched] = useState(false);

  const principal = parseUsdg(amount);
  const interestNum = Number(interest);
  const interestBps = Math.round(interestNum * 100);

  const amountError =
    touched && amount !== "" && (principal === null || principal <= 0n)
      ? "Enter an amount above zero."
      : null;
  const interestError =
    touched && (!Number.isFinite(interestNum) || interestNum < 0 || interestNum > 100)
      ? "Interest must be between 0 and 100."
      : null;

  const valid =
    principal !== null && principal > 0n && !interestError && interestBps >= 0;

  const preview =
    principal !== null && principal > 0n && interestBps >= 0
      ? principal + interestOn(principal, interestBps)
      : null;

  function submit() {
    setTouched(true);
    if (!valid || principal === null) return;
    onSubmit({
      principal,
      interestBps,
      durationSecs: duration,
      collateral: { kind: "any" },
    });
    setAmount("");
    setTouched(false);
  }

  return (
    <Panel>
      <p className="m-0 text-[17px] font-extrabold">Post an offer</p>
      <p
        className="m-0 mt-1.5 max-w-[56ch] text-[13.5px] leading-relaxed"
        style={{ color: "var(--fg-dim)" }}
      >
        Any holder can take this offer against any Boy. Your USDG is committed
        the moment someone does, and you get it back with interest on repayment —
        or you get the Boy.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Amount to lend" suffix="USDG" error={amountError}>
          <input
            inputMode="decimal"
            value={amount}
            placeholder="400"
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setTouched(true)}
            style={inputStyle}
          />
        </Field>

        <Field label="Interest for the full term" suffix="%" error={interestError}>
          <input
            inputMode="decimal"
            value={interest}
            placeholder="10"
            onChange={(e) => setInterest(e.target.value)}
            onBlur={() => setTouched(true)}
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="mt-5">
        <p className="m-0 mb-2.5 text-[12.5px] font-semibold" style={{ color: "var(--fg-dim)" }}>
          Term
        </p>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map(([label, secs]) => {
            const active = duration === secs;
            return (
              <button
                key={secs}
                type="button"
                onClick={() => setDuration(secs)}
                aria-pressed={active}
                className="rounded-full px-4 py-2 text-[13px] font-bold"
                style={{
                  background: active ? "var(--lime)" : "rgba(255,255,255,0.06)",
                  color: active ? "var(--ink)" : "var(--fg-dim)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {preview !== null && (
        <p
          className="m-0 mt-5 text-[13px]"
          style={{ color: "var(--fg-dim)", fontFamily: "var(--mono)" }}
        >
          Borrower repays {formatUsdg(preview, { decimals: 0 })} USDG, or you
          keep the Boy.
        </p>
      )}

      {error && (
        <p className="m-0 mt-4 text-[13.5px] font-bold" style={{ color: "var(--punch)" }}>
          {error}
        </p>
      )}

      <div className="mt-6">
        <Button onClick={submit} disabled={pending || (touched && !valid)}>
          {pending ? "Posting…" : "Post offer"}
        </Button>
      </div>
    </Panel>
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
  error,
  children,
}: {
  label: string;
  suffix: string;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-2.5 flex items-center justify-between text-[12.5px] font-semibold">
        <span style={{ color: "var(--fg-dim)" }}>{label}</span>
        <span style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}>
          {suffix}
        </span>
      </label>
      {children}
      {error && (
        <p className="m-0 mt-2 text-[12px]" style={{ color: "var(--punch)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
