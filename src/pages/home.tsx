import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "wouter";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import {
  ART,
  COLLECTION,
  ECONOMIC_LAYERS,
  LINKS,
  MEET_THE_BOYS,
  SNEAK_PEEK,
  TBA_ASSETS,
  TOOLS,
  type Tool,
} from "@/lib/site";

/**
 * Scan-in reveal for artwork below the toolkit. Triggers once per image on
 * first scroll into view, then disconnects — this isn't a general-purpose
 * "everything fades up" pattern, just the one signature treatment for
 * photographic art on this page.
 */
function useRevealed<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, revealed };
}

function RevealArt({
  src,
  alt = "",
  className = "",
  style,
  delay = 0,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}) {
  const { ref, revealed } = useRevealed<HTMLImageElement>();
  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      className={`art-reveal ${revealed ? "art-reveal--in" : ""} ${className}`}
      style={{ ...style, animationDelay: revealed ? `${delay}s` : undefined }}
    />
  );
}

export default function Home() {
  return (
    <div style={{ background: "var(--ink)", minHeight: "100vh" }}>
      <SiteHeader />
      <main>
        <Hero />
        <Toolkit />
        <Gallery
          images={SNEAK_PEEK}
          eyebrow="Sneak peek"
          title="Meet the Boys"
        />
        <Vision />
        <TokenBoundAccounts />
        <HolderEconomics />
        <Gallery images={MEET_THE_BOYS} eyebrow="More of them" title="The Hood" />
        <HowItWorks />
        <JoinBand />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────*/

function Hero() {
  return (
    <section
      className="relative overflow-hidden px-5 pb-20 pt-[130px] sm:px-8 sm:pb-24 sm:pt-[160px]"
      style={{ zIndex: 0 }}
    >
      <img
        src={ART.hero}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ zIndex: -2 }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: -1,
          background:
            "linear-gradient(to bottom, rgba(11,8,24,0.55) 0%, rgba(11,8,24,0.82) 55%, var(--ink) 100%)",
        }}
      />

      <div className="relative mx-auto flex max-w-[1180px] flex-col items-center text-center">
        <img
          src="/logo.png"
          alt=""
          width={96}
          height={96}
          className="rise h-20 w-20 rounded-[22px] sm:h-24 sm:w-24"
          style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
        />

        <h1
          className="wordmark wordmark--light rise m-0 mt-7"
          style={{
            fontSize: "clamp(2.4rem, 10vw, 5.4rem)",
            lineHeight: 0.95,
            animationDelay: "0.08s",
          }}
        >
          BoyMeetsHood
        </h1>

        <p
          className="rise m-0 mt-6 max-w-[34ch] text-[18px] font-semibold leading-snug sm:text-[22px]"
          style={{ color: "#fff", animationDelay: "0.14s" }}
        >
          {COLLECTION.supply} Boys. One Hood.
          <br />
          Real financial utility.
        </p>

        <div
          className="rise mt-9 flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: "0.2s" }}
        >
          <Link
            href="/p2p"
            className="inline-flex items-center justify-center rounded-full px-9 py-4 text-[15px] font-extrabold"
            style={{ background: "var(--lime)", color: "var(--ink)" }}
          >
            Enter the Hood
          </Link>
          <a
            href={LINKS.opensea}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full px-9 py-4 text-[15px] font-extrabold"
            style={{ border: "2px solid rgba(255,255,255,0.35)", color: "#fff" }}
          >
            Join the Boys
          </a>
        </div>

        <dl
          className="rise mt-14 grid w-full max-w-[760px] grid-cols-2 gap-px overflow-hidden rounded-[20px] sm:grid-cols-4"
          style={{
            background: "var(--hairline)",
            boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
            animationDelay: "0.28s",
          }}
        >
          {(
            [
              ["Supply", COLLECTION.supply],
              ["Chain", COLLECTION.chain],
              ["Settles in", "USDG or ETH"],
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
              <dd className="m-0 mt-1.5 text-[15px] font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── Section furniture ───────────────────────────────────────────────────*/

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="m-0 mb-4 text-[12px] uppercase"
      style={{
        fontFamily: "var(--mono)",
        letterSpacing: "0.2em",
        color: "var(--lime)",
      }}
    >
      {children}
    </p>
  );
}

function Heading({ children, max = "18ch" }: { children: ReactNode; max?: string }) {
  return (
    <h2
      className="m-0 font-black leading-[1.02]"
      style={{
        fontSize: "clamp(2rem, 5vw, 3.2rem)",
        letterSpacing: "-0.025em",
        maxWidth: max,
      }}
    >
      {children}
    </h2>
  );
}

/* ── The Hood Toolkit ────────────────────────────────────────────────────*/

function Toolkit() {
  return (
    <section className="px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Utilities</Eyebrow>
            <Heading>The Hood Toolkit</Heading>
          </div>
          <p
            className="m-0 text-[12.5px] uppercase"
            style={{
              fontFamily: "var(--mono)",
              letterSpacing: "0.16em",
              color: "var(--fg-faint)",
            }}
          >
            Everything ships after mint
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  const style: CSSProperties = {
    minHeight: 280,
    border: `2px solid ${tool.live ? "rgba(201,247,61,0.5)" : "var(--hairline)"}`,
  };

  return (
    <Link
      href={tool.href}
      className={`tool-card ${tool.live ? "" : "tool-card--soon"}`}
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
            fontSize: "clamp(1.6rem, 3.4vw, 2.1rem)",
            letterSpacing: "-0.02em",
            color: tool.live ? tool.tint : "#fff",
          }}
        >
          {tool.name}
        </h3>
        <p
          className="m-0 mt-2.5 max-w-[42ch] text-[14px] leading-relaxed"
          style={{ color: "rgba(255,255,255,0.78)" }}
        >
          {tool.blurb}
        </p>
      </div>
    </Link>
  );
}

/* ── Galleries ───────────────────────────────────────────────────────────*/

function Gallery({
  images,
  eyebrow,
  title,
}: {
  images: string[];
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading>{title}</Heading>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {images.map((src, i) => (
            <div
              key={src}
              className="overflow-hidden rounded-[18px]"
              style={{
                aspectRatio: "1/1",
                border: "1px solid var(--hairline)",
                transform: i % 2 === 0 ? "rotate(-1.2deg)" : "rotate(1.2deg)",
              }}
            >
              <RevealArt
                src={src}
                className="h-full w-full object-cover"
                delay={i * 0.08}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Vision ──────────────────────────────────────────────────────────────*/

function Vision() {
  return (
    <section className="px-5 py-24 sm:px-8" style={{ background: "var(--ink-2)" }}>
      <div className="mx-auto max-w-[1180px]">
        <Eyebrow>The vision</Eyebrow>
        <h2
          className="m-0 font-black leading-[0.98]"
          style={{ fontSize: "clamp(2.4rem, 7vw, 4.4rem)", letterSpacing: "-0.03em" }}
        >
          {COLLECTION.supply} Boys.
          <br />
          One Hood.
          <br />
          <span style={{ color: "var(--lime)" }}>Real financial utility.</span>
        </h2>

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="m-0 text-[22px] font-extrabold">The genesis collection</h3>
            <p
              className="m-0 mt-5 max-w-[52ch] text-[16.5px] leading-relaxed"
              style={{ color: "var(--fg-dim)" }}
            >
              BoyMeetsHood is a collection of {COLLECTION.supply} boys built for the{" "}
              {COLLECTION.chain}, where NFTs meet financial infrastructure. Each
              Boy is more than a profile picture.
            </p>
            <p
              className="m-0 mt-4 max-w-[52ch] text-[16.5px] leading-relaxed"
              style={{ color: "var(--fg-dim)" }}
            >
              The long-term vision is for every NFT to become an on-chain
              financial identity with its own smart account.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[ART.fence, ART.chilling].map((src, i) => (
              <div
                key={src}
                className="overflow-hidden rounded-[20px]"
                style={{
                  aspectRatio: "1/1",
                  border: "1px solid var(--hairline)",
                  transform: i === 0 ? "rotate(-2deg)" : "rotate(2deg)",
                }}
              >
                <RevealArt
                  src={src}
                  className="h-full w-full object-cover"
                  delay={i * 0.1}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── ERC-6551 ────────────────────────────────────────────────────────────*/

function TokenBoundAccounts() {
  return (
    <section className="px-5 py-24 sm:px-8">
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div
          className="overflow-hidden rounded-[24px]"
          style={{ border: "1px solid var(--hairline)", aspectRatio: "4/5" }}
        >
          <RevealArt src={ART.seated} className="h-full w-full object-cover" />
        </div>

        <div>
          <Eyebrow>ERC-6551</Eyebrow>
          <Heading max="14ch">The Boy Is the Wallet</Heading>

          <p
            className="m-0 mt-6 max-w-[54ch] text-[16.5px] leading-relaxed"
            style={{ color: "var(--fg-dim)" }}
          >
            Every BoyMeetsHood NFT is designed to be connected to a Token-Bound
            Account. Think of it as a wallet attached to your NFT. When the NFT
            moves, its associated account can move with it according to the TBA
            implementation.
          </p>

          <ul className="m-0 mt-8 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3">
            {TBA_ASSETS.map((asset) => (
              <li
                key={asset}
                className="flex items-center gap-2.5 rounded-[12px] px-4 py-3"
                style={{ background: "var(--ink-2)" }}
              >
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: "var(--lime)" }}
                  aria-hidden="true"
                />
                <span className="text-[13.5px] font-semibold">{asset}</span>
              </li>
            ))}
          </ul>

          <p
            className="m-0 mt-8 text-[18px] font-extrabold leading-snug"
            style={{ color: "var(--lime)" }}
          >
            Your Boy isn't just holding a wallet. Your Boy has a wallet.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Holder economics ────────────────────────────────────────────────────*/

function HolderEconomics() {
  return (
    <section className="px-5 py-24 sm:px-8" style={{ background: "var(--ink-2)" }}>
      <div className="mx-auto max-w-[1180px]">
        <Eyebrow>Holder economics</Eyebrow>
        <Heading max="22ch">
          The goal is to give the NFT an evolving economic role
        </Heading>

        <p
          className="m-0 mt-6 max-w-[58ch] text-[16.5px] leading-relaxed"
          style={{ color: "var(--fg-dim)" }}
        >
          The goal isn't to tell people "buy a JPEG and you'll get rich." The NFT
          becomes the membership and identity layer for the ecosystem.
        </p>

        <ol className="m-0 mt-12 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {ECONOMIC_LAYERS.map((layer, i) => (
            <li
              key={layer}
              className="flex items-center gap-4 rounded-[16px] px-5 py-4"
              style={{ background: "var(--ink)", border: "1px solid var(--hairline)" }}
            >
              <span
                className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[13px] font-black"
                style={{
                  background: i === 0 ? "var(--lime)" : "rgba(255,255,255,0.08)",
                  color: i === 0 ? "var(--ink)" : "#fff",
                  fontFamily: "var(--mono)",
                }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="text-[14.5px] font-bold">{layer}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── How a loan works ────────────────────────────────────────────────────*/

const STEPS: [string, string][] = [
  ["Post what you want", "Pick your Boys, name the amount, the interest and the term."],
  ["Someone funds it", "USDG or ETH lands in your wallet. Your Boys are in escrow."],
  ["Repay before the deadline", "Escrow releases every Boy the moment it clears."],
  ["Or they're the lender's", "No auction, no grace period, no extension."],
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <Eyebrow>Hood Credit</Eyebrow>
        <Heading max="15ch">Borrow against your Boys. Keep your Boys.</Heading>

        <ol className="m-0 mt-12 grid list-none grid-cols-1 gap-8 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, body], i) => (
            <li key={title}>
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-[14px] font-black"
                style={{
                  background: i === 3 ? "var(--punch)" : "var(--lime)",
                  color: i === 3 ? "#fff" : "var(--ink)",
                  fontFamily: "var(--mono)",
                }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="m-0 mt-4 text-[17px] font-extrabold leading-snug">{title}</h3>
              <p
                className="m-0 mt-2 text-[14px] leading-relaxed"
                style={{ color: "var(--fg-dim)" }}
              >
                {body}
              </p>
            </li>
          ))}
        </ol>

        <Link
          href="/p2p"
          className="mt-12 inline-flex items-center rounded-full px-8 py-4 text-[15px] font-extrabold"
          style={{ background: "var(--lime)", color: "var(--ink)" }}
        >
          Open the market
        </Link>
      </div>
    </section>
  );
}

/* ── Closing band ────────────────────────────────────────────────────────*/

function JoinBand() {
  const [hovered, setHovered] = useState(false);

  return (
    <section className="px-5 pb-24 sm:px-8">
      <div
        className="scanlines relative mx-auto max-w-[1180px] overflow-hidden rounded-[28px] px-8 py-16 text-center sm:py-20"
        style={{ background: "var(--lime)" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <h2
          className="wordmark wordmark--dark m-0"
          style={{ fontSize: "clamp(2rem, 6.5vw, 3.6rem)", lineHeight: 1 }}
        >
          Get in the Hood
        </h2>
        <p
          className="mx-auto m-0 mt-5 max-w-[46ch] text-[16px] font-semibold leading-relaxed"
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
            className="inline-flex items-center justify-center rounded-full px-8 py-4 text-[15px] font-extrabold transition-transform"
            style={{
              background: "var(--ink)",
              color: "var(--lime)",
              transform: hovered ? "translateY(-2px)" : "none",
            }}
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
