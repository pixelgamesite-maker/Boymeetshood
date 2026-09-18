import type { Loan } from "@/types/lending";
import { formatUsdg, shortAddress, timeLeft } from "@/lib/format";
import { useNow } from "@/hooks/useLending";
import { BoyAvatar, Button, Panel, Pill, Stat } from "@/components/lending/primitives";

export function LoanCard({
  loan,
  role,
  onRepay,
  onClaim,
  busy,
}: {
  loan: Loan;
  role: "borrower" | "lender";
  onRepay: () => void;
  onClaim: () => void;
  busy: boolean;
}) {
  const now = useNow();
  const remaining = timeLeft(loan.dueAt, now);
  const active = loan.status === "active";

  const statusPill =
    loan.status === "repaid" ? (
      <Pill tone="lime">Repaid</Pill>
    ) : loan.status === "defaulted" ? (
      <Pill tone="punch">Defaulted</Pill>
    ) : remaining.expired ? (
      <Pill tone="punch">Overdue</Pill>
    ) : (
      <Pill tone="neutral">Active</Pill>
    );

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <BoyAvatar tokenId={loan.tokenId} />
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <p
                className="m-0 text-[17px] font-extrabold leading-none"
                style={{ fontFamily: "var(--mono)" }}
              >
                Boy #{loan.tokenId}
              </p>
              {statusPill}
            </div>
            <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--fg-faint)" }}>
              {role === "borrower"
                ? `borrowed from ${shortAddress(loan.lender)}`
                : `lent to ${shortAddress(loan.borrower)}`}
            </p>
          </div>
        </div>

        {active && role === "borrower" && !remaining.expired && (
          <Button onClick={onRepay} disabled={busy}>
            {busy ? "Repaying…" : `Repay ${formatUsdg(loan.repayAmount, { decimals: 0 })} USDG`}
          </Button>
        )}
        {active && role === "lender" && remaining.expired && (
          <Button variant="danger" onClick={onClaim} disabled={busy}>
            {busy ? "Claiming…" : "Claim collateral"}
          </Button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Principal" value={formatUsdg(loan.principal, { decimals: 0 })} />
        <Stat label="Interest" value={formatUsdg(loan.interest, { decimals: 0 })} />
        <Stat
          label={role === "borrower" ? "You repay" : "You're owed"}
          value={formatUsdg(loan.repayAmount, { decimals: 0 })}
        />
        <Stat
          label={active ? "Time left" : "Closed"}
          value={active ? remaining.label : loan.status === "repaid" ? "Repaid" : "Collateral taken"}
          tone={active && remaining.urgent ? "punch" : "default"}
        />
      </div>

      {active && remaining.expired && role === "borrower" && (
        <p
          className="m-0 mt-4 text-[13px] leading-relaxed"
          style={{ color: "var(--punch)" }}
        >
          The deadline has passed. This loan can no longer be repaid, and the
          lender can claim Boy #{loan.tokenId} at any time.
        </p>
      )}
      {active && remaining.urgent && !remaining.expired && role === "borrower" && (
        <p
          className="m-0 mt-4 text-[13px] leading-relaxed"
          style={{ color: "var(--punch)" }}
        >
          Under a day left. Miss it and Boy #{loan.tokenId} transfers to the
          lender — there's no grace period.
        </p>
      )}
    </Panel>
  );
}
