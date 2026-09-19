import { defineChain } from "viem";

/**
 * Robinhood Chain is not in wagmi's built-in chain list, so it has to be
 * defined by hand and passed into the wagmi config.
 *
 * Chain ids confirmed against this project's earlier deployments:
 *   4663   mainnet
 *   46630  testnet
 *
 * Everything in this build has gone straight to mainnet, so `robinhoodChain`
 * below is the one the app uses. The testnet definition is exported in case a
 * dry run is ever wanted before a risky deploy.
 */

/** RPC and explorer come from .env so they can change without a code edit:
 *
 *   VITE_RH_RPC_URL=https://...
 *   VITE_RH_EXPLORER_URL=https://...
 *
 * Vite only exposes vars prefixed with VITE_, and they're baked in at build
 * time — so on Railway these must be set before the build step, not after.
 */
const RPC_URL = import.meta.env.VITE_RH_RPC_URL ?? "";
const EXPLORER_URL = import.meta.env.VITE_RH_EXPLORER_URL ?? "";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: RPC_URL ? [RPC_URL] : [] } },
  blockExplorers: {
    default: { name: "Explorer", url: EXPLORER_URL },
  },
  testnet: false,
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: RPC_URL ? [RPC_URL] : [] } },
  blockExplorers: {
    default: { name: "Explorer", url: EXPLORER_URL },
  },
  testnet: true,
});

/**
 * False until an RPC endpoint is supplied. Gate wallet reads on this rather
 * than letting wagmi fail with an opaque transport error.
 */
export const CHAIN_CONFIGURED = RPC_URL.length > 0;

/** Build an explorer link for a transaction or address. */
export function explorerUrl(kind: "tx" | "address", value: string): string {
  if (!EXPLORER_URL) return "";
  return `${EXPLORER_URL.replace(/\/$/, "")}/${kind}/${value}`;
}
