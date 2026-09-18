import { useState } from "react";
import { Link } from "wouter";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { COLLECTION, LINKS, TOOLS } from "@/lib/site";

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is BoyMeetsHood?",
    a: `A ${COLLECTION.supply}-piece NFT collection on ${COLLECTION.chain}, with a lending protocol built underneath it. Holding a Boy is what gets you access to the Hood Toolkit.`,
  },
  {
    q: "Why did supply change?",
    a: `The collection didn't mint out at its original size, so supply was cut to ${COLLECTION.supply}. Fewer Boys, same Hood.`,
  },
  {
    q: "Do I have to sell my Boy to get liquidity?",
    a: "No. That's the whole point. Your Boy sits in escrow for the length of the loan and comes straight back to your wallet when you repay.",
  },
  {
    q: "Can I use my Boy while a loan is active?",
    a: "No. Collateral is locked in the contract for the full term. You get it back on repayment, or you lose it on default.",
  },
  {
    q: "What happens the second I miss the deadline?",
    a: "The Boy transfers to your lender. There's no grace period and no partial repayment — treat the deadline as final when you accept an offer.",
  },
  {
    q: "Who decides the interest rate?",
    a: "Lenders do. Each writes their own offer, and competing offers are what move rates. The protocol doesn't set a house rate.",
  },
  {
    q: `Why ${COLLECTION.currency} instead of the chain's native token?`,
    a: "A loan denominated in a volatile asset can blow up on both sides before the term is even up. USDG keeps what you borrow and what you owe the same number.",
  },
  {
    q: "When does the rest of the toolkit ship?",
    a: "After mint. P2P lending is live first; pool lending, the treasury and AutoMint follow.",
  },
  {
    q: "Will other collections be supported?",
    a: "Not at launch. The contracts take a collection address as a parameter, so adding one later is a deployment rather than a rewrite.",
  },
];

export default function About() {
  return (
    <div style={{ background: "var(--ink)", minHeight: "100vh" }}>
      <SiteHeader />
      <main>
        <section
          className="scanlines relative overflow-hidden px-5 pb-16 pt-[130px] sm:px-8 sm:pt-[160px]"
          style={{ background: "var(--lime)" }}
        >
          <div className="mx-auto max-w-[900px]">
            <h1
              className="wordmark wordmark--dark glitch m-0"
              data-text="About the Hood"
              style={{ fontSize: "clamp(2.2rem, 8vw, 4.2rem)", lineHeight: 0.98 }}
            >
              About the Hood
            </h1>
            <p
              className="m-0 mt-6 max-w-[52ch] text-[17px] font-semibold leading-relaxed sm:text-[19px]"
              style={{ color: "rgba(11,8,24,0.76)" }}
            >
              {COLLECTION.supply} Boys, and a protocol that treats them as
              something you can actually borrow against.
            </p>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-[900px] gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <h2
                className="m-0 font-black leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", letterSpacing: "-0.02em" }}
              >
                The collection
              </h2>
              <p
                className="m-0 mt-5 text-[16px] leading-relaxed"
                style={{ color: "var(--fg-dim)" }}
              >
                BoyMeetsHood is {COLLECTION.supply} characters on{" "}
                {COLLECTION.chain}. The art came first, but the point was never
                just the art — most PFP collections give you a picture and a
                Discord role. This one gives you collateral.
              </p>
              <p
                className="m-0 mt-4 text-[16px] leading-relaxed"
                style={{ color: "var(--fg-dim)" }}
              >
                Every Boy can be locked in escrow to borrow {COLLECTION.currency}{" "}
                from another holder, then reclaimed on repayment. No selling, no
                waiting for a bid, no giving up your spot in the Hood.
              </p>

              <h2
                className="m-0 mt-12 font-black leading-[1.05]"
                style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", letterSpacing: "-0.02em" }}
              >
                The toolkit
              </h2>
              <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
                {TOOLS.map((t) => (
                  <li key={t.name}>
                    <Link
                      href={t.href}
                      className="flex items-center justify-between gap-4 rounded-[14px] px-5 py-4"
                      style={{ background: "var(--ink-2)" }}
                    >
                      <span>
                        <span className="block text-[15px] font-bold">{t.name}</span>
                        <span
                          className="mt-1 block text-[13px] leading-relaxed"
                          style={{ color: "var(--fg-dim)" }}
                        >
                          {t.blurb}
                        </span>
                      </span>
                      <span
                        className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                        style={{
                          background: t.live ? "var(--lime)" : "rgba(255,255,255,0.09)",
                          color: t.live ? "var(--ink)" : "var(--fg-faint)",
                        }}
                      >
                        {t.live ? "Live" : "Soon"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div
                className="overflow-hidden rounded-[22px]"
                style={{ border: "1px solid var(--hairline)" }}
              >
                <img
                  src={TOOLS[0].image}
                  alt=""
                  className="block h-full w-full object-cover"
                  style={{ aspectRatio: "4/5" }}
                />
              </div>
              <dl
                className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[18px]"
                style={{ background: "var(--hairline)" }}
              >
                {(
                  [
                    ["Supply", COLLECTION.supply],
                    ["Chain", COLLECTION.chain],
                    ["Settles in", COLLECTION.currency],
                    ["Lending", "Live"],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="px-5 py-4" style={{ background: "var(--ink-2)" }}>
                    <dt
                      className="m-0 text-[11px] uppercase"
                      style={{
                        fontFamily: "var(--mono)",
                        letterSpacing: "0.12em",
                        color: "var(--fg-faint)",
                      }}
                    >
                      {k}
                    </dt>
                    <dd className="m-0 mt-1 text-[15px] font-extrabold">{v}</dd>
                  </div>
                ))}
              </dl>
              <a
                href={LINKS.opensea}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center rounded-full px-7 py-3.5 text-[14.5px] font-extrabold"
                style={{ background: "var(--lime)", color: "var(--ink)" }}
              >
                Join the Boys
              </a>
            </div>
          </div>
        </section>

        <Faq />
      </main>
      <SiteFooter />
    </div>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="scroll-mt-24 px-5 py-20 sm:px-8"
      style={{ background: "var(--ink-2)" }}
    >
      <div className="mx-auto max-w-[820px]">
        <h2
          className="m-0 font-black leading-[1]"
          style={{ fontSize: "clamp(2rem, 5vw, 3rem)", letterSpacing: "-0.025em" }}
        >
          Questions
        </h2>

        <div className="mt-9">
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
                    style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
                  >
                    <span className="text-[16.5px] font-bold sm:text-[18px]">{f.q}</span>
                    <span
                      className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[17px] font-bold"
                      style={{
                        background: isOpen ? "var(--lime)" : "rgba(255,255,255,0.09)",
                        color: isOpen ? "var(--ink)" : "#fff",
                        transform: isOpen ? "rotate(45deg)" : "none",
                        transition: "transform 0.2s",
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
