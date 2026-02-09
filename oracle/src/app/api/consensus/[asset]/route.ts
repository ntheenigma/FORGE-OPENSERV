import { NextResponse } from "next/server";
import { getConsensus } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: { asset: string } }
) {
  const asset = params.asset.toUpperCase();

  if (asset !== "BTC" && asset !== "GOLD") {
    return NextResponse.json({ error: "Invalid asset. Use BTC or GOLD" }, { status: 400 });
  }

  const consensus = getConsensus(asset);

  if (!consensus) {
    return NextResponse.json({
      asset,
      direction: "neutral",
      confidence: 50,
      humanCount: 0,
      agentCount: 0,
      reasoning: "No consensus data yet. Waiting for next pipeline run.",
      timestamp: Date.now(),
      windowId: "pending",
    });
  }

  return NextResponse.json(consensus);
}
