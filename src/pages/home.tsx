import { useState, type CSSProperties, type MouseEvent } from "react";
import { Link } from "wouter";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

/* ──────────────────────────────────────────────────────────────────────────
   Content
   ────────────────────────────────────────────────────────────────────────── */

const FACTS: [string, string][] = [
  ["Supply", "2,666 Boys"],
  ["Settles in", "USDG"],
  ["Network", "Robinhood Chain"],
  ["Model", "Peer-to-peer"],
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "A lender posts an offer",
    body: "They set the amount, the interest, how long you get, and which Boys they will take as collateral. The offer sits on the market until someone takes it.",
  },
  {
    title: "You take the offer that suits you",
    body: "No haggling, no waiting to be matched. Pick a live offer, and your Boy moves into escrow as the USDG lands in your wallet.",
  },
  {
    title: "You repay before the deadline",
    body: "Principal plus interest, in USDG. The contract releases your Boy back to you the moment it clears — the lender does not have to approve anything.",
  },
  {
    title: "Or you miss it, and the Boy is theirs",
    body: "The deadline is hard. No auction, no grace period, no extension. The lender priced that risk into the offer you accepted.",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I have to sell my Boy to get liquidity?",
    a: "No. That is the whole point. Your Boy sits in escrow for the length of the loan and comes straight back to your wallet when you repay.",
  },
  {
    q: "Can I use my Boy while the loan is active?",
    a: "No. Collateral is locked in the contract for the full term. You get it back on repayment, or you lose it on default.",
  },
  {
    q: "What happens the second I miss the deadline?",
    a: "The Boy transfers to your lender. There is no grace period and no partial repayment — treat the deadline as final when you accept an offer.",
  },
  {
    q: "Who decides the interest rate?",
    a: "Lenders do. Each writes their own offer, and competing offers are what move rates. The protocol does not set a house rate.",
  },
  {
    q: "Why USDG instead of the chain's native token?",
    a: "A loan denominated in a volatile asset can blow up on both sides before the term is even up. USDG keeps what you borrow and what you owe the same number.",
  },
  {
    q: "Will other collections be supported?",
    a: "Not at launch. The contracts take the collection address as a parameter, so adding one later is a deployment rather than a rewrite.",
  },
];

const TOOLKIT: { name: string; body: string; tint: string; live: boolean }[] = [
  {
    name: "Hood Credit",
    body: "Borrow against your Boy without selling it. Peer-to-peer offers, settled in USDG.",
    tint: "var(--lime)",
    live: true,
  },
  {
    name: "Hood AutoMint",
    body: "Non-custodial minting terminal. Free for holders. Less clicking, less panic.",
    tint: "var(--sky)",
    live: false,
  },
  {
    name: "Hood Treasury",
    body: "Protocol revenue routed by contract, verifiable on-chain.",
    tint: "var(--punch)",
    live: false,
  },
  {
    name: "JUICE",
    body: "The Hood needs a scoreboard. Earn it by actually using the protocol.",
    tint: "var(--violet)",
    live: false,
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <div style={{ background: "var(--ink)", minHeight: "100vh" }}>
      <SiteHeader />
      <main>
        <Hero />
        <Facts />
        <HowItWorks />
        <Scope />
        <Toolkit />
        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────*/

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-20 pt-[120px] sm:px-8 sm:pt-[150px]">
      {/* Night sky */}
      <div
        className="starfield pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background: `radial-gradient(1100px 620px at 78% 8%, rgba(107,75,255,0.30), transparent 62%),
                       radial-gradient(760px 480px at 10% 32%, rgba(69,214,245,0.16), transparent 66%)`,
        }}
      />
      <div className="starfield pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div>
          <h1
            className="rise hood-wordmark"
            style={{
              fontSize: "clamp(2.9rem, 8.5vw, 5.1rem)",
              lineHeight: 0.94,
              margin: 0,
            }}
          >
            Borrow against
            <br />
            your Boy.
            <br />
            Keep your Boy.
          </h1>

          <p
            className="rise mt-7 max-w-[46ch] text-[17px] leading-relaxed sm:text-[18px]"
            style={{ color: "var(--fg-dim)", animationDelay: "0.1s" }}
          >
            Lock your NFT in escrow, take USDG today, and pay it back before the
            clock runs out. Repay and it comes home. Miss the deadline and your
            lender keeps it.
          </p>

          <div
            className="rise mt-9 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "0.18s" }}
          >
            <Link
              href="/market"
              className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[15px] font-extrabold transition-transform"
              style={{ background: "var(--lime)", color: "var(--ink)" }}
              onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) =>
                (e.currentTarget.style.transform = "translateY(-2px)")
              }
              onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.transform = "")}
            >
              Browse offers
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[15px] font-bold transition-colors"
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
              }}
              onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
              }
              onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.background = "transparent")}
            >
              How it works
            </a>
          </div>
        </div>

        <LoanTicket />
      </div>
    </section>
  );
}

/* ── The loan ticket — the one bold object on the page ────────────────────*/

type Side = "borrow" | "lend";

function LoanTicket() {
  const [side, setSide] = useState<Side>("borrow");
  const borrowing = side === "borrow";

  return (
    <div className="ticket-drop justify-self-center lg:justify-self-end">
      <div
        className="w-[330px] sm:w-[382px]"
        style={{ transform: "rotate(-2.2deg)" }}
      >
        {/* Side switch, sitting on the paper's shoulder */}
        <div
          className="mb-3 inline-flex gap-1 rounded-full p-1"
          style={{ background: "rgba(255,255,255,0.08)" }}
          role="tablist"
          aria-label="Show the ticket from either side"
        >
          {(["borrow", "lend"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={side === s}
              onClick={() => setSide(s)}
              className="rounded-full px-4 py-1.5 text-[12.5px] font-bold capitalize transition-colors"
              style={{
                background: side === s ? "var(--lime)" : "transparent",
                color: side === s ? "var(--ink)" : "var(--fg-dim)",
              }}
            >
              {s === "borrow" ? "I'm borrowing" : "I'm lending"}
            </button>
          ))}
        </div>

        <article
          className="ticket-notch relative rounded-[18px] px-7 pb-7 pt-6"
          style={
            {
              background: "var(--paper)",
              color: "var(--paper-ink)",
              boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
              "--notch-y": "58%",
            } as CSSProperties
          }
        >
          <header className="flex items-start justify-between">
            <div>
              <p className="m-0 text-[19px] font-extrabold leading-none">
                Loan ticket
              </p>
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
            <div
              className="h-12 w-12 flex-shrink-0 rounded-[10px]"
              style={{
                background:
                  "linear-gradient(145deg, var(--sky), var(--violet) 55%, var(--punch))",
              }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="m-0 text-[14.5px] font-bold leading-tight">
                Boy #1204
              </p>
              <p
                className="m-0 text-[11.5px]"
                style={{ fontFamily: "var(--mono)", color: "#6d6482" }}
              >
                held in escrow
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-y-4">
            <Term label={borrowing ? "You receive" : "You lend"} value="400 USDG" big />
            <Term label="Interest" value="10%" big />
            <Term label="Term" value="7 days" />
            <Term
              label={borrowing ? "You repay" : "You're owed"}
              value="440 USDG"
            />
          </dl>

          <div className="perforation my-6 h-[2px]" aria-hidden="true" />

          <p
            className="m-0 text-[12.5px] leading-relaxed"
            style={{ color: "#6d6482", fontFamily: "var(--mono)" }}
          >
            {borrowing
              ? "Repay 440 USDG by day 7 and Boy #1204 returns to your wallet automatically."
              : "If day 7 passes unpaid, Boy #1204 transfers to you. No auction, no grace period."}
          </p>
        </article>
      </div>
    </div>
  );
}

function Term({
  label,
  value,
  big = false,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div>
      <dt className="m-0 text-[12px] font-semibold" style={{ color: "#6d6482" }}>
        {label}
      </dt>
      <dd
        className="m-0 mt-0.5 font-bold leading-none"
        style={{
          fontFamily: "var(--mono)",
          fontSize: big ? "21px" : "16px",
        }}
      >
        {value}
      </dd>
    </div>
  );
}

/* ── Facts strip ──────────────────────────────────────────────────────────*/

function Facts() {
  return (
    <section className="px-5 sm:px-8">
      <div
        className="mx-auto grid max-w-[1180px] grid-cols-2 gap-px overflow-hidden rounded-[20px] md:grid-cols-4"
        style={{ background: "var(--hairline)" }}
      >
        {FACTS.map(([label, value]) => (
          <div key={label} className="px-6 py-6" style={{ background: "var(--ink)" }}>
            <p
              className="m-0 text-[12px]"
              style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}
            >
              {label}
            </p>
            <p className="m-0 mt-1.5 text-[19px] font-extrabold">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── How it works ─────────────────────────────────────────────────────────*/

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <h2
          className="m-0 max-w-[16ch] font-black leading-[0.98]"
          style={{ fontSize: "clamp(2.1rem, 5vw, 3.3rem)", letterSpacing: "-0.02em" }}
        >
          Four steps, and the contract does three of them.
        </h2>

        <ol className="mt-14 grid list-none grid-cols-1 gap-x-10 gap-y-12 p-0 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-5">
              <span
                className="mt-1 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[15px] font-black"
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
                <h3 className="m-0 text-[20px] font-extrabold leading-snug">
                  {step.title}
                </h3>
                <p
                  className="m-0 mt-2.5 max-w-[52ch] text-[15.5px] leading-relaxed"
                  style={{ color: "var(--fg-dim)" }}
                >
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── What ships now vs later ──────────────────────────────────────────────*/

function Scope() {
  return (
    <section className="px-5 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div
          className="rounded-[26px] p-8 sm:p-12"
          style={{ background: "var(--ink-2)" }}
        >
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <div>
              <span
                className="inline-block rounded-full px-3 py-1 text-[11.5px] font-bold"
                style={{ background: "var(--lime)", color: "var(--ink)" }}
              >
                Live at launch
              </span>
              <h2
                className="m-0 mt-5 font-black leading-[1.02]"
                style={{ fontSize: "clamp(1.9rem, 4vw, 2.7rem)", letterSpacing: "-0.02em" }}
              >
                Peer-to-peer lending
              </h2>
              <p
                className="m-0 mt-4 max-w-[54ch] text-[16px] leading-relaxed"
                style={{ color: "var(--fg-dim)" }}
              >
                One lender, one borrower, one Boy. Lenders write offers, you take
                the one you like, and the escrow contract handles the rest. No
                oracle, no pooled capital, nothing to be liquidated out from under
                you by a price feed.
              </p>
              <Link
                href="/market"
                className="mt-7 inline-flex items-center rounded-full px-7 py-3.5 text-[14.5px] font-extrabold"
                style={{ background: "var(--lime)", color: "var(--ink)" }}
              >
                Browse offers
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              <p
                className="m-0 text-[13px]"
                style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}
              >
                Not in this release
              </p>
              <NextUp
                name="Pool lending"
                body="Shared liquidity and instant borrowing against a protocol-set LTV. Needs a price feed the collection cannot yet support honestly."
              />
              <NextUp
                name="Buy now, pay later"
                body="Finance a Boy at purchase and pay it down over time."
              />
              <NextUp
                name="More collections"
                body="The contracts already take a collection address, so this is a deployment, not a rebuild."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NextUp({ name, body }: { name: string; body: string }) {
  return (
    <div
      className="rounded-[14px] p-5"
      style={{ background: "rgba(255,255,255,0.04)" }}
    >
      <p className="m-0 text-[15px] font-bold">{name}</p>
      <p
        className="m-0 mt-1.5 text-[13.5px] leading-relaxed"
        style={{ color: "var(--fg-dim)" }}
      >
        {body}
      </p>
    </div>
  );
}

/* ── Toolkit ──────────────────────────────────────────────────────────────*/

function Toolkit() {
  return (
    <section id="toolkit" className="scroll-mt-24 px-5 py-28 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <h2
          className="m-0 font-black leading-[1.02]"
          style={{ fontSize: "clamp(2.1rem, 5vw, 3.3rem)", letterSpacing: "-0.02em" }}
        >
          The Hood Toolkit
        </h2>
        <p
          className="m-0 mt-4 max-w-[52ch] text-[16px] leading-relaxed"
          style={{ color: "var(--fg-dim)" }}
        >
          Everything ships after mint. Hood Credit is first out the door.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLKIT.map((tool) => (
            <article
              key={tool.name}
              className="relative flex flex-col rounded-[20px] p-6"
              style={{
                background: tool.live ? tool.tint : "var(--ink-2)",
                color: tool.live ? "var(--ink)" : "#fff",
                minHeight: "196px",
              }}
            >
              <span
                className="self-start rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                style={{
                  background: tool.live
                    ? "rgba(14,10,40,0.9)"
                    : "rgba(255,255,255,0.08)",
                  color: tool.live ? tool.tint : "var(--fg-faint)",
                }}
              >
                {tool.live ? "Live" : "Coming soon"}
              </span>
              <h3 className="m-0 mt-auto pt-6 text-[21px] font-extrabold">
                {tool.name}
              </h3>
              <p
                className="m-0 mt-2 text-[13.5px] leading-relaxed"
                style={{
                  color: tool.live ? "rgba(14,10,40,0.72)" : "var(--fg-dim)",
                }}
              >
                {tool.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────────*/

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 px-5 pb-28 sm:px-8">
      <div className="mx-auto max-w-[820px]">
        <h2
          className="m-0 font-black leading-[1.02]"
          style={{ fontSize: "clamp(2.1rem, 5vw, 3.3rem)", letterSpacing: "-0.02em" }}
        >
          Questions
        </h2>

        <div className="mt-10">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} style={{ borderTop: "1px solid var(--hairline)" }}>
                <h3 className="m-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left"
                    style={{ background: "none", border: "none", color: "#fff" }}
                  >
                    <span className="text-[17px] font-bold sm:text-[18px]">
                      {f.q}
                    </span>
                    <span
                      className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[17px] font-bold transition-transform"
                      style={{
                        background: isOpen ? "var(--lime)" : "rgba(255,255,255,0.08)",
                        color: isOpen ? "var(--ink)" : "#fff",
                        transform: isOpen ? "rotate(45deg)" : "none",
                      }}
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </button>
                </h3>
                {isOpen && (
                  <p
                    className="m-0 max-w-[62ch] pb-7 text-[15.5px] leading-relaxed"
                    style={{ color: "var(--fg-dim)" }}
                  >
                    {f.a}
                  </p>
                )}
              </div>
            );
          })}
          <div style={{ borderTop: "1px solid var(--hairline)" }} />
        </div>
      </div>
    </section>
  );
}
