import type {
  Asset,
  Prediction,
  AgentSignal,
  ConsensusResult,
  UserStats,
  FeedItem,
  Candle,
  LeaderboardEntry,
  RegisteredAgent,
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

// ── External Agent Pool ──

const MAX_EXTERNAL_AGENTS = 50;
const PROBATION_WINDOWS = 96; // 24hrs at 15-min intervals
const BAN_AFTER_FAILURES = 10;

let agentPool: RegisteredAgent[] = [];

function generateApiKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "orc_";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

export function registerAgent(opts: {
  name: string;
  endpoint: string;
  description: string;
  assets: Asset[];
  ownerAddress?: string;
}): { agent: RegisteredAgent; error?: never } | { agent?: never; error: string } {
  // Validate
  if (!opts.name || opts.name.length < 2 || opts.name.length > 40) {
    return { error: "Name must be 2-40 characters" };
  }
  if (!opts.endpoint || !opts.endpoint.startsWith("http")) {
    return { error: "Endpoint must be a valid HTTP(S) URL" };
  }
  if (!opts.assets || opts.assets.length === 0) {
    return { error: "Must specify at least one asset (BTC, GOLD)" };
  }
  if (agentPool.filter((a) => a.type === "external").length >= MAX_EXTERNAL_AGENTS) {
    return { error: `Max ${MAX_EXTERNAL_AGENTS} external agents reached` };
  }
  // Check duplicate endpoint
  if (agentPool.some((a) => a.endpoint === opts.endpoint && a.status !== "banned")) {
    return { error: "An agent with this endpoint is already registered" };
  }

  const agent: RegisteredAgent = {
    id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: opts.name,
    endpoint: opts.endpoint,
    description: opts.description.slice(0, 200),
    ownerAddress: opts.ownerAddress,
    type: "external",
    status: "probation",
    assets: opts.assets,
    registeredAt: Date.now(),
    probationWindowsRemaining: PROBATION_WINDOWS,
    totalPredictions: 0,
    correctPredictions: 0,
    accuracyEma: 0.5,
    consecutiveFailures: 0,
    lastSeen: null,
    apiKey: generateApiKey(),
  };

  agentPool.push(agent);

  // Initialize accuracy EMA
  agentAccuracy[`ext:${agent.id}`] = 0.5;

  addFeedItem({
    id: `feed-${Date.now()}-reg`,
    type: "agent_signal",
    asset: opts.assets[0],
    message: `New agent registered: ${agent.name} (${opts.assets.join(", ")}) — on probation for 24h`,
    timestamp: Date.now(),
  });

  return { agent };
}

export function getAgentPool(): RegisteredAgent[] {
  return [...agentPool];
}

export function getActiveExternalAgents(asset: Asset): RegisteredAgent[] {
  return agentPool.filter(
    (a) =>
      a.type === "external" &&
      (a.status === "active" || a.status === "probation") &&
      a.assets.includes(asset)
  );
}

export function getAgentById(id: string): RegisteredAgent | null {
  return agentPool.find((a) => a.id === id) ?? null;
}

export function validateAgentApiKey(id: string, apiKey: string): boolean {
  const agent = agentPool.find((a) => a.id === id);
  return agent ? agent.apiKey === apiKey : false;
}

export function updateExternalAgentStats(
  agentId: string,
  correct: boolean
): void {
  const agent = agentPool.find((a) => a.id === agentId);
  if (!agent) return;

  agent.totalPredictions++;
  if (correct) {
    agent.correctPredictions++;
    agent.consecutiveFailures = 0;
  }
  agent.lastSeen = Date.now();

  // EMA update
  const key = `ext:${agentId}`;
  const old = agentAccuracy[key] ?? 0.5;
  const newEma = EMA_ALPHA * (correct ? 1.0 : 0.0) + (1 - EMA_ALPHA) * old;
  agentAccuracy[key] = Number(newEma.toFixed(4));
  agent.accuracyEma = agentAccuracy[key];

  // Probation management
  if (agent.status === "probation") {
    agent.probationWindowsRemaining--;
    if (agent.probationWindowsRemaining <= 0) {
      // Promote if EMA > 0.52, demote otherwise
      agent.status = agent.accuracyEma > 0.52 ? "active" : "inactive";
      console.log(
        `[ORACLE] Agent ${agent.name} ${agent.status === "active" ? "PROMOTED" : "DEMOTED"} (EMA: ${agent.accuracyEma})`
      );
    }
  }
}

export function markExternalAgentFailure(agentId: string): void {
  const agent = agentPool.find((a) => a.id === agentId);
  if (!agent) return;

  agent.consecutiveFailures++;
  if (agent.consecutiveFailures >= BAN_AFTER_FAILURES) {
    agent.status = "banned";
    console.log(`[ORACLE] Agent ${agent.name} BANNED after ${BAN_AFTER_FAILURES} consecutive failures`);
  }
}

export function getAgentLeaderboard(): {
  id: string;
  name: string;
  type: "core" | "external";
  status: string;
  accuracy: number;
  totalPredictions: number;
  correctPredictions: number;
  assets: string[];
}[] {
  // Core agents
  const coreEntries = ["trend", "rsi", "volume", "macro", "pattern", "sentiment"].map((t) => ({
    id: `core:${t}`,
    name: `${t.charAt(0).toUpperCase() + t.slice(1)}Bot`,
    type: "core" as const,
    status: "active",
    accuracy: agentAccuracy[t] ?? 0.5,
    totalPredictions: predictions.filter((p) => p.agentType === t).length,
    correctPredictions: predictions.filter((p) => p.agentType === t && p.correct).length,
    assets: ["BTC", "GOLD"],
  }));

  // External agents
  const extEntries = agentPool
    .filter((a) => a.type === "external")
    .map((a) => ({
      id: a.id,
      name: a.name,
      type: "external" as const,
      status: a.status,
      accuracy: a.accuracyEma,
      totalPredictions: a.totalPredictions,
      correctPredictions: a.correctPredictions,
      assets: a.assets,
    }));

  return [...coreEntries, ...extEntries].sort((a, b) => b.accuracy - a.accuracy);
}
