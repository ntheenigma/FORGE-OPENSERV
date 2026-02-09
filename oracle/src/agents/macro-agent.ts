import type { Candle, AgentSignal, Asset } from "@/lib/types";
import { queryAgent } from "@/lib/groq";
import { getAgentHistoricalAccuracy } from "@/lib/store";

// Cross-asset correlation data (fetched from free sources)
interface MacroData {
  btcChange: number;
  goldChange: number;
  dxyEstimate: number;
  correlation: string;
}

async function fetchMacroContext(
  btcCandles: Candle[],
  goldPrice: number
): Promise<MacroData> {
  // BTC momentum
  const btcChange =
    btcCandles.length >= 60
      ? ((btcCandles[btcCandles.length - 1].close - btcCandles[btcCandles.length - 60].close) /
          btcCandles[btcCandles.length - 60].close) *
        100
      : 0;

  // Gold momentum (approximate from price)
  const goldChange = 0; // We'd need historical gold data; placeholder

  // DXY estimate: when BTC and Gold both go up, DXY likely weakening
  const dxyEstimate =
    btcChange > 0.5 ? -1 : btcChange < -0.5 ? 1 : 0;

  // Correlation regime
  let correlation = "normal";
  if (btcChange > 0 && goldPrice > 2600) correlation = "risk_on";
  else if (btcChange < 0 && goldPrice > 2700) correlation = "flight_to_safety";
  else if (btcChange < -1) correlation = "risk_off";

  return {
    btcChange: Number(btcChange.toFixed(4)),
    goldChange,
    dxyEstimate,
    correlation,
  };
}

const SYSTEM_PROMPT = `You are MacroBot, a cross-asset correlation expert for the ORACLE prediction platform.
You analyze relationships between BTC, Gold, DXY (dollar strength), and risk sentiment.

RULES:
- Risk-on environment: BTC typically rises, Gold mixed
- Risk-off / flight to safety: Gold rises, BTC may fall
- Strong DXY (dollar): typically negative for both BTC and Gold
- Weak DXY: positive for both BTC and Gold
- When BTC and Gold move together: macro-driven (monetary policy / liquidity)
- When they diverge: asset-specific factors dominate
- Use cross-asset context to predict the SPECIFIC asset being analyzed
- For BTC: focus on risk appetite, correlation with tech/growth
- For GOLD: focus on inflation expectations, real yields, safe haven flows
- Output JSON: {"direction":"up"|"down","confidence":10-95,"reasoning":"max 200 chars"}`;

export async function analyzeMacro(
  asset: Asset,
  candles: Candle[],
  goldPrice: number
): Promise<AgentSignal> {
  const price = candles[candles.length - 1]?.close ?? 0;
  const macro = await fetchMacroContext(candles, goldPrice);

  // Compute BTC-specific indicators
  const btcVol = candles.length >= 20
    ? Math.sqrt(
        candles.slice(-20).reduce((s, c, i, arr) => {
          if (i === 0) return 0;
          const ret = Math.log(c.close / arr[i - 1].close);
          return s + ret * ret;
        }, 0) / 19
      ) * 100
    : 0;

  // Hourly momentum
  const hourMom = candles.length >= 60
    ? ((candles[candles.length - 1].close - candles[candles.length - 60].close) / candles[candles.length - 60].close) * 100
    : 0;

  const signals = `Asset: ${asset} | Price: ${price.toFixed(2)}
BTC 1h change: ${macro.btcChange.toFixed(4)}%
Gold spot: ~$${goldPrice.toFixed(2)}
DXY direction estimate: ${macro.dxyEstimate > 0 ? "STRENGTHENING" : macro.dxyEstimate < 0 ? "WEAKENING" : "STABLE"}
Correlation regime: ${macro.correlation.toUpperCase()}
BTC volatility (20-bar): ${btcVol.toFixed(3)}%
BTC hourly momentum: ${hourMom.toFixed(4)}%
Analyzing for: ${asset}
Context: ${asset === "BTC" ? "Risk asset, correlated with tech/growth" : "Safe haven, inversely correlated with DXY"}`;

  let result: { direction: "up" | "down"; confidence: number; reasoning: string };

  try {
    result = await queryAgent("MacroBot", SYSTEM_PROMPT, signals);
  } catch {
    let direction: "up" | "down";
    if (asset === "BTC") {
      direction = macro.correlation === "risk_on" ? "up" : macro.correlation === "risk_off" ? "down" : hourMom >= 0 ? "up" : "down";
    } else {
      direction = macro.correlation === "flight_to_safety" ? "up" : macro.dxyEstimate > 0 ? "down" : "up";
    }
    result = { direction, confidence: 50, reasoning: `fallback:${macro.correlation}` };
  }

  return {
    agentType: "macro",
    asset,
    direction: result.direction,
    confidence: result.confidence,
    reasoning: result.reasoning,
    indicators: {
      btc_1h_change: macro.btcChange,
      gold_price: goldPrice,
      dxy_estimate: macro.dxyEstimate,
      btc_volatility: Number(btcVol.toFixed(3)),
    },
    historicalAccuracy: getAgentHistoricalAccuracy("macro"),
    timestamp: Date.now(),
  };
}
