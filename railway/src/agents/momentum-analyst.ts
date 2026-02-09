import type { Candle, Prediction } from "@/lib/types";

function avg(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function analyzeMomentum(candles: Candle[]): Prediction {
  const closes = candles.map((c) => c.close);

  if (closes.length < 20) {
    return {
      prediction: "UP",
      confidence: 0.5,
      reasoning: "insufficient_data",
      specialization: "momentum_trend",
      timestamp: new Date().toISOString(),
    };
  }

  const price = closes[closes.length - 1];
  const ma5 = avg(closes.slice(-5));
  const ma20 = avg(closes.slice(-20));
  const ma50 = closes.length >= 50 ? avg(closes.slice(-50)) : avg(closes);

  const mom5 =
    closes.length >= 6
      ? (price - closes[closes.length - 6]) / closes[closes.length - 6]
      : 0;
  const mom20 =
    closes.length >= 21
      ? (price - closes[closes.length - 21]) / closes[closes.length - 21]
      : 0;

  let direction: "UP" | "DOWN";
  let conf: number;
  let reason: string;

  if (ma5 > ma20 && ma20 > ma50 && price > ma5) {
    direction = "UP";
    conf = 0.68;
    reason = "strong_uptrend_all_MAs_aligned";
  } else if (ma5 < ma20 && ma20 < ma50 && price < ma5) {
    direction = "DOWN";
    conf = 0.68;
    reason = "strong_downtrend_all_MAs_aligned";
  } else if (ma5 > ma20 && price > ma20) {
    direction = "UP";
    conf = 0.6;
    reason = "bullish_MA5_cross_MA20";
  } else if (ma5 < ma20 && price < ma20) {
    direction = "DOWN";
    conf = 0.6;
    reason = "bearish_MA5_cross_MA20";
  } else if (ma5 > ma20 && price < ma5) {
    direction = "UP";
    conf = 0.54;
    reason = "pullback_in_uptrend";
  } else if (ma5 < ma20 && price > ma5) {
    direction = "DOWN";
    conf = 0.54;
    reason = "bounce_in_downtrend";
  } else {
    direction = mom5 >= 0 ? "UP" : "DOWN";
    conf = 0.52;
    reason = "no_clear_trend";
  }

  // Momentum agreement adjustment
  if ((mom5 > 0) === (mom20 > 0)) conf += 0.05;
  else conf -= 0.05;
  if (Math.abs(mom5) > 0.002) conf += 0.05;

  return {
    prediction: direction,
    confidence: clamp(Number(conf.toFixed(2)), 0.5, 0.78),
    reasoning: reason,
    specialization: "momentum_trend",
    timestamp: new Date().toISOString(),
    indicators: {
      ma5: Number(ma5.toFixed(2)),
      ma20: Number(ma20.toFixed(2)),
      ma50: Number(ma50.toFixed(2)),
      momentum_5: Number(mom5.toFixed(6)),
      momentum_20: Number(mom20.toFixed(6)),
    },
  };
}
