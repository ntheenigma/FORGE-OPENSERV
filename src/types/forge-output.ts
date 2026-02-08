import { SupportedAsset } from './market-data';

export interface ForgeMetadata {
  forge_version: string;
  timestamp: string;
  asset: SupportedAsset;
  current_price: number;
  generation_method: 'multi_agent_synthesis';
  accuracy_epoch: number;
}

export interface ForgeSimulations {
  count: number;
  time_increment_seconds: number;
  horizon_seconds: number;
  paths: number[][];
}

export interface ForgeVolatilityAnalysis {
  forecast_volatility_24h: number;
  term_structure: {
    '1d': number;
    '7d': number;
    '30d': number;
  };
  percentiles: {
    '5': number;
    '50': number;
    '95': number;
  };
  contributing_agents: string[];
  agent_confidence: number;
}

export interface ForgeLiquidationLevels {
  long_liquidation_cascade: number;
  short_liquidation_cascade: number;
  contributing_agent: string;
}

export interface ForgeAgentWeights {
  [agentId: string]: number;
}

export interface ForgeRiskMetrics {
  var_95: number;
  var_99: number;
  expected_shortfall_95: number;
}

export interface ForgeOutput {
  metadata: ForgeMetadata;
  simulations: ForgeSimulations;
  volatility_analysis: ForgeVolatilityAnalysis;
  liquidation_levels: ForgeLiquidationLevels;
  agent_weights: ForgeAgentWeights;
  risk_metrics: ForgeRiskMetrics;
}
