export interface CRPSResult {
  agentId: string;
  crps: number;
  asset: string;
  horizonSeconds: number;
  predictionTimestamp: string;
  validationTimestamp: string;
  realizedPrice: number;
}

export interface ScoreTransformation {
  agentId: string;
  rawCrps: number;
  normalizedScore: number; // best = 0, worst capped at 90th pctile
  cappedAtThreshold: boolean;
}

export interface EMAUpdate {
  agentId: string;
  previousEma: number;
  newScore: number;
  updatedEma: number;
  windowDays: number;
}

export interface SoftmaxWeights {
  epoch: number;
  timestamp: string;
  weights: Record<string, number>; // agentId -> weight
  temperature: number;
}

export interface RewardDistribution {
  epoch: number;
  timestamp: string;
  totalPoolUsd: number;
  distributions: RewardEntry[];
}

export interface RewardEntry {
  agentId: string;
  walletAddress: string;
  softmaxWeight: number;
  rewardUsd: number;
  txHash?: string;
}

export interface ValidationResult {
  predictionTimestamp: string;
  validationTimestamp: string;
  asset: string;
  realizedPrice: number;
  agentScores: CRPSResult[];
  transformedScores: ScoreTransformation[];
  emaUpdates: EMAUpdate[];
}
