import { config } from '../config';
import { computeCRPS } from '../lib/crps';
import { transformScores, updateEMA, computeSoftmaxWeights } from '../lib/scoring';
import { fetchPythHistoricalPrice } from '../lib/market-data';
import { SupportedAsset } from '../types/market-data';
import { CRPSResult, ValidationResult } from '../types/scoring';
import { ForgeOutput } from '../types/forge-output';
import { updateAgentWeight } from './prediction-generation';

/**
 * Validation and Scoring Workflow
 *
 * Trigger: Cron schedule, 24 hours after each prediction timestamp.
 * Steps:
 *   1. REST API agent fetches realized prices from Pyth historical endpoint
 *   2. Code Executor agent calculates CRPS for each contributing agent
 *   3. Code Executor agent applies score transformation
 *   4. Sheets agent updates public leaderboard with rolling 10-day EMA
 *   5. File System agent archives validation results
 */

// EMA state store per agent
const emaStore = new Map<string, number>();

// Leaderboard store
const validationHistory: ValidationResult[] = [];

export function getEmaScore(agentId: string): number {
  return emaStore.get(agentId) ?? 1.0; // default high (bad) until proven
}

export function getValidationHistory(count?: number): ValidationResult[] {
  return count ? validationHistory.slice(-count) : validationHistory;
}

/**
 * Run validation for a past prediction.
 */
export async function runValidation(
  prediction: ForgeOutput,
  agentPaths: Map<string, number[][]> // agentId -> their contributed paths
): Promise<ValidationResult> {
  const asset = prediction.metadata.asset;
  const predictionTimestamp = new Date(prediction.metadata.timestamp).getTime();
  const horizonSeconds = prediction.simulations.horizon_seconds;
  const stepSeconds = prediction.simulations.time_increment_seconds;
  const totalSteps = Math.floor(horizonSeconds / stepSeconds);

  // Fetch realized prices at each time step
  const realizedPrices: number[] = [];
  for (let step = 1; step <= totalSteps; step++) {
    const targetTime = Math.floor((predictionTimestamp + step * stepSeconds * 1000) / 1000);
    try {
      const pricePoint = await fetchPythHistoricalPrice(asset as SupportedAsset, targetTime);
      realizedPrices.push(pricePoint.price);
    } catch {
      break; // Stop at first missing price
    }
  }

  if (realizedPrices.length === 0) {
    throw new Error(`No realized prices available for validation of ${asset}`);
  }

  // Compute CRPS for each agent's contributed paths
  const crpsResults: CRPSResult[] = [];

  for (const [agentId, paths] of agentPaths.entries()) {
    // Use the final step for CRPS calculation
    const pathLen = paths[0]?.length ?? 1;
    const finalStep = Math.min(realizedPrices.length - 1, pathLen - 1);
    const crps = computeCRPS(paths, realizedPrices[finalStep], finalStep);

    crpsResults.push({
      agentId,
      crps,
      asset,
      horizonSeconds,
      predictionTimestamp: prediction.metadata.timestamp,
      validationTimestamp: new Date().toISOString(),
      realizedPrice: realizedPrices[finalStep],
    });
  }

  // Transform scores
  const transformedScores = transformScores(crpsResults);

  // Update EMAs
  const emaUpdates = transformedScores.map((ts) => {
    const prevEma = getEmaScore(ts.agentId);
    const update = updateEMA(prevEma, ts.normalizedScore);
    update.agentId = ts.agentId;
    emaStore.set(ts.agentId, update.updatedEma);
    return update;
  });

  // Recompute softmax weights and propagate to prediction workflow
  const agentScores = Array.from(emaStore.entries()).map(([agentId, emaScore]) => ({
    agentId,
    emaScore,
  }));

  const epoch = validationHistory.length + 1;
  const softmax = computeSoftmaxWeights(agentScores, epoch);

  // Update agent weights in prediction workflow
  for (const [agentId, weight] of Object.entries(softmax.weights)) {
    updateAgentWeight(agentId, weight);
  }

  const result: ValidationResult = {
    predictionTimestamp: prediction.metadata.timestamp,
    validationTimestamp: new Date().toISOString(),
    asset,
    realizedPrice: realizedPrices[realizedPrices.length - 1],
    agentScores: crpsResults,
    transformedScores,
    emaUpdates,
  };

  validationHistory.push(result);
  if (validationHistory.length > 500) validationHistory.splice(0, validationHistory.length - 500);

  return result;
}
