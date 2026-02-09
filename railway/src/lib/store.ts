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

// Initialize data dir on import
ensureDir(path.join(DATA_DIR, "logs"));
ensureDir(path.join(DATA_DIR, "scores"));
ensureDir(path.join(DATA_DIR, "config"));
