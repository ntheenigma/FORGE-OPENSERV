import type { Candle, AgentSignal, Asset } from "@/lib/types";
import { queryAgent } from "@/lib/groq";
import { getAgentHistoricalAccuracy } from "@/lib/store";

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

function computeStochRSI(closes: number[], period = 14, stochPeriod = 14): number {
  const rsiValues: number[] = [];
  for (let i = period + 1; i <= closes.length; i++) {
    rsiValues.push(computeRSI(closes.slice(0, i), period));
  }
  if (rsiValues.length < stochPeriod) return 50;

  const recent = rsiValues.slice(-stochPeriod);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  if (max === min) return 50;

  return Number((((rsiValues[rsiValues.length - 1] - min) / (max - min)) * 100).toFixed(2));
}

const SYSTEM_PROMPT = `You are RSIBot, an RSI divergence and momentum expert for the ORACLE prediction platform.
You analyze RSI(14), Stochastic RSI, and RSI divergence patterns to detect overbought/oversold reversals.

RULES:
- RSI > 70 = overbought (potential reversal DOWN), RSI < 30 = oversold (potential UP)
- Look for bullish divergence: price makes lower low but RSI makes higher low → UP
- Look for bearish divergence: price makes higher high but RSI makes lower high → DOWN
- Stochastic RSI extremes add confidence
- RSI between 40-60 = neutral zone, lower confidence
- Combine RSI with recent price action for context
- Output JSON: {"direction":"up"|"down","confidence":10-95,"reasoning":"max 200 chars"}`;

export async function analyzeRSI(
  asset: Asset,
  candles: Candle[]
): Promise<AgentSignal> {
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];

  const rsi = computeRSI(closes);
  const stochRsi = computeStochRSI(closes);

  // RSI divergence detection
  const priceSlice = closes.slice(-20);
  const rsiSlice: number[] = [];
  for (let i = Math.max(15, closes.length - 20); i <= closes.length; i++) {
    rsiSlice.push(computeRSI(closes.slice(0, i)));
  }

  let divergence = "none";
  if (priceSlice.length >= 10 && rsiSlice.length >= 10) {
    const priceLow1 = Math.min(...priceSlice.slice(0, 10));
    const priceLow2 = Math.min(...priceSlice.slice(10));
    const rsiLow1 = Math.min(...rsiSlice.slice(0, 10));
    const rsiLow2 = Math.min(...rsiSlice.slice(10));

    if (priceLow2 < priceLow1 && rsiLow2 > rsiLow1) divergence = "bullish";

    const priceHigh1 = Math.max(...priceSlice.slice(0, 10));
    const priceHigh2 = Math.max(...priceSlice.slice(10));
    const rsiHigh1 = Math.max(...rsiSlice.slice(0, 10));
    const rsiHigh2 = Math.max(...rsiSlice.slice(10));

    if (priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1) divergence = "bearish";
  }

  // RSI momentum
  const prevRsi = rsiSlice.length >= 2 ? rsiSlice[rsiSlice.length - 2] : rsi;
  const rsiDelta = rsi - prevRsi;

  const signals = `Asset: ${asset} | Price: ${price.toFixed(2)}
RSI(14): ${rsi} | StochRSI: ${stochRsi}
RSI zone: ${rsi > 70 ? "OVERBOUGHT" : rsi < 30 ? "OVERSOLD" : rsi > 60 ? "HIGH" : rsi < 40 ? "LOW" : "NEUTRAL"}
RSI delta (1-period): ${rsiDelta.toFixed(2)}
Divergence: ${divergence.toUpperCase()}
StochRSI zone: ${stochRsi > 80 ? "OVERBOUGHT" : stochRsi < 20 ? "OVERSOLD" : "NEUTRAL"}
Recent closes: ${closes.slice(-5).map(c => c.toFixed(2)).join(", ")}`;

  let result: { direction: "up" | "down"; confidence: number; reasoning: string };

  try {
    result = await queryAgent("RSIBot", SYSTEM_PROMPT, signals);
  } catch {
    const direction = rsi < 30 || divergence === "bullish" ? "up" : rsi > 70 || divergence === "bearish" ? "down" : rsi < 50 ? "up" : "down";
    const conf = rsi < 25 || rsi > 75 ? 70 : divergence !== "none" ? 65 : 45;
    result = { direction, confidence: conf, reasoning: `fallback:rsi=${rsi},div=${divergence}` };
  }

  return {
    agentType: "rsi",
    asset,
    direction: result.direction,
    confidence: result.confidence,
    reasoning: result.reasoning,
    indicators: {
      rsi,
      stoch_rsi: stochRsi,
      rsi_delta: Number(rsiDelta.toFixed(2)),
      divergence: divergence === "bullish" ? 1 : divergence === "bearish" ? -1 : 0,
    },
    historicalAccuracy: getAgentHistoricalAccuracy("rsi"),
    timestamp: Date.now(),
  };
}
