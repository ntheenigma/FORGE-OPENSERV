import { NextResponse } from "next/server";
import { getLastResult } from "@/agents/pipeline";
import { getAccuracyScores } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const last = getLastResult();
  const scores = getAccuracyScores();

  return NextResponse.json({
    status: "ok",
    uptime: process.uptime(),
    last_prediction: last
      ? {
          window_id: last.window_id,
          prediction: last.consensus.prediction,
          confidence: last.consensus.confidence,
          timestamp: last.timestamp,
        }
      : null,
    accuracy_scores: scores,
    version: "1.0.0",
  });
}
