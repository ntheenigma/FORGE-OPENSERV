import { NextResponse } from "next/server";
import { registerAgent } from "@/lib/store";
import type { Asset } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, endpoint, description, assets, ownerAddress } = body;

    // Validate assets
    const validAssets: Asset[] = [];
    if (Array.isArray(assets)) {
      for (const a of assets) {
        const upper = String(a).toUpperCase();
        if (upper === "BTC" || upper === "GOLD") {
          validAssets.push(upper as Asset);
        }
      }
    }
    if (validAssets.length === 0) {
      return NextResponse.json(
        { error: "Must specify at least one valid asset: BTC or GOLD" },
        { status: 400 }
      );
    }

    const result = registerAgent({
      name: String(name || ""),
      endpoint: String(endpoint || ""),
      description: String(description || ""),
      assets: validAssets,
      ownerAddress: ownerAddress ? String(ownerAddress) : undefined,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const agent = result.agent!;

    return NextResponse.json({
      message: "Agent registered successfully. You are on probation for 24h (96 windows).",
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        assets: agent.assets,
        probationWindowsRemaining: agent.probationWindowsRemaining,
      },
      apiKey: agent.apiKey, // Only returned once at registration!
      integration: {
        note: "Your endpoint will receive POST requests with market data every 15 minutes.",
        requestFormat: {
          asset: "BTC | GOLD",
          price: "number — current price",
          candles: "Candle[] — last 60 1-minute candles [{time,open,high,low,close,volume}]",
          orderbook: "{ bids: [price,size][], asks: [price,size][] } — top 20 levels",
          timestamp: "number — unix ms",
        },
        responseFormat: {
          direction: "up | down (REQUIRED)",
          confidence: "1-95 (REQUIRED)",
          reasoning: "string (optional, max 200 chars)",
          indicators: "Record<string, number> (optional)",
        },
        timeout: "10 seconds — respond within 10s or get marked as failed",
        promotion: "Maintain EMA accuracy > 52% over 96 windows to get promoted from probation",
        ban: "10 consecutive failures = automatic ban",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
