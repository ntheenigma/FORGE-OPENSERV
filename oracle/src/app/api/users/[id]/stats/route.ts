import { NextResponse } from "next/server";
import { getUserStats } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  const stats = getUserStats(userId);

  return NextResponse.json({
    userId: stats.userId,
    totalPredictions: stats.totalPredictions,
    correctPredictions: stats.correctPredictions,
    accuracy: Number((stats.accuracy * 100).toFixed(1)),
    avgConfidence: Number(stats.avgConfidence.toFixed(1)),
    reputation: Number(stats.reputation.toFixed(2)),
    rank: stats.rank,
    streak: stats.streak,
    bestStreak: stats.bestStreak,
    joinedAt: stats.joinedAt,
    lastActive: stats.lastActive,
  });
}
