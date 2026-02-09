import Link from "next/link";
import { LivePrediction } from "./LivePrediction";

function HeroStats() {
  const stats = [
    { label: "Agents", value: "4+LLM" },
    { label: "Interval", value: "15 min" },
    { label: "Data Sources", value: "3" },
    { label: "LLM Cost", value: "$0" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <div className="text-xl font-black text-white">{s.value}</div>
          <div className="mt-0.5 text-xs text-zinc-500">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Arch() {
  const layers = [
    { label: "Data", items: ["Binance", "Pyth", "Coinbase"], color: "blue" },
    { label: "Analysis", items: ["Candle", "Flow", "Momentum", "Reversion"], color: "emerald" },
    { label: "Consensus", items: ["Weigher", "Synthesizer (Groq)"], color: "amber" },
    { label: "Feedback", items: ["Scorer", "Logger"], color: "purple" },
  ];
  return (
    <div className="space-y-3">
      {layers.map((l, i) => (
        <div key={l.label}>
          <div className={`rounded-xl border border-${l.color}-500/20 bg-${l.color}-500/10 p-4`}>
            <div className={`mb-2 text-xs font-semibold uppercase tracking-wider text-${l.color}-400`}>{l.label}</div>
            <div className="flex flex-wrap gap-2">
              {l.items.map((a) => (
                <span key={a} className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-300">{a}</span>
              ))}
            </div>
          </div>
          {i < layers.length - 1 && (
            <div className="flex justify-center py-1">
              <svg className="h-4 w-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          <span className="text-xs font-medium text-amber-400">Live on Railway &middot; Groq Free Tier</span>
        </div>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-white md:text-6xl">
          Bitcoin Predictions<br />
          <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Forged by Consensus</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400 md:text-lg">
          4 pure-math TypeScript agents + Groq LLM synthesizer. Zero startup cost.
          Every 15 minutes. Deployed on Railway.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/premium" className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 text-sm font-bold text-black transition-all hover:from-amber-400 hover:to-orange-400">
            Get Premium Access
          </Link>
          <Link href="/airdrop" className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/[0.08]">
            Claim FORGE Tokens
          </Link>
        </div>
      </div>
      <div className="mt-16"><HeroStats /></div>
      <div className="mt-16 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Current Window</h2>
          <LivePrediction />
        </div>
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">Architecture</h2>
          <Arch />
        </div>
      </div>
      <div className="mt-20 rounded-2xl border border-amber-500/10 bg-gradient-to-b from-amber-500/[0.04] to-transparent p-8 text-center md:p-12">
        <h2 className="text-2xl font-black text-white md:text-3xl">Zero cost. Zero infrastructure debt.</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400">
          Pure TypeScript math agents (no LLM) for candle, flow, momentum, and reversion analysis.
          Only the Synthesizer uses Groq&apos;s free Llama 3.1 70B for consensus reasoning.
        </p>
        <Link href="/premium" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-sm font-bold text-black">Subscribe Now</Link>
      </div>
      <footer className="mt-20 border-t border-white/[0.06] pt-8 text-center text-xs text-zinc-600">
        <p>FORGE &middot; Hosted on Railway &middot; LLM by Groq (free) &middot; Payments on Base</p>
        <p className="mt-2">Predictions are informational only. Not financial advice.</p>
      </footer>
    </div>
  );
}
