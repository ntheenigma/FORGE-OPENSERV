"use client";

import { useEffect, useRef, useState } from "react";
import type { Asset, Candle } from "@/lib/types";

interface Props {
  asset: Asset;
  candles: Candle[];
}

export function ChartContainer({ asset, candles }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || chartRef.current) return;

      const { createChart } = await import("lightweight-charts");
      if (cancelled) return;

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 300,
        layout: {
          background: { color: "transparent" },
          textColor: "#71717a",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.03)" },
          horzLines: { color: "rgba(255,255,255,0.03)" },
        },
        crosshair: {
          vertLine: { color: "rgba(255,255,255,0.1)", labelBackgroundColor: "#27272a" },
          horzLine: { color: "rgba(255,255,255,0.1)", labelBackgroundColor: "#27272a" },
        },
        timeScale: {
          borderColor: "rgba(255,255,255,0.06)",
          timeVisible: true,
          secondsVisible: false,
        },
        rightPriceScale: {
          borderColor: "rgba(255,255,255,0.06)",
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
      });

      chartRef.current = chart;
      seriesRef.current = series;

      if (candles.length > 0) {
        series.setData(candles as any);
        chart.timeScale().fitContent();
      }

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      ro.observe(containerRef.current);

      setLoaded(true);

      return () => {
        ro.disconnect();
        chart.remove();
      };
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Update data
  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      seriesRef.current.setData(candles as any);
    }
  }, [candles]);

  const color = asset === "BTC" ? "orange" : "amber";

  return (
    <div className="relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`h-6 w-6 animate-spin rounded-full border-2 border-${color}-500/20 border-t-${color}-500`} />
        </div>
      )}
      <div ref={containerRef} className="chart-container" />
    </div>
  );
}
