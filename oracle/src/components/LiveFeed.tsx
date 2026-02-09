"use client";

import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/types";

export function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch("/api/feed?limit=30");
        const data = await res.json();
        setItems(data.feed || []);
      } catch {
        // ignore
      }
    }

    fetchFeed();
    const iv = setInterval(fetchFeed, 5000);
    return () => clearInterval(iv);
  }, []);

  function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  }

  const typeIcons: Record<string, string> = {
    prediction: "\u{1F52E}",
    consensus: "\u26A1",
    agent_signal: "\u{1F916}",
    resolution: "\u2705",
  };

  return (
    <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 400 }}>
      {items.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-600">
          No activity yet. Make a prediction to start the feed.
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.02]"
          >
            <span className="mt-0.5 text-xs">{typeIcons[item.type] || "\u{1F4AC}"}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {item.asset && (
                  <span className={`text-[10px] font-bold ${item.asset === "BTC" ? "text-orange-400" : "text-amber-400"}`}>
                    {item.asset}
                  </span>
                )}
                {item.direction && (
                  <span className={`text-[10px] font-bold ${item.direction === "up" ? "text-emerald-400" : "text-red-400"}`}>
                    {item.direction === "up" ? "\u2191" : "\u2193"}
                  </span>
                )}
                {item.confidence !== undefined && (
                  <span className="text-[10px] text-zinc-500">{item.confidence}%</span>
                )}
              </div>
              <p className="truncate text-[11px] text-zinc-400">{item.message}</p>
            </div>
            <span className="shrink-0 text-[10px] text-zinc-600">{timeAgo(item.timestamp)}</span>
          </div>
        ))
      )}
    </div>
  );
}
