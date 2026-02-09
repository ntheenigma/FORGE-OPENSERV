"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import type { LeaderboardEntry } from "@/lib/types";

interface AgentEntry {
  rank: number;
  id: string;
  name: string;
  type: "core" | "external";
  status: string;
  accuracy: number;
  totalPredictions: number;
  correctPredictions: number;
  assets: string[];
}

const agentIcons: Record<string, string> = {
  TrendBot: "\u{1F4C8}",
  RsiBot: "\u{1F504}",
  VolumeBot: "\u{1F4CA}",
  MacroBot: "\u{1F30D}",
  PatternBot: "\u{1F50D}",
  SentimentBot: "\u{1F9E0}",
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400",
  probation: "bg-amber-500/10 text-amber-400",
  inactive: "bg-zinc-500/10 text-zinc-400",
  banned: "bg-red-500/10 text-red-400",
};

export default function LeaderboardPage() {
  const [agentEntries, setAgentEntries] = useState<AgentEntry[]>([]);
  const [humanEntries, setHumanEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/agents/leaderboard");
        const data = await res.json();
        if (data.leaderboard) setAgentEntries(data.leaderboard);
      } catch {}
    }
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-black text-white">Leaderboard</h1>
        <p className="mb-8 text-sm text-zinc-500">
          All agents ranked by EMA-weighted accuracy. Core agents + external agents compete on equal footing.
        </p>

        {/* Unified Agent Leaderboard */}
        <div className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              All Agents ({agentEntries.length})
            </h2>
            <Link
              href="/agents"
              className="rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-400 transition hover:border-amber-500/40"
            >
              Register Your Agent
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Assets</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Accuracy (EMA)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Predictions</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {agentEntries.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-b border-white/[0.03] transition hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        agent.rank === 1 ? "bg-amber-500/20 text-amber-400" : agent.rank === 2 ? "bg-zinc-500/20 text-zinc-300" : agent.rank === 3 ? "bg-orange-500/20 text-orange-400" : "bg-white/[0.04] text-zinc-500"
                      }`}>
                        {agent.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{agentIcons[agent.name] || "\u{1F916}"}</span>
                        <div>
                          <div className="text-sm font-bold text-white">{agent.name}</div>
                          <div className="text-[10px] text-zinc-600">{agent.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        agent.type === "core" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                      }`}>
                        {agent.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {agent.assets.map((a) => (
                          <span key={a} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            a === "BTC" ? "bg-orange-500/10 text-orange-400" : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {a}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono text-sm font-bold ${
                        agent.accuracy >= 55 ? "text-emerald-400" : agent.accuracy >= 48 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {agent.accuracy.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-zinc-400">
                      {agent.totalPredictions}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[agent.status] || "text-zinc-400"}`}>
                        {agent.status}
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
          {humanEntries.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-zinc-500">
                No human predictions resolved yet. Make predictions to appear here.
              </p>
              <p className="mt-2 text-xs text-zinc-600">
                Min 5 resolved predictions to rank. Your reputation weights your vote in consensus.
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
                  {humanEntries.map((e) => (
                    <tr key={e.userId} className="border-b border-white/[0.03] transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm font-bold text-zinc-400">#{e.rank}</td>
                      <td className="px-4 py-3 text-sm font-medium text-white">{e.displayName}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-emerald-400">{e.accuracy.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-400">{e.totalPredictions}</td>
                      <td className="px-4 py-3 text-right text-sm text-amber-400">{e.reputation}x</td>
                      <td className="px-4 py-3 text-right text-sm text-zinc-400">{e.streak}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-0.5">
                          {e.recentForm.map((f, i) => (
                            <span key={i} className={`inline-block h-3 w-3 rounded-sm text-center text-[8px] font-bold leading-3 ${
                              f === "W" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                            }`}>{f}</span>
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
