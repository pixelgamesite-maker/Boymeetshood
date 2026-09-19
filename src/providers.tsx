import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/lib/wagmi";

import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Chain data goes stale fast, but not so fast that every focus event
      // should trigger a refetch storm.
      staleTime: 10_000,
      retry: 1,
    },
  },
});

/** Themed to match the site: lime actions, ink surfaces, Gabarito type. */
const hoodTheme = darkTheme({
  accentColor: "#c9f73d",
  accentColorForeground: "#0b0818",
  borderRadius: "large",
  fontStack: "system",
  overlayBlur: "small",
});

hoodTheme.colors.modalBackground = "#14102e";
hoodTheme.colors.modalBorder = "rgba(255,255,255,0.1)";
hoodTheme.colors.profileForeground = "#1e1746";
hoodTheme.fonts.body = '"Gabarito", "Segoe UI", system-ui, sans-serif';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={hoodTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
