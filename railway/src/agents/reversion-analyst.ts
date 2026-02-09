import type { Candle, Prediction } from "@/lib/types";

function avg(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[], mean: number): number {
  const sq = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(sq);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function analyzeReversion(candles: Candle[]): Prediction {
  const closes = candles.map((c) => c.close);

  if (closes.length < 20) {
    return {
      prediction: "UP",
      confidence: 0.5,
      reasoning: "insufficient_data",
      specialization: "mean_reversion",
      timestamp: new Date().toISOString(),
    };
  }

  const last20 = closes.slice(-20);
  const price = closes[closes.length - 1];
  const sma20 = avg(last20);
  const std20 = stddev(last20, sma20);

  if (std20 === 0) {
    return {
      prediction: "UP",
      confidence: 0.5,
      reasoning: "zero_volatility",
      specialization: "mean_reversion",
      timestamp: new Date().toISOString(),
    };
  }

  const upperBand = sma20 + 2 * std20;
  const lowerBand = sma20 - 2 * std20;
  const zScore = (price - sma20) / std20;
  const pctB = (price - lowerBand) / (upperBand - lowerBand);
  const bandwidth = (upperBand - lowerBand) / sma20;

  let direction: "UP" | "DOWN";
  let conf: number;
  let reason: string;

  if (price > upperBand && zScore > 2.0) {
    direction = "DOWN";
    conf = 0.72;
    reason = `above_upper_band_zscore_${zScore.toFixed(1)}`;
  } else if (price > upperBand) {
    direction = "DOWN";
    conf = 0.65;
    reason = "above_upper_band";
  } else if (price < lowerBand && zScore < -2.0) {
    direction = "UP";
    conf = 0.72;
    reason = `below_lower_band_zscore_${zScore.toFixed(1)}`;
  } else if (price < lowerBand) {
    direction = "UP";
    conf = 0.65;
    reason = "below_lower_band";
  } else if (zScore > 1.5) {
    direction = "DOWN";
    conf = 0.58;
    reason = "approaching_upper_band";
  } else if (zScore < -1.5) {
    direction = "UP";
    conf = 0.58;
    reason = "approaching_lower_band";
  } else {
    direction = price > sma20 ? "DOWN" : "UP";
    conf = 0.51;
    reason = "within_bands_neutral";
  }

  // Bandwidth adjustments
  if (bandwidth < 0.002) conf -= 0.08; // squeeze
  if (bandwidth > 0.008) conf -= 0.05; // trending, reversion less reliable

  // Sustained outside check
  const last5 = closes.slice(-5);
  const outsideCount = last5.filter(
    (c) => c > upperBand || c < lowerBand
  ).length;
  if (outsideCount >= 2) conf -= 0.10;

  return {
    prediction: direction,
    confidence: clamp(Number(conf.toFixed(2)), 0.5, 0.78),
    reasoning: reason.slice(0, 80),
    specialization: "mean_reversion",
    timestamp: new Date().toISOString(),
    indicators: {
      sma20: Number(sma20.toFixed(2)),
      std20: Number(std20.toFixed(2)),
      upper_band: Number(upperBand.toFixed(2)),
      lower_band: Number(lowerBand.toFixed(2)),
      z_score: Number(zScore.toFixed(3)),
      pct_b: Number(pctB.toFixed(3)),
      bandwidth: Number(bandwidth.toFixed(6)),
    },
  };
}
