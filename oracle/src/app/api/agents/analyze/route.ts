import { NextResponse } from "next/server";
import { fetchMarketSnapshot } from "@/lib/market-data";
import { runAgentAnalysis } from "@/agents/orchestrator";
import { calculateConsensus } from "@/lib/consensus";
import { getUnresolvedPredictions, setConsensus, addPrediction, getAgentAccuracy } from "@/lib/store";
import type { Asset, Prediction } from "@/lib/types";
import { PREDICTION_WINDOW_MS } from "@/lib/constants";

function windowId(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const asset = (url.searchParams.get("asset")?.toUpperCase() || "BTC") as Asset;

  if (asset !== "BTC" && asset !== "GOLD") {
    return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
  }

  console.log(`[ORACLE] Running agent analysis for ${asset}...`);

  try {
    // 1. Fetch market data
    const snapshot = await fetchMarketSnapshot(asset);

    // 2. Run all 6 agents
    const signals = await runAgentAnalysis(asset, snapshot);

    // 3. Store agent predictions
    for (const signal of signals) {
      const pred: Prediction = {
        id: `agent-${signal.agentType}-${Date.now()}`,
        asset,
        userId: `agent:${signal.agentType}`,
        direction: signal.direction,
        confidence: signal.confidence,
        reasoning: signal.reasoning,
        timestamp: signal.timestamp,
        source: "agent",
        agentType: signal.agentType,
      };
      addPrediction(pred);
    }

    // 4. Get human predictions for this window
    const windowStart = Date.now() - PREDICTION_WINDOW_MS;
    const humanPredictions = getUnresolvedPredictions(asset, windowStart);

    // 5. Calculate consensus
    const wid = windowId();
    const consensus = calculateConsensus(asset, humanPredictions, signals, wid);
    setConsensus(asset, consensus);

    return NextResponse.json({
      asset,
      windowId: wid,
      signals: signals.map((s) => ({
        agent: s.agentType,
        direction: s.direction,
        confidence: s.confidence,
        reasoning: s.reasoning,
        accuracy: s.historicalAccuracy,
      })),
      consensus: {
        direction: consensus.direction,
        confidence: consensus.confidence,
        humanCount: consensus.humanCount,
        agentCount: consensus.agentCount,
        reasoning: consensus.reasoning,
      },
      agentAccuracy: getAgentAccuracy(),
      price: snapshot.price,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error(`[ORACLE] Agent analysis failed:`, e);
    return NextResponse.json(
      { error: "Agent analysis failed", details: String(e) },
      { status: 500 }
    );
  }
}

// Also support GET for manual trigger
export async function GET(req: Request) {
  return POST(req);
}
