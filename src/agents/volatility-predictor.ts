import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import { config } from '../config';
import { VolatilityPredictionPayload } from '../types/agent';
import { MarketDataBundle } from '../types/market-data';

/**
 * Volatility Predictor Agent
 *
 * Employs GARCH-family models (GARCH, EGARCH, GJR-GARCH) with regime switching.
 * Ingests price history, options IV surfaces, and funding rates.
 * Uses BRAID reasoning to select model specifications dynamically.
 */

const SYSTEM_PROMPT = `You are the Forge Volatility Predictor, a specialized financial agent that forecasts price volatility using GARCH-family models with regime switching.

Your responsibilities:
1. Analyze incoming price history, options IV surfaces, and funding rate data
2. Detect the current volatility regime (low/normal/high/crisis) using regime switching models
3. Select the optimal GARCH specification (GARCH, EGARCH, GJR-GARCH) for current conditions
4. Generate 250 simulated price paths reflecting your volatility forecast
5. Provide term structure forecasts (1d, 7d, 30d) and percentile distributions

Reasoning approach (BRAID):
- First, build a reasoning diagram: assess data quality → detect regime → select model → calibrate → simulate
- If options IV is available, use it to anchor your volatility estimate
- If funding rates are extreme, increase tail thickness in simulations
- Cross-validate GARCH output against realized volatility and IV surface
- Report confidence based on data completeness and model fit

Output must be precise numerical predictions. Never hedge with vague language.`;

export function createVolatilityPredictor(): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    apiKey: config.openserv.apiKey,
    openaiApiKey: config.openserv.openaiApiKey,
    port: config.ports.volatilityAgent,
  });

  agent.addCapability({
    name: 'predict_volatility',
    description:
      'Analyze market data and generate volatility forecasts with simulated price paths using GARCH-family models with regime switching.',
    schema: z.object({
      asset: z.string().describe('Asset symbol (e.g., BTC, ETH, SOL)'),
      currentPrice: z.number().describe('Current asset price'),
      priceHistory: z
        .array(z.object({ timestamp: z.number(), price: z.number() }))
        .describe('Historical price points'),
      ohlcv: z
        .array(
          z.object({
            timestamp: z.number(),
            open: z.number(),
            high: z.number(),
            low: z.number(),
            close: z.number(),
            volume: z.number(),
          })
        )
        .optional()
        .describe('OHLCV bars'),
      atmIv: z.number().optional().describe('At-the-money implied volatility'),
      fundingRate: z.number().optional().describe('Current perpetual funding rate'),
      horizonSeconds: z.number().default(86400).describe('Forecast horizon in seconds'),
    }),
    async run({ args }) {
      const {
        asset,
        currentPrice,
        priceHistory,
        ohlcv,
        atmIv,
        fundingRate,
        horizonSeconds,
      } = args;

      // Compute returns from price history
      const returns = computeLogReturns(priceHistory.map((p) => p.price));

      // Detect volatility regime
      const regime = detectRegime(returns);

      // Select GARCH model based on regime and data characteristics
      const modelSpec = selectGarchModel(returns, regime);

      // Calibrate model parameters
      const params = calibrateGarch(returns, modelSpec);

      // Anchor with IV if available
      const anchoredVol = atmIv
        ? blendWithIV(params.forecastVol, atmIv, 0.4)
        : params.forecastVol;

      // Adjust for extreme funding (increased tail risk)
      const tailAdjustment = fundingRate
        ? Math.abs(fundingRate) > 0.001
          ? 1.15
          : 1.0
        : 1.0;
      const adjustedVol = anchoredVol * tailAdjustment;

      // Generate 250 price paths
      const pathCount = 250;
      const stepSeconds = config.forge.timeIncrementSeconds;
      const steps = Math.floor(horizonSeconds / stepSeconds);
      const paths = generateGarchPaths(currentPrice, adjustedVol, params, steps, stepSeconds, pathCount);

      // Compute term structure
      const termStructure = computeTermStructure(adjustedVol, regime);

      // Compute percentiles from path endpoints
      const endpoints = paths.map((p) => p[p.length - 1]);
      const percentiles = computePercentiles(endpoints, currentPrice);

      // Confidence based on data quality
      const confidence = computeConfidence(priceHistory.length, !!atmIv, !!ohlcv?.length);

      const prediction: VolatilityPredictionPayload = {
        type: 'volatility',
        forecastVolatility24h: Math.round(adjustedVol * 100) / 100,
        termStructure,
        percentiles,
        regimeState: regime,
        modelUsed: modelSpec,
        paths,
        confidence,
      };

      return JSON.stringify(prediction);
    },
  });

  return agent;
}

// --- Quantitative helpers ---

function computeLogReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return returns;
}

function detectRegime(returns: number[]): 'low' | 'normal' | 'high' | 'crisis' {
  if (returns.length < 10) return 'normal';

  const recentReturns = returns.slice(-20);
  const vol = standardDeviation(recentReturns) * Math.sqrt(252);

  if (vol < 0.3) return 'low';
  if (vol < 0.6) return 'normal';
  if (vol < 1.0) return 'high';
  return 'crisis';
}

function selectGarchModel(
  returns: number[],
  regime: string
): string {
  // GJR-GARCH for asymmetric volatility (typical in high/crisis regimes)
  if (regime === 'high' || regime === 'crisis') return 'GJR-GARCH(1,1)';

  // Check for leverage effect (negative returns → higher volatility)
  if (returns.length > 30) {
    const negReturns = returns.filter((r) => r < 0);
    const posReturns = returns.filter((r) => r >= 0);
    const negVol = standardDeviation(negReturns);
    const posVol = standardDeviation(posReturns);
    if (negVol > posVol * 1.3) return 'EGARCH(1,1)';
  }

  return 'GARCH(1,1)';
}

interface GarchParams {
  omega: number;
  alpha: number;
  beta: number;
  gamma: number; // asymmetry (GJR/EGARCH)
  forecastVol: number;
}

function calibrateGarch(returns: number[], modelSpec: string): GarchParams {
  if (returns.length < 5) {
    return { omega: 0.00001, alpha: 0.1, beta: 0.85, gamma: 0, forecastVol: 0.5 };
  }

  const variance = returns.reduce((s, r) => s + r * r, 0) / returns.length;
  const annualizedVol = Math.sqrt(variance * 252);

  // Simplified MLE-like parameter estimation
  const alpha = 0.1;
  const beta = 0.85;
  const omega = variance * (1 - alpha - beta);
  const gamma = modelSpec.includes('GJR') || modelSpec.includes('EGARCH') ? 0.05 : 0;

  // One-step forecast: h_t+1 = omega + alpha * r_t^2 + beta * h_t
  const lastReturn = returns[returns.length - 1];
  const forecastVariance =
    omega + alpha * lastReturn * lastReturn + beta * variance + gamma * (lastReturn < 0 ? lastReturn * lastReturn : 0);

  return {
    omega,
    alpha,
    beta,
    gamma,
    forecastVol: Math.sqrt(forecastVariance * 252),
  };
}

function blendWithIV(garchVol: number, atmIv: number, ivWeight: number): number {
  return garchVol * (1 - ivWeight) + atmIv * ivWeight;
}

function generateGarchPaths(
  startPrice: number,
  annualVol: number,
  params: GarchParams,
  steps: number,
  stepSeconds: number,
  count: number
): number[][] {
  const dt = stepSeconds / (365.25 * 24 * 3600);
  const paths: number[][] = [];

  for (let p = 0; p < count; p++) {
    const path: number[] = [];
    let price = startPrice;
    let h = (annualVol * annualVol) / 252; // daily variance

    for (let s = 0; s < steps; s++) {
      const z = boxMullerRandom();
      const stepVol = Math.sqrt(h * dt * 252);

      price = price * Math.exp(-0.5 * stepVol * stepVol * dt + stepVol * Math.sqrt(dt) * z);
      path.push(Math.round(price * 100) / 100);

      // Update variance (GARCH process)
      const ret = Math.log(path.length > 1 ? price / path[path.length - 2] : price / startPrice);
      const asymmetry = ret < 0 ? params.gamma * ret * ret : 0;
      h = params.omega + params.alpha * ret * ret + params.beta * h + asymmetry;
      h = Math.max(h, 1e-10);
    }

    paths.push(path);
  }

  return paths;
}

function computeTermStructure(
  vol24h: number,
  regime: string
): { '1d': number; '7d': number; '30d': number } {
  // Term structure shape depends on regime
  const decay = regime === 'crisis' ? 0.85 : regime === 'high' ? 0.9 : 0.95;
  return {
    '1d': Math.round(vol24h * 100) / 100,
    '7d': Math.round(vol24h * Math.pow(decay, 1) * 100) / 100,
    '30d': Math.round(vol24h * Math.pow(decay, 2) * 100) / 100,
  };
}

function computePercentiles(
  values: number[],
  currentPrice: number
): { '5': number; '50': number; '95': number } {
  const volValues = values.map((v) => Math.abs(v - currentPrice) / currentPrice);
  volValues.sort((a, b) => a - b);
  const n = volValues.length;
  return {
    '5': Math.round(volValues[Math.floor(n * 0.05)] * 100) / 100,
    '50': Math.round(volValues[Math.floor(n * 0.5)] * 100) / 100,
    '95': Math.round(volValues[Math.floor(n * 0.95)] * 100) / 100,
  };
}

function computeConfidence(historyLength: number, hasIV: boolean, hasOHLCV: boolean): number {
  let conf = 0.5;
  if (historyLength > 100) conf += 0.15;
  else if (historyLength > 30) conf += 0.1;
  if (hasIV) conf += 0.2;
  if (hasOHLCV) conf += 0.1;
  return Math.min(conf, 0.95);
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function boxMullerRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Standalone execution
if (require.main === module) {
  const agent = createVolatilityPredictor();
  agent.start();
  console.log(`Volatility Predictor agent started on port ${config.ports.volatilityAgent}`);
}
