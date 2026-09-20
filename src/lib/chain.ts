import { defineChain } from "viem";

/**
 * Robinhood Chain — chain id 4663.
 *
 * The real values are the defaults, so a deploy that's missing its env vars
 * still points at the right network. Override any of them in .env when you
 * need to (a private RPC with higher rate limits, for instance):
 *
 *   VITE_CHAIN_ID
 *   VITE_RPC_URL
 *   VITE_EXPLORER_URL
 */

const DEFAULT_ID = 4663;
const DEFAULT_RPC = "https://rpc.mainnet.chain.robinhood.com";
const DEFAULT_EXPLORER = "https://robinhoodchain.blockscout.com";

const envId = Number(import.meta.env.VITE_CHAIN_ID ?? "");
const envRpc = (import.meta.env.VITE_RPC_URL ?? "").trim();
const envExplorer = (import.meta.env.VITE_EXPLORER_URL ?? "").trim();

export const robinhoodChain = defineChain({
  id: Number.isInteger(envId) && envId > 0 ? envId : DEFAULT_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [envRpc.startsWith("http") ? envRpc : DEFAULT_RPC] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: envExplorer.startsWith("http") ? envExplorer : DEFAULT_EXPLORER,
    },
  },
  testnet: false,
});

/** Build an explorer link for a transaction, address or token. */
export function explorerUrl(
  kind: "tx" | "address" | "token",
  value: string,
): string {
  return `${robinhoodChain.blockExplorers.default.url}/${kind}/${value}`;
}
