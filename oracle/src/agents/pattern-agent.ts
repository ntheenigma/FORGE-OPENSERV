import type { Candle, AgentSignal, Asset } from "@/lib/types";
import { queryAgent } from "@/lib/groq";
import { getAgentHistoricalAccuracy } from "@/lib/store";

interface PatternResult {
  name: string;
  type: "bullish" | "bearish" | "neutral";
  strength: number; // 0-1
}

function detectPatterns(candles: Candle[]): PatternResult[] {
  if (candles.length < 5) return [];
  const patterns: PatternResult[] = [];

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  const lastBody = last.close - last.open;
  const prevBody = prev.close - prev.open;
  const lastRange = last.high - last.low;
  const bodySize = Math.abs(lastBody);
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);

  // Bullish engulfing
  if (lastBody > 0 && prevBody < 0 && last.close > prev.open && last.open < prev.close) {
    patterns.push({ name: "bullish_engulfing", type: "bullish", strength: 0.8 });
  }

  // Bearish engulfing
  if (lastBody < 0 && prevBody > 0 && last.close < prev.open && last.open > prev.close) {
    patterns.push({ name: "bearish_engulfing", type: "bearish", strength: 0.8 });
  }

  // Hammer
  if (lowerWick > 2 * bodySize && upperWick < bodySize * 0.5 && lastRange > 0) {
    patterns.push({ name: "hammer", type: "bullish", strength: 0.7 });
  }

  // Shooting star
  if (upperWick > 2 * bodySize && lowerWick < bodySize * 0.5 && lastRange > 0) {
    patterns.push({ name: "shooting_star", type: "bearish", strength: 0.7 });
  }

  // Doji
  if (bodySize < lastRange * 0.1 && lastRange > 0) {
    patterns.push({ name: "doji", type: "neutral", strength: 0.3 });
  }

  // Three white soldiers
  if (lastBody > 0 && prevBody > 0 && (prev2.close - prev2.open) > 0) {
    const avgBody = (lastBody + prevBody + (prev2.close - prev2.open)) / 3;
    if (avgBody > 0) patterns.push({ name: "three_white_soldiers", type: "bullish", strength: 0.85 });
  }

  // Three black crows
  if (lastBody < 0 && prevBody < 0 && (prev2.close - prev2.open) < 0) {
    patterns.push({ name: "three_black_crows", type: "bearish", strength: 0.85 });
  }

  // Morning star (3-candle reversal)
  if (prev2.close < prev2.open && Math.abs(prevBody) < lastRange * 0.3 && lastBody > 0 && last.close > (prev2.open + prev2.close) / 2) {
    patterns.push({ name: "morning_star", type: "bullish", strength: 0.75 });
  }

  // Evening star
  if (prev2.close > prev2.open && Math.abs(prevBody) < lastRange * 0.3 && lastBody < 0 && last.close < (prev2.open + prev2.close) / 2) {
    patterns.push({ name: "evening_star", type: "bearish", strength: 0.75 });
  }

  // Volume confirmation on patterns
  const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  const volRatio = avgVol > 0 ? last.volume / avgVol : 1;
  if (volRatio > 1.5) {
    patterns.forEach((p) => { p.strength = Math.min(1, p.strength + 0.1); });
  }

  return patterns;
}

const SYSTEM_PROMPT = `You are PatternBot, a candlestick and chart pattern expert for the ORACLE prediction platform.
You analyze candlestick patterns, support/resistance, and price structure to predict direction.

RULES:
- Evaluate detected patterns by their reliability and context
- Bullish patterns after downtrend = stronger signal
- Bearish patterns after uptrend = stronger signal
- Patterns at key levels (support/resistance) = more significant
- Volume confirmation increases pattern reliability
- Multiple confirming patterns = higher confidence
- Conflicting patterns = lower confidence
- No patterns = very low confidence
- Output JSON: {"direction":"up"|"down","confidence":10-95,"reasoning":"max 200 chars"}`;

export async function analyzePatterns(
  asset: Asset,
  candles: Candle[]
): Promise<AgentSignal> {
  const price = candles[candles.length - 1]?.close ?? 0;
  const patterns = detectPatterns(candles);

  // Support/resistance from recent highs/lows
  const recent50 = candles.slice(-50);
  const highs = recent50.map((c) => c.high);
  const lows = recent50.map((c) => c.low);
  const resistance = Math.max(...highs);
  const support = Math.min(...lows);
  const range = resistance - support;
  const pricePosition = range > 0 ? (price - support) / range : 0.5;

  // Recent trend context
  const last20 = candles.slice(-20);
  const upCandles = last20.filter((c) => c.close > c.open).length;
  const trendBias = upCandles > 12 ? "UPTREND" : upCandles < 8 ? "DOWNTREND" : "NEUTRAL";

  // Volume
  const avgVol = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / 20;
  const lastVol = candles[candles.length - 1]?.volume ?? 0;
  const volRatio = avgVol > 0 ? lastVol / avgVol : 1;

  const patternSummary = patterns.length > 0
    ? patterns.map((p) => `${p.name}(${p.type},str=${p.strength.toFixed(2)})`).join(", ")
    : "NO_PATTERNS_DETECTED";

  const signals = `Asset: ${asset} | Price: ${price.toFixed(2)}
Detected patterns: ${patternSummary}
Trend context (20 bars): ${trendBias} (${upCandles}/20 green)
Support: ${support.toFixed(2)} | Resistance: ${resistance.toFixed(2)}
Price position in range: ${(pricePosition * 100).toFixed(1)}%
Volume ratio: ${volRatio.toFixed(2)}x average
Last 5 OHLC: ${candles.slice(-5).map(c => `[O:${c.open.toFixed(0)} H:${c.high.toFixed(0)} L:${c.low.toFixed(0)} C:${c.close.toFixed(0)}]`).join(" ")}`;

  let result: { direction: "up" | "down"; confidence: number; reasoning: string };

  try {
    result = await queryAgent("PatternBot", SYSTEM_PROMPT, signals);
  } catch {
    const bullish = patterns.filter((p) => p.type === "bullish").reduce((s, p) => s + p.strength, 0);
    const bearish = patterns.filter((p) => p.type === "bearish").reduce((s, p) => s + p.strength, 0);
    const direction = bullish > bearish ? "up" : bearish > bullish ? "down" : "up";
    const conf = patterns.length > 0 ? Math.min(70, 40 + Math.abs(bullish - bearish) * 30) : 40;
    result = { direction, confidence: conf, reasoning: `fallback:${patterns.map(p => p.name).join("+")}` };
  }

  return {
    agentType: "pattern",
    asset,
    direction: result.direction,
    confidence: result.confidence,
    reasoning: result.reasoning,
    indicators: {
      patterns_found: patterns.length,
      bullish_strength: patterns.filter((p) => p.type === "bullish").reduce((s, p) => s + p.strength, 0),
      bearish_strength: patterns.filter((p) => p.type === "bearish").reduce((s, p) => s + p.strength, 0),
      support,
      resistance,
      price_position: Number(pricePosition.toFixed(3)),
      vol_ratio: Number(volRatio.toFixed(2)),
    },
    historicalAccuracy: getAgentHistoricalAccuracy("pattern"),
    timestamp: Date.now(),
  };
}
