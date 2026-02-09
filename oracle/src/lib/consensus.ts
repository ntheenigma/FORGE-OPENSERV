import type { Prediction, AgentSignal, ConsensusResult, Asset, Direction } from "./types";
import { getUserReputation } from "./store";

interface WeightedSignal {
  source: string;
  direction: Direction;
  weight: number;
  confidence: number;
  timestamp: number;
}

export function calculateConsensus(
  asset: Asset,
  humanPredictions: Prediction[],
  agentSignals: AgentSignal[],
  windowId: string
): ConsensusResult {
  const now = Date.now();
  const signals: WeightedSignal[] = [];

  // Weight human predictions by reputation
  for (const p of humanPredictions) {
    const rep = getUserReputation(p.userId);
    signals.push({
      source: `human:${p.userId.slice(0, 8)}`,
      direction: p.direction,
      weight: rep * (p.confidence / 100),
      confidence: p.confidence,
      timestamp: p.timestamp,
    });
  }

  // Weight agent signals by historical accuracy
  for (const a of agentSignals) {
    signals.push({
      source: `agent:${a.agentType}`,
      direction: a.direction,
      weight: a.historicalAccuracy * (a.confidence / 100),
      confidence: a.confidence,
      timestamp: a.timestamp,
    });
  }

  if (signals.length === 0) {
    return {
      asset,
      direction: "neutral",
      confidence: 50,
      humanCount: 0,
      agentCount: 0,
      reasoning: "No signals available",
      upWeight: 0,
      downWeight: 0,
      agreementRatio: 0.5,
      signals: [],
      timestamp: now,
      windowId,
    };
  }

  // Apply time-decay: 1hr half-life
  const HALF_LIFE = 3600000;
  const timeWeighted = signals.map((s) => ({
    ...s,
    finalWeight: s.weight * Math.exp(-(now - s.timestamp) / HALF_LIFE),
  }));

  const upWeight = timeWeighted
    .filter((s) => s.direction === "up")
    .reduce((sum, s) => sum + s.finalWeight, 0);

  const downWeight = timeWeighted
    .filter((s) => s.direction === "down")
    .reduce((sum, s) => sum + s.finalWeight, 0);

  const total = upWeight + downWeight;
  const upRatio = total > 0 ? upWeight / total : 0.5;

  let direction: Direction | "neutral";
  let confidence: number;

  if (upRatio > 0.6) {
    direction = "up";
    confidence = Math.round(upRatio * 100);
  } else if (upRatio < 0.4) {
    direction = "down";
    confidence = Math.round((1 - upRatio) * 100);
  } else {
    direction = "neutral";
    confidence = 50;
  }

  // Boost confidence if high agreement
  const totalSignals = signals.length;
  const majorityDirection = upRatio >= 0.5 ? "up" : "down";
  const agreeing = signals.filter((s) => s.direction === majorityDirection).length;
  const agreementRatio = totalSignals > 0 ? agreeing / totalSignals : 0.5;

  if (agreementRatio >= 0.85) confidence = Math.min(95, confidence + 5);
  else if (agreementRatio < 0.55) confidence = Math.max(30, confidence - 10);

  const reasoning = generateReasoning(
    humanPredictions.length,
    agentSignals.length,
    direction,
    confidence,
    agreementRatio,
    agentSignals
  );

  return {
    asset,
    direction,
    confidence,
    humanCount: humanPredictions.length,
    agentCount: agentSignals.length,
    reasoning,
    upWeight: Number(upWeight.toFixed(3)),
    downWeight: Number(downWeight.toFixed(3)),
    agreementRatio: Number(agreementRatio.toFixed(2)),
    signals: timeWeighted.map((s) => ({
      source: s.source,
      direction: s.direction,
      weight: Number(s.finalWeight.toFixed(3)),
      confidence: s.confidence,
    })),
    timestamp: now,
    windowId,
  };
}

function generateReasoning(
  humanCount: number,
  agentCount: number,
  direction: string,
  confidence: number,
  agreement: number,
  agentSignals: AgentSignal[]
): string {
  const parts: string[] = [];

  if (humanCount > 0) parts.push(`${humanCount} human${humanCount > 1 ? "s" : ""}`);
  if (agentCount > 0) parts.push(`${agentCount} agent${agentCount > 1 ? "s" : ""}`);

  const sourceSummary = parts.join(" + ");
  const dirStr = direction === "neutral" ? "split" : `lean ${direction.toUpperCase()}`;
  const agreeStr = `${Math.round(agreement * 100)}% agreement`;

  const topAgent = agentSignals.sort((a, b) => b.confidence - a.confidence)[0];
  const topNote = topAgent
    ? ` | Strongest: ${topAgent.agentType} (${topAgent.confidence}%)`
    : "";

  return `${sourceSummary} ${dirStr} at ${confidence}% conf, ${agreeStr}${topNote}`;
}
