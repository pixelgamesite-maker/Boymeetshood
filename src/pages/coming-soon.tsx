import { Link, useRoute } from "wouter";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { LINKS, TOOLS } from "@/lib/site";

/**
 * One page, three routes. Reads which tool it is from the URL so pool lending,
 * the treasury and AutoMint don't need three near-identical files.
 */
export default function ComingSoon() {
  const [, params] = useRoute("/:slug");
  const href = `/${params?.slug ?? ""}`;
  const tool = TOOLS.find((t) => t.href === href) ?? TOOLS[1];
  const others = TOOLS.filter((t) => t.href !== tool.href);

  return (
    <div style={{ background: "var(--ink)", minHeight: "100vh" }}>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden px-5 pb-16 pt-[130px] sm:px-8 sm:pt-[160px]">
          <img
            src={tool.image}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ filter: "grayscale(0.75) brightness(0.32)", zIndex: -2 }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              zIndex: -1,
              background:
                "linear-gradient(to bottom, rgba(11,8,24,0.55), rgba(11,8,24,0.96))",
            }}
          />

          <div className="mx-auto max-w-[820px]">
            <span
              className="inline-block rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase"
              style={{
                fontFamily: "var(--mono)",
                letterSpacing: "0.14em",
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
              }}
            >
              Coming soon
            </span>

            <h1
              className="m-0 mt-6 font-black leading-[1]"
              style={{
                fontSize: "clamp(2.4rem, 8vw, 4.4rem)",
                letterSpacing: "-0.03em",
                color: tool.tint,
              }}
            >
              {tool.name}
            </h1>

            <p
              className="m-0 mt-6 max-w-[50ch] text-[17px] leading-relaxed sm:text-[19px]"
              style={{ color: "var(--fg-dim)" }}
            >
              {tool.blurb}
            </p>

            <p
              className="m-0 mt-4 max-w-[50ch] text-[15.5px] leading-relaxed"
              style={{ color: "var(--fg-faint)" }}
            >
              This one ships after mint. P2P lending is live now, and it's the
              same escrow underneath — so nothing you do there gets thrown away
              when the rest of the toolkit lands.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/p2p"
                className="inline-flex items-center rounded-full px-7 py-3.5 text-[14.5px] font-extrabold"
                style={{ background: "var(--lime)", color: "var(--ink)" }}
              >
                Use P2P Lending
              </Link>
              <a
                href={LINKS.x}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-full px-7 py-3.5 text-[14.5px] font-extrabold"
                style={{ border: "1px solid rgba(255,255,255,0.22)", color: "#fff" }}
              >
                Get told when it's live
              </a>
            </div>
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-8">
          <div className="mx-auto max-w-[820px]">
            <h2 className="m-0 text-[18px] font-extrabold">Elsewhere in the Hood</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {others.map((t) => (
                <Link
                  key={t.name}
                  href={t.href}
                  className="rounded-[16px] p-5"
                  style={{ background: "var(--ink-2)" }}
                >
                  <span
                    className="inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                    style={{
                      background: t.live ? "var(--lime)" : "rgba(255,255,255,0.09)",
                      color: t.live ? "var(--ink)" : "var(--fg-faint)",
                    }}
                  >
                    {t.live ? "Live" : "Soon"}
                  </span>
                  <p className="m-0 mt-3 text-[15.5px] font-extrabold">{t.name}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
