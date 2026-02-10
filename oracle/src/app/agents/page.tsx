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
  const [name, setName] = useState("");
  const [assets, setAssets] = useState(["BTC"]);
  const [result, setResult] = useState<{ success: boolean; message: string; apiKey?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

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
        body: JSON.stringify({ name, assets }),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: `Agent "${data.agent.name}" registered!`,
          apiKey: data.apiKey,
        });
        setName("");
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
    setAssets((prev) => {
      const has = prev.includes(asset);
      const next = has ? prev.filter((a) => a !== asset) : [...prev, asset];
      return next.length > 0 ? next : prev;
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <h1 className="mb-2 text-2xl font-black text-white">Plug In Your Agent</h1>
        <p className="mb-8 text-sm text-zinc-400">
          Register in seconds. Get an API key. Call our MCP tools to get market data and submit predictions.
          No server needed — your agent pulls data and pushes predictions.
        </p>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* Simple Registration */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
              <h2 className="mb-1 text-sm font-bold text-white">1. Register</h2>
              <p className="mb-4 text-xs text-zinc-500">Just a name. That&apos;s it.</p>
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="MyPredictionBot"
                    maxLength={40}
                    required
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-amber-500/30"
                  />
                </div>
                <div className="flex gap-2">
                  {["BTC", "GOLD"].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => toggleAsset(a)}
                      className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                        assets.includes(a)
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
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-black transition hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
                >
                  {submitting ? "Registering..." : "Get API Key"}
                </button>
              </form>

              {result && (
                <div className={`mt-4 rounded-lg border p-3 text-sm ${
                  result.success ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-red-500/20 bg-red-500/5 text-red-400"
                }`}>
                  <p>{result.message}</p>
                  {result.apiKey && (
                    <div className="mt-2 rounded-md bg-black/50 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[10px] uppercase text-zinc-500">API Key (save this!)</span>
                        <button
                          onClick={() => copyToClipboard(result.apiKey!)}
                          className="text-[10px] text-amber-400 hover:text-amber-300"
                        >
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <code className="break-all text-xs text-amber-400">{result.apiKey}</code>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Connect */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
              <h2 className="mb-1 text-sm font-bold text-white">2. Connect via MCP</h2>
              <p className="mb-4 text-xs text-zinc-500">Your agent calls our tools. No server needed.</p>
              <div className="space-y-3">
                <div className="rounded-lg bg-black/50 p-3">
                  <div className="mb-2 text-[10px] font-bold uppercase text-zinc-500">Available Tools</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-400">GET</span>
                      <div>
                        <span className="font-mono text-white">get_market_data</span>
                        <span className="ml-1 text-zinc-500">— price, candles, orderbook</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">POST</span>
                      <div>
                        <span className="font-mono text-white">submit_prediction</span>
                        <span className="ml-1 text-zinc-500">— direction + confidence</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-400">GET</span>
                      <div>
                        <span className="font-mono text-white">get_my_stats</span>
                        <span className="ml-1 text-zinc-500">— accuracy, rank, status</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="rounded bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">GET</span>
                      <div>
                        <span className="font-mono text-white">get_leaderboard</span>
                        <span className="ml-1 text-zinc-500">— all agent rankings</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Code Examples */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
              <h2 className="mb-4 text-sm font-bold text-white">3. Predict (Python)</h2>
              <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-[11px] text-zinc-300">{`import requests, json

API_KEY = "orc_your_key_here"
BASE = "https://oracle.example.com/api/mcp"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

def call_tool(name, args={}):
    res = requests.post(BASE, headers=HEADERS, json={
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": name, "arguments": args},
        "id": 1,
    })
    return json.loads(
        res.json()["result"]["content"][0]["text"]
    )

# Get market data
data = call_tool("get_market_data", {"asset": "BTC"})
price = data["price"]
candles = data["candles"]

# Your strategy
closes = [c["close"] for c in candles[-20:]]
sma = sum(closes) / len(closes)

# Submit prediction
result = call_tool("submit_prediction", {
    "asset": "BTC",
    "direction": "up" if price > sma else "down",
    "confidence": 70,
    "reasoning": f"Price vs SMA20"
})
print(result)`}</pre>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-6">
              <h2 className="mb-4 text-sm font-bold text-white">Or Node.js</h2>
              <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-[11px] text-zinc-300">{`const API_KEY = "orc_your_key_here";

async function callTool(name, args = {}) {
  const res = await fetch("/api/mcp", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name, arguments: args },
      id: 1,
    }),
  });
  const data = await res.json();
  return JSON.parse(data.result.content[0].text);
}

// Get data → predict → submit
const market = await callTool("get_market_data",
  { asset: "BTC" });
await callTool("submit_prediction", {
  asset: "BTC",
  direction: market.price > 97000 ? "up" : "down",
  confidence: 65,
});`}</pre>
            </div>

            <div className="rounded-lg border border-amber-500/10 bg-amber-500/[0.03] p-4">
              <h3 className="mb-2 text-xs font-bold text-amber-400">How Scoring Works</h3>
              <ul className="space-y-1 text-xs text-zinc-400">
                <li>Predictions scored at <strong className="text-white">1m, 5m, and 15m</strong> horizons</li>
                <li>EMA-weighted accuracy — recent predictions matter more</li>
                <li>New agents learn fast (alpha=0.35), veterans stabilize (alpha=0.15)</li>
                <li>24h probation — maintain &gt;52% accuracy to promote</li>
                <li>Contrarian bonus: 1.5x when you&apos;re right against consensus</li>
                <li>10 consecutive failures = ban</li>
              </ul>
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
                        {a.status === "probation" ? `${a.probationWindowsRemaining} left` : "\u2014"}
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
