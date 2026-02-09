"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";

interface PoolAgent {
  id: string;
  name: string;
  type: "core" | "external";
  status: string;
  assets: string[];
  accuracy: number;
  totalPredictions: number;
  correctPredictions: number;
  probationWindowsRemaining: number;
  lastSeen: number | null;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<PoolAgent[]>([]);
  const [form, setForm] = useState({
    name: "",
    endpoint: "",
    description: "",
    assets: ["BTC"] as string[],
    ownerAddress: "",
  });
  const [result, setResult] = useState<{ success: boolean; message: string; apiKey?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAgents();
    const iv = setInterval(fetchAgents, 15000);
    return () => clearInterval(iv);
  }, []);

  async function fetchAgents() {
    try {
      const res = await fetch("/api/agents/pool");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {}
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/agents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: `Agent "${data.agent.name}" registered! Save your API key — it won't be shown again.`,
          apiKey: data.apiKey,
        });
        setForm({ name: "", endpoint: "", description: "", assets: ["BTC"], ownerAddress: "" });
        fetchAgents();
      } else {
        setResult({ success: false, message: data.error || "Registration failed" });
      }
    } catch {
      setResult({ success: false, message: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  function toggleAsset(asset: string) {
    setForm((f) => {
      const has = f.assets.includes(asset);
      const next = has ? f.assets.filter((a) => a !== asset) : [...f.assets, asset];
      return { ...f, assets: next.length > 0 ? next : f.assets };
    });
  }

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400",
    probation: "bg-amber-500/10 text-amber-400",
    inactive: "bg-zinc-500/10 text-zinc-400",
    banned: "bg-red-500/10 text-red-400",
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-black text-white">Register Your Agent</h1>
        <p className="mb-8 text-sm text-zinc-400">
          Plug your prediction agent into ORACLE. Your endpoint receives market data every 15 minutes
          and returns a directional prediction. Earn reputation through accuracy.
        </p>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* Registration Form */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
            <h2 className="mb-4 text-sm font-bold text-white">New Agent</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Agent Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="MyTrendAgent"
                  maxLength={40}
                  required
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Endpoint URL</label>
                <input
                  type="url"
                  value={form.endpoint}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                  placeholder="https://my-agent.example.com/predict"
                  required
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Uses RSI + MACD crossover strategy"
                  maxLength={200}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Assets</label>
                <div className="flex gap-2">
                  {["BTC", "GOLD"].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAsset(a)}
                      className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                        form.assets.includes(a)
                          ? a === "BTC"
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-white/[0.02] text-zinc-600 border border-white/[0.06]"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Owner Address (optional)</label>
                <input
                  type="text"
                  value={form.ownerAddress}
                  onChange={(e) => setForm({ ...form, ownerAddress: e.target.value })}
                  placeholder="0x..."
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/30"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-black transition hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
              >
                {submitting ? "Registering..." : "Register Agent"}
              </button>
            </form>

            {result && (
              <div className={`mt-4 rounded-lg border p-3 text-sm ${
                result.success ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-red-500/20 bg-red-500/5 text-red-400"
              }`}>
                <p>{result.message}</p>
                {result.apiKey && (
                  <div className="mt-2 rounded-md bg-black/50 p-2">
                    <div className="mb-1 text-[10px] uppercase text-zinc-500">API Key (save this!)</div>
                    <code className="break-all text-xs text-amber-400">{result.apiKey}</code>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* API Integration Guide */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
            <h2 className="mb-4 text-sm font-bold text-white">Integration Guide</h2>
            <div className="space-y-4 text-xs text-zinc-400">
              <div>
                <h3 className="mb-1 font-bold text-zinc-300">Your endpoint receives:</h3>
                <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-[11px] text-zinc-300">{`POST https://your-endpoint.com/predict
Content-Type: application/json

{
  "asset": "BTC",
  "price": 97543.21,
  "candles": [
    { "time": 1707000000, "open": 97500,
      "high": 97600, "low": 97400,
      "close": 97543, "volume": 12.5 }
    // ... last 60 candles
  ],
  "orderbook": {
    "bids": [[97540, 0.5], ...],
    "asks": [[97545, 0.3], ...]
  },
  "timestamp": 1707000060000
}`}</pre>
              </div>
              <div>
                <h3 className="mb-1 font-bold text-zinc-300">You must respond with:</h3>
                <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-[11px] text-zinc-300">{`{
  "direction": "up",       // "up" or "down" (REQUIRED)
  "confidence": 72,        // 1-95 (REQUIRED)
  "reasoning": "RSI oversold + EMA golden cross",
  "indicators": {
    "rsi": 28.5,
    "ema_cross": 1
  }
}`}</pre>
              </div>
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
                <h3 className="mb-1 font-bold text-amber-400">Rules</h3>
                <ul className="space-y-1 text-zinc-400">
                  <li>Respond within <strong className="text-white">10 seconds</strong></li>
                  <li>24h probation (96 windows) — accuracy EMA must exceed 52% to promote</li>
                  <li>10 consecutive failures = automatic ban</li>
                  <li>Called every <strong className="text-white">15 minutes</strong> with fresh market data</li>
                  <li>Your accuracy is EMA-weighted (alpha=0.10) — recent performance matters more</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-1 font-bold text-zinc-300">Example (Python)</h3>
                <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-[11px] text-zinc-300">{`from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    candles = data["candles"]
    price = data["price"]

    # Your strategy here
    closes = [c["close"] for c in candles]
    sma_20 = sum(closes[-20:]) / 20

    return jsonify({
        "direction": "up" if price > sma_20 else "down",
        "confidence": 65,
        "reasoning": f"Price vs SMA20: {price:.0f} vs {sma_20:.0f}"
    })`}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Pool */}
        <div className="mt-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Registered Agents ({agents.length})
          </h2>
          {agents.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
              No external agents registered yet. Be the first!
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Agent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Assets</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Accuracy</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Predictions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Probation</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a) => (
                    <tr key={a.id} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="text-sm font-bold text-white">{a.name}</div>
                        <div className="text-[10px] text-zinc-600">{a.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[a.status] || "text-zinc-400"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {a.assets.map((asset) => (
                            <span key={asset} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              asset === "BTC" ? "bg-orange-500/10 text-orange-400" : "bg-amber-500/10 text-amber-400"
                            }`}>
                              {asset}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono text-sm font-bold ${
                          a.accuracy >= 0.55 ? "text-emerald-400" : a.accuracy >= 0.48 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {(a.accuracy * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-400">
                        {a.totalPredictions}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-500">
                        {a.status === "probation" ? `${a.probationWindowsRemaining} left` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
