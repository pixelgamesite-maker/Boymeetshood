import { useMemo, useState, type ReactNode } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import {
  BoyCard,
  Button,
  EmptyState,
  ErrorState,
  Panel,
  Pill,
  SkeletonRows,
  Stat,
} from "@/components/lending/primitives";
import { formatJuice, juiceToNumber } from "@/lib/format";
import { RARITY_BOOSTER, RARITY_ORDER, type Rarity, type Stake } from "@/types/staking";
import {
  useBaseDailyReward,
  useClaimAllRewards,
  useClaimRewards,
  useJuiceBalance,
  useMyAddress,
  useMyBoys,
  useMyStakes,
  usePendingRewards,
  useStake,
  useStakeAll,
  useTokenRarities,
  useUnstake,
} from "@/hooks/useJuiceStaking";
import { useNow } from "@/hooks/useLending";

export default function Juice() {
  const me = useMyAddress();

  return (
    <div style={{ background: "var(--ink)", minHeight: "100vh" }}>
      <SiteHeader />
      <main className="px-5 pb-28 pt-[120px] sm:px-8 sm:pt-[140px]">
        <div className="mx-auto max-w-[900px]">
          <span
            className="inline-block rounded-full px-3.5 py-1.5 text-[11px] font-extrabold uppercase"
            style={{
              fontFamily: "var(--mono)",
              letterSpacing: "0.14em",
              background: "rgba(255,255,255,0.12)",
              color: "var(--violet, #b794f6)",
            }}
          >
            $JUICE
          </span>

          <h1
            className="m-0 mt-4 font-black leading-[1.02]"
            style={{ fontSize: "clamp(2rem, 5vw, 2.9rem)", letterSpacing: "-0.02em" }}
          >
            Stake your Boys, earn $JUICE
          </h1>

          <p
            className="m-0 mt-4 max-w-[62ch] text-[15.5px] leading-relaxed"
            style={{ color: "var(--fg-dim)" }}
          >
            Stake a Boy and it earns $JUICE continuously, boosted by rarity,
            for as long as it stays staked. No lock: unstake anytime and keep
            whatever's accrued.
          </p>

          {!me && (
            <p
              className="m-0 mt-3 text-[13px] leading-relaxed"
              style={{ color: "var(--fg-faint)" }}
            >
              Browsing is open to everyone — connect a wallet when you're
              ready to stake.
            </p>
          )}

          <RewardTable />

          <div className="mt-12 flex flex-col gap-12">
            <StakeSection />
            <MyStakesSection />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/* ── Reward table — always visible, no wallet needed ────────────────────── */

function RewardTable() {
  const base = useBaseDailyReward();

  return (
    <Panel className="mt-8">
      <p className="m-0 text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--fg-faint)" }}>
        How much you earn, per day
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {RARITY_ORDER.slice()
          .reverse()
          .map((r) => (
            <div key={r} className="rounded-[14px] p-3.5" style={{ background: "var(--ink-3)" }}>
              <p className="m-0 text-[12px]" style={{ color: "var(--fg-faint)" }}>
                {r}
              </p>
              <p
                className="m-0 mt-1 text-[17px] font-extrabold"
                style={{ fontFamily: "var(--mono)", color: "var(--lime)" }}
              >
                {base.data !== undefined
                  ? (juiceToNumber(base.data) * RARITY_BOOSTER[r]).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })
                  : "…"}
              </p>
              <p className="m-0 text-[11px]" style={{ color: "var(--fg-faint)" }}>
                $JUICE / day
              </p>
            </div>
          ))}
      </div>

    </Panel>
  );
}

/* ── Stake ───────────────────────────────────────────────────────────────*/

function StakeSection() {
  const me = useMyAddress();
  const { openConnectModal } = useConnectModal();
  const boys = useMyBoys();
  const tokenIds = useMemo(() => (boys.data ?? []).map((b) => b.tokenId), [boys.data]);
  const rarities = useTokenRarities(tokenIds);
  const base = useBaseDailyReward();
  const [selected, setSelected] = useState<number[]>([]);

  const stake = useStake();
  const stakeAll = useStakeAll();
  const pending = stake.pending || stakeAll.pending;

  function toggle(tokenId: number) {
    setSelected((s: number[]) => (s.includes(tokenId) ? s.filter((t) => t !== tokenId) : [...s, tokenId]));
  }

  const estimatePerDay = useMemo(() => {
    if (base.data === undefined) return undefined;
    const rarityData = rarities.data ?? {};
    const baseRate = juiceToNumber(base.data);
    return selected.reduce((sum: number, id: number) => {
      const rarity = rarityData[id];
      const booster = rarity ? RARITY_BOOSTER[rarity] : 1;
      return sum + baseRate * booster;
    }, 0);
  }, [selected, base.data, rarities.data]);

  async function onStake() {
    if (selected.length === 0) return;
    const ok = selected.length === 1 ? await stake.run(selected[0]) : await stakeAll.run(selected);
    if (ok) {
      setSelected([]);
      boys.refetch();
    }
  }

  return (
    <Section title="Stake" note="Put your Boys to work">
      {!me ? (
        <EmptyState
          title="Connect your wallet"
          body="Connect to see which Boys you can stake."
          action={<Button onClick={openConnectModal}>Connect wallet</Button>}
        />
      ) : boys.loading && !boys.data ? (
        <SkeletonRows count={2} />
      ) : boys.error ? (
        <ErrorState message={boys.error} onRetry={boys.refetch} />
      ) : (boys.data ?? []).length === 0 ? (
        <EmptyState
          title="No Boys in this wallet"
          body="You need at least one Boy, unstaked, to lock up here."
        />
      ) : (
        <>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
          >
            {(boys.data ?? []).map((boy) => (
              <div key={boy.tokenId} className="relative">
                <BoyCard
                  tokenId={boy.tokenId}
                  selected={selected.includes(boy.tokenId)}
                  onToggle={() => toggle(boy.tokenId)}
                />
                <RarityBadge rarity={rarities.data?.[boy.tokenId]} />
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="m-0 text-[12px]" style={{ color: "var(--fg-faint)" }}>
                Estimated rate for {selected.length || 0} Boy
                {selected.length === 1 ? "" : "s"}
              </p>
              <p
                className="m-0 mt-1 text-[20px] font-extrabold"
                style={{ fontFamily: "var(--mono)", color: "var(--lime)" }}
              >
                {estimatePerDay !== undefined
                  ? estimatePerDay.toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : "…"}{" "}
                $JUICE / day
              </p>
            </div>
            <Button onClick={onStake} disabled={selected.length === 0 || pending}>
              {pending
                ? "Staking…"
                : selected.length === 0
                  ? "Pick Boys to stake"
                  : `Stake ${selected.length} Boy${selected.length === 1 ? "" : "s"}`}
            </Button>
          </div>

          {(stake.error || stakeAll.error) && (
            <ActionError
              message={stake.error ?? stakeAll.error ?? ""}
              onDismiss={() => {
                stake.reset();
                stakeAll.reset();
              }}
            />
          )}
        </>
      )}
    </Section>
  );
}

function RarityBadge({ rarity }: { rarity: Rarity | null | undefined }) {
  if (!rarity) return null;
  return (
    <span
      className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}
    >
      {rarity}
    </span>
  );
}

/* ── Your stakes ─────────────────────────────────────────────────────────*/

function MyStakesSection() {
  const me = useMyAddress();
  // Hooks below must run unconditionally (Rules of Hooks) — each already
  // no-ops without a connected wallet (their `enabled` gate is `Boolean(me)`).
  const stakes = useMyStakes();
  const balance = useJuiceBalance();
  const claimAll = useClaimAllRewards();

  if (!me) return null;

  const list = stakes.data ?? [];

  return (
    <Section
      title="Your stakes"
      note={
        balance.data !== undefined
          ? `$JUICE claimed so far: ${formatJuice(balance.data)}`
          : undefined
      }
    >
      {list.length > 1 && (
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={async () => {
              if (await claimAll.run()) {
                stakes.refetch();
                balance.refetch();
              }
            }}
            disabled={claimAll.pending}
          >
            {claimAll.pending ? "Claiming…" : "Claim all rewards"}
          </Button>
          {claimAll.error && (
            <ActionError message={claimAll.error} onDismiss={claimAll.reset} />
          )}
        </div>
      )}

      {stakes.loading && !stakes.data ? (
        <SkeletonRows count={2} />
      ) : stakes.error ? (
        <ErrorState message={stakes.error} onRetry={stakes.refetch} />
      ) : list.length === 0 ? (
        <EmptyState title="Nothing staked yet" body="Stake a Boy above to start earning $JUICE." />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((s) => (
            <StakeCard
              key={s.tokenId}
              stake={s}
              onChanged={() => {
                stakes.refetch();
                balance.refetch();
              }}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function StakeCard({ stake, onChanged }: { stake: Stake; onChanged: () => void }) {
  const now = useNow(1000);
  const unstake = useUnstake();
  const claim = useClaimRewards();
  const pendingRewards = usePendingRewards(stake.tokenId, true);

  const staked = Math.max(0, now - stake.stakedAt);
  const stakedLabel = `${Math.floor(staked / 86_400)}d ${Math.floor((staked % 86_400) / 3_600)}h staked`;

  const busy = unstake.pending || claim.pending;

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <p className="m-0 text-[14px] font-extrabold">BoyMeetsH00d #{stake.tokenId}</p>
            <div className="mt-1 flex items-center gap-2">
              {stake.rarity && <Pill tone="sky">{stake.rarity}</Pill>}
              <Pill tone="neutral">{stakedLabel}</Pill>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <Stat label="Earning" value={`${formatJuice(stake.dailyRate)} $JUICE / day`} />
          <Stat
            label="Ready to claim"
            value={pendingRewards.data !== undefined ? `${formatJuice(pendingRewards.data)} $JUICE` : "…"}
            tone="lime"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button
          variant="ghost"
          disabled={busy || !pendingRewards.data || pendingRewards.data === 0n}
          onClick={async () => {
            if (await claim.run(stake.tokenId)) {
              pendingRewards.refetch();
              onChanged();
            }
          }}
        >
          {claim.pending ? "Claiming…" : "Claim"}
        </Button>

        <Button
          disabled={busy}
          onClick={async () => {
            if (await unstake.run(stake.tokenId)) onChanged();
          }}
        >
          {unstake.pending ? "Unstaking…" : "Unstake"}
        </Button>
      </div>

      {(claim.error || unstake.error) && (
        <ActionError
          message={claim.error ?? unstake.error ?? ""}
          onDismiss={() => {
            claim.reset();
            unstake.reset();
          }}
        />
      )}
    </Panel>
  );
}

/* ── Shared ──────────────────────────────────────────────────────────────*/

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="m-0 text-[20px] font-extrabold">{title}</h2>
        {note && (
          <p className="m-0 mt-1.5 text-[13.5px]" style={{ color: "var(--fg-dim)" }}>
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function ActionError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[14px] px-5 py-4"
      style={{ background: "rgba(255,61,113,0.12)" }}
    >
      <p className="m-0 text-[13.5px] font-bold" style={{ color: "var(--punch)" }}>
        {message}
      </p>
      <Button variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
