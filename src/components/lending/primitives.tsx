import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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

/* ── Boy metadata ─────────────────────────────────────────────────────────
 * Read from the collection's tokenURI once per token, cached for the page
 * session, so the same Boy in a picker, a request and a loan costs one fetch.
 *
 * IPFS is served through several public gateways, tried in order. Any single
 * public gateway is slow or rate-limited often enough that relying on one
 * means art that loads for you and not for someone else.
 */

const GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

/**
 * Every Boy mirrored on Supabase. Tried last, but it's the only source with
 * predictable latency — public IPFS gateways are slow or rate-limited often
 * enough that art loading at all shouldn't depend on them.
 */
const MIRROR = (tokenId: number) =>
  `https://vcxixncpxesnxbevxmyw.supabase.co/storage/v1/object/public/boy/nft_${tokenId}.png`;

export interface BoyMeta {
  name: string;
  /** Candidate URLs for the image, best first. */
  images: string[];
}

const metaCache = new Map<number, BoyMeta>();
const metaInFlight = new Map<number, Promise<BoyMeta>>();

/** Every URL a URI could be fetched from, best first. */
function candidates(uri: string): string[] {
  if (uri.startsWith("ipfs://")) {
    const path = uri.slice(7).replace(/^ipfs\//, "");
    return GATEWAYS.map((g) => g + path);
  }
  if (uri.startsWith("ar://")) return [`https://arweave.net/${uri.slice(5)}`];
  return [uri];
}

async function fetchJson(urls: string[]): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return await res.json();
      lastError = new Error(String(res.status));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export function loadBoyMeta(tokenId: number): Promise<BoyMeta> {
  const cached = metaCache.get(tokenId);
  if (cached) return Promise.resolve(cached);

  const existing = metaInFlight.get(tokenId);
  if (existing) return existing;

  const fallback: BoyMeta = {
    name: `BoyMeetsH00d #${tokenId}`,
    images: [MIRROR(tokenId)],
  };

  const task = (async () => {
    try {
      const uri = await readContract(wagmiConfig, {
        address: CONTRACTS.boys,
        abi: erc721Abi,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });

      let json: Record<string, unknown>;
      if (uri.startsWith("data:application/json;base64,")) {
        json = JSON.parse(atob(uri.split(",")[1]));
      } else if (uri.startsWith("data:application/json,")) {
        json = JSON.parse(decodeURIComponent(uri.split(",")[1]));
      } else {
        json = await fetchJson(candidates(uri));
      }

      const image = (json.image ?? json.image_url) as string | undefined;
      const meta: BoyMeta = {
        name: typeof json.name === "string" ? json.name : fallback.name,
        images: [...(image ? candidates(image) : []), MIRROR(tokenId)],
      };
      metaCache.set(tokenId, meta);
      return meta;
    } catch {
      // Don't cache failures: a gateway hiccup shouldn't hide art all session.
      return fallback;
    } finally {
      metaInFlight.delete(tokenId);
    }
  })();

  metaInFlight.set(tokenId, task);
  return task;
}

export function useBoyMeta(tokenId: number): BoyMeta | null {
  const [meta, setMeta] = useState<BoyMeta | null>(
    () => metaCache.get(tokenId) ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    loadBoyMeta(tokenId).then((m) => !cancelled && setMeta(m));
    return () => {
      cancelled = true;
    };
  }, [tokenId]);

  return meta;
}

/**
 * The art itself. Walks through gateway candidates on error, and shows a
 * shimmer while loading rather than a blank or a broken-image icon.
 */
export function BoyImage({
  tokenId,
  className = "",
  style,
}: {
  tokenId: number;
  className?: string;
  style?: CSSProperties;
}) {
  const meta = useBoyMeta(tokenId);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
  }, [tokenId]);

  const src = meta?.images[attempt];
  const exhausted = meta !== null && attempt >= meta.images.length;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: "var(--ink-3)", ...style }}
    >
      {!loaded && !exhausted && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: "rgba(255,255,255,0.05)" }}
          aria-hidden="true"
        />
      )}

      {exhausted && (
        <div
          className="absolute inset-0 grid place-items-center text-center"
          style={{ color: "var(--fg-faint)" }}
        >
          <span className="px-2 text-[11px] font-bold" style={{ fontFamily: "var(--mono)" }}>
            #{tokenId}
          </span>
        </div>
      )}

      {src && (
        <img
          key={src}
          src={src}
          alt={meta?.name ?? `Boy #${tokenId}`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setAttempt((a) => a + 1);
          }}
        />
      )}
    </div>
  );
}

/** Small square thumbnail — kept for compact places like loan rows. */
export function BoyAvatar({ tokenId, size = 44 }: { tokenId: number; size?: number }) {
  return (
    <BoyImage
      tokenId={tokenId}
      className="flex-shrink-0 rounded-[10px]"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The OpenSea-style card: big square art, name underneath. Selectable when
 * given onToggle, with a lime ring and check when picked.
 */
export function BoyCard({
  tokenId,
  selected = false,
  disabled = false,
  onToggle,
}: {
  tokenId: number;
  selected?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  const meta = useBoyMeta(tokenId);
  const interactive = Boolean(onToggle);

  const body = (
    <>
      <div className="relative">
        <BoyImage tokenId={tokenId} className="aspect-square w-full" />
        {selected && (
          <span
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full"
            style={{ background: "var(--lime)", color: "var(--ink)" }}
            aria-hidden="true"
          >
            <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
              <path d="M1.5 5.5L5 9L12.5 1.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      <div className="px-3 py-2.5 text-left">
        <p className="m-0 truncate text-[13px] font-extrabold leading-tight">
          {meta?.name ?? `BoyMeetsH00d #${tokenId}`}
        </p>
        <p
          className="m-0 mt-0.5 text-[11px]"
          style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}
        >
          #{tokenId}
        </p>
      </div>
    </>
  );

  const frame: CSSProperties = {
    background: "var(--ink-2)",
    border: `2px solid ${selected ? "var(--lime)" : "var(--hairline)"}`,
    opacity: disabled ? 0.35 : 1,
  };

  if (!interactive) {
    return (
      <div className="overflow-hidden rounded-[14px]" style={frame}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
      className="overflow-hidden rounded-[14px] p-0 transition-transform hover:-translate-y-0.5"
      style={{ ...frame, cursor: disabled ? "not-allowed" : "pointer", color: "#fff" }}
    >
      {body}
    </button>
  );
}
