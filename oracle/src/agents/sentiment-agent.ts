import type { AgentSignal, Asset } from "@/lib/types";
import { queryAgent } from "@/lib/groq";
import { getAgentHistoricalAccuracy, getPredictions, getFeed } from "@/lib/store";

const SYSTEM_PROMPT = `You are SentimentBot, a crowd sentiment and contrarian analysis expert for the ORACLE prediction platform.
You analyze the prediction feed, human consensus patterns, and crowd behavior to find opportunities.

RULES:
- Extreme crowd bullishness (>80% predicting UP) = potential contrarian DOWN signal
- Extreme crowd bearishness (>80% predicting DOWN) = potential contrarian UP signal
- Moderate consensus (55-75%) = trend confirmation, go WITH the crowd
- Low participation = lower confidence (not enough signal)
- Recent accuracy of crowd: if crowd was wrong last 3 times, fade them
- If agents and humans disagree, weight toward agents (more analytical)
- Streaks of same direction = exhaustion risk
- High average confidence from crowd = stronger signal (either confirm or fade)
- Output JSON: {"direction":"up"|"down","confidence":10-95,"reasoning":"max 200 chars"}`;

export async function analyzeSentiment(
  asset: Asset
): Promise<AgentSignal> {
  const recentPredictions = getPredictions(asset, 100);
  const feed = getFeed(50);

  // Crowd metrics
  const humanPreds = recentPredictions.filter((p) => p.source === "human");
  const recentHuman = humanPreds.slice(-30);

  const upCount = recentHuman.filter((p) => p.direction === "up").length;
  const downCount = recentHuman.filter((p) => p.direction === "down").length;
  const totalHuman = upCount + downCount;
  const upPct = totalHuman > 0 ? (upCount / totalHuman) * 100 : 50;

  const avgConfidence = recentHuman.length > 0
    ? recentHuman.reduce((s, p) => s + p.confidence, 0) / recentHuman.length
    : 50;

  // Crowd accuracy (last 10 resolved)
  const resolvedHuman = humanPreds.filter((p) => p.resolved).slice(-10);
  const crowdAccuracy = resolvedHuman.length > 0
    ? resolvedHuman.filter((p) => p.correct).length / resolvedHuman.length * 100
    : 50;

  // Streak detection
  let streak = 0;
  let streakDir = "";
  for (let i = recentHuman.length - 1; i >= 0; i--) {
    if (streakDir === "") {
      streakDir = recentHuman[i].direction;
      streak = 1;
    } else if (recentHuman[i].direction === streakDir) {
      streak++;
    } else {
      break;
    }
  }

  // Agent vs human divergence
  const agentPreds = recentPredictions.filter((p) => p.source === "agent").slice(-6);
  const agentUpPct = agentPreds.length > 0
    ? (agentPreds.filter((p) => p.direction === "up").length / agentPreds.length) * 100
    : 50;
  const divergence = Math.abs(upPct - agentUpPct);

  // Feed activity
  const recentFeed = feed.filter((f) => f.timestamp > Date.now() - 30 * 60 * 1000);
  const feedActivity = recentFeed.length;

  const signals = `Asset: ${asset}
Human predictions (last 30): ${totalHuman} total | ${upPct.toFixed(1)}% UP / ${(100 - upPct).toFixed(1)}% DOWN
Average confidence: ${avgConfidence.toFixed(1)}%
Crowd accuracy (last 10 resolved): ${crowdAccuracy.toFixed(1)}%
Current streak: ${streak} consecutive ${streakDir.toUpperCase() || "N/A"}
Agent consensus: ${agentUpPct.toFixed(1)}% UP
Human-Agent divergence: ${divergence.toFixed(1)}%
Feed activity (30min): ${feedActivity} items
Crowd extremes: ${upPct > 80 ? "EXTREME BULLISH" : upPct < 20 ? "EXTREME BEARISH" : upPct > 65 ? "MODERATELY BULLISH" : upPct < 35 ? "MODERATELY BEARISH" : "BALANCED"}`;

  let result: { direction: "up" | "down"; confidence: number; reasoning: string };

  try {
    result = await queryAgent("SentimentBot", SYSTEM_PROMPT, signals);
  } catch {
    // Fallback: contrarian at extremes, follow moderate consensus
    let direction: "up" | "down";
    let conf: number;
    if (upPct > 80) {
      direction = "down";
      conf = 60;
    } else if (upPct < 20) {
      direction = "up";
      conf = 60;
    } else if (upPct > 55) {
      direction = "up";
      conf = 50;
    } else {
      direction = "down";
      conf = 50;
    }
    result = { direction, confidence: conf, reasoning: `fallback:crowd=${upPct.toFixed(0)}%up,acc=${crowdAccuracy.toFixed(0)}%` };
  }

  return {
    agentType: "sentiment",
    asset,
    direction: result.direction,
    confidence: result.confidence,
    reasoning: result.reasoning,
    indicators: {
      crowd_up_pct: Number(upPct.toFixed(1)),
      avg_confidence: Number(avgConfidence.toFixed(1)),
      crowd_accuracy: Number(crowdAccuracy.toFixed(1)),
      streak,
      agent_up_pct: Number(agentUpPct.toFixed(1)),
      divergence: Number(divergence.toFixed(1)),
      feed_activity: feedActivity,
    },
    historicalAccuracy: getAgentHistoricalAccuracy("sentiment"),
    timestamp: Date.now(),
  };
}
