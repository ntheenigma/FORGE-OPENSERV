/**
 * Continuous Ranked Probability Score (CRPS) implementation.
 *
 * CRPS measures both calibration and sharpness of probabilistic forecasts.
 * Lower CRPS = better forecast. It generalizes MAE to probabilistic predictions.
 *
 * For an ensemble of simulated paths, CRPS is computed as:
 *   CRPS = E|X - y| - 0.5 * E|X - X'|
 * where X, X' are independent draws from the forecast distribution and y is realized.
 */

export function computeCRPS(predictedPaths: number[][], realizedPrice: number, stepIndex: number): number {
  const samples: number[] = [];
  for (const path of predictedPaths) {
    if (stepIndex < path.length) {
      samples.push(path[stepIndex]);
    }
  }

  if (samples.length === 0) {
    return Infinity;
  }

  // Sort for efficient computation
  const sorted = samples.slice().sort((a, b) => a - b);
  const n = sorted.length;

  // E|X - y|: mean absolute error between each sample and realized value
  let meanAbsError = 0;
  for (const s of sorted) {
    meanAbsError += Math.abs(s - realizedPrice);
  }
  meanAbsError /= n;

  // E|X - X'|: mean absolute difference between pairs (efficient O(n) via sorted order)
  // For sorted values: E|X-X'| = (2 / n^2) * sum_i( (2i - n - 1) * x_i )
  let meanAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    meanAbsDiff += (2 * i - n + 1) * sorted[i];
  }
  meanAbsDiff = (2 * meanAbsDiff) / (n * n);

  // CRPS = E|X-y| - 0.5 * E|X-X'|
  return meanAbsError - 0.5 * Math.abs(meanAbsDiff);
}

export function computeCRPSMultiHorizon(
  predictedPaths: number[][],
  realizedPrices: number[],
  timeIncrementSeconds: number,
  horizonSeconds: number
): { crpsPerStep: number[]; averageCrps: number } {
  const totalSteps = Math.floor(horizonSeconds / timeIncrementSeconds);
  const stepsToValidate = Math.min(totalSteps, realizedPrices.length);
  const crpsPerStep: number[] = [];

  for (let step = 0; step < stepsToValidate; step++) {
    crpsPerStep.push(computeCRPS(predictedPaths, realizedPrices[step], step));
  }

  const averageCrps =
    crpsPerStep.length > 0
      ? crpsPerStep.reduce((a, b) => a + b, 0) / crpsPerStep.length
      : Infinity;

  return { crpsPerStep, averageCrps };
}
