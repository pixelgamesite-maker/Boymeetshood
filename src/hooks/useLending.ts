import { useCallback, useEffect, useRef, useState } from "react";
import type { Loan, Offer, OwnedBoy } from "@/types/lending";
import * as protocol from "@/lib/mock";

/**
 * Every read and write the UI does goes through this file.
 *
 * When the contracts are live, replace the bodies with wagmi's useReadContract
 * and useWriteContract. The return shapes below must not change — that's what
 * keeps the swap from touching any component.
 */

export const MY_ADDRESS = protocol.MOCK_ME;

interface Query<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useQuery<T>(fetcher: () => Promise<T>): Query<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest fetcher without making it a dependency
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cancel = load();
    // Re-read whenever the protocol state changes under us
    const unsubscribe = protocol.subscribe(() => load());
    return () => {
      cancel();
      unsubscribe();
    };
  }, [load]);

  return { data, loading, error, refetch: load };
}

/** Every offer currently open on the market. */
export function useOffers(): Query<Offer[]> {
  return useQuery(protocol.fetchOffers);
}

/** Every loan touching the connected wallet, as borrower or as lender. */
export function useMyLoans(): Query<Loan[]> {
  return useQuery(protocol.fetchLoans);
}

/** Boys held by the connected wallet, and whether each is free to pledge. */
export function useMyBoys(): Query<OwnedBoy[]> {
  return useQuery(protocol.fetchWallet);
}

/* ── Writes ──────────────────────────────────────────────────────────────*/

interface Action<Args extends unknown[]> {
  run: (...args: Args) => Promise<boolean>;
  pending: boolean;
  error: string | null;
  reset: () => void;
}

function useAction<Args extends unknown[]>(
  fn: (...args: Args) => Promise<unknown>,
): Action<Args> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      setPending(true);
      setError(null);
      try {
        await fn(...args);
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Transaction failed.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}

export const useTakeOffer = () => useAction(protocol.takeOffer);
export const useRepayLoan = () => useAction(protocol.repayLoan);
export const useClaimCollateral = () => useAction(protocol.claimCollateral);
export const useCreateOffer = () => useAction(protocol.createOffer);
export const useCancelOffer = () => useAction(protocol.cancelOffer);

/* ── Countdown ───────────────────────────────────────────────────────────*/

/** Unix seconds, ticking once a second. Drives every deadline on the page. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(
      () => setNow(Math.floor(Date.now() / 1000)),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
