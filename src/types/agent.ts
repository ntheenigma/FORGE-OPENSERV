export type AgentCapability =
  | 'volatility_prediction'
  | 'liquidation_analysis'
  | 'sentiment_tracking'
  | 'pattern_matching'
  | 'correlation_analysis'
  | 'onchain_flow'
  | 'options_microstructure'
  | 'macro_regime'
  | 'alternative_data';

export interface AgentRegistration {
  agentId: string;
  name: string;
  endpointUrl: string;
  capabilities: AgentCapability[];
  architecture: string;
  walletAddress: string;
  stakeAmountUsd: number;
  stakedAt: string;
  status: AgentStatus;
  shadowValidationPassed: boolean;
}

export type AgentStatus =
  | 'pending_validation'
  | 'shadow_mode'
  | 'active'
  | 'deprecated'
  | 'slashed';

export interface AgentPrediction {
  agentId: string;
  capability: AgentCapability;
  timestamp: string;
  asset: string;
  horizonSeconds: number;
  prediction: AgentPredictionPayload;
}

export interface VolatilityPredictionPayload {
  type: 'volatility';
  forecastVolatility24h: number;
  termStructure: { '1d': number; '7d': number; '30d': number };
  percentiles: { '5': number; '50': number; '95': number };
  regimeState: 'low' | 'normal' | 'high' | 'crisis';
  modelUsed: string;
  paths: number[][];
  confidence: number;
}

export interface LiquidationPredictionPayload {
  type: 'liquidation';
  longCascadePrice: number;
  shortCascadePrice: number;
  cascadeRiskScore: number;
  liquidationHeatmap: { price: number; size: number; side: 'long' | 'short' }[];
  paths: number[][];
  confidence: number;
}

export interface SentimentPredictionPayload {
  type: 'sentiment';
  overallSentiment: number; // -1 to 1
  sentimentMomentum: number;
  divergenceFromPrice: number;
  narrativeShift: boolean;
  paths: number[][];
  confidence: number;
}

export interface PatternPredictionPayload {
  type: 'pattern';
  topAnalogs: { period: string; similarity: number; forwardReturn: number }[];
  compositeForwardPath: number[];
  paths: number[][];
  confidence: number;
}

export type AgentPredictionPayload =
  | VolatilityPredictionPayload
  | LiquidationPredictionPayload
  | SentimentPredictionPayload
  | PatternPredictionPayload;

export interface AgentScore {
  agentId: string;
  capability: AgentCapability;
  crps: number;
  normalizedScore: number;
  rollingEma10d: number;
  softmaxWeight: number;
  epoch: number;
  timestamp: string;
}

export interface LeaderboardEntry {
  rank: number;
  agentId: string;
  name: string;
  capability: AgentCapability;
  rollingEma10d: number;
  totalEarningsUsd: number;
  predictionsCount: number;
  activeSince: string;
}
