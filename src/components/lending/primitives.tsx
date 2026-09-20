import { useEffect, useState, type ReactNode } from "react";
import { readContract } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wagmi";
import { CONTRACTS } from "@/lib/contracts";
import { erc721Abi } from "@/lib/abis/tokens";

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

/**
 * The Boy's art, read from the collection's tokenURI.
 *
 * Metadata is fetched once per token and cached for the page session, so the
 * same Boy appearing in a picker, a card and a loan row costs one round trip.
 * Falls back to a coloured tile while loading or if anything fails — a broken
 * image icon looks like a bug, a tile looks deliberate.
 */

const imageCache = new Map<number, string | null>();
const inFlight = new Map<number, Promise<string | null>>();

/** ipfs://… and ar://… aren't URLs a browser can fetch. */
function toHttp(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7).replace(/^ipfs\//, "")}`;
  }
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

async function loadImage(tokenId: number): Promise<string | null> {
  const cached = imageCache.get(tokenId);
  if (cached !== undefined) return cached;

  const existing = inFlight.get(tokenId);
  if (existing) return existing;

  const task = (async () => {
    try {
      const uri = await readContract(wagmiConfig, {
        address: CONTRACTS.boys,
        abi: erc721Abi,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });

      let metadata: { image?: string; image_url?: string };

      if (uri.startsWith("data:application/json;base64,")) {
        metadata = JSON.parse(atob(uri.split(",")[1]));
      } else if (uri.startsWith("data:application/json,")) {
        metadata = JSON.parse(decodeURIComponent(uri.split(",")[1]));
      } else {
        const res = await fetch(toHttp(uri));
        if (!res.ok) throw new Error(String(res.status));
        metadata = await res.json();
      }

      const image = metadata.image ?? metadata.image_url;
      const resolved = image ? toHttp(image) : null;
      imageCache.set(tokenId, resolved);
      return resolved;
    } catch {
      imageCache.set(tokenId, null);
      return null;
    } finally {
      inFlight.delete(tokenId);
    }
  })();

  inFlight.set(tokenId, task);
  return task;
}

export function BoyAvatar({ tokenId, size = 44 }: { tokenId: number; size?: number }) {
  const [src, setSrc] = useState<string | null>(
    () => imageCache.get(tokenId) ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    loadImage(tokenId).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  const hue = (tokenId * 47) % 360;

  return (
    <div
      className="flex-shrink-0 overflow-hidden rounded-[10px]"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, hsl(${hue} 85% 62%), hsl(${(hue + 70) % 360} 80% 52%))`,
      }}
    >
      {src && (
        <img
          src={src}
          alt={`Boy #${tokenId}`}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setSrc(null)}
        />
      )}
    </div>
  );
}
