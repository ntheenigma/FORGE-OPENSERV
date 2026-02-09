import { NextResponse } from "next/server";
import { runPipeline, runScoring } from "@/agents/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "predict";

  if (action === "score") {
    await runScoring();
    return NextResponse.json({ status: "scored" });
  }

  const result = await runPipeline();
  if (!result) {
    return NextResponse.json(
      { error: "Pipeline failed — check data sources" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    prediction: result.consensus.prediction,
    confidence: result.consensus.confidence,
    action: result.consensus.action,
    regime: result.consensus.regime,
    window_id: result.window_id,
  });
}
