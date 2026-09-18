import { useEffect, useState } from "react";

const HOLD_MS = 1500;
const FADE_MS = 500;
const SEEN_KEY = "bmh_booted";

/**
 * The lime boot screen. Plays once per browser session, then gets out of the
 * way — a splash on every navigation stops being a welcome and starts being a
 * toll gate.
 */
export default function BootSplash() {
  const [phase, setPhase] = useState<"hidden" | "showing" | "leaving">(() => {
    if (typeof window === "undefined") return "hidden";
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return "hidden";
    } catch {
      /* private mode — just show it */
    }
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return reduced ? "hidden" : "showing";
  });

  useEffect(() => {
    if (phase !== "showing") return;

    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }

    document.body.style.overflow = "hidden";
    const leave = setTimeout(() => setPhase("leaving"), HOLD_MS);
    const done = setTimeout(() => setPhase("hidden"), HOLD_MS + FADE_MS);

    return () => {
      clearTimeout(leave);
      clearTimeout(done);
      document.body.style.overflow = "";
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "hidden") document.body.style.overflow = "";
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      className="scanlines fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "var(--lime)",
        animation:
          phase === "leaving" ? `boot-out ${FADE_MS}ms ease forwards` : undefined,
      }}
    >
      {/* Sweep */}
      <div
        className="pointer-events-none absolute inset-x-0 h-1/3"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(255,255,255,0.35), transparent)",
          animation: "boot-scan 1.5s linear",
        }}
      />

      <img
        src="/logo.png"
        alt=""
        width={128}
        height={128}
        className="h-28 w-28 rounded-[28px] sm:h-32 sm:w-32"
        style={{
          animation: "boot-logo 0.5s cubic-bezier(0.22,1,0.36,1) both",
          boxShadow: "0 24px 60px rgba(11,8,24,0.28)",
        }}
      />

      <p
        className="wordmark wordmark--dark glitch m-0 mt-8 uppercase"
        data-text="BoyMeetsHood"
        style={{ fontSize: "clamp(2rem, 8vw, 3.4rem)", lineHeight: 1 }}
      >
        BoyMeetsHood
      </p>

      <p
        className="m-0 mt-5 text-[11px] uppercase"
        style={{
          fontFamily: "var(--mono)",
          letterSpacing: "0.42em",
          color: "rgba(11,8,24,0.55)",
          animation: "blink 1.1s ease-in-out infinite",
        }}
      >
        Entering the Hood
      </p>
    </div>
  );
}
