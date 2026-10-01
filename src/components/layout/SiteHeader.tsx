import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Home", href: "/" },
  { label: "Lending", href: "/p2p" },
  { label: "Staking", href: "/juice" },
];

export default function SiteHeader() {
  const [stuck, setStuck] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on route change / escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const opaque = stuck || menuOpen;

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-200"
      style={{
        background: opaque ? "rgba(11,8,24,0.92)" : "transparent",
        backdropFilter: opaque ? "blur(20px)" : "none",
        WebkitBackdropFilter: opaque ? "blur(20px)" : "none",
        borderBottom: `1px solid ${opaque ? "var(--hairline)" : "transparent"}`,
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

        <div className="flex items-center gap-3">
          {/* Inline nav on wider screens */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-2 text-[14px] font-bold transition-colors"
                style={{ color: "#fff" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <HoodConnectButton />

          {/* Hamburger — toggles the dropdown menu */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full md:hidden"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid var(--hairline)" }}
          >
            <div className="flex flex-col items-center justify-center gap-[5px]">
              <span
                className="block h-[2px] w-[18px] rounded-full transition-transform"
                style={{
                  background: "#fff",
                  transform: menuOpen ? "translateY(7px) rotate(45deg)" : "none",
                }}
              />
              <span
                className="block h-[2px] w-[18px] rounded-full transition-opacity"
                style={{ background: "#fff", opacity: menuOpen ? 0 : 1 }}
              />
              <span
                className="block h-[2px] w-[18px] rounded-full transition-transform"
                style={{
                  background: "#fff",
                  transform: menuOpen ? "translateY(-7px) rotate(-45deg)" : "none",
                }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Dropdown nav (mobile) */}
      {menuOpen && (
        <nav className="border-t px-5 pb-4 pt-2 md:hidden" style={{ borderColor: "var(--hairline)" }}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-[12px] px-4 py-3 text-[15px] font-extrabold"
              style={{ color: "#fff" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

const pill =
  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px] font-extrabold sm:px-6 sm:text-[14px]";

/**
 * RainbowKit's button, restyled as a lime pill so it doesn't look bolted on.
 * ConnectButton.Custom hands us the state and the modal openers; everything
 * visual below is ours.
 */
function HoodConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Hide until wagmi has hydrated, otherwise the button flashes the
        // wrong state on first paint.
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            aria-hidden={!ready}
            style={
              !ready
                ? { opacity: 0, pointerEvents: "none", userSelect: "none" }
                : undefined
            }
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className={pill}
                    style={{ background: "var(--lime)", color: "var(--ink)" }}
                  >
                    Connect wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className={pill}
                    style={{ background: "var(--punch)", color: "#fff" }}
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openChainModal}
                    aria-label={`Network: ${chain.name}. Change network`}
                    className="hidden h-[42px] w-[42px] items-center justify-center rounded-full sm:flex"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid var(--hairline)",
                    }}
                  >
                    {chain.hasIcon && chain.iconUrl ? (
                      <img
                        src={chain.iconUrl}
                        alt=""
                        className="h-[22px] w-[22px] rounded-full"
                        style={{ background: chain.iconBackground }}
                      />
                    ) : (
                      <span
                        className="h-[10px] w-[10px] rounded-full"
                        style={{ background: "var(--lime)" }}
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={openAccountModal}
                    className={pill}
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      color: "#fff",
                      border: "1px solid var(--hairline)",
                    }}
                  >
                    <span style={{ fontFamily: "var(--mono)" }}>
                      {account.displayName}
                    </span>
                    {account.displayBalance && (
                      <span
                        className="hidden sm:inline"
                        style={{ color: "var(--fg-faint)", fontWeight: 600 }}
                      >
                        {account.displayBalance}
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
