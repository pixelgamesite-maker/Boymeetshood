import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { robinhoodChain } from "@/lib/chain";

/**
 * WalletConnect project id — free from https://cloud.reown.com
 * Set VITE_WALLETCONNECT_PROJECT_ID in .env. Without it, injected wallets
 * (MetaMask and friends) still work, but mobile deep links won't.
 */
const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "").trim();

export const WALLETCONNECT_READY = projectId.length > 0;

export const wagmiConfig = getDefaultConfig({
  appName: "BoyMeetsHood",
  appDescription: "Borrow USDG against your Boy without selling it.",
  appUrl: "https://boymeetshood.xyz",
  appIcon: "/logo.png",
  // getDefaultConfig requires a string; an empty one degrades to injected-only
  // rather than throwing.
  projectId: projectId || "boymeetshood-dev",
  chains: [robinhoodChain],
  ssr: false,
});
