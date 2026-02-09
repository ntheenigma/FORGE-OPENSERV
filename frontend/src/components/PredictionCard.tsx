"use client";

import { useEffect, useState } from "react";

interface Prediction {
  prediction: "UP" | "DOWN";
  confidence: number;
  action: string;
  regime: string;
  reasoning: string;
  vote_breakdown: {
    up_weight: number;
    down_weight: number;
    agreement_ratio: number;
    unique_specializations: number;
  };
  agent_contributions: {
    specialization: string;
    vote: string;
    weight: number;
  }[];
  timestamp: string;
  window_id: string;
}

const MOCK_PREDICTION: Prediction = {
  prediction: "UP",
  confidence: 0.68,
  action: "medium",
  regime: "trending",
  reasoning: "3/4_agents_UP_weighted_0.72_trending_regime",
  vote_breakdown: {
    up_weight: 0.72,
    down_weight: 0.28,
    agreement_ratio: 0.75,
    unique_specializations: 4,
  },
  agent_contributions: [
    { specialization: "candle_microstructure", vote: "UP", weight: 0.31 },
    { specialization: "order_flow", vote: "UP", weight: 0.28 },
    { specialization: "momentum_trend", vote: "UP", weight: 0.22 },
    { specialization: "mean_reversion", vote: "DOWN", weight: 0.19 },
  ],
  timestamp: new Date().toISOString(),
  window_id: "20250215-1430",
};

function ConfidenceRing({
  confidence,
  direction,
}: {
  confidence: number;
  direction: "UP" | "DOWN";
}) {
  const pct = confidence * 100;
  const circumference = 2 * Math.PI * 54;
  const dashoffset = circumference - (pct / 100) * circumference;
  const color = direction === "UP" ? "#22c55e" : "#ef4444";

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="6"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-black" style={{ color }}>
          {direction}
        </div>
        <div className="mt-0.5 text-sm text-zinc-400">
          {(confidence * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function AgentVote({
  agent,
}: {
  agent: { specialization: string; vote: string; weight: number };
}) {
  const label = agent.specialization
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          className={`h-2 w-2 rounded-full ${
            agent.vote === "UP" ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-xs text-zinc-300">{label}</span>
      </div>
      <span className="text-xs font-mono text-zinc-500">
        {(agent.weight * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export function PredictionCard({ premium = false }: { premium?: boolean }) {
  const [prediction, setPrediction] = useState<Prediction>(MOCK_PREDICTION);
  const [countdown, setCountdown] = useState(900);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => (c <= 0 ? 900 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLive(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent p-6">
      {/* Glow effect */}
      <div
        className={`pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl transition-opacity duration-1000 ${
          live ? "opacity-20" : "opacity-0"
        } ${
          prediction.prediction === "UP" ? "bg-green-500" : "bg-red-500"
        }`}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Live Prediction
            </span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-white">BTC / USD</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Next window</div>
          <div className="font-mono text-sm text-zinc-300">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* Confidence Ring */}
      <div className="relative mt-6 flex justify-center">
        <ConfidenceRing
          confidence={prediction.confidence}
          direction={prediction.prediction}
        />
      </div>

      {/* Action + Regime */}
      <div className="mt-4 flex justify-center gap-3">
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-300">
          {prediction.action.toUpperCase()}
        </span>
        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-300">
          {prediction.regime.toUpperCase()}
        </span>
      </div>

      {/* Agent Votes - Premium Only */}
      {premium ? (
        <div className="mt-6 space-y-1.5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Agent Votes
          </div>
          {prediction.agent_contributions.map((agent) => (
            <AgentVote key={agent.specialization} agent={agent} />
          ))}
          <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-500/5 px-3 py-2 text-xs">
            <span className="text-amber-400/80">Diversity Score</span>
            <span className="font-mono text-amber-400">
              {prediction.vote_breakdown.unique_specializations} specializations
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <div className="text-sm text-zinc-400">
            Agent vote breakdown available on
          </div>
          <a
            href="/premium"
            className="mt-1 inline-block text-sm font-semibold text-amber-400 hover:text-amber-300"
          >
            Premium Plans &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
