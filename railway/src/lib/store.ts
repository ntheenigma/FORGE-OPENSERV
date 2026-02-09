import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readJSON<T>(filePath: string, fallback: T): T {
  const full = path.join(DATA_DIR, filePath);
  try {
    if (!existsSync(full)) return fallback;
    return JSON.parse(readFileSync(full, "utf-8"));
  } catch {
    return fallback;
  }
}

export function writeJSON(filePath: string, data: unknown): void {
  const full = path.join(DATA_DIR, filePath);
  ensureDir(path.dirname(full));
  writeFileSync(full, JSON.stringify(data, null, 2));
}

export function appendLog(date: string, entry: unknown): void {
  const filePath = `logs/${date}.json`;
  const existing = readJSON<unknown[]>(filePath, []);
  existing.push(entry);
  writeJSON(filePath, existing);
}

export function getAccuracyScores(): Record<string, number> {
  return readJSON("scores/accuracy.json", {
    candle_microstructure: 0.5,
    order_flow: 0.5,
    momentum_trend: 0.5,
    mean_reversion: 0.5,
  });
}

export function setAccuracyScores(scores: Record<string, number>): void {
  writeJSON("scores/accuracy.json", scores);
}

export function getLatestConsensus() {
  return readJSON<{ consensus: unknown; timestamp: string } | null>(
    "latest.json",
    null
  );
}

export function setLatestConsensus(data: unknown): void {
  writeJSON("latest.json", data);
}

// ── Agent Pool ──

import type { RegisteredAgent, RewardDistribution, LeaderboardEntry } from "./types";

const CORE_AGENTS: RegisteredAgent[] = [
  { agent_id: "core-candle", name: "CandleAnalyst", specialization: "candle_microstructure", endpoint: "", description: "Candlestick pattern recognition", type: "core", status: "active", registered_at: "2025-01-01T00:00:00Z", probation_windows_remaining: 0, total_predictions: 0, correct_predictions: 0, last_seen: null, consecutive_failures: 0 },
  { agent_id: "core-flow", name: "FlowAnalyst", specialization: "order_flow", endpoint: "", description: "Order book imbalance analysis", type: "core", status: "active", registered_at: "2025-01-01T00:00:00Z", probation_windows_remaining: 0, total_predictions: 0, correct_predictions: 0, last_seen: null, consecutive_failures: 0 },
  { agent_id: "core-momentum", name: "MomentumAnalyst", specialization: "momentum_trend", endpoint: "", description: "Moving average crossover trends", type: "core", status: "active", registered_at: "2025-01-01T00:00:00Z", probation_windows_remaining: 0, total_predictions: 0, correct_predictions: 0, last_seen: null, consecutive_failures: 0 },
  { agent_id: "core-reversion", name: "ReversionAnalyst", specialization: "mean_reversion", endpoint: "", description: "Bollinger Band mean reversion", type: "core", status: "active", registered_at: "2025-01-01T00:00:00Z", probation_windows_remaining: 0, total_predictions: 0, correct_predictions: 0, last_seen: null, consecutive_failures: 0 },
];

export function getAgentPool(): RegisteredAgent[] {
  const pool = readJSON<RegisteredAgent[]>("config/agent_pool.json", []);
  if (pool.length === 0) {
    // Seed with core agents
    writeJSON("config/agent_pool.json", CORE_AGENTS);
    return CORE_AGENTS;
  }
  return pool;
}

export function setAgentPool(pool: RegisteredAgent[]): void {
  writeJSON("config/agent_pool.json", pool);
}

export function getExternalAgents(): RegisteredAgent[] {
  return getAgentPool().filter(
    (a) => a.type === "external" && (a.status === "active" || a.status === "probation")
  );
}

export function getActiveAgents(): RegisteredAgent[] {
  return getAgentPool().filter(
    (a) => a.status === "active" || a.status === "probation"
  );
}

export function registerAgent(agent: Omit<RegisteredAgent, "agent_id" | "registered_at" | "probation_windows_remaining" | "total_predictions" | "correct_predictions" | "last_seen" | "consecutive_failures" | "type" | "status">): RegisteredAgent | { error: string } {
  const pool = getAgentPool();

  // Validation
  const RESERVED = ["candle_microstructure", "order_flow", "momentum_trend", "mean_reversion"];
  if (RESERVED.includes(agent.specialization)) {
    return { error: `Specialization "${agent.specialization}" is reserved by core agents` };
  }
  if (pool.some((a) => a.specialization === agent.specialization && a.status !== "inactive" && a.status !== "banned")) {
    return { error: `Specialization "${agent.specialization}" already registered by another active agent` };
  }
  if (pool.filter((a) => a.type === "external" && a.status !== "inactive" && a.status !== "banned").length >= 20) {
    return { error: "Maximum 20 external agents reached. Wait for a slot." };
  }
  if (!agent.endpoint.startsWith("http")) {
    return { error: "Endpoint must be a valid HTTP(S) URL" };
  }
  if (!agent.name || agent.name.length < 3 || agent.name.length > 30) {
    return { error: "Name must be 3-30 characters" };
  }

  const newAgent: RegisteredAgent = {
    agent_id: `ext-${agent.specialization}-${Date.now().toString(36)}`,
    name: agent.name,
    specialization: agent.specialization,
    endpoint: agent.endpoint,
    description: agent.description,
    owner_address: agent.owner_address,
    type: "external",
    status: "probation",
    registered_at: new Date().toISOString(),
    probation_windows_remaining: 96, // 24 hours
    total_predictions: 0,
    correct_predictions: 0,
    last_seen: null,
    consecutive_failures: 0,
  };

  // Initialize accuracy score
  const scores = getAccuracyScores();
  scores[agent.specialization] = 0.5;
  setAccuracyScores(scores);

  // Initialize diversity score
  const diversity = getDiversityScores();
  diversity[agent.specialization] = { contrarian_correct: 0, total_windows: 0, score: 0 };
  setDiversityScores(diversity);

  pool.push(newAgent);
  setAgentPool(pool);
  return newAgent;
}

export function updateAgentStats(specialization: string, correct: boolean): void {
  const pool = getAgentPool();
  const agent = pool.find((a) => a.specialization === specialization);
  if (!agent) return;

  agent.total_predictions++;
  if (correct) agent.correct_predictions++;
  agent.last_seen = new Date().toISOString();

  // Probation countdown
  if (agent.status === "probation") {
    agent.probation_windows_remaining--;
    if (agent.probation_windows_remaining <= 0) {
      const scores = getAccuracyScores();
      const ema = scores[specialization] ?? 0.5;
      agent.status = ema > 0.52 ? "active" : "inactive";
      console.log(`[FORGE] Agent ${agent.name} ${agent.status === "active" ? "PROMOTED" : "DEMOTED"} (EMA: ${ema.toFixed(3)})`);
    }
  }

  // Auto-ban after 10 consecutive failures (endpoint down)
  if (agent.consecutive_failures >= 10 && agent.type === "external") {
    agent.status = "banned";
    console.log(`[FORGE] Agent ${agent.name} BANNED (10 consecutive failures)`);
  }

  setAgentPool(pool);
}

export function markAgentFailure(specialization: string): void {
  const pool = getAgentPool();
  const agent = pool.find((a) => a.specialization === specialization);
  if (!agent) return;
  agent.consecutive_failures++;
  setAgentPool(pool);
}

export function clearAgentFailures(specialization: string): void {
  const pool = getAgentPool();
  const agent = pool.find((a) => a.specialization === specialization);
  if (!agent) return;
  agent.consecutive_failures = 0;
  setAgentPool(pool);
}

// ── Diversity Scores ──

export function getDiversityScores(): Record<string, { contrarian_correct: number; total_windows: number; score: number }> {
  return readJSON("scores/diversity.json", {});
}

export function setDiversityScores(scores: Record<string, { contrarian_correct: number; total_windows: number; score: number }>): void {
  writeJSON("scores/diversity.json", scores);
}

// ── Rewards ──

export function getRewardHistory(): RewardDistribution[] {
  return readJSON("rewards/history.json", []);
}

export function appendReward(dist: RewardDistribution): void {
  const history = getRewardHistory();
  history.push(dist);
  writeJSON("rewards/history.json", history);
}

export function getAgentTotalRewards(): Record<string, number> {
  return readJSON("rewards/totals.json", {});
}

export function setAgentTotalRewards(totals: Record<string, number>): void {
  writeJSON("rewards/totals.json", totals);
}

// ── Leaderboard ──

export function buildLeaderboard(): LeaderboardEntry[] {
  const pool = getAgentPool();
  const scores = getAccuracyScores();
  const diversity = getDiversityScores();
  const rewards = getAgentTotalRewards();

  const entries = pool
    .filter((a) => a.status !== "banned")
    .map((a) => ({
      rank: 0,
      agent_id: a.agent_id,
      name: a.name,
      specialization: a.specialization,
      type: a.type,
      status: a.status,
      accuracy_ema: scores[a.specialization] ?? 0.5,
      total_predictions: a.total_predictions,
      correct_predictions: a.correct_predictions,
      accuracy_pct: a.total_predictions > 0 ? (a.correct_predictions / a.total_predictions) * 100 : 0,
      diversity_score: diversity[a.specialization]?.score ?? 0,
      total_rewards: rewards[a.specialization] ?? 0,
      streak: 0,
    }))
    .sort((a, b) => b.accuracy_ema - a.accuracy_ema);

  entries.forEach((e, i) => (e.rank = i + 1));
  return entries;
}

// Initialize data dir on import
ensureDir(path.join(DATA_DIR, "logs"));
ensureDir(path.join(DATA_DIR, "scores"));
ensureDir(path.join(DATA_DIR, "config"));
ensureDir(path.join(DATA_DIR, "rewards"));
