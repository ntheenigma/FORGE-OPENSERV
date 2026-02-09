import { AirdropClaim } from "@/components/AirdropClaim";

export const metadata = {
  title: "FORGE Token Airdrop",
  description:
    "Premium subscribers are eligible for the FORGE token airdrop. Check your allocation and claim on Base.",
};

function Timeline() {
  const phases = [
    {
      date: "Now",
      title: "Accumulation Phase",
      desc: "Subscribe to Premium. Every day of active subscription earns airdrop points.",
      active: true,
    },
    {
      date: "Jun 2025",
      title: "Snapshot",
      desc: "All premium wallets and subscription durations are recorded on-chain.",
      active: false,
    },
    {
      date: "Jul 2025",
      title: "Claim Opens",
      desc: "Connect wallet, verify eligibility, and claim your FORGE allocation.",
      active: false,
    },
    {
      date: "Jul - Dec 2025",
      title: "Vesting",
      desc: "6-month linear vesting. Tokens unlock continuously to your wallet.",
      active: false,
    },
  ];

  return (
    <div className="relative space-y-6">
      <div className="absolute bottom-0 left-[11px] top-0 w-px bg-white/[0.06]" />
      {phases.map((phase) => (
        <div key={phase.title} className="relative flex gap-4 pl-8">
          <div
            className={`absolute left-0 top-1 h-[22px] w-[22px] rounded-full border-2 ${
              phase.active
                ? "border-amber-500 bg-amber-500/20"
                : "border-zinc-700 bg-zinc-900"
            }`}
          >
            {phase.active && (
              <div className="absolute inset-1 animate-pulse rounded-full bg-amber-500" />
            )}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {phase.date}
            </div>
            <h3 className="mt-0.5 font-semibold text-white">{phase.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{phase.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TokenomicsBar() {
  const segments = [
    { label: "Airdrop", pct: 15, color: "bg-amber-500" },
    { label: "Ecosystem", pct: 30, color: "bg-blue-500" },
    { label: "Team", pct: 15, color: "bg-purple-500" },
    { label: "Treasury", pct: 20, color: "bg-emerald-500" },
    { label: "Liquidity", pct: 20, color: "bg-pink-500" },
  ];

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.04]">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`${seg.color} transition-all`}
            style={{ width: `${seg.pct}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${seg.color}`} />
            <span className="text-xs text-zinc-400">
              {seg.label} ({seg.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AirdropPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:py-20">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1">
          <span className="text-xs font-medium text-amber-400">
            Premium Exclusive
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">
          FORGE Token Airdrop
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-zinc-400">
          15M tokens allocated to premium subscribers. Higher tiers earn
          larger multipliers. Claim on Base with 6-month vesting.
        </p>
      </div>

      {/* Tokenomics */}
      <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Token Distribution (100M Total Supply)
        </h2>
        <TokenomicsBar />
      </div>

      {/* Claim Section */}
      <div className="mt-12">
        <AirdropClaim />
      </div>

      {/* Timeline */}
      <div className="mt-16">
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Airdrop Timeline
        </h2>
        <Timeline />
      </div>

      {/* FAQ */}
      <div className="mt-16">
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          FAQ
        </h2>
        <div className="space-y-4">
          {[
            {
              q: "Who is eligible?",
              a: "Any wallet with an active Premium subscription (Signal, Edge, or Vault) at the time of snapshot. Higher tiers get higher multipliers.",
            },
            {
              q: "How is the allocation calculated?",
              a: "Base allocation of 5,000 FORGE per eligible wallet, multiplied by your tier: Signal (1x), Edge (2.5x), Vault (10x). Duration bonuses may apply.",
            },
            {
              q: "What chain are the tokens on?",
              a: "FORGE tokens will be an ERC-20 on Base (Coinbase L2). Claiming is gas-efficient thanks to Base's low fees.",
            },
            {
              q: "What is the vesting schedule?",
              a: "6-month linear vesting starting from claim date. Tokens unlock continuously — no cliff.",
            },
            {
              q: "Can I sell during vesting?",
              a: "Only unlocked (vested) tokens are transferable. The vesting contract releases tokens linearly every block.",
            },
          ].map((item) => (
            <div
              key={item.q}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <h3 className="font-semibold text-white">{item.q}</h3>
              <p className="mt-1.5 text-sm text-zinc-400">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
