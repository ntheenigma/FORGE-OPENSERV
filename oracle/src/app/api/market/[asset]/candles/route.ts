import { NextResponse } from "next/server";
import { getCandleCache } from "@/lib/store";
import { fetchBTCCandles } from "@/lib/market-data";

export async function GET(
  req: Request,
  { params }: { params: { asset: string } }
) {
  const asset = params.asset.toUpperCase();
  const url = new URL(req.url);
  const timeframe = url.searchParams.get("timeframe") || "1m";
  const limit = Math.min(500, Number(url.searchParams.get("limit")) || 100);

  if (asset !== "BTC" && asset !== "GOLD") {
    return NextResponse.json({ error: "Invalid asset. Use BTC or GOLD" }, { status: 400 });
  }

  // Try cache first
  const cacheKey = `${asset}:${timeframe}`;
  const cached = getCandleCache(cacheKey);
  if (cached && cached.length > 0) {
    return NextResponse.json({
      asset,
      timeframe,
      candles: cached.slice(-limit),
      count: Math.min(cached.length, limit),
    });
  }

  // Fresh fetch for BTC
  if (asset === "BTC") {
    try {
      const candles = await fetchBTCCandles(timeframe, limit);
      return NextResponse.json({
        asset: "BTC",
        timeframe,
        candles,
        count: candles.length,
      });
    } catch {
      return NextResponse.json({ error: "Candle data unavailable" }, { status: 503 });
    }
  }

  // GOLD candles from cache only (generated from price snapshots)
  return NextResponse.json({
    asset: "GOLD",
    timeframe,
    candles: [],
    count: 0,
    note: "Gold candles generated from price snapshots. Run pipeline to populate.",
  });
}
