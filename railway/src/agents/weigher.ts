import type { Prediction, WeightedPrediction } from "@/lib/types";
import { getAccuracyScores } from "@/lib/store";

export function applyWeights(predictions: Prediction[]): WeightedPrediction[] {
  const scores = getAccuracyScores();

  const weighted = predictions.map((p) => {
    const accuracyWeight = scores[p.specialization] ?? 0.5;
    const weightedConf = p.confidence * accuracyWeight;
    return {
      ...p,
      accuracy_weight: accuracyWeight,
      weighted_confidence: Number(weightedConf.toFixed(4)),
      normalized_weight: 0,
    };
  });

  const total = weighted.reduce((s, w) => s + w.weighted_confidence, 0);
  if (total > 0) {
    for (const w of weighted) {
      w.normalized_weight = Number((w.weighted_confidence / total).toFixed(4));
    }
  }

  weighted.sort((a, b) => b.normalized_weight - a.normalized_weight);
  return weighted;
}
