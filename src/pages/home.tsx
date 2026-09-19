import { useState, type CSSProperties } from "react";
import { Link } from "wouter";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { COLLECTION, LINKS, TOOLS, type Tool } from "@/lib/site";

export default function Home() {
  return (
    <div style={{ background: "var(--ink)", minHeight: "100vh" }}>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <TheBoys />
        <JoinBand />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Hero: brand, then the four doors ─────────────────────────────────────*/

function Hero() {
  return (
    <section
      className="scanlines relative overflow-hidden px-5 pb-16 pt-[110px] sm:px-8 sm:pb-20 sm:pt-[140px]"
      style={{ background: "var(--lime)" }}
    >
      <div className="relative mx-auto max-w-[1180px]">
        <div className="flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt=""
            width={104}
            height={104}
            className="rise h-[88px] w-[88px] rounded-[24px] sm:h-[104px] sm:w-[104px]"
            style={{ boxShadow: "0 24px 60px rgba(11,8,24,0.26)" }}
          />

          <h1
            className="wordmark wordmark--dark rise m-0 mt-7"
            style={{
              fontSize: "clamp(2.4rem, 10vw, 5.4rem)",
              lineHeight: 0.95,
              animationDelay: "0.08s",
            }}
          >
            BoyMeetsHood
          </h1>

          <p
            className="rise m-0 mt-5 max-w-[34ch] text-[17px] font-semibold leading-snug sm:text-[20px]"
            style={{ color: "rgba(11,8,24,0.78)", animationDelay: "0.14s" }}
          >
            {COLLECTION.supply} Boys. One Hood. Real financial utility.
          </p>

          <div
            className="rise mt-8 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "0.2s" }}
          >
            <Link
              href="/p2p"
              className="inline-flex items-center justify-center rounded-full px-9 py-4 text-[15px] font-extrabold"
              style={{ background: "var(--ink)", color: "var(--lime)" }}
            >
              Enter the Hood
            </Link>
            <a
              href={LINKS.opensea}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full px-9 py-4 text-[15px] font-extrabold"
              style={{ border: "2px solid rgba(11,8,24,0.28)", color: "var(--ink)" }}
            >
              Join the Boys
            </a>
          </div>
        </div>

        {/* The four doors, right here in the hero */}
        <div
          className="rise mt-14 flex items-end justify-between gap-4"
          style={{ animationDelay: "0.26s" }}
        >
          <h2
            className="m-0 font-black leading-[1]"
            style={{
              fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
              letterSpacing: "-0.025em",
              color: "var(--ink)",
            }}
          >
            The Hood Toolkit
          </h2>
          <p
            className="m-0 hidden text-[12px] uppercase sm:block"
            style={{
              fontFamily: "var(--mono)",
              letterSpacing: "0.16em",
              color: "rgba(11,8,24,0.52)",
            }}
          >
            Everything ships after mint
          </p>
        </div>

        <div
          className="rise mt-5 grid gap-4 sm:grid-cols-2"
          style={{ animationDelay: "0.3s" }}
        >
          {TOOLS.map((tool, i) => (
            <ToolCard key={tool.name} tool={tool} feature={i === 0} />
          ))}
        </div>

        <dl
          className="rise mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] sm:grid-cols-4"
          style={{
            background: "var(--hairline)",
            boxShadow: "0 18px 50px rgba(11,8,24,0.3)",
            animationDelay: "0.36s",
          }}
        >
          {(
            [
              ["Supply", COLLECTION.supply],
              ["Chain", COLLECTION.chain],
              ["Settles in", COLLECTION.currency],
              ["Lending", "Live"],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="px-5 py-5" style={{ background: "var(--ink-2)" }}>
              <dt
                className="m-0 text-[11px] uppercase"
                style={{
                  fontFamily: "var(--mono)",
                  letterSpacing: "0.14em",
                  color: "var(--fg-faint)",
                }}
              >
                {label}
              </dt>
              <dd
                className="m-0 mt-1.5 text-[16px] font-extrabold"
                style={{ color: "#fff" }}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ToolCard({ tool, feature }: { tool: Tool; feature: boolean }) {
  const style: CSSProperties = {
    minHeight: feature ? 300 : 260,
    border: `2px solid ${tool.live ? "rgba(11,8,24,0.9)" : "rgba(11,8,24,0.35)"}`,
  };

  return (
    <Link
      href={tool.href}
      className={`tool-card ${tool.live ? "" : "tool-card--soon"} ${
        feature ? "sm:col-span-2" : ""
      }`}
      style={style}
    >
      <img src={tool.image} alt="" loading="lazy" />
      <div className="relative flex h-full flex-col justify-end p-6 sm:p-7">
        <span
          className="mb-auto self-start rounded-full px-3 py-1.5 text-[11px] font-extrabold uppercase"
          style={{
            fontFamily: "var(--mono)",
            letterSpacing: "0.1em",
            background: tool.live ? tool.tint : "rgba(255,255,255,0.16)",
            color: tool.live ? "var(--ink)" : "#fff",
          }}
        >
          {tool.live ? "Live" : "Coming soon"}
        </span>

        <h3
          className="m-0 mt-8 font-black leading-[1]"
          style={{
            fontSize: feature
              ? "clamp(1.9rem, 4.4vw, 2.7rem)"
              : "clamp(1.6rem, 3.4vw, 2.1rem)",
            letterSpacing: "-0.02em",
            color: tool.live ? tool.tint : "#fff",
          }}
        >
          {tool.name}
        </h3>
        <p
          className="m-0 mt-2.5 max-w-[42ch] text-[14px] leading-relaxed"
          style={{ color: "rgba(255,255,255,0.76)" }}
        >
          {tool.blurb}
        </p>
      </div>
    </Link>
  );
}

/* ── How a loan works ─────────────────────────────────────────────────────*/

const STEPS: [string, string][] = [
  ["A lender posts an offer", "Amount, interest, term, and which Boys they accept."],
  ["You take the one that suits", "Your Boy enters escrow, the USDG lands in your wallet."],
  ["Repay before the deadline", "Escrow releases your Boy the moment it clears."],
  ["Or the Boy is theirs", "No auction, no grace period, no extension."],
];

function HowItWorks() {
  return (
    <section
      id="how"
      className="scroll-mt-24 px-5 py-24 sm:px-8"
      style={{ background: "var(--ink-2)" }}
    >
      <div className="mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-[1fr_auto] lg:gap-12">
        <div>
          <h2
            className="m-0 max-w-[15ch] font-black leading-[1]"
            style={{ fontSize: "clamp(2.1rem, 5vw, 3.2rem)", letterSpacing: "-0.025em" }}
          >
            Borrow against your Boy. Keep your Boy.
          </h2>

          <ol className="m-0 mt-10 grid list-none grid-cols-1 gap-7 p-0 sm:grid-cols-2">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span
                  className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[14px] font-black"
                  style={{
                    background: i === 3 ? "var(--punch)" : "var(--lime)",
                    color: i === 3 ? "#fff" : "var(--ink)",
                    fontFamily: "var(--mono)",
                  }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="m-0 text-[16.5px] font-extrabold leading-snug">{title}</h3>
                  <p
                    className="m-0 mt-1.5 max-w-[38ch] text-[14px] leading-relaxed"
                    style={{ color: "var(--fg-dim)" }}
                  >
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <Link
            href="/p2p"
            className="mt-10 inline-flex items-center rounded-full px-8 py-3.5 text-[14.5px] font-extrabold"
            style={{ background: "var(--lime)", color: "var(--ink)" }}
          >
            Browse offers
          </Link>
        </div>

        <LoanTicket />
      </div>
    </section>
  );
}

function LoanTicket() {
  const [lending, setLending] = useState(false);

  return (
    <div className="ticket-drop justify-self-center">
      <div className="w-[320px] sm:w-[360px]" style={{ transform: "rotate(-2.2deg)" }}>
        <div
          className="mb-3 inline-flex gap-1 rounded-full p-1"
          style={{ background: "rgba(255,255,255,0.09)" }}
        >
          {[false, true].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={lending === v}
              onClick={() => setLending(v)}
              className="rounded-full px-4 py-1.5 text-[12.5px] font-bold"
              style={{
                background: lending === v ? "var(--lime)" : "transparent",
                color: lending === v ? "var(--ink)" : "var(--fg-dim)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {v ? "I'm lending" : "I'm borrowing"}
            </button>
          ))}
        </div>

        <article
          className="ticket-notch relative rounded-[18px] px-7 pb-7 pt-6"
          style={
            {
              background: "var(--paper)",
              color: "var(--paper-ink)",
              boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
              "--notch-y": "58%",
            } as CSSProperties
          }
        >
          <header className="flex items-start justify-between">
            <div>
              <p className="m-0 text-[19px] font-extrabold leading-none">Loan ticket</p>
              <p
                className="m-0 mt-1.5 text-[11.5px]"
                style={{ fontFamily: "var(--mono)", color: "#6d6482" }}
              >
                #0000 · example
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ background: "var(--paper-ink)", color: "var(--lime)" }}
            >
              Active
            </span>
          </header>

          <div
            className="mt-5 flex items-center gap-3.5 rounded-[14px] p-3"
            style={{ background: "rgba(26,21,48,0.06)" }}
          >
            <img
              src="/logo.png"
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 flex-shrink-0 rounded-[10px]"
            />
            <div>
              <p className="m-0 text-[14.5px] font-bold leading-tight">Boy #1204</p>
              <p
                className="m-0 text-[11.5px]"
                style={{ fontFamily: "var(--mono)", color: "#6d6482" }}
              >
                held in escrow
              </p>
            </div>
          </div>

          <dl className="m-0 mt-5 grid grid-cols-2 gap-y-4">
            <Term label={lending ? "You lend" : "You receive"} value="400 USDG" big />
            <Term label="Interest" value="10%" big />
            <Term label="Term" value="7 days" />
            <Term label={lending ? "You're owed" : "You repay"} value="440 USDG" />
          </dl>

          <div className="perforation my-6 h-[2px]" aria-hidden="true" />

          <p
            className="m-0 text-[12.5px] leading-relaxed"
            style={{ color: "#6d6482", fontFamily: "var(--mono)" }}
          >
            {lending
              ? "If day 7 passes unpaid, Boy #1204 transfers to you."
              : "Repay 440 USDG by day 7 and Boy #1204 comes home."}
          </p>
        </article>
      </div>
    </div>
  );
}

function Term({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <dt className="m-0 text-[12px] font-semibold" style={{ color: "#6d6482" }}>
        {label}
      </dt>
      <dd
        className="m-0 mt-0.5 font-bold leading-none"
        style={{ fontFamily: "var(--mono)", fontSize: big ? "21px" : "16px" }}
      >
        {value}
      </dd>
    </div>
  );
}

/* ── The collection ───────────────────────────────────────────────────────*/

function TheBoys() {
  return (
    <section className="px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2
              className="m-0 font-black leading-[1]"
              style={{ fontSize: "clamp(2.1rem, 5vw, 3.2rem)", letterSpacing: "-0.025em" }}
            >
              The Boys
            </h2>
            <p
              className="m-0 mt-5 max-w-[48ch] text-[16.5px] leading-relaxed"
              style={{ color: "var(--fg-dim)" }}
            >
              {COLLECTION.supply} of them, on {COLLECTION.chain}. Loud hair, worse
              attitudes, and a protocol underneath that treats them as collateral
              rather than wallpaper.
            </p>
            <p
              className="m-0 mt-4 max-w-[48ch] text-[16.5px] leading-relaxed"
              style={{ color: "var(--fg-dim)" }}
            >
              Holding one is what gets you into the Hood: borrow against it, lend
              to someone who wants to, and keep it through both.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={LINKS.opensea}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full px-7 py-3.5 text-[14.5px] font-extrabold"
                style={{ background: "var(--lime)", color: "var(--ink)" }}
              >
                Join the Boys
              </a>
              <Link
                href="/about"
                className="inline-flex items-center rounded-full px-7 py-3.5 text-[14.5px] font-extrabold"
                style={{ border: "1px solid rgba(255,255,255,0.22)", color: "#fff" }}
              >
                About the Hood
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TOOLS.map((t, i) => (
              <div
                key={t.image}
                className="overflow-hidden rounded-[18px]"
                style={{
                  aspectRatio: "1/1",
                  border: "1px solid var(--hairline)",
                  transform: i % 2 === 0 ? "rotate(-1.5deg)" : "rotate(1.5deg)",
                }}
              >
                <img
                  src={t.image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Closing band ─────────────────────────────────────────────────────────*/

function JoinBand() {
  return (
    <section className="px-5 pb-24 sm:px-8">
      <div
        className="scanlines relative mx-auto max-w-[1180px] overflow-hidden rounded-[28px] px-8 py-16 text-center sm:py-20"
        style={{ background: "var(--lime)" }}
      >
        <h2
          className="wordmark wordmark--dark m-0"
          style={{ fontSize: "clamp(2rem, 6.5vw, 3.6rem)", lineHeight: 1 }}
        >
          Get in the Hood
        </h2>
        <p
          className="mx-auto m-0 mt-5 max-w-[44ch] text-[16px] font-semibold leading-relaxed"
          style={{ color: "rgba(11,8,24,0.72)" }}
        >
          Grab a Boy, then put him to work. Lending is live — the rest of the
          toolkit lands after mint.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={LINKS.opensea}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[15px] font-extrabold"
            style={{ background: "var(--ink)", color: "var(--lime)" }}
          >
            Join the Boys
          </a>
          <a
            href={LINKS.x}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[15px] font-extrabold"
            style={{ border: "2px solid rgba(11,8,24,0.28)", color: "var(--ink)" }}
          >
            Follow on X
          </a>
        </div>
      </div>
    </section>
  );
}
