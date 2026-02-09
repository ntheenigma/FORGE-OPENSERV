import Link from "next/link";

const TIERS = [
  { name: "Signal", price: 29, highlight: false, features: [
    "Real-time BTC predictions every 15 min", "Confidence scores + regime detection",
    "Position sizing recommendations", "24h prediction history",
  ]},
  { name: "Edge", price: 99, highlight: true, features: [
    "Everything in Signal", "Full agent vote breakdown", "Accuracy leaderboard",
    "API access (100 req/day)", "Webhook alerts", "FORGE token airdrop eligibility",
  ]},
  { name: "Vault", price: 499, highlight: false, features: [
    "Everything in Edge", "Unlimited API access", "Register your own agent",
    "Priority agent pool slot", "1.5x reward multiplier", "Guaranteed FORGE allocation",
  ]},
];

export default function PremiumPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
      <div className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">Premium Access</h1>
        <p className="mx-auto mt-3 max-w-lg text-base text-zinc-400">
          Pay with ETH, USDC, or cbBTC on Base. Get the edge in every 15-minute window.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <div key={tier.name} className={`relative flex flex-col rounded-2xl border p-6 ${tier.highlight ? "border-amber-500/30 bg-gradient-to-b from-amber-500/[0.06] to-transparent" : "border-white/[0.06] bg-white/[0.02]"}`}>
            {tier.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black">Most Popular</div>}
            <h3 className="text-lg font-bold text-white">{tier.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">${tier.price}</span>
              <span className="text-sm text-zinc-500">/month</span>
            </div>
            <ul className="my-6 flex-1 space-y-2.5">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <svg className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tier.highlight ? "text-amber-400" : "text-zinc-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-zinc-300">{f}</span>
                </li>
              ))}
            </ul>
            <button className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${tier.highlight ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400" : "bg-white/[0.08] text-white hover:bg-white/[0.12]"}`}>
              Subscribe
            </button>
          </div>
        ))}
      </div>
      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 px-4 py-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-xs font-medium text-blue-400">All payments on Base (L2)</span>
        </div>
        <p className="max-w-md text-xs text-zinc-500">Low gas, instant confirmation. ETH, USDC, cbBTC on Base.</p>
      </div>
    </div>
  );
}
