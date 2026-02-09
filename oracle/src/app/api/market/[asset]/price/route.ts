import { NextResponse } from "next/server";
import { getLatestPrice } from "@/lib/store";
import { fetchPythPrice, fetchGoldPrice } from "@/lib/market-data";
import { PYTH_BTC_FEED } from "@/lib/constants";

export async function GET(
  _req: Request,
  { params }: { params: { asset: string } }
) {
  const asset = params.asset.toUpperCase();

  if (asset !== "BTC" && asset !== "GOLD") {
    return NextResponse.json({ error: "Invalid asset. Use BTC or GOLD" }, { status: 400 });
  }

  // Try cache first
  const cached = getLatestPrice(asset);
  if (cached && Date.now() - cached.timestamp < 10000) {
    return NextResponse.json({
      asset,
      price: cached.price,
      change24h: cached.change24h,
      timestamp: cached.timestamp,
    });
  }

  // Fresh fetch
  try {
    if (asset === "BTC") {
      const pyth = await fetchPythPrice(PYTH_BTC_FEED);
      if (pyth) {
        return NextResponse.json({
          asset: "BTC",
          price: Number(pyth.price.toFixed(2)),
          change24h: cached?.change24h ?? 0,
          timestamp: Date.now(),
        });
      }
    } else {
      const price = await fetchGoldPrice();
      return NextResponse.json({
        asset: "GOLD",
        price: Number(price.toFixed(2)),
        change24h: cached?.change24h ?? 0,
        timestamp: Date.now(),
      });
    }
  } catch {
    // Return cached if available
    if (cached) {
      return NextResponse.json({
        asset,
        price: cached.price,
        change24h: cached.change24h,
        timestamp: cached.timestamp,
        stale: true,
      });
    }
  }

  return NextResponse.json({ error: "Price unavailable" }, { status: 503 });
}
