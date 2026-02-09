"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import type { LeaderboardEntry } from "@/lib/types";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [agentAccuracy, setAgentAccuracy] = useState<Record<string, number>>({});

  useEffect(() => {
    // In production this would call a leaderboard API
    // For now, show agent accuracy
    async function fetchData() {
      try {
        const res = await fetch("/api/agents/analyze?asset=BTC");
        const data = await res.json();
        if (data.agentAccuracy) setAgentAccuracy(data.agentAccuracy);
      } catch {}
    }
    fetchData();
  }, []);

  const agents = [
    { type: "trend", name: "TrendBot", icon: "\u{1F4C8}" },
    { type: "rsi", name: "RSIBot", icon: "\u{1F504}" },
    { type: "volume", name: "VolumeBot", icon: "\u{1F4CA}" },
    { type: "macro", name: "MacroBot", icon: "\u{1F30D}" },
    { type: "pattern", name: "PatternBot", icon: "\u{1F50D}" },
    { type: "sentiment", name: "SentimentBot", icon: "\u{1F9E0}" },
  ];

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-black text-white">Leaderboard</h1>
        <p className="mb-8 text-sm text-zinc-500">
          Agent accuracy scores (EMA-weighted) and human predictor rankings.
        </p>

        {/* Agent Leaderboard */}
        <div className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            AI Agents
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Agent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Accuracy (EMA)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {agents
                  .map((a) => ({ ...a, accuracy: agentAccuracy[a.type] ?? 0.5 }))
                  .sort((a, b) => b.accuracy - a.accuracy)
                  .map((agent, i) => (
                    <tr
                      key={agent.type}
                      className="border-b border-white/[0.03] transition hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          i === 0 ? "bg-amber-500/20 text-amber-400" : i === 1 ? "bg-zinc-500/20 text-zinc-300" : i === 2 ? "bg-orange-500/20 text-orange-400" : "bg-white/[0.04] text-zinc-500"
                        }`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{agent.icon}</span>
                          <div>
                            <div className="text-sm font-bold text-white">{agent.name}</div>
                            <div className="text-[10px] text-zinc-600">{agent.type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono text-sm font-bold ${
                          agent.accuracy >= 0.55 ? "text-emerald-400" : agent.accuracy >= 0.48 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {(agent.accuracy * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Human Leaderboard */}
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Human Predictors
          </h2>
          {entries.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-zinc-500">
                No human predictions resolved yet. Make predictions to appear on the leaderboard.
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                You need at least 5 resolved predictions to rank.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">User</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Accuracy</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Predictions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Reputation</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Streak</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Form</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.userId}
                      className="border-b border-white/[0.03] transition hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 text-sm font-bold text-zinc-400">#{e.rank}</td>
                      <td className="px-4 py-3 text-sm font-medium text-white">{e.displayName}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400">
                        {e.accuracy.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-400">{e.totalPredictions}</td>
                      <td className="px-4 py-3 text-right text-sm text-amber-400">{e.reputation}x</td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-400">{e.streak}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-0.5">
                          {e.recentForm.map((f, i) => (
                            <span
                              key={i}
                              className={`inline-block h-3 w-3 rounded-sm text-center text-[8px] font-bold leading-3 ${
                                f === "W" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
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
