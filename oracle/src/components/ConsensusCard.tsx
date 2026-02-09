"use client";

import type { ConsensusResult } from "@/lib/types";

interface Props {
  consensus: ConsensusResult | null;
}

export function ConsensusCard({ consensus }: Props) {
  if (!consensus) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="text-center text-xs text-zinc-600">
          Waiting for consensus...
        </div>
      </div>
    );
  }

  const isUp = consensus.direction === "up";
  const isNeutral = consensus.direction === "neutral";
  const dirColor = isNeutral ? "zinc" : isUp ? "emerald" : "red";

  return (
    <div className={`rounded-xl border p-4 ${
      isNeutral
        ? "border-white/[0.06] bg-white/[0.02]"
        : isUp
        ? "border-emerald-500/20 bg-emerald-500/[0.04]"
        : "border-red-500/20 bg-red-500/[0.04]"
    }`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Consensus
        </span>
        <span className="text-[10px] text-zinc-600">
          {consensus.humanCount}H + {consensus.agentCount}A
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Direction */}
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          isNeutral ? "bg-zinc-500/10" : isUp ? "bg-emerald-500/10" : "bg-red-500/10"
        }`}>
          {isNeutral ? (
            <span className="text-lg text-zinc-400">--</span>
          ) : (
            <svg
              className={`h-6 w-6 ${isUp ? "text-emerald-400" : "rotate-180 text-red-400"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </div>

        <div className="flex-1">
          <div className={`text-lg font-black ${
            isNeutral ? "text-zinc-400" : isUp ? "text-emerald-400" : "text-red-400"
          }`}>
            {consensus.direction.toUpperCase()} {consensus.confidence}%
          </div>
          <div className="text-xs text-zinc-500">{consensus.reasoning}</div>
        </div>
      </div>

      {/* Signal breakdown */}
      {consensus.signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {consensus.signals.slice(0, 8).map((s, i) => (
            <span
              key={i}
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                s.direction === "up"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {s.source.replace("agent:", "").replace("human:", "U:")} {s.direction === "up" ? "\u2191" : "\u2193"}
            </span>
          ))}
        </div>
      )}

      {/* Agreement bar */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] text-zinc-600">
          <span>{(consensus.upWeight * 100 / (consensus.upWeight + consensus.downWeight || 1)).toFixed(0)}% UP</span>
          <span>{(consensus.downWeight * 100 / (consensus.upWeight + consensus.downWeight || 1)).toFixed(0)}% DOWN</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="rounded-full bg-emerald-500 transition-all"
            style={{ width: `${consensus.upWeight * 100 / (consensus.upWeight + consensus.downWeight || 1)}%` }}
          />
          <div
            className="rounded-full bg-red-500 transition-all"
            style={{ width: `${consensus.downWeight * 100 / (consensus.upWeight + consensus.downWeight || 1)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
