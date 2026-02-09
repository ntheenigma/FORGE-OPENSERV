import { NextResponse } from "next/server";
import { getAgentLeaderboard } from "@/lib/store";

export async function GET() {
  const leaderboard = getAgentLeaderboard();

  return NextResponse.json({
    leaderboard: leaderboard.map((entry, i) => ({
      rank: i + 1,
      ...entry,
      accuracy: Number((entry.accuracy * 100).toFixed(1)),
    })),
    total: leaderboard.length,
  });
}
