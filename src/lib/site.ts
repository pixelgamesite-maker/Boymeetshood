/**
 * Everything about the collection that appears in more than one place.
 * Change a link, a fact or a card image here and it changes everywhere.
 */

export const LINKS = {
  site: "https://boymeethood.fun",
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

/** Art in /public, used for the hero, galleries and section images. */
export const ART = {
  hero: "/hiding.png",
  boat: "/boat.png",
  seated: "/seated.png",
  swamp: "/swamp.png",
  fence: "/seated-on-fence.png",
  bike: "/riding-bike.jpg",
  stop: "/stop.jpg",
  snowboard: "/snowboarding.png",
  chilling: "/chilling.png",
  basketball: "/basketball.png",
} as const;

/** First gallery, under the toolkit. */
export const SNEAK_PEEK = [ART.boat, ART.seated, ART.stop, ART.chilling];

/** Second gallery, closing out the vision. */
export const MEET_THE_BOYS = [ART.snowboard, ART.bike, ART.swamp, ART.fence];

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
    name: "Hood Credit",
    blurb:
      "Borrow against your Boys without selling them. Post a request or take an offer, in USDG or ETH.",
    href: "/p2p",
    image: ART.swamp,
    tint: "var(--lime)",
    live: true,
  },
  {
    name: "Hood AutoMint",
    blurb: "Non-custodial minting terminal. Free for all holders. Less clicking, less panic.",
    href: "/automint",
    image: ART.bike,
    tint: "var(--sky)",
    live: false,
  },
  {
    name: "Hood Treasury",
    blurb: "Protocol revenue, routed by contract. The 70/30 flywheel.",
    href: "/treasury",
    image: ART.basketball,
    tint: "var(--punch)",
    live: false,
  },
  {
    name: "JUICE",
    blurb: "The Hood needs a scoreboard. Earn it by actually using the protocol.",
    href: "/juice",
    image: ART.snowboard,
    tint: "var(--violet)",
    live: false,
  },
];

/** What a Token-Bound Account can hold. */
export const TBA_ASSETS = [
  "ETH",
  "Stablecoins",
  "NFTs",
  "Tokenized assets",
  "Protocol rewards",
  "Other approved assets",
];

/** The layers a Boy gains as the ecosystem grows. */
export const ECONOMIC_LAYERS = [
  "NFT",
  "Token-Bound Account",
  "Hood Credit",
  "Lending",
  "AutoMint",
  "Hood Treasury",
  "More products",
];
