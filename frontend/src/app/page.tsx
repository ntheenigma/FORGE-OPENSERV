import { PredictionCard } from "@/components/PredictionCard";
import Link from "next/link";

function HeroStats() {
  const stats = [
    { label: "Prediction Agents", value: "14" },
    { label: "Window Interval", value: "15 min" },
    { label: "Data Sources", value: "3" },
    { label: "Monthly Cost", value: "$3.76" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
        >
          <div className="text-xl font-black text-white">{stat.value}</div>
          <div className="mt-0.5 text-xs text-zinc-500">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

function ArchitectureDiagram() {
  const layers = [
    {
      label: "Data Layer",
      agents: ["Binance Candles", "Pyth Oracle", "Coinbase Book"],
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Analysis Layer",
      agents: ["Candle", "Flow", "Momentum", "Reversion", "External"],
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Consensus Layer",
      agents: ["Collector", "Weigher", "Synthesizer"],
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: "Feedback Layer",
      agents: ["Scorer", "Paymaster", "Logger"],
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
  ];

  return (
    <div className="space-y-3">
      {layers.map((layer, i) => (
        <div key={layer.label}>
          <div
            className={`rounded-xl border ${layer.border} ${layer.bg} p-4`}
          >
            <div
              className={`mb-2 text-xs font-semibold uppercase tracking-wider ${layer.color}`}
            >
              {layer.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {layer.agents.map((agent) => (
                <span
                  key={agent}
                  className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-300"
                >
                  {agent}
                </span>
              ))}
            </div>
          </div>
          {i < layers.length - 1 && (
            <div className="flex justify-center py-1">
              <svg
                className="h-4 w-4 text-zinc-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DifferentiatorSection() {
  const points = [
    {
      title: "Diversity > Redundancy",
      desc: "4 intentionally different analysis strategies. 30% of rewards go to contrarian accuracy.",
    },
    {
      title: "Self-Improving",
      desc: "EMA-weighted feedback loop every 15 minutes. Better agents gain influence automatically.",
    },
    {
      title: "Open Ensemble",
      desc: "Register your own prediction agent. Start on probation, earn your way to full weight.",
    },
    {
      title: "Zero Infrastructure",
      desc: "Pure no-code on OpenServ. 14 agents, 3 workflows, $3.76/month. No servers to manage.",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {points.map((point) => (
        <div
          key={point.title}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <h3 className="font-semibold text-white">{point.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
            {point.desc}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
      {/* Hero */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-amber-400">
            Live on Base
          </span>
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-white md:text-6xl">
          Bitcoin Predictions
          <br />
          <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Forged by Consensus
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400 md:text-lg">
          14 specialized AI agents analyze candles, order flow, momentum, and
          mean reversion every 15 minutes. Diversity beats redundancy.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/premium"
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-black transition-all hover:from-amber-400 hover:to-orange-400"
          >
            Get Premium Access
          </Link>
          <Link
            href="/airdrop"
            className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/[0.08]"
          >
            Claim FORGE Tokens
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-16">
        <HeroStats />
      </div>

      {/* Two Column: Prediction + Architecture */}
      <div className="mt-16 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Current Window
          </h2>
          <PredictionCard />
        </div>
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Architecture
          </h2>
          <ArchitectureDiagram />
        </div>
      </div>

      {/* Differentiators */}
      <div className="mt-20">
        <h2 className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Why FORGE
        </h2>
        <DifferentiatorSection />
      </div>

      {/* CTA */}
      <div className="mt-20 rounded-2xl border border-amber-500/10 bg-gradient-to-b from-amber-500/[0.04] to-transparent p-8 text-center md:p-12">
        <h2 className="text-2xl font-black text-white md:text-3xl">
          Beat the market with ensemble intelligence
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400">
          Premium subscribers get full agent vote breakdowns, API access,
          webhook alerts, and guaranteed FORGE token airdrop eligibility.
        </p>
        <Link
          href="/premium"
          className="mt-6 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-sm font-bold text-black transition-all hover:from-amber-400 hover:to-orange-400"
        >
          Subscribe Now
        </Link>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/[0.06] pt-8 text-center text-xs text-zinc-600">
        <p>
          FORGE &middot; Built on{" "}
          <a
            href="https://openserv.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white"
          >
            OpenServ
          </a>{" "}
          &middot; Payments on{" "}
          <a
            href="https://base.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-white"
          >
            Base
          </a>
        </p>
        <p className="mt-2">
          Predictions are informational only. Not financial advice. Past
          accuracy does not guarantee future results.
        </p>
      </footer>
    </div>
  );
}
