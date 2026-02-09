"use client";

import { useEffect, useState, useCallback } from "react";
import type { Asset, Candle, ConsensusResult } from "@/lib/types";
import { ChartContainer } from "./ChartContainer";
import { PredictionControls } from "./PredictionControls";
import { ConsensusCard } from "./ConsensusCard";

interface Props {
  asset: Asset;
}

export function AssetPanel({ asset }: Props) {
  const [price, setPrice] = useState(0);
  const [change24h, setChange24h] = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch price
  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch(`/api/market/${asset}/price`);
        const data = await res.json();
        if (data.price) {
          setPrice(data.price);
          setChange24h(data.change24h || 0);
        }
      } catch {}
    }

    fetchPrice();
    const iv = setInterval(fetchPrice, 5000);
    return () => clearInterval(iv);
  }, [asset]);

  // Fetch candles
  useEffect(() => {
    async function fetchCandles() {
      try {
        const res = await fetch(`/api/market/${asset}/candles?timeframe=1m&limit=100`);
        const data = await res.json();
        if (data.candles?.length > 0) {
          setCandles(data.candles);
        }
      } catch {}
      setLoading(false);
    }

    fetchCandles();
    const iv = setInterval(fetchCandles, 30000);
    return () => clearInterval(iv);
  }, [asset]);

  // Fetch consensus
  useEffect(() => {
    async function fetchConsensus() {
      try {
        const res = await fetch(`/api/consensus/${asset}`);
        const data = await res.json();
        if (data.direction) setConsensus(data);
      } catch {}
    }

    fetchConsensus();
    const iv = setInterval(fetchConsensus, 10000);
    return () => clearInterval(iv);
  }, [asset]);

  const handlePredict = useCallback(
    async (direction: "up" | "down", confidence: number, reasoning: string) => {
      try {
        await fetch("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset,
            direction,
            confidence,
            reasoning,
            userId: `web-${Math.random().toString(36).slice(2, 10)}`,
          }),
        });
      } catch {}
    },
    [asset]
  );

  const isUp = change24h >= 0;
  const isBTC = asset === "BTC";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111118] p-4">
      {/* Asset Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            isBTC ? "bg-orange-500/10" : "bg-amber-500/10"
          }`}>
            <span className={`text-base font-black ${isBTC ? "text-orange-400" : "text-amber-400"}`}>
              {isBTC ? "\u20BF" : "Au"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">{asset}</span>
              <span className="text-[10px] text-zinc-500">{isBTC ? "Bitcoin" : "Gold"}/USD</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black text-white">
                ${price > 0 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "..."}
              </span>
              {price > 0 && (
                <span className={`text-xs font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                  {isUp ? "+" : ""}{change24h.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-4">
        {loading ? (
          <div className="chart-container flex items-center justify-center">
            <div className="text-xs text-zinc-600">Loading chart...</div>
          </div>
        ) : (
          <ChartContainer asset={asset} candles={candles} />
        )}
      </div>

      {/* Consensus */}
      <div className="mb-4">
        <ConsensusCard consensus={consensus} />
      </div>

      {/* Prediction Controls */}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Your Prediction
        </div>
        <PredictionControls asset={asset} onPredict={handlePredict} />
      </div>
    </div>
  );
}
