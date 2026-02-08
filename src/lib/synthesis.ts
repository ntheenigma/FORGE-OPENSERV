import { config } from '../config';
import { AgentPredictionPayload } from '../types/agent';
import {
  ForgeOutput,
  ForgeSimulations,
  ForgeVolatilityAnalysis,
  ForgeLiquidationLevels,
  ForgeRiskMetrics,
} from '../types/forge-output';
import { SupportedAsset } from '../types/market-data';

interface WeightedPrediction {
  agentId: string;
  weight: number;
  prediction: AgentPredictionPayload;
}

/**
 * Synthesize 1,000 coherent price paths from multiple agent predictions,
 * weighted by their rolling 10-day CRPS scores (softmax weights).
 */
export function synthesizePaths(
  predictions: WeightedPrediction[],
  currentPrice: number
): number[][] {
  const totalPaths = config.forge.simulationCount;
  const synthesized: number[][] = [];

  // Allocate path count per agent proportional to weight
  const allocations = allocatePathCounts(predictions, totalPaths);

  for (const { agentId, count } of allocations) {
    const pred = predictions.find((p) => p.agentId === agentId);
    if (!pred || !pred.prediction.paths) continue;

    const agentPaths = pred.prediction.paths;
    if (agentPaths.length === 0) continue;

    // Sample `count` paths from this agent's predictions
    for (let i = 0; i < count; i++) {
      const idx = i % agentPaths.length;
      synthesized.push(agentPaths[idx]);
    }
  }

  // If we don't have enough, pad with GBM from current price
  while (synthesized.length < totalPaths) {
    synthesized.push(generateGBMPath(currentPrice, 0.5, config.forge.horizonSeconds, config.forge.timeIncrementSeconds));
  }

  // Shuffle for uniform mixing
  shuffleArray(synthesized);

  return synthesized.slice(0, totalPaths);
}

function allocatePathCounts(
  predictions: WeightedPrediction[],
  totalPaths: number
): { agentId: string; count: number }[] {
  const allocations: { agentId: string; count: number }[] = [];
  let remaining = totalPaths;

  const totalWeight = predictions.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return [];

  for (let i = 0; i < predictions.length; i++) {
    const isLast = i === predictions.length - 1;
    const count = isLast
      ? remaining
      : Math.round((predictions[i].weight / totalWeight) * totalPaths);
    allocations.push({ agentId: predictions[i].agentId, count: Math.max(0, count) });
    remaining -= count;
  }

  return allocations;
}

/**
 * Generate a single Geometric Brownian Motion path as fallback.
 */
function generateGBMPath(
  startPrice: number,
  annualizedVol: number,
  horizonSeconds: number,
  stepSeconds: number
): number[] {
  const steps = Math.floor(horizonSeconds / stepSeconds);
  const dt = stepSeconds / (365.25 * 24 * 3600);
  const path: number[] = [];
  let price = startPrice;

  for (let i = 0; i < steps; i++) {
    const z = gaussianRandom();
    price = price * Math.exp(-0.5 * annualizedVol * annualizedVol * dt + annualizedVol * Math.sqrt(dt) * z);
    path.push(price);
  }

  return path;
}

function gaussianRandom(): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Compute risk metrics from synthesized paths.
 */
export function computeRiskMetrics(paths: number[][], currentPrice: number): ForgeRiskMetrics {
  // Get terminal returns
  const terminalReturns: number[] = [];
  for (const path of paths) {
    if (path.length > 0) {
      const terminalPrice = path[path.length - 1];
      const pctReturn = ((terminalPrice - currentPrice) / currentPrice) * 100;
      terminalReturns.push(pctReturn);
    }
  }

  terminalReturns.sort((a, b) => a - b);

  const n = terminalReturns.length;
  if (n === 0) {
    return { var_95: 0, var_99: 0, expected_shortfall_95: 0 };
  }

  // VaR at 95% and 99% (left tail)
  const var95Index = Math.floor(n * 0.05);
  const var99Index = Math.floor(n * 0.01);

  const var95 = terminalReturns[var95Index];
  const var99 = terminalReturns[var99Index];

  // Expected Shortfall (CVaR) at 95%: average of returns below VaR95
  const tailReturns = terminalReturns.slice(0, var95Index + 1);
  const expectedShortfall95 =
    tailReturns.length > 0
      ? tailReturns.reduce((s, r) => s + r, 0) / tailReturns.length
      : var95;

  return {
    var_95: Math.round(var95 * 10) / 10,
    var_99: Math.round(var99 * 10) / 10,
    expected_shortfall_95: Math.round(expectedShortfall95 * 10) / 10,
  };
}

/**
 * Extract volatility analysis from predictions.
 */
export function extractVolatilityAnalysis(
  predictions: WeightedPrediction[]
): ForgeVolatilityAnalysis {
  const volPredictions = predictions.filter((p) => p.prediction.type === 'volatility');
  const patternPredictions = predictions.filter((p) => p.prediction.type === 'pattern');
  const contributing = [
    ...volPredictions.map((p) => p.agentId),
    ...patternPredictions.map((p) => p.agentId),
  ];

  if (volPredictions.length === 0) {
    return {
      forecast_volatility_24h: 0,
      term_structure: { '1d': 0, '7d': 0, '30d': 0 },
      percentiles: { '5': 0, '50': 0, '95': 0 },
      contributing_agents: contributing,
      agent_confidence: 0,
    };
  }

  // Weighted average of volatility predictions
  let totalWeight = 0;
  let weightedVol = 0;
  let weightedConfidence = 0;
  const termStructure = { '1d': 0, '7d': 0, '30d': 0 };
  const percentiles = { '5': 0, '50': 0, '95': 0 };

  for (const p of volPredictions) {
    const vol = p.prediction as import('../types/agent').VolatilityPredictionPayload;
    weightedVol += vol.forecastVolatility24h * p.weight;
    weightedConfidence += vol.confidence * p.weight;
    termStructure['1d'] += vol.termStructure['1d'] * p.weight;
    termStructure['7d'] += vol.termStructure['7d'] * p.weight;
    termStructure['30d'] += vol.termStructure['30d'] * p.weight;
    percentiles['5'] += vol.percentiles['5'] * p.weight;
    percentiles['50'] += vol.percentiles['50'] * p.weight;
    percentiles['95'] += vol.percentiles['95'] * p.weight;
    totalWeight += p.weight;
  }

  if (totalWeight > 0) {
    weightedVol /= totalWeight;
    weightedConfidence /= totalWeight;
    termStructure['1d'] /= totalWeight;
    termStructure['7d'] /= totalWeight;
    termStructure['30d'] /= totalWeight;
    percentiles['5'] /= totalWeight;
    percentiles['50'] /= totalWeight;
    percentiles['95'] /= totalWeight;
  }

  return {
    forecast_volatility_24h: Math.round(weightedVol * 100) / 100,
    term_structure: {
      '1d': Math.round(termStructure['1d'] * 100) / 100,
      '7d': Math.round(termStructure['7d'] * 100) / 100,
      '30d': Math.round(termStructure['30d'] * 100) / 100,
    },
    percentiles: {
      '5': Math.round(percentiles['5'] * 100) / 100,
      '50': Math.round(percentiles['50'] * 100) / 100,
      '95': Math.round(percentiles['95'] * 100) / 100,
    },
    contributing_agents: contributing,
    agent_confidence: Math.round(weightedConfidence * 100) / 100,
  };
}

/**
 * Extract liquidation levels from predictions.
 */
export function extractLiquidationLevels(
  predictions: WeightedPrediction[]
): ForgeLiquidationLevels {
  const liqPredictions = predictions.filter((p) => p.prediction.type === 'liquidation');

  if (liqPredictions.length === 0) {
    return {
      long_liquidation_cascade: 0,
      short_liquidation_cascade: 0,
      contributing_agent: 'none',
    };
  }

  // Use highest-weighted liquidation agent
  const best = liqPredictions.sort((a, b) => b.weight - a.weight)[0];
  const liq = best.prediction as import('../types/agent').LiquidationPredictionPayload;

  return {
    long_liquidation_cascade: liq.longCascadePrice,
    short_liquidation_cascade: liq.shortCascadePrice,
    contributing_agent: best.agentId,
  };
}

/**
 * Build complete ForgeOutput from agent predictions.
 */
export function buildForgeOutput(
  predictions: WeightedPrediction[],
  asset: SupportedAsset,
  currentPrice: number,
  epoch: number
): ForgeOutput {
  const paths = synthesizePaths(predictions, currentPrice);
  const riskMetrics = computeRiskMetrics(paths, currentPrice);
  const volatilityAnalysis = extractVolatilityAnalysis(predictions);
  const liquidationLevels = extractLiquidationLevels(predictions);

  const agentWeights: Record<string, number> = {};
  for (const p of predictions) {
    agentWeights[p.agentId] = Math.round(p.weight * 100) / 100;
  }

  return {
    metadata: {
      forge_version: config.forge.version,
      timestamp: new Date().toISOString(),
      asset,
      current_price: currentPrice,
      generation_method: 'multi_agent_synthesis',
      accuracy_epoch: epoch,
    },
    simulations: {
      count: paths.length,
      time_increment_seconds: config.forge.timeIncrementSeconds,
      horizon_seconds: config.forge.horizonSeconds,
      paths,
    },
    volatility_analysis: volatilityAnalysis,
    liquidation_levels: liquidationLevels,
    agent_weights: agentWeights,
    risk_metrics: riskMetrics,
  };
}
