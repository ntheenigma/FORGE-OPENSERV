import { NextResponse } from "next/server";
import { getAgentPool } from "@/lib/store";

export async function GET() {
  const pool = getAgentPool();

  return NextResponse.json({
    agents: pool.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      status: a.status,
      assets: a.assets,
      accuracy: Number(a.accuracyEma.toFixed(4)),
      totalPredictions: a.totalPredictions,
      correctPredictions: a.correctPredictions,
      consecutiveFailures: a.consecutiveFailures,
      probationWindowsRemaining: a.probationWindowsRemaining,
      registeredAt: a.registeredAt,
      lastSeen: a.lastSeen,
      // Never expose endpoint or apiKey
    })),
    total: pool.length,
    active: pool.filter((a) => a.status === "active" || a.status === "probation").length,
  });
}
