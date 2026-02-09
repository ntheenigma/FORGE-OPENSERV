import { Header } from "@/components/Header";
import { AssetPanel } from "@/components/AssetPanel";
import { LiveFeed } from "@/components/LiveFeed";

function AgentGrid() {
  const agents = [
    { name: "TrendBot", desc: "EMA crossover & trend", icon: "\u{1F4C8}", color: "emerald" },
    { name: "RSIBot", desc: "RSI divergence", icon: "\u{1F504}", color: "blue" },
    { name: "VolumeBot", desc: "VWAP & order flow", icon: "\u{1F4CA}", color: "purple" },
    { name: "MacroBot", desc: "Cross-asset correlation", icon: "\u{1F30D}", color: "amber" },
    { name: "PatternBot", desc: "Candlestick patterns", icon: "\u{1F50D}", color: "rose" },
    { name: "SentimentBot", desc: "Crowd analysis", icon: "\u{1F9E0}", color: "cyan" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {agents.map((a) => (
        <div
          key={a.name}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center transition hover:bg-white/[0.04]"
        >
          <div className="text-lg">{a.icon}</div>
          <div className="mt-1 text-xs font-bold text-white">{a.name}</div>
          <div className="mt-0.5 text-[10px] text-zinc-500">{a.desc}</div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
            Predict{" "}
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              Bitcoin
            </span>{" "}
            &{" "}
            <span className="bg-gradient-to-r from-amber-300 to-yellow-400 bg-clip-text text-transparent">
              Gold
            </span>
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400">
            6 AI agents + human crowd intelligence. Real-time consensus every 15 minutes.
            Make your prediction and earn reputation.
          </p>
        </div>

        {/* Agent Grid */}
        <div className="mb-8">
          <AgentGrid />
        </div>

        {/* Main Trading View: BTC | GOLD | Feed */}
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr_300px]">
          <AssetPanel asset="BTC" />
          <AssetPanel asset="GOLD" />

          {/* Live Feed Sidebar */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Live Feed
              </span>
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 animate-live rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-400">Live</span>
              </div>
            </div>
            <LiveFeed />
          </div>
        </div>

        {/* How it Works */}
        <div className="mt-12 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
          <h2 className="mb-6 text-center text-xl font-black text-white">How ORACLE Works</h2>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              {
                step: "1",
                title: "Data Streams",
                desc: "Real-time BTC from Binance, Gold from Pyth/APIs. Candles, orderbook, oracle prices.",
              },
              {
                step: "2",
                title: "6 AI Agents Analyze",
                desc: "Each agent computes signals (EMA, RSI, VWAP, patterns) then uses Groq LLM for reasoning.",
              },
              {
                step: "3",
                title: "Humans Predict",
                desc: "You submit direction + confidence. Your reputation weights your vote in the consensus.",
              },
              {
                step: "4",
                title: "Weighted Consensus",
                desc: "Time-decayed, reputation-weighted blend of all signals. Scored against realized price.",
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-black text-black">
                  {s.step}
                </div>
                <h3 className="mt-3 text-sm font-bold text-white">{s.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-white/[0.06] pt-6 text-center text-xs text-zinc-600">
          <p>ORACLE Prediction Platform &middot; Powered by Groq (free tier) &middot; Binance + Pyth data</p>
          <p className="mt-1">Predictions are informational only. Not financial advice. DYOR.</p>
        </footer>
      </main>
    </>
  );
}
