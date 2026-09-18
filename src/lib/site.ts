/**
 * Everything about the collection that appears in more than one place.
 * Change a link or a card image here and it changes everywhere.
 */

export const LINKS = {
  opensea: "https://opensea.io/collection/boymeetshood",
  x: "https://x.com/boymeetsh00d",
} as const;

export const COLLECTION = {
  name: "BoyMeetsHood",
  supply: "2,666",
  chain: "Robinhood Chain",
  currency: "USDG",
  tagline: "2,666 Boys. One Hood. Real financial utility.",
} as const;

/**
 * The art lives in /public. Swap any src below if a picture suits a different
 * card — the mapping is a guess at what each file shows.
 */
export interface Tool {
  name: string;
  blurb: string;
  href: string;
  image: string;
  tint: string;
  live: boolean;
}

export const TOOLS: Tool[] = [
  {
    name: "P2P Lending",
    blurb: "Borrow USDG against your Boy without selling it. Lenders post, you pick.",
    href: "/p2p",
    image: "/winter-md.png",
    tint: "var(--lime)",
    live: true,
  },
  {
    name: "Pool Lending",
    blurb: "Instant liquidity from a shared pool, priced by protocol risk parameters.",
    href: "/pool",
    image: "/umbrella-sm.png",
    tint: "var(--sky)",
    live: false,
  },
  {
    name: "Hood Treasury",
    blurb: "Protocol revenue routed by contract. The 70/30 flywheel, verifiable on-chain.",
    href: "/treasury",
    image: "/gold-sm.png",
    tint: "var(--punch)",
    live: false,
  },
  {
    name: "Hood AutoMint",
    blurb: "Non-custodial minting terminal. Free for holders. Less clicking, less panic.",
    href: "/automint",
    image: "/wall-sm.png",
    tint: "var(--violet)",
    live: false,
  },
];
