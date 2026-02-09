export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBook {
  bids: [number, number][];
  asks: [number, number][];
}

export interface MarketData {
  candles: Candle[];
  price: number;
  confidence: number;
  orderbook: OrderBook;
  timestamp: string;
  sources: { binance: boolean; pyth: boolean; coinbase: boolean };
}

export interface Prediction {
  prediction: "UP" | "DOWN";
  confidence: number;
  reasoning: string;
  specialization: string;
  timestamp: string;
  indicators?: Record<string, number>;
}

export interface WeightedPrediction extends Prediction {
  accuracy_weight: number;
  weighted_confidence: number;
  normalized_weight: number;
}

export interface Consensus {
  prediction: "UP" | "DOWN";
  confidence: number;
  action: "no_trade" | "small" | "medium" | "large" | "full";
  position_size_pct: number;
  regime: "trending" | "ranging" | "uncertain";
  reasoning: string;
  vote_breakdown: {
    up_weight: number;
    down_weight: number;
    agreement_ratio: number;
    unique_specializations: number;
  };
  agent_contributions: { specialization: string; vote: string; weight: number }[];
  timestamp: string;
  window_id: string;
  asset: string;
  horizon_minutes: number;
}

export interface ScoreResult {
  specialization: string;
  predicted: string;
  correct: boolean;
  confidence: number;
  score_delta: number;
  new_ema: number;
}

export interface PipelineResult {
  window_id: string;
  market_data: MarketData;
  predictions: Prediction[];
  consensus: Consensus;
  timestamp: string;
}
