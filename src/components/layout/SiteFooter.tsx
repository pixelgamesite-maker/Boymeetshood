import { Link } from "wouter";
import { COLLECTION, LINKS, TOOLS } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer
      className="px-5 pb-14 pt-16 sm:px-8"
      style={{ borderTop: "1px solid var(--hairline)", background: "var(--ink)" }}
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[360px]">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-[12px]"
              />
              <span className="wordmark wordmark--light text-[22px] leading-none">
                BoyMeetsHood
              </span>
            </div>
            <p
              className="mt-5 text-[15px] leading-relaxed"
              style={{ color: "var(--fg-dim)" }}
            >
              {COLLECTION.tagline}
            </p>
            <a
              href={LINKS.opensea}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center rounded-full px-6 py-3 text-[14px] font-extrabold"
              style={{ background: "var(--lime)", color: "var(--ink)" }}
            >
              Join the Boys
            </a>
          </div>

          <div className="flex gap-14 sm:gap-20">
            <Col
              heading="The Hood"
              links={TOOLS.map((t) => [t.name, t.href] as [string, string])}
            />
            <Col
              heading="More"
              links={[
                ["About", "/about"],
                ["FAQ", "/about#faq"],
                ["OpenSea", LINKS.opensea],
                ["X", LINKS.x],
              ]}
            />
          </div>
        </div>

        <div
          className="mt-14 flex flex-col gap-4 pt-7 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <p
            className="m-0 max-w-[560px] text-[12.5px] leading-relaxed"
            style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}
          >
            Lending against NFT collateral carries risk of total loss. Nothing
            here is financial advice.
          </p>
          <p
            className="m-0 text-[12.5px]"
            style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}
          >
            © {new Date().getFullYear()} BoyMeetsHood
          </p>
        </div>
      </div>
    </footer>
  );
}

function Col({ heading, links }: { heading: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-4 text-[14px] font-bold text-white">{heading}</p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("http") ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px]"
                style={{ color: "var(--fg-dim)" }}
              >
                {label}
              </a>
            ) : (
              <Link href={href} className="text-[14px]" style={{ color: "var(--fg-dim)" }}>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
