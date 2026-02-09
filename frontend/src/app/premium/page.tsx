import { PricingTiers } from "@/components/PricingTiers";

export const metadata = {
  title: "Premium | FORGE",
  description:
    "Subscribe with ETH, USDC, or cbBTC on Base. Get full agent breakdowns, API access, and FORGE token airdrop eligibility.",
};

function FeatureComparison() {
  const features = [
    { name: "Live predictions (15 min)", free: true, signal: true, edge: true, vault: true },
    { name: "Confidence + regime", free: true, signal: true, edge: true, vault: true },
    { name: "Position sizing", free: false, signal: true, edge: true, vault: true },
    { name: "Agent vote breakdown", free: false, signal: false, edge: true, vault: true },
    { name: "Accuracy leaderboard", free: false, signal: false, edge: true, vault: true },
    { name: "API access", free: false, signal: false, edge: "100/day", vault: "Unlimited" },
    { name: "Webhook alerts", free: false, signal: false, edge: true, vault: true },
    { name: "Register own agent", free: false, signal: false, edge: false, vault: true },
    { name: "Reward multiplier", free: false, signal: false, edge: false, vault: "1.5x" },
    { name: "FORGE token airdrop", free: false, signal: false, edge: true, vault: "Guaranteed" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              Feature
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
              Free
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
              Signal
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-amber-400">
              Edge
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
              Vault
            </th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.name} className="border-b border-white/[0.04]">
              <td className="px-4 py-3 text-zinc-300">{f.name}</td>
              {[f.free, f.signal, f.edge, f.vault].map((val, i) => (
                <td key={i} className="px-4 py-3 text-center">
                  {val === true ? (
                    <svg
                      className="mx-auto h-4 w-4 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : val === false ? (
                    <span className="text-zinc-700">&mdash;</span>
                  ) : (
                    <span className="text-xs font-medium text-amber-400">
                      {val}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PremiumPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
          Premium Access
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-zinc-400">
          Pay with top crypto on Base. Get the edge in every 15-minute
          prediction window.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="mt-12">
        <PricingTiers />
      </div>

      {/* Feature Comparison */}
      <div className="mt-20">
        <h2 className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Feature Comparison
        </h2>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1">
          <FeatureComparison />
        </div>
      </div>

      {/* Base Chain Badge */}
      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-blue-400">
            All payments on Base (L2)
          </span>
        </div>
        <p className="max-w-md text-xs text-zinc-500">
          Low gas fees, instant confirmation. We accept ETH, USDC, and cbBTC
          natively on Base. Subscription activates within 1 block confirmation.
        </p>
      </div>
    </div>
  );
}
