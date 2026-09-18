import { useEffect, useState, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";

const NAV: [string, string][] = [
  ["Home", "/"],
  ["Market", "/market"],
  ["How it works", "/#how"],
];

export default function SiteHeader() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile drawer whenever the route changes
  useEffect(() => setOpen(false), [location]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-200"
      style={{
        background: stuck ? "rgba(14,10,40,0.86)" : "transparent",
        backdropFilter: stuck ? "blur(20px)" : "none",
        WebkitBackdropFilter: stuck ? "blur(20px)" : "none",
        borderBottom: `1px solid ${stuck ? "var(--hairline)" : "transparent"}`,
      }}
    >
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="BoyMeetsHood, home"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-[10px] text-[15px] font-black"
            style={{ background: "var(--lime)", color: "var(--ink)" }}
            aria-hidden="true"
          >
            B
          </span>
          <span className="hood-wordmark text-[19px] leading-none">
            BoyMeetsHood
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="rounded-full px-4 py-2 text-[14px] font-medium transition-colors"
              style={{ color: "var(--fg-dim)" }}
              onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) =>
                (e.currentTarget.style.color = "var(--fg-dim)")
              }
            >
              {label}
            </Link>
          ))}
          <ConnectButton className="ml-3" />
        </nav>

        {/* Mobile trigger */}
        <button
          type="button"
          className="md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
          style={{ color: "#fff", background: "none", border: "none" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M4 8h16M4 16h16"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="md:hidden"
          style={{
            background: "rgba(14,10,40,0.97)",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <div className="mx-auto flex max-w-[1180px] flex-col gap-1 px-5 pb-6 pt-2">
            {NAV.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="rounded-xl px-3 py-3 text-[16px] font-medium"
                style={{ color: "var(--fg-dim)" }}
              >
                {label}
              </Link>
            ))}
            <ConnectButton className="mt-3 w-full justify-center" />
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * Placeholder for RainbowKit's <ConnectButton />.
 * Swap the body of this component once Robinhood Chain is registered as a
 * custom chain in the wagmi config — the layout around it won't need to move.
 */
function ConnectButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      disabled
      title="Wallet connection lands with the market"
      className={`inline-flex cursor-not-allowed items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold ${className}`}
      style={{
        background: "rgba(255,255,255,0.06)",
        color: "var(--fg-faint)",
        border: "1px solid var(--hairline)",
      }}
    >
      Connect wallet
    </button>
  );
}
