import type { Candle, OrderBook, AgentSignal, Asset } from "@/lib/types";
import { queryAgent } from "@/lib/groq";
import { getAgentHistoricalAccuracy } from "@/lib/store";

function computeVWAP(candles: Candle[]): number {
  let cumTP = 0;
  let cumVol = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTP += tp * c.volume;
    cumVol += c.volume;
  }
  return cumVol > 0 ? cumTP / cumVol : 0;
}

function volumeProfile(candles: Candle[]): { avgVol: number; volRatio: number; volTrend: string } {
  if (candles.length < 5) return { avgVol: 0, volRatio: 1, volTrend: "flat" };
  const vols = candles.map((c) => c.volume);
  const avgVol = vols.reduce((s, v) => s + v, 0) / vols.length;
  const lastVol = vols[vols.length - 1];
  const volRatio = avgVol > 0 ? lastVol / avgVol : 1;

  const recentAvg = vols.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const olderAvg = vols.slice(-20, -5).reduce((s, v) => s + v, 0) / Math.max(1, vols.slice(-20, -5).length);
  const volTrend = recentAvg > olderAvg * 1.2 ? "increasing" : recentAvg < olderAvg * 0.8 ? "decreasing" : "flat";

  return { avgVol: Number(avgVol.toFixed(2)), volRatio: Number(volRatio.toFixed(2)), volTrend };
}

const SYSTEM_PROMPT = `You are VolumeBot, a volume profile and order flow expert for the ORACLE prediction platform.
You analyze VWAP, volume profile, order book imbalances, and money flow to predict direction.

RULES:
- Price above VWAP with rising volume = bullish
- Price below VWAP with rising volume = bearish
- Volume spike (>1.5x avg) confirms direction of the move
- Order book imbalance: bid > ask = buying pressure (UP), ask > bid = selling pressure (DOWN)
- Thin order book (low depth) = lower confidence
- Volume divergence (price up but volume declining) = potential reversal
- Output JSON: {"direction":"up"|"down","confidence":10-95,"reasoning":"max 200 chars"}`;

export async function analyzeVolume(
  asset: Asset,
  candles: Candle[],
  orderbook: OrderBook
): Promise<AgentSignal> {
  const price = candles[candles.length - 1]?.close ?? 0;

  // VWAP
  const vwap = computeVWAP(candles.slice(-60));
  const priceVsVwap = vwap > 0 ? ((price / vwap - 1) * 100) : 0;

  // Volume profile
  const { avgVol, volRatio, volTrend } = volumeProfile(candles);

  // Volume-price correlation
  const last10 = candles.slice(-10);
  const upCandles = last10.filter((c) => c.close > c.open);
  const downCandles = last10.filter((c) => c.close <= c.open);
  const upVol = upCandles.reduce((s, c) => s + c.volume, 0);
  const downVol = downCandles.reduce((s, c) => s + c.volume, 0);
  const moneyFlowRatio = downVol > 0 ? upVol / downVol : upVol > 0 ? 2 : 1;

  // Order book
  let bidDepth = 0;
  let askDepth = 0;
  let imbalance = 1;
  let spreadBps = 0;

  if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
    bidDepth = orderbook.bids.reduce((s, b) => s + b[1], 0);
    askDepth = orderbook.asks.reduce((s, a) => s + a[1], 0);
    imbalance = askDepth > 0 ? bidDepth / askDepth : 1;
    const mid = (orderbook.bids[0][0] + orderbook.asks[0][0]) / 2;
    spreadBps = mid > 0 ? ((orderbook.asks[0][0] - orderbook.bids[0][0]) / mid) * 10000 : 0;
  }

  const signals = `Asset: ${asset} | Price: ${price.toFixed(2)}
VWAP(60): ${vwap.toFixed(2)} | Price vs VWAP: ${priceVsVwap.toFixed(3)}%
Volume ratio (last/avg): ${volRatio} | Volume trend: ${volTrend}
Money flow ratio (up/down vol): ${moneyFlowRatio.toFixed(2)}
Order book imbalance (bid/ask): ${imbalance.toFixed(2)}
Bid depth: ${bidDepth.toFixed(4)} | Ask depth: ${askDepth.toFixed(4)}
Spread: ${spreadBps.toFixed(1)} bps
${orderbook.bids.length > 0 ? `Top bid: ${orderbook.bids[0][0]} (${orderbook.bids[0][1]}) | Top ask: ${orderbook.asks[0][0]} (${orderbook.asks[0][1]})` : "No order book data"}`;

  let result: { direction: "up" | "down"; confidence: number; reasoning: string };

  try {
    result = await queryAgent("VolumeBot", SYSTEM_PROMPT, signals);
  } catch {
    const direction = priceVsVwap > 0 && moneyFlowRatio > 1.2 ? "up" : priceVsVwap < 0 && moneyFlowRatio < 0.8 ? "down" : imbalance > 1.2 ? "up" : "down";
    const conf = Math.abs(priceVsVwap) > 0.1 ? 60 : 45;
    result = { direction, confidence: conf, reasoning: `fallback:vwap=${priceVsVwap.toFixed(2)}%,mf=${moneyFlowRatio.toFixed(2)}` };
  }

  return {
    agentType: "volume",
    asset,
    direction: result.direction,
    confidence: result.confidence,
    reasoning: result.reasoning,
    indicators: {
      vwap: Number(vwap.toFixed(2)),
      price_vs_vwap: Number(priceVsVwap.toFixed(3)),
      vol_ratio: volRatio,
      money_flow: Number(moneyFlowRatio.toFixed(2)),
      book_imbalance: Number(imbalance.toFixed(2)),
      spread_bps: Number(spreadBps.toFixed(1)),
    },
    historicalAccuracy: getAgentHistoricalAccuracy("volume"),
    timestamp: Date.now(),
  };
}
