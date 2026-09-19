import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConnectButton } from "@rainbow-me/rainbowkit";

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

        <HoodConnectButton />
      </div>
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
