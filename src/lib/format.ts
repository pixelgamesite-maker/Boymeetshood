import { CURRENCY_DECIMALS, CURRENCY_LABEL, type Currency } from "@/types/lending";

/**
 * Amounts are always base units of their own currency. Every helper here
 * takes the currency explicitly — there is no default, because defaulting to
 * one would silently mis-scale the other by twelve orders of magnitude.
 */

/** 1_500_000n USDG -> "1.50". 100000000000000000n ETH -> "0.1". */
export function formatAmount(
  base: bigint,
  currency: Currency,
  opts: { decimals?: number; trim?: boolean } = {},
): string {
  const scale = CURRENCY_DECIMALS[currency];
  const unit = 10n ** BigInt(scale);

  // USDG reads naturally at 2dp; ETH needs more to show a small loan.
  const places = opts.decimals ?? (currency === "eth" ? 4 : 2);
  const trim = opts.trim ?? currency === "eth";

  const negative = base < 0n;
  const abs = negative ? -base : base;

  const whole = (abs / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (abs % unit).toString().padStart(scale, "0").slice(0, places);

  let out = places > 0 ? `${whole}.${fraction}` : whole;
  if (trim && out.includes(".")) out = out.replace(/\.?0+$/, "");

  return negative ? `-${out}` : out;
}

/** "0.11 ETH" / "27.50 USDG" */
export function formatAmountLabel(base: bigint, currency: Currency): string {
  return `${formatAmount(base, currency)} ${CURRENCY_LABEL[currency]}`;
}

/** Turn a human amount from an input field into base units. */
export function parseAmount(input: string, currency: Currency): bigint | null {
  const scale = CURRENCY_DECIMALS[currency];
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    return null;
  }

  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > scale) return null;

  return (
    BigInt(whole || "0") * 10n ** BigInt(scale) +
    BigInt(fraction.padEnd(scale, "0") || "0")
  );
}

/** 1000 -> "10%" */
export function formatInterest(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** Interest owed on a principal for the full term. */
export function interestOn(principal: bigint, bps: number): bigint {
  return (principal * BigInt(bps)) / 10_000n;
}

/** 604800 -> "7 days" */
export function formatDuration(secs: number): string {
  const days = Math.floor(secs / 86_400);
  if (days >= 1) return `${days} ${days === 1 ? "day" : "days"}`;

  const hours = Math.floor(secs / 3_600);
  if (hours >= 1) return `${hours} ${hours === 1 ? "hour" : "hours"}`;

  const mins = Math.max(1, Math.floor(secs / 60));
  return `${mins} ${mins === 1 ? "min" : "mins"}`;
}

export interface TimeLeft {
  secs: number;
  expired: boolean;
  label: string;
  /** True inside the last 24 hours. */
  urgent: boolean;
}

export function timeLeft(
  dueAt: number,
  now = Math.floor(Date.now() / 1000),
): TimeLeft {
  const secs = dueAt - now;
  if (secs <= 0) return { secs: 0, expired: true, label: "Overdue", urgent: true };

  const d = Math.floor(secs / 86_400);
  const h = Math.floor((secs % 86_400) / 3_600);
  const m = Math.floor((secs % 3_600) / 60);
  const s = secs % 60;

  const label =
    d > 0
      ? `${d}d ${h}h`
      : h > 0
        ? `${h}h ${String(m).padStart(2, "0")}m`
        : `${m}m ${String(s).padStart(2, "0")}s`;

  return { secs, expired: false, label, urgent: secs < 86_400 };
}

/** 0x1234…abcd */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
