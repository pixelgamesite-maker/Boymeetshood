import { useState } from "react";
import type { Offer, OwnedBoy } from "@/types/lending";
import {
  describeCollateral,
  formatDuration,
  formatInterest,
  formatUsdg,
  interestOn,
  shortAddress,
} from "@/lib/format";
import { BoyAvatar, Button, Panel, Pill, Stat } from "@/components/lending/primitives";

export function OfferCard({
  offer,
  boys,
  mine,
  onTake,
  onCancel,
  busy,
}: {
  offer: Offer;
  boys: OwnedBoy[];
  mine: boolean;
  onTake: (tokenId: number) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  const eligible = boys.filter(
    (b) =>
      b.available &&
      (offer.collateral.kind === "any" ||
        offer.collateral.tokenIds.includes(b.tokenId)),
  );

  const repay = offer.principal + interestOn(offer.principal, offer.interestBps);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <p
              className="m-0 text-[24px] font-extrabold leading-none"
              style={{ fontFamily: "var(--mono)" }}
            >
              {formatUsdg(offer.principal, { decimals: 0 })}
              <span className="ml-1.5 text-[14px]" style={{ color: "var(--fg-dim)" }}>
                USDG
              </span>
            </p>
            {mine && <Pill tone="sky">Your offer</Pill>}
          </div>
          <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
            from {shortAddress(offer.lender)}
          </p>
        </div>

        {mine ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel offer"}
          </Button>
        ) : eligible.length === 0 ? (
          <Button disabled>No eligible Boy</Button>
        ) : picking ? (
          <Button variant="ghost" onClick={() => setPicking(false)} disabled={busy}>
            Back
          </Button>
        ) : (
          <Button onClick={() => setPicking(true)}>Take offer</Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Interest" value={formatInterest(offer.interestBps)} tone="lime" />
        <Stat label="Term" value={formatDuration(offer.durationSecs)} />
        <Stat label="You repay" value={formatUsdg(repay, { decimals: 0 })} />
        <Stat label="Accepts" value={describeCollateral(offer.collateral)} />
      </div>

      {picking && (
        <div
          className="mt-5 rounded-[14px] p-4"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <p className="m-0 text-[13.5px] font-bold">
            Which Boy goes into escrow?
          </p>
          <p
            className="m-0 mt-1 text-[12.5px] leading-relaxed"
            style={{ color: "var(--fg-dim)" }}
          >
            It's locked for {formatDuration(offer.durationSecs)}. Repay{" "}
            {formatUsdg(repay, { decimals: 0 })} USDG before the deadline or the
            lender keeps it.
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {eligible.map((boy) => {
              const active = chosen === boy.tokenId;
              return (
                <button
                  key={boy.tokenId}
                  type="button"
                  onClick={() => setChosen(boy.tokenId)}
                  aria-pressed={active}
                  className="flex items-center gap-2.5 rounded-[12px] p-2 pr-3.5 transition-colors"
                  style={{
                    background: active ? "var(--lime)" : "rgba(255,255,255,0.06)",
                    color: active ? "var(--ink)" : "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <BoyAvatar tokenId={boy.tokenId} size={32} />
                  <span
                    className="text-[13px] font-bold"
                    style={{ fontFamily: "var(--mono)" }}
                  >
                    #{boy.tokenId}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Button
              onClick={() => chosen !== null && onTake(chosen)}
              disabled={chosen === null || busy}
            >
              {busy
                ? "Confirming…"
                : chosen === null
                  ? "Pick a Boy"
                  : `Borrow ${formatUsdg(offer.principal, { decimals: 0 })} USDG`}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
