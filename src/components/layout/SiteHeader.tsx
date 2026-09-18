import { useEffect, useState } from "react";
import { Link } from "wouter";

export default function SiteHeader() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-200"
      style={{
        background: stuck ? "rgba(11,8,24,0.88)" : "transparent",
        backdropFilter: stuck ? "blur(20px)" : "none",
        WebkitBackdropFilter: stuck ? "blur(20px)" : "none",
        borderBottom: `1px solid ${stuck ? "var(--hairline)" : "transparent"}`,
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="BoyMeetsHood, home">
          <img
            src="/logo.png"
            alt=""
            width={38}
            height={38}
            className="h-[38px] w-[38px] rounded-[11px]"
          />
          <span
            className="wordmark wordmark--light text-[20px] leading-none"
            style={{ letterSpacing: "-0.02em" }}
          >
            BoyMeetsHood
          </span>
        </Link>

        <ConnectButton />
      </div>
    </header>
  );
}

/**
 * Placeholder for RainbowKit's <ConnectButton />. Swap the body once Robinhood
 * Chain is registered as a custom chain in the wagmi config.
 */
function ConnectButton() {
  return (
    <button
      type="button"
      disabled
      title="Wallet connection lands with the market"
      className="inline-flex cursor-not-allowed items-center rounded-full px-5 py-2.5 text-[13.5px] font-extrabold sm:px-6 sm:text-[14px]"
      style={{
        background: "rgba(255,255,255,0.07)",
        color: "var(--fg-faint)",
        border: "1px solid var(--hairline)",
      }}
    >
      Connect wallet
    </button>
  );
}
