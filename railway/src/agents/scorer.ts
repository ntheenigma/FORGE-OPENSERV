import type { Prediction, ScoreResult } from "@/lib/types";
import { getAccuracyScores, setAccuracyScores } from "@/lib/store";

const EMA_ALPHA = 0.1;
const FLAT_THRESHOLD = 0.0001; // 0.01%

export async function scorePredictions(
  predictions: Prediction[],
  consensusPrediction: string,
  consensusConfidence: number,
  priceAtPrediction: number
): Promise<{
  results: ScoreResult[];
  consensus_correct: boolean;
  realized_price: number;
  price_change_pct: number;
} | null> {
  // Fetch current price from Pyth
  let realizedPrice: number;
  try {
    const res = await fetch(
      "https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
    );
    const data = await res.json();
    const feed = data[0];
    realizedPrice =
      Number(feed.price.price) * 10 ** feed.price.expo;
  } catch {
    return null; // Can't score without price
  }

  const changePct =
    (realizedPrice - priceAtPrediction) / priceAtPrediction;
  const isFlat = Math.abs(changePct) < FLAT_THRESHOLD;
  const actualDirection: "UP" | "DOWN" =
    realizedPrice >= priceAtPrediction ? "UP" : "DOWN";

  const scores = getAccuracyScores();
  const results: ScoreResult[] = [];

  for (const p of predictions) {
    const correct = isFlat || p.prediction === actualDirection;
    let delta = 0;
    if (correct && p.confidence > 0.7) delta = 2;
    else if (correct) delta = 1;
    else if (!correct && p.confidence > 0.7) delta = -2;
    else delta = -1;

    const oldEma = scores[p.specialization] ?? 0.5;
    const newEma =
      EMA_ALPHA * (correct ? 1.0 : 0.0) + (1 - EMA_ALPHA) * oldEma;
    scores[p.specialization] = Number(newEma.toFixed(4));

    results.push({
      specialization: p.specialization,
      predicted: p.prediction,
      correct,
      confidence: p.confidence,
      score_delta: delta,
      new_ema: scores[p.specialization],
    });
  }

  setAccuracyScores(scores);

  const consensusCorrect =
    isFlat || consensusPrediction === actualDirection;

  return {
    results,
    consensus_correct: consensusCorrect,
    realized_price: Number(realizedPrice.toFixed(2)),
    price_change_pct: Number((changePct * 100).toFixed(4)),
  };
}
