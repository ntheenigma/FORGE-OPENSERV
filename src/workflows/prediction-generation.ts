import { config } from '../config';
import { getLatestData, getHistoricalData } from './data-ingestion';
import { SupportedAsset } from '../types/market-data';
import { AgentPredictionPayload } from '../types/agent';
import { buildForgeOutput } from '../lib/synthesis';
import { ForgeOutput } from '../types/forge-output';

/**
 * Parallel Prediction Generation Workflow
 *
 * Trigger: Completion of Ingestion workflow.
 * Configuration: Parallel branch execution enabled.
 * Four branches execute simultaneously:
 *   - Volatility Predictor agent
 *   - Liquidation Analyzer agent
 *   - Sentiment Tracker agent
 *   - Pattern Matcher agent
 * Program Manager (Forge Synthesizer) aggregates upon all branches completing.
 *
 * In OpenServ, this maps to a workflow with parallel branches and
 * a Program Manager agent triggered on all-branches-complete.
 */

interface AgentEndpoint {
  agentId: string;
  capability: string;
  buildInput: (asset: SupportedAsset, currentPrice: number) => Record<string, any>;
}

// Agent weight store (updated by validation workflow)
const agentWeights = new Map<string, number>([
  ['volatility-predictor', 0.30],
  ['liquidation-analyzer', 0.25],
  ['sentiment-tracker', 0.20],
  ['pattern-matcher', 0.25],
]);

// Prediction store
const predictionStore = new Map<string, ForgeOutput[]>();

export function updateAgentWeight(agentId: string, weight: number): void {
  agentWeights.set(agentId, weight);
}

export function getLatestPrediction(asset: string): ForgeOutput | undefined {
  const history = predictionStore.get(asset);
  return history?.[history.length - 1];
}

export function getPredictionHistory(asset: string, count?: number): ForgeOutput[] {
  const history = predictionStore.get(asset) ?? [];
  return count ? history.slice(-count) : history;
}

/**
 * Execute parallel prediction generation for an asset.
 * In production on OpenServ, each agent is a separate service invoked via workflow.
 * Here we simulate the parallel invocation pattern.
 */
export async function runPredictionGeneration(
  asset: SupportedAsset,
  epoch: number,
  agentInvoker: (agentId: string, capability: string, input: Record<string, any>) => Promise<AgentPredictionPayload>
): Promise<ForgeOutput> {
  const latestData = getLatestData(asset);
  if (!latestData) {
    throw new Error(`No ingested data available for ${asset}. Run ingestion first.`);
  }

  const currentPrice = latestData.currentPrice;
  const historicalData = getHistoricalData(asset, 500);
  const priceHistory = historicalData.map((d) => ({
    timestamp: d.timestamp,
    price: d.currentPrice,
  }));

  // Define agent inputs
  const agentInputs: AgentEndpoint[] = [
    {
      agentId: 'volatility-predictor',
      capability: 'predict_volatility',
      buildInput: () => ({
        asset,
        currentPrice,
        priceHistory,
        ohlcv: latestData.ohlcv,
        atmIv: latestData.ivSurface?.atmIv,
        fundingRate: latestData.fundingRate?.rate,
        horizonSeconds: config.forge.horizonSeconds,
      }),
    },
    {
      agentId: 'liquidation-analyzer',
      capability: 'analyze_liquidations',
      buildInput: () => ({
        asset,
        currentPrice,
        openInterest: latestData.openInterest?.openInterest,
        longRatio: latestData.openInterest?.longRatio,
        shortRatio: latestData.openInterest?.shortRatio,
        fundingRate: latestData.fundingRate?.rate,
        liquidationLevels: latestData.liquidationLevels,
        horizonSeconds: config.forge.horizonSeconds,
      }),
    },
    {
      agentId: 'sentiment-tracker',
      capability: 'track_sentiment',
      buildInput: () => ({
        asset,
        currentPrice,
        fundingRate: latestData.fundingRate?.rate,
        horizonSeconds: config.forge.horizonSeconds,
      }),
    },
    {
      agentId: 'pattern-matcher',
      capability: 'match_patterns',
      buildInput: () => ({
        asset,
        currentPrice,
        priceHistory,
        ohlcv: latestData.ohlcv,
        horizonSeconds: config.forge.horizonSeconds,
      }),
    },
  ];

  // Execute all agents in parallel
  const results = await Promise.allSettled(
    agentInputs.map((ep) =>
      agentInvoker(ep.agentId, ep.capability, ep.buildInput(asset, currentPrice))
    )
  );

  // Collect successful predictions with weights
  const weightedPredictions: { agentId: string; weight: number; prediction: AgentPredictionPayload }[] = [];

  for (let i = 0; i < agentInputs.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      const ep = agentInputs[i];
      weightedPredictions.push({
        agentId: ep.agentId,
        weight: agentWeights.get(ep.agentId) ?? 0.25,
        prediction: result.value,
      });
    }
  }

  if (weightedPredictions.length === 0) {
    throw new Error('All agent predictions failed. Cannot generate output.');
  }

  // Renormalize weights for available predictions
  const totalWeight = weightedPredictions.reduce((s, p) => s + p.weight, 0);
  const normalized = weightedPredictions.map((p) => ({
    ...p,
    weight: p.weight / totalWeight,
  }));

  // Synthesize final output
  const output = buildForgeOutput(normalized, asset, currentPrice, epoch);

  // Store prediction
  if (!predictionStore.has(asset)) predictionStore.set(asset, []);
  const history = predictionStore.get(asset)!;
  history.push(output);
  if (history.length > 100) history.splice(0, history.length - 100);

  return output;
}
