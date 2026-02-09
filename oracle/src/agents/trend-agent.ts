import type { Candle, AgentSignal, Asset } from "@/lib/types";
import { queryAgent } from "@/lib/groq";
import { getAgentHistoricalAccuracy } from "@/lib/store";

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

const SYSTEM_PROMPT = `You are TrendBot, an expert trend-following analyst for the ORACLE prediction platform.
You analyze EMA crossovers, trend strength (ADX concept), and price momentum to determine direction.

RULES:
- Focus on EMA(9), EMA(21), EMA(55) alignment and crossover signals
- Consider trend strength: all EMAs aligned = strong, mixed = weak
- Momentum: rate of change over 5 and 20 periods
- Higher confidence when trend is clear and sustained
- Lower confidence during chop/transition periods
- Output JSON: {"direction":"up"|"down","confidence":10-95,"reasoning":"max 200 chars"}`;

export async function analyzeTrend(
  asset: Asset,
  candles: Candle[]
): Promise<AgentSignal> {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];

  // Compute signals
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema55 = ema(closes, 55);

  const lastEma9 = ema9[ema9.length - 1];
  const lastEma21 = ema21[ema21.length - 1];
  const lastEma55 = ema55[ema55.length - 1];

  const roc5 = closes.length >= 6 ? (price - closes[closes.length - 6]) / closes[closes.length - 6] * 100 : 0;
  const roc20 = closes.length >= 21 ? (price - closes[closes.length - 21]) / closes[closes.length - 21] * 100 : 0;

  // Trend alignment
  const bullAlign = lastEma9 > lastEma21 && lastEma21 > lastEma55;
  const bearAlign = lastEma9 < lastEma21 && lastEma21 < lastEma55;

  // EMA slopes (rate of change of EMA)
  const ema9Slope = ema9.length >= 5 ? (ema9[ema9.length - 1] - ema9[ema9.length - 5]) / ema9[ema9.length - 5] * 100 : 0;
  const ema21Slope = ema21.length >= 5 ? (ema21[ema21.length - 1] - ema21[ema21.length - 5]) / ema21[ema21.length - 5] * 100 : 0;

  const signals = `Asset: ${asset} | Price: ${price.toFixed(2)}
EMA(9): ${lastEma9.toFixed(2)} | EMA(21): ${lastEma21.toFixed(2)} | EMA(55): ${lastEma55.toFixed(2)}
EMA alignment: ${bullAlign ? "BULLISH" : bearAlign ? "BEARISH" : "MIXED"}
EMA(9) slope: ${ema9Slope.toFixed(4)}% | EMA(21) slope: ${ema21Slope.toFixed(4)}%
ROC(5): ${roc5.toFixed(4)}% | ROC(20): ${roc20.toFixed(4)}%
Price vs EMA9: ${((price / lastEma9 - 1) * 100).toFixed(3)}%
Price vs EMA21: ${((price / lastEma21 - 1) * 100).toFixed(3)}%
Last 5 candles: ${candles.slice(-5).map(c => c.close > c.open ? "G" : "R").join("")}`;

  let result: { direction: "up" | "down"; confidence: number; reasoning: string };

  try {
    result = await queryAgent("TrendBot", SYSTEM_PROMPT, signals);
  } catch {
    // Fallback: pure math
    const direction = bullAlign ? "up" : bearAlign ? "down" : roc5 >= 0 ? "up" : "down";
    const conf = bullAlign || bearAlign ? 65 : 45;
    result = { direction, confidence: conf, reasoning: `fallback:${bullAlign ? "bull" : bearAlign ? "bear" : "mixed"}_align` };
  }

  return {
    agentType: "trend",
    asset,
    direction: result.direction,
    confidence: result.confidence,
    reasoning: result.reasoning,
    indicators: {
      ema9: Number(lastEma9.toFixed(2)),
      ema21: Number(lastEma21.toFixed(2)),
      ema55: Number(lastEma55.toFixed(2)),
      ema9_slope: Number(ema9Slope.toFixed(4)),
      roc5: Number(roc5.toFixed(4)),
      roc20: Number(roc20.toFixed(4)),
    },
    historicalAccuracy: getAgentHistoricalAccuracy("trend"),
    timestamp: Date.now(),
  };
}
