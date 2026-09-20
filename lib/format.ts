/**
 * USDG decimals. Confirm against the deployed token before mainnet — if this
 * is wrong, every amount on the site is wrong by orders of magnitude.
 */
export const USDG_DECIMALS = 6;

const UNIT = 10n ** BigInt(USDG_DECIMALS);

/** 1_500_000n -> "1.50" (or "1.5" with trimTrailing). */
export function formatUsdg(
  base: bigint,
  { decimals = 2, trimTrailing = false }: { decimals?: number; trimTrailing?: boolean } = {},
): string {
  const negative = base < 0n;
  const abs = negative ? -base : base;

  const whole = abs / UNIT;
  const fraction = abs % UNIT;

  const fractionStr = fraction
    .toString()
    .padStart(USDG_DECIMALS, "0")
    .slice(0, decimals);

  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  let out = decimals > 0 ? `${wholeStr}.${fractionStr}` : wholeStr;
  if (trimTrailing) out = out.replace(/\.?0+$/, "");

  return negative ? `-${out}` : out;
}

/** Convenience for labels: "400.00 USDG". */
export function formatUsdgLabel(base: bigint): string {
  return `${formatUsdg(base)} USDG`;
}

/** Turn a human amount from an input field into base units. */
export function parseUsdg(input: string): bigint | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;

  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > USDG_DECIMALS) return null;

  const padded = fraction.padEnd(USDG_DECIMALS, "0");
  return BigInt(whole || "0") * UNIT + BigInt(padded || "0");
}

/** 1000 -> "10%". Trims a trailing .0 so whole rates read cleanly. */
export function formatInterest(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/** Interest owed on a principal for the full term. */
export function interestOn(principal: bigint, bps: number): bigint {
  return (principal * BigInt(bps)) / 10_000n;
}

/** 604800 -> "7 days". */
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
  /** "2d 14h", "6h 12m", "14m 09s", or "Overdue". */
  label: string;
  /** True inside the last 24 hours — worth showing in the warning colour. */
  urgent: boolean;
}

export function timeLeft(dueAt: number, now = Math.floor(Date.now() / 1000)): TimeLeft {
  const secs = dueAt - now;
  if (secs <= 0) {
    return { secs: 0, expired: true, label: "Overdue", urgent: true };
  }

  const d = Math.floor(secs / 86_400);
  const h = Math.floor((secs % 86_400) / 3_600);
  const m = Math.floor((secs % 3_600) / 60);
  const s = secs % 60;

  let label: string;
  if (d > 0) label = `${d}d ${h}h`;
  else if (h > 0) label = `${h}h ${String(m).padStart(2, "0")}m`;
  else label = `${m}m ${String(s).padStart(2, "0")}s`;

  return { secs, expired: false, label, urgent: secs < 86_400 };
}

/** 0x1234…abcd */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
