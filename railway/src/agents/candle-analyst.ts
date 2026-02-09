import type { Candle, Prediction } from "@/lib/types";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function analyzeCandles(candles: Candle[]): Prediction {
  if (candles.length < 5) {
    return {
      prediction: "UP",
      confidence: 0.5,
      reasoning: "insufficient_candle_data",
      specialization: "candle_microstructure",
      timestamp: new Date().toISOString(),
    };
  }

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  let direction: "UP" | "DOWN" = "UP";
  let conf = 0.55;
  const reasons: string[] = [];

  // Pattern detection
  const lastBody = last.close - last.open;
  const prevBody = prev.close - prev.open;
  const lastRange = last.high - last.low;
  const lowerWick = Math.min(last.open, last.close) - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  const bodySize = Math.abs(lastBody);

  // Bullish engulfing
  if (lastBody > 0 && prevBody < 0 && last.close > prev.open && last.open < prev.close) {
    direction = "UP";
    conf += 0.10;
    reasons.push("bullish_engulfing");
  }
  // Bearish engulfing
  else if (lastBody < 0 && prevBody > 0 && last.close < prev.open && last.open > prev.close) {
    direction = "DOWN";
    conf += 0.10;
    reasons.push("bearish_engulfing");
  }
  // Hammer (bullish)
  else if (lowerWick > 2 * bodySize && upperWick < bodySize * 0.5 && lastRange > 0) {
    direction = "UP";
    conf += 0.08;
    reasons.push("hammer");
  }
  // Shooting star (bearish)
  else if (upperWick > 2 * bodySize && lowerWick < bodySize * 0.5 && lastRange > 0) {
    direction = "DOWN";
    conf += 0.08;
    reasons.push("shooting_star");
  }
  // Doji
  else if (bodySize < lastRange * 0.1 && lastRange > 0) {
    conf -= 0.05;
    reasons.push("doji");
  }
  // Three white soldiers
  else if (lastBody > 0 && prevBody > 0 && prev2.close - prev2.open > 0) {
    direction = "UP";
    conf += 0.12;
    reasons.push("three_white_soldiers");
  }
  // Three black crows
  else if (lastBody < 0 && prevBody < 0 && prev2.close - prev2.open < 0) {
    direction = "DOWN";
    conf += 0.12;
    reasons.push("three_black_crows");
  }

  // Volume confirmation
  const recent20 = candles.slice(-20);
  const avgVol = recent20.reduce((s, c) => s + c.volume, 0) / recent20.length;
  const volRatio = avgVol > 0 ? last.volume / avgVol : 1;

  if (volRatio > 1.5) {
    conf += 0.10;
    reasons.push("vol_confirm");
  } else if (volRatio < 0.5) {
    conf -= 0.10;
    reasons.push("low_vol");
  }

  // Trend context
  const last20 = candles.slice(-20);
  const upCandles = last20.filter((c) => c.close > c.open).length;
  if (upCandles > 14) {
    direction = direction === "UP" ? "DOWN" : direction; // exhaustion
    reasons.push("exhaustion_reversal");
  } else if (upCandles < 6) {
    direction = direction === "DOWN" ? "UP" : direction;
    reasons.push("exhaustion_reversal");
  }

  // Default direction from recent trend if no pattern found
  if (reasons.length === 0) {
    const closes5 = candles.slice(-5).map((c) => c.close);
    direction = closes5[4] > closes5[0] ? "UP" : "DOWN";
    conf = 0.52;
    reasons.push("trend_follow");
  }

  return {
    prediction: direction,
    confidence: clamp(Number(conf.toFixed(2)), 0.5, 0.8),
    reasoning: reasons.join("+").slice(0, 80),
    specialization: "candle_microstructure",
    timestamp: new Date().toISOString(),
    indicators: { volume_ratio: Number(volRatio.toFixed(2)) },
  };
}
