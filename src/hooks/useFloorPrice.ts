import { useEffect, useState } from "react";

/**
 * Collection floor price, straight from OpenSea's own stats — not the
 * on-chain contract. This is display-only: it exists so people have a
 * number to price a request or an offer against, nothing more. The escrow
 * contract has no idea this exists and never will; enforcing a floor
 * on-chain against a thin, 2,666-supply book is exactly the manipulation
 * risk we deliberately kept out of it.
 *
 * The request goes through our own server (`/api/floor-price`), not
 * straight to OpenSea, because a browser call would need OpenSea's API key
 * exposed in the bundle and has a real history of being blocked by CORS
 * anyway. See server.js for the proxy.
 */

export interface FloorPrice {
  /** In OpenSea's own reporting currency for this collection (see `symbol`). */
  value: number;
  symbol: string;
  /** True if OpenSea couldn't be reached and this is the last good value. */
  stale: boolean;
  updatedAt: number;
}

interface FloorPriceState {
  data: FloorPrice | null;
  loading: boolean;
  /** Set only when there has never been a value to show. */
  error: "not_configured" | "upstream_error" | "network" | null;
}

const POLL_MS = 90_000;

export function useFloorPrice(): FloorPriceState {
  const [state, setState] = useState<FloorPriceState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/floor-price");
        const body = await res.json();
        if (cancelled) return;

        if (body.ok) {
          setState({
            data: {
              value: body.value,
              symbol: body.symbol,
              stale: Boolean(body.stale),
              updatedAt: body.fetchedAt,
            },
            loading: false,
            error: null,
          });
        } else {
          setState((s) => ({ ...s, loading: false, error: body.reason ?? "upstream_error" }));
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: "network" }));
        }
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}
