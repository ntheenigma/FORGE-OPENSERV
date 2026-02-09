"use client";

import { useEffect, useState } from "react";

interface PredictionData {
  consensus: {
    prediction: "UP" | "DOWN";
    confidence: number;
    action: string;
    regime: string;
    reasoning: string;
    agent_contributions: { specialization: string; vote: string; weight: number }[];
  };
  window_id: string;
  timestamp: string;
}

export function LivePrediction() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [countdown, setCountdown] = useState(900);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/prediction");
        if (res.ok) setData(await res.json());
      } catch { /* empty */ }
      setLoading(false);
    }
    load();
    const poll = setInterval(load, 60000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c <= 0 ? 900 : c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const min = Math.floor(countdown / 60);
  const sec = countdown % 60;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="text-sm text-zinc-500">Loading prediction...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        <div className="text-sm text-zinc-400">No predictions yet</div>
        <div className="mt-2 text-xs text-zinc-600">Pipeline runs every 15 minutes. First prediction on startup.</div>
      </div>
    );
  }

  const c = data.consensus;
  const color = c.prediction === "UP" ? "#22c55e" : "#ef4444";
  const pct = c.confidence * 100;
  const circ = 2 * Math.PI * 54;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-6">
      <div className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-20 blur-3xl`} style={{ background: color }} />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Live Prediction</span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">BTC / USD</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Next window</div>
          <div className="font-mono text-sm text-zinc-300">{min}:{sec.toString().padStart(2, "0")}</div>
        </div>
      </div>
      <div className="relative mt-6 flex justify-center">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-1000 ease-out" />
          </svg>
          <div className="text-center">
            <div className="text-3xl font-black" style={{ color }}>{c.prediction}</div>
            <div className="mt-0.5 text-sm text-zinc-400">{pct.toFixed(0)}%</div>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-300">{c.action.toUpperCase()}</span>
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-300">{c.regime.toUpperCase()}</span>
      </div>
      <div className="mt-6 space-y-1.5">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Agent Votes</div>
        {(c.agent_contributions || []).map((a) => (
          <div key={a.specialization} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${a.vote === "UP" ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-xs text-zinc-300">{a.specialization.replace(/_/g, " ")}</span>
            </div>
            <span className="text-xs font-mono text-zinc-500">{(a.weight * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
