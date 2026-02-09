import { NextResponse } from "next/server";
import { addPrediction, getPredictions } from "@/lib/store";
import type { Prediction, Asset, Direction } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const asset = url.searchParams.get("asset")?.toUpperCase() as Asset | undefined;
  const limit = Math.min(100, Number(url.searchParams.get("limit")) || 20);

  const predictions = getPredictions(asset, limit);

  return NextResponse.json({
    predictions: predictions.map((p) => ({
      id: p.id,
      asset: p.asset,
      direction: p.direction,
      confidence: p.confidence,
      reasoning: p.reasoning,
      source: p.source,
      agentType: p.agentType,
      timestamp: p.timestamp,
      resolved: p.resolved,
      correct: p.correct,
    })),
    count: predictions.length,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { asset, direction, confidence, reasoning, userId, signature } = body;

    // Validate
    if (!asset || !["BTC", "GOLD"].includes(asset.toUpperCase())) {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }
    if (!direction || !["up", "down"].includes(direction)) {
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
    }
    if (typeof confidence !== "number" || confidence < 1 || confidence > 100) {
      return NextResponse.json({ error: "Confidence must be 1-100" }, { status: 400 });
    }

    const prediction: Prediction = {
      id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      asset: asset.toUpperCase() as Asset,
      userId: userId || `anon-${Math.random().toString(36).slice(2, 8)}`,
      direction: direction as Direction,
      confidence,
      reasoning: reasoning?.slice(0, 500),
      timestamp: Date.now(),
      source: "human",
      signature,
    };

    addPrediction(prediction);

    return NextResponse.json({
      id: prediction.id,
      asset: prediction.asset,
      direction: prediction.direction,
      confidence: prediction.confidence,
      timestamp: prediction.timestamp,
      message: "Prediction recorded",
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
