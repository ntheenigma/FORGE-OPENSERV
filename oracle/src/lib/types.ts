// ── Market Data ──

export type Asset = "BTC" | "GOLD";
export type Timeframe = "1m" | "3m" | "5m" | "10m" | "15m";
export type Direction = "up" | "down";

export interface Candle {
  time: number; // unix seconds
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

export interface MarketSnapshot {
  asset: Asset;
  price: number;
  change24h: number;
  candles: Candle[];
  orderbook: OrderBook;
  timestamp: number;
}

// ── Predictions ──

export interface Prediction {
  id: string;
  asset: Asset;
  userId: string;
  direction: Direction;
  confidence: number; // 0-100
  reasoning?: string;
  timestamp: number;
  source: "human" | "agent";
  agentType?: string;
  signature?: string;
  resolved?: boolean;
  correct?: boolean;
  actualChange?: number;
}

// ── Agent System ──

export type AgentType =
  | "trend"
  | "rsi"
  | "volume"
  | "macro"
  | "pattern"
  | "sentiment";

export interface AgentSignal {
  agentType: AgentType;
  asset: Asset;
  direction: Direction;
  confidence: number; // 0-100
  reasoning: string;
  indicators: Record<string, number>;
  historicalAccuracy: number;
  timestamp: number;
}

export interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  weight: number; // default weight in consensus
  enabled: boolean;
}

// ── Consensus ──

export interface ConsensusResult {
  asset: Asset;
  direction: Direction | "neutral";
  confidence: number;
  humanCount: number;
  agentCount: number;
  reasoning: string;
  upWeight: number;
  downWeight: number;
  agreementRatio: number;
  signals: {
    source: string;
    direction: Direction;
    weight: number;
    confidence: number;
  }[];
  timestamp: number;
  windowId: string;
}

// ── Users & Reputation ──

export interface UserStats {
  userId: string;
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  avgConfidence: number;
  reputation: number; // 0.5-2.0x multiplier
  rank: number;
  streak: number;
  bestStreak: number;
  joinedAt: number;
  lastActive: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  accuracy: number;
  totalPredictions: number;
  reputation: number;
  streak: number;
  recentForm: ("W" | "L" | "P")[]; // last 10
}

// ── Feed ──

export interface FeedItem {
  id: string;
  type: "prediction" | "consensus" | "agent_signal" | "resolution";
  asset: Asset;
  direction?: Direction;
  confidence?: number;
  userId?: string;
  agentType?: string;
  message: string;
  timestamp: number;
}

// ── Scoring ──

export interface ScoreResult {
  predictionId: string;
  correct: boolean;
  actualChange: number;
  scoreDelta: number;
  newEma: number;
}

// ── Pipeline ──

export interface PipelineResult {
  windowId: string;
  asset: Asset;
  agentSignals: AgentSignal[];
  humanPredictions: Prediction[];
  consensus: ConsensusResult;
  timestamp: number;
}

// ── EIP-712 ──

export interface PredictionPayload {
  asset: string;
  direction: boolean; // true=up
  confidence: number;
  timestamp: number;
  nonce: number;
  userAddress: string;
}
