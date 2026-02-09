"use client";

import { useState } from "react";
import type { Asset } from "@/lib/types";

interface Props {
  asset: Asset;
  onPredict: (direction: "up" | "down", confidence: number, reasoning: string) => void;
}

export function PredictionControls({ asset, onPredict }: Props) {
  const [confidence, setConfidence] = useState(65);
  const [reasoning, setReasoning] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmit, setLastSubmit] = useState<{ direction: string; time: number } | null>(null);

  const handlePredict = async (direction: "up" | "down") => {
    if (submitting) return;
    setSubmitting(true);

    try {
      onPredict(direction, confidence, reasoning);
      setLastSubmit({ direction, time: Date.now() });
      setReasoning("");
    } finally {
      setTimeout(() => setSubmitting(false), 1000);
    }
  };

  const color = asset === "BTC" ? "orange" : "amber";

  return (
    <div className="space-y-3">
      {/* Direction buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handlePredict("up")}
          disabled={submitting}
          className="group flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-3 text-sm font-bold text-emerald-400 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
          UP
        </button>
        <button
          onClick={() => handlePredict("down")}
          disabled={submitting}
          className="group flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 py-3 text-sm font-bold text-red-400 transition-all hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
          DOWN
        </button>
      </div>

      {/* Confidence slider */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Confidence</span>
          <span className={`font-mono font-bold ${confidence >= 70 ? "text-emerald-400" : confidence >= 50 ? "text-amber-400" : "text-zinc-400"}`}>
            {confidence}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={95}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/[0.06] accent-amber-500"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-zinc-600">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>

      {/* Reasoning (optional) */}
      <div>
        <input
          type="text"
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="Reasoning (optional)"
          maxLength={200}
          className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 outline-none transition focus:border-white/[0.12]"
        />
      </div>

      {/* Last submission */}
      {lastSubmit && (
        <div className={`rounded-lg border px-3 py-1.5 text-center text-xs ${
          lastSubmit.direction === "up" ? "border-emerald-500/20 text-emerald-400" : "border-red-500/20 text-red-400"
        }`}>
          Predicted {lastSubmit.direction.toUpperCase()} at {confidence}%
        </div>
      )}
    </div>
  );
}
