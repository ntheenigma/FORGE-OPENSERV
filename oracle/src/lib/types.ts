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
  | "sentiment"
  | string; // external agents use custom types

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

// ── External Agent Registration ──

export type ExternalAgentStatus = "active" | "probation" | "inactive" | "banned";
export type AgentConnectionType = "mcp" | "http";

export interface RegisteredAgent {
  id: string;
  name: string;
  endpoint?: string; // Optional — only for HTTP-push agents
  description: string;
  ownerAddress?: string;
  type: "core" | "external";
  connectionType: AgentConnectionType; // "mcp" = agent pulls data, "http" = we push
  status: ExternalAgentStatus;
  assets: Asset[]; // which assets this agent predicts
  registeredAt: number;
  probationWindowsRemaining: number; // 96 = 24hrs of 15-min windows
  totalPredictions: number;
  correctPredictions: number;
  accuracyEma: number;
  consecutiveFailures: number;
  lastSeen: number | null;
  apiKey: string; // assigned on registration, agent sends in header
}

/**
 * External agents can connect two ways:
 *
 * 1. MCP (recommended) — Agent connects to POST /api/mcp with API key
 *    and calls tools: get_market_data, submit_prediction, get_my_stats
 *
 * 2. HTTP Push — Agent runs an endpoint, we POST market data to it
 *    (legacy, still supported but not recommended)
 */
export interface ExternalPredictionResponse {
  direction: Direction;
  confidence: number; // 1-95
  reasoning?: string;
  indicators?: Record<string, number>;
}

// ── Multi-Timeframe Scoring ──

export type ScoringHorizon = "1m" | "5m" | "15m";

export interface PendingResolution {
  predictionId: string;
  agentId: string; // "core:trend" or "ext:agent-id" or "human:userId"
  asset: Asset;
  direction: Direction;
  priceAtPrediction: number;
  timestamp: number;
  horizons: {
    horizon: ScoringHorizon;
    resolveAt: number; // unix ms
    resolved: boolean;
    correct?: boolean;
  }[];
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
