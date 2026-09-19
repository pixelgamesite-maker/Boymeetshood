import { defineChain } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * Robinhood Chain isn't in wagmi's built-in chain list, so it's defined here
 * and read from .env — that way deploying to a different network never means
 * editing source.
 *
 *   VITE_CHAIN_ID        numeric chain id
 *   VITE_RPC_URL         https RPC endpoint
 *   VITE_EXPLORER_URL    block explorer base url
 *
 * Until those exist, the app falls back to Arbitrum Sepolia. Robinhood Chain
 * is on the Arbitrum stack, so a testnet there behaves closely enough to
 * verify wallet connection, network switching and signing.
 *
 * ⚠️ The fallback is for development only. Never ship a build where
 *    CHAIN_CONFIGURED is false — it would point real users at a testnet.
 */

const envId = Number(import.meta.env.VITE_CHAIN_ID ?? "");
const envRpc = (import.meta.env.VITE_RPC_URL ?? "").trim();
const envExplorer = (import.meta.env.VITE_EXPLORER_URL ?? "").trim();

export const CHAIN_CONFIGURED =
  Number.isInteger(envId) && envId > 0 && envRpc.startsWith("http");

export const robinhoodChain = CHAIN_CONFIGURED
  ? defineChain({
      id: envId,
      name: "Robinhood Chain",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [envRpc] } },
      blockExplorers: envExplorer
        ? { default: { name: "Explorer", url: envExplorer } }
        : undefined,
      testnet: false,
    })
  : arbitrumSepolia;

/** Build an explorer link for a transaction or address. */
export function explorerUrl(kind: "tx" | "address", value: string): string {
  const base = robinhoodChain.blockExplorers?.default.url;
  return base ? `${base}/${kind}/${value}` : "";
}
