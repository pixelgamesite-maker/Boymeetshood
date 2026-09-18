import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[20px] p-5 sm:p-6 ${className}`}
      style={{ background: "var(--ink-2)" }}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "lime" | "punch";
}) {
  const color =
    tone === "lime" ? "var(--lime)" : tone === "punch" ? "var(--punch)" : "#fff";
  return (
    <div>
      <p className="m-0 text-[11.5px]" style={{ color: "var(--fg-faint)" }}>
        {label}
      </p>
      <p
        className="m-0 mt-1 text-[16px] font-bold leading-none"
        style={{ fontFamily: "var(--mono)", color }}
      >
        {value}
      </p>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "lime" | "punch" | "sky";
}) {
  const map = {
    neutral: { bg: "rgba(255,255,255,0.08)", fg: "var(--fg-dim)" },
    lime: { bg: "var(--lime)", fg: "var(--ink)" },
    punch: { bg: "var(--punch)", fg: "#fff" },
    sky: { bg: "var(--sky)", fg: "var(--ink)" },
  }[tone];

  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: map.bg, color: map.fg }}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: { background: "var(--lime)", color: "var(--ink)", border: "none" },
    ghost: {
      background: "transparent",
      color: "#fff",
      border: "1px solid rgba(255,255,255,0.2)",
    },
    danger: { background: "var(--punch)", color: "#fff", border: "none" },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[13.5px] font-extrabold transition-opacity ${className}`}
      style={{ ...styles, opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}

export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-[104px] rounded-[20px]"
          style={{
            background: "var(--ink-2)",
            opacity: 1 - i * 0.18,
          }}
        />
      ))}
    </div>
  );
}

/** An empty screen is an invitation to act, so it always names the next move. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Panel className="text-center">
      <p className="m-0 text-[17px] font-extrabold">{title}</p>
      <p
        className="mx-auto m-0 mt-2 max-w-[42ch] text-[14px] leading-relaxed"
        style={{ color: "var(--fg-dim)" }}
      >
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </Panel>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Panel>
      <p className="m-0 text-[15px] font-bold" style={{ color: "var(--punch)" }}>
        {message}
      </p>
      <p
        className="m-0 mt-1.5 text-[13.5px] leading-relaxed"
        style={{ color: "var(--fg-dim)" }}
      >
        Nothing was sent. Try again, and check your connection if it keeps failing.
      </p>
      <div className="mt-4">
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Panel>
  );
}

/** The Boy's art slot. Swap the gradient for the real tokenURI image later. */
export function BoyAvatar({ tokenId, size = 44 }: { tokenId: number; size?: number }) {
  const hue = (tokenId * 47) % 360;
  return (
    <div
      className="flex-shrink-0 rounded-[10px]"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, hsl(${hue} 85% 62%), hsl(${(hue + 70) % 360} 80% 52%))`,
      }}
      aria-hidden="true"
    />
  );
}
