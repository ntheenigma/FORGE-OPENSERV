import type {
  Asset,
  Prediction,
  AgentSignal,
  ConsensusResult,
  UserStats,
  FeedItem,
  Candle,
  LeaderboardEntry,
} from "./types";
import {
  EMA_ALPHA,
  REPUTATION_MIN,
  REPUTATION_MAX,
  REPUTATION_DEFAULT,
  MAX_FEED_SIZE,
} from "./constants";

// ── In-memory stores (persist to JSON on Railway) ──

let predictions: Prediction[] = [];
let feed: FeedItem[] = [];
let userStatsMap: Record<string, UserStats> = {};
let agentAccuracy: Record<string, number> = {
  trend: 0.5,
  rsi: 0.5,
  volume: 0.5,
  macro: 0.5,
  pattern: 0.5,
  sentiment: 0.5,
};
let latestConsensus: Record<string, ConsensusResult> = {};
let latestAgentSignals: Record<string, AgentSignal[]> = {};
let candleCache: Record<string, Candle[]> = {};
let latestPrices: Record<string, { price: number; change24h: number; timestamp: number }> = {};

// ── Predictions ──

export function addPrediction(p: Prediction): void {
  predictions.push(p);
  addFeedItem({
    id: `feed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "prediction",
    asset: p.asset,
    direction: p.direction,
    confidence: p.confidence,
    userId: p.source === "human" ? p.userId : undefined,
    agentType: p.agentType,
    message:
      p.source === "agent"
        ? `${p.agentType} predicts ${p.asset} ${p.direction.toUpperCase()} (${p.confidence}%)`
        : `User predicts ${p.asset} ${p.direction.toUpperCase()} (${p.confidence}%)`,
    timestamp: p.timestamp,
  });
}

export function getPredictions(asset?: Asset, limit = 50): Prediction[] {
  let filtered = asset ? predictions.filter((p) => p.asset === asset) : predictions;
  return filtered.slice(-limit);
}

export function getUnresolvedPredictions(asset: Asset, windowStart: number): Prediction[] {
  return predictions.filter(
    (p) => p.asset === asset && !p.resolved && p.timestamp >= windowStart
  );
}

export function resolvePrediction(id: string, correct: boolean, actualChange: number): void {
  const p = predictions.find((x) => x.id === id);
  if (!p) return;
  p.resolved = true;
  p.correct = correct;
  p.actualChange = actualChange;

  if (p.source === "human") {
    updateUserStats(p.userId, correct, p.confidence);
  }
  if (p.source === "agent" && p.agentType) {
    updateAgentAccuracy(p.agentType, correct);
  }
}

// ── User Stats ──

function ensureUser(userId: string): UserStats {
  if (!userStatsMap[userId]) {
    userStatsMap[userId] = {
      userId,
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0.5,
      avgConfidence: 50,
      reputation: REPUTATION_DEFAULT,
      rank: 0,
      streak: 0,
      bestStreak: 0,
      joinedAt: Date.now(),
      lastActive: Date.now(),
    };
  }
  return userStatsMap[userId];
}

function updateUserStats(userId: string, correct: boolean, confidence: number): void {
  const u = ensureUser(userId);
  u.totalPredictions++;
  if (correct) {
    u.correctPredictions++;
    u.streak++;
    if (u.streak > u.bestStreak) u.bestStreak = u.streak;
  } else {
    u.streak = 0;
  }
  u.accuracy = u.totalPredictions > 0 ? u.correctPredictions / u.totalPredictions : 0.5;
  u.avgConfidence =
    (u.avgConfidence * (u.totalPredictions - 1) + confidence) / u.totalPredictions;

  // Reputation = function of accuracy and volume
  const volBonus = Math.min(0.3, u.totalPredictions / 500);
  const accBonus = (u.accuracy - 0.5) * 2;
  u.reputation = Math.max(
    REPUTATION_MIN,
    Math.min(REPUTATION_MAX, REPUTATION_DEFAULT + accBonus + volBonus)
  );
  u.lastActive = Date.now();
}

export function getUserStats(userId: string): UserStats {
  return ensureUser(userId);
}

export function getLeaderboard(limit = 50): LeaderboardEntry[] {
  const users = Object.values(userStatsMap)
    .filter((u) => u.totalPredictions >= 5)
    .sort((a, b) => b.accuracy - a.accuracy || b.totalPredictions - a.totalPredictions);

  return users.slice(0, limit).map((u, i) => {
    const recent = predictions
      .filter((p) => p.userId === u.userId && p.resolved)
      .slice(-10)
      .map((p) => (p.correct ? "W" : "L") as "W" | "L" | "P");

    return {
      rank: i + 1,
      userId: u.userId,
      displayName: u.userId.slice(0, 8) + "...",
      accuracy: Number((u.accuracy * 100).toFixed(1)),
      totalPredictions: u.totalPredictions,
      reputation: Number(u.reputation.toFixed(2)),
      streak: u.streak,
      recentForm: recent,
    };
  });
}

// ── Agent Accuracy ──

function updateAgentAccuracy(agentType: string, correct: boolean): void {
  const old = agentAccuracy[agentType] ?? 0.5;
  agentAccuracy[agentType] = Number(
    (EMA_ALPHA * (correct ? 1.0 : 0.0) + (1 - EMA_ALPHA) * old).toFixed(4)
  );
}

export function getAgentAccuracy(): Record<string, number> {
  return { ...agentAccuracy };
}

export function getAgentHistoricalAccuracy(agentType: string): number {
  return agentAccuracy[agentType] ?? 0.5;
}

// ── Consensus ──

export function setConsensus(asset: string, consensus: ConsensusResult): void {
  latestConsensus[asset] = consensus;
  addFeedItem({
    id: `feed-consensus-${Date.now()}`,
    type: "consensus",
    asset: consensus.asset,
    direction: consensus.direction === "neutral" ? undefined : consensus.direction,
    confidence: consensus.confidence,
    message: `Consensus: ${consensus.asset} ${consensus.direction.toUpperCase()} (${consensus.confidence}%) | ${consensus.humanCount}H + ${consensus.agentCount}A`,
    timestamp: consensus.timestamp,
  });
}

export function getConsensus(asset: string): ConsensusResult | null {
  return latestConsensus[asset] ?? null;
}

// ── Agent Signals ──

export function setAgentSignals(asset: string, signals: AgentSignal[]): void {
  latestAgentSignals[asset] = signals;
}

export function getAgentSignals(asset: string): AgentSignal[] {
  return latestAgentSignals[asset] ?? [];
}

// ── Feed ──

function addFeedItem(item: FeedItem): void {
  feed.push(item);
  if (feed.length > MAX_FEED_SIZE) {
    feed = feed.slice(-MAX_FEED_SIZE);
  }
}

export function getFeed(limit = 20): FeedItem[] {
  return feed.slice(-limit).reverse();
}

// ── Candle Cache ──

export function setCandleCache(key: string, candles: Candle[]): void {
  candleCache[key] = candles;
}

export function getCandleCache(key: string): Candle[] | null {
  return candleCache[key] ?? null;
}

// ── Price Cache ──

export function setLatestPrice(
  asset: string,
  price: number,
  change24h: number
): void {
  latestPrices[asset] = { price, change24h, timestamp: Date.now() };
}

export function getLatestPrice(
  asset: string
): { price: number; change24h: number; timestamp: number } | null {
  return latestPrices[asset] ?? null;
}

// ── Reputation helper for consensus ──

export function getUserReputation(userId: string): number {
  return userStatsMap[userId]?.reputation ?? REPUTATION_DEFAULT;
}
