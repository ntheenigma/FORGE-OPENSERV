import { config } from '../config';
import {
  CRPSResult,
  ScoreTransformation,
  EMAUpdate,
  SoftmaxWeights,
} from '../types/scoring';

/**
 * Transform raw CRPS scores:
 * - Best agent normalized to 0
 * - Worst 10% capped at 90th percentile
 */
export function transformScores(results: CRPSResult[]): ScoreTransformation[] {
  if (results.length === 0) return [];

  const crpsValues = results.map((r) => r.crps);
  const minCrps = Math.min(...crpsValues);

  // Determine 90th percentile threshold for capping
  const sorted = crpsValues.slice().sort((a, b) => a - b);
  const p90Index = Math.floor(sorted.length * 0.9);
  const p90Threshold = sorted[Math.min(p90Index, sorted.length - 1)];

  return results.map((result) => {
    const shifted = result.crps - minCrps; // best = 0
    const cappedAtThreshold = shifted > (p90Threshold - minCrps);
    const normalizedScore = cappedAtThreshold ? (p90Threshold - minCrps) : shifted;

    return {
      agentId: result.agentId,
      rawCrps: result.crps,
      normalizedScore,
      cappedAtThreshold,
    };
  });
}

/**
 * Update Exponential Moving Average (10-day rolling window).
 */
export function updateEMA(previousEma: number, newScore: number): EMAUpdate {
  const alpha = config.scoring.emaAlpha;
  const updatedEma = alpha * newScore + (1 - alpha) * previousEma;

  return {
    agentId: '',
    previousEma,
    newScore,
    updatedEma,
    windowDays: config.scoring.rollingWindowDays,
  };
}

/**
 * Compute softmax weights from EMA scores.
 * Lower score = better, so we negate before softmax.
 * w_i = exp(-score_i / T) / sum(exp(-score_j / T))
 */
export function computeSoftmaxWeights(
  agentScores: { agentId: string; emaScore: number }[],
  epoch: number
): SoftmaxWeights {
  const T = config.scoring.softmaxTemperature;
  const weights: Record<string, number> = {};

  if (agentScores.length === 0) {
    return { epoch, timestamp: new Date().toISOString(), weights, temperature: T };
  }

  // Negate scores (lower CRPS = better = higher weight)
  const exps = agentScores.map((a) => ({
    agentId: a.agentId,
    exp: Math.exp(-a.emaScore / T),
  }));

  const sumExp = exps.reduce((s, e) => s + e.exp, 0);

  for (const entry of exps) {
    weights[entry.agentId] = sumExp > 0 ? entry.exp / sumExp : 1 / agentScores.length;
  }

  return {
    epoch,
    timestamp: new Date().toISOString(),
    weights,
    temperature: T,
  };
}

/**
 * Determine which agents to deprecate (bottom N%).
 */
export function identifyDeprecatedAgents(
  agentScores: { agentId: string; emaScore: number }[]
): string[] {
  if (agentScores.length < 5) return []; // don't deprecate in small pools

  const sorted = [...agentScores].sort((a, b) => a.emaScore - b.emaScore);
  const cutoff = Math.ceil(sorted.length * (config.scoring.bottomDeprecationPct / 100));
  // Bottom performers have the HIGHEST scores (worst CRPS)
  return sorted.slice(-cutoff).map((a) => a.agentId);
}

/**
 * Check architecture diversity constraint.
 * Returns true if adding another agent of this architecture would exceed 30% cap.
 */
export function checkArchitectureDiversity(
  existingArchitectures: string[],
  newArchitecture: string
): boolean {
  const total = existingArchitectures.length + 1;
  const countSame = existingArchitectures.filter((a) => a === newArchitecture).length + 1;
  return (countSame / total) * 100 > config.agentRegistry.maxSameArchitecturePct;
}
