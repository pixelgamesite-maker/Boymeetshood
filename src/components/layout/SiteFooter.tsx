import type { MouseEvent } from "react";
import { Link } from "wouter";

const X_URL = "https://x.com/boymeetshood";

export default function SiteFooter() {
  return (
    <footer
      className="px-5 pb-14 pt-16 sm:px-8"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[340px]">
            <span className="hood-wordmark text-[26px] leading-none">
              BoyMeetsHood
            </span>
            <p
              className="mt-4 text-[15px] leading-relaxed"
              style={{ color: "var(--fg-dim)" }}
            >
              Borrow USDG against your Boy without selling it. 2,666 Boys on
              Robinhood Chain.
            </p>
          </div>

          <div className="flex gap-14 sm:gap-20">
            <FooterCol
              heading="Protocol"
              links={[
                ["Market", "/market"],
                ["How it works", "/#how"],
                ["FAQ", "/#faq"],
              ]}
            />
            <FooterCol
              heading="Collection"
              links={[
                ["X", X_URL],
                ["Toolkit", "/#toolkit"],
              ]}
            />
          </div>
        </div>

        <div
          className="mt-14 flex flex-col gap-4 pt-7 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <p
            className="max-w-[560px] text-[12.5px] leading-relaxed"
            style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}
          >
            Lending against NFT collateral carries risk of total loss. Nothing
            here is financial advice.
          </p>
          <p
            className="text-[12.5px]"
            style={{ color: "var(--fg-faint)", fontFamily: "var(--mono)" }}
          >
            © {new Date().getFullYear()} BoyMeetsHood
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  heading,
  links,
}: {
  heading: string;
  links: [string, string][];
}) {
  return (
    <div>
      <p className="mb-4 text-[14px] font-bold text-white">{heading}</p>
      <ul className="flex flex-col gap-2.5">
        {links.map(([label, href]) => {
          const external = href.startsWith("http");
          return (
            <li key={label}>
              {external ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] transition-colors"
                  style={{ color: "var(--fg-dim)" }}
                  onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) =>
                    (e.currentTarget.style.color = "var(--fg-dim)")
                  }
                >
                  {label}
                </a>
              ) : (
                <Link
                  href={href}
                  className="text-[14px] transition-colors"
                  style={{ color: "var(--fg-dim)" }}
                  onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) =>
                    (e.currentTarget.style.color = "var(--fg-dim)")
                  }
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
