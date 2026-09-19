/**
 * wagmi + RainbowKit config.
 *
 * NOT imported anywhere yet — wiring this into the app before the deps are
 * installed and the chain values are filled in would break the build. Install,
 * fill in, then say the word and the header's Connect button gets swapped for
 * the real one.
 *
 * Install:
 *   npm i wagmi viem @tanstack/react-query @rainbow-me/rainbowkit
 *
 * On React 19: RainbowKit's dependency tree still peers against React 18
 * (that's the valtio / use-sync-external-store warning in your build log). If
 * it throws at runtime rather than install time, pinning React to 18.3.1 is
 * the usual fix.
 */

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { robinhoodChain } from "@/lib/chain";

/**
 * WalletConnect project id — free, from https://cloud.reown.com
 * Put it in .env as VITE_WALLETCONNECT_PROJECT_ID. Without it, only injected
 * wallets (MetaMask and friends) will connect; mobile deep links won't.
 */
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "";

export const wagmiConfig = getDefaultConfig({
  appName: "BoyMeetsHood",
  projectId,
  chains: [robinhoodChain],
  ssr: false,
});
