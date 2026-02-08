import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import { config } from '../config';
import { PatternPredictionPayload } from '../types/agent';

/**
 * Pattern Matcher Agent
 *
 * Identifies historical periods similar to current conditions across trend,
 * volatility, volume, and macro context. Extracts forward paths from top analogs.
 */

const SYSTEM_PROMPT = `You are the Forge Pattern Matcher, a specialized financial agent that finds historical analogs to current market conditions and extracts forward price paths.

Your responsibilities:
1. Characterize current market state: trend, volatility regime, volume profile, momentum
2. Search historical data for periods with similar characteristics
3. Rank analogs by multi-dimensional similarity score
4. Extract forward paths from the top 3 historical analogs
5. Generate 250 price paths by sampling and interpolating from analog forward returns

Reasoning approach (BRAID):
- Characterize current state → define similarity metrics → search history → rank → extract paths
- Similarity metrics: trend direction, realized vol, volume ratio, momentum, drawdown depth
- Weight recent analogs slightly higher (regime persistence)
- Never rely on a single analog—blend top 3 to avoid overfitting
- If no strong analog exists (similarity < 0.5), increase path dispersion

This is pattern recognition, not prediction. Extract what markets did in similar conditions.`;

export function createPatternMatcher(): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    apiKey: config.openserv.apiKey,
    openaiApiKey: config.openserv.openaiApiKey,
    port: config.ports.patternAgent,
  });

  agent.addCapability({
    name: 'match_patterns',
    description:
      'Identify historical analogs to current market conditions and generate price paths based on how markets behaved in similar situations.',
    schema: z.object({
      asset: z.string().describe('Asset symbol'),
      currentPrice: z.number().describe('Current asset price'),
      priceHistory: z
        .array(z.object({ timestamp: z.number(), price: z.number() }))
        .describe('Historical price points (ideally 500+ for analog search)'),
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
        .describe('OHLCV data for volume analysis'),
      horizonSeconds: z.number().default(86400).describe('Forecast horizon'),
    }),
    async run({ args }) {
      const { currentPrice, priceHistory, ohlcv, horizonSeconds } = args;

      const prices = priceHistory.map((p) => p.price);
      if (prices.length < 30) {
        return JSON.stringify(buildFallbackPrediction(currentPrice, horizonSeconds));
      }

      // Characterize current market state
      const currentState = characterizeState(prices, ohlcv?.map((b) => b.volume));

      // Find historical analogs within the price history
      const analogs = findAnalogs(prices, currentState, ohlcv?.map((b) => b.volume));

      // Extract forward paths from top analogs
      const topAnalogs = analogs.slice(0, 3);

      // Build composite forward path
      const compositeForward = buildCompositeForward(topAnalogs, prices);

      // Generate 250 paths by sampling around analog forward returns
      const pathCount = 250;
      const stepSeconds = config.forge.timeIncrementSeconds;
      const steps = Math.floor(horizonSeconds / stepSeconds);
      const paths = generateAnalogPaths(
        currentPrice,
        topAnalogs,
        prices,
        steps,
        pathCount
      );

      const avgSimilarity = topAnalogs.length > 0
        ? topAnalogs.reduce((s, a) => s + a.similarity, 0) / topAnalogs.length
        : 0;

      const prediction: PatternPredictionPayload = {
        type: 'pattern',
        topAnalogs: topAnalogs.map((a) => ({
          period: `index_${a.startIndex}-${a.endIndex}`,
          similarity: Math.round(a.similarity * 100) / 100,
          forwardReturn: Math.round(a.forwardReturn * 10000) / 10000,
        })),
        compositeForwardPath: compositeForward.map((p) => Math.round(p * 100) / 100),
        paths,
        confidence: Math.min(0.95, avgSimilarity * 0.8 + (prices.length > 200 ? 0.15 : 0)),
      };

      return JSON.stringify(prediction);
    },
  });

  return agent;
}

// --- Pattern matching helpers ---

interface MarketState {
  trend: number;        // -1 to 1
  realizedVol: number;  // annualized
  momentum: number;     // rate of change
  volumeProfile: number; // relative volume
  drawdown: number;     // from recent high
}

interface AnalogMatch {
  startIndex: number;
  endIndex: number;
  similarity: number;
  forwardReturn: number;
  forwardReturns: number[]; // step-by-step returns after analog period
}

function characterizeState(prices: number[], volumes?: number[]): MarketState {
  const n = prices.length;
  const lookback = Math.min(20, n - 1);
  const recent = prices.slice(-lookback);

  // Trend: linear regression slope normalized
  const trend = computeTrend(recent);

  // Realized vol
  const returns = computeReturns(recent);
  const realizedVol = stdDev(returns) * Math.sqrt(252);

  // Momentum: rate of change over lookback
  const momentum = (recent[recent.length - 1] - recent[0]) / recent[0];

  // Volume profile
  let volumeProfile = 1.0;
  if (volumes && volumes.length >= lookback) {
    const recentVol = volumes.slice(-lookback);
    const olderVol = volumes.slice(-lookback * 2, -lookback);
    if (olderVol.length > 0) {
      const avgRecent = recentVol.reduce((s, v) => s + v, 0) / recentVol.length;
      const avgOlder = olderVol.reduce((s, v) => s + v, 0) / olderVol.length;
      volumeProfile = avgOlder > 0 ? avgRecent / avgOlder : 1.0;
    }
  }

  // Drawdown from recent high
  const recentHigh = Math.max(...prices.slice(-60));
  const drawdown = (prices[n - 1] - recentHigh) / recentHigh;

  return { trend, realizedVol, momentum, volumeProfile, drawdown };
}

function findAnalogs(
  prices: number[],
  currentState: MarketState,
  volumes?: number[]
): AnalogMatch[] {
  const windowSize = 20;
  const forwardSteps = 30;
  const matches: AnalogMatch[] = [];

  // Slide window through history, comparing each window to current state
  for (let i = windowSize; i < prices.length - forwardSteps - windowSize; i++) {
    const windowPrices = prices.slice(i - windowSize, i);
    const windowVolumes = volumes?.slice(i - windowSize, i);
    const histState = characterizeState(windowPrices, windowVolumes);

    const similarity = computeSimilarity(currentState, histState);

    if (similarity > 0.4) {
      // Extract forward returns after this analog period
      const forwardPrices = prices.slice(i, i + forwardSteps);
      const forwardReturns = computeReturns(forwardPrices);
      const forwardReturn = forwardPrices.length > 1
        ? (forwardPrices[forwardPrices.length - 1] - forwardPrices[0]) / forwardPrices[0]
        : 0;

      matches.push({
        startIndex: i - windowSize,
        endIndex: i,
        similarity,
        forwardReturn,
        forwardReturns,
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  // Deduplicate overlapping windows
  const deduped: AnalogMatch[] = [];
  for (const match of matches) {
    const overlaps = deduped.some(
      (d) => Math.abs(d.startIndex - match.startIndex) < windowSize
    );
    if (!overlaps) {
      deduped.push(match);
    }
    if (deduped.length >= 5) break;
  }

  return deduped;
}

function computeSimilarity(a: MarketState, b: MarketState): number {
  const trendDiff = Math.abs(a.trend - b.trend) / 2;
  const volDiff = Math.abs(a.realizedVol - b.realizedVol) / Math.max(a.realizedVol, b.realizedVol, 0.01);
  const momDiff = Math.abs(a.momentum - b.momentum) / Math.max(Math.abs(a.momentum), Math.abs(b.momentum), 0.01);
  const volProfileDiff = Math.abs(a.volumeProfile - b.volumeProfile) / Math.max(a.volumeProfile, b.volumeProfile, 0.01);
  const ddDiff = Math.abs(a.drawdown - b.drawdown) / Math.max(Math.abs(a.drawdown), Math.abs(b.drawdown), 0.01);

  const weights = { trend: 0.25, vol: 0.25, mom: 0.2, volProfile: 0.15, dd: 0.15 };
  const distance =
    weights.trend * trendDiff +
    weights.vol * volDiff +
    weights.mom * momDiff +
    weights.volProfile * volProfileDiff +
    weights.dd * ddDiff;

  return Math.max(0, 1 - distance);
}

function buildCompositeForward(analogs: AnalogMatch[], _prices: number[]): number[] {
  if (analogs.length === 0) return [];

  const maxLen = Math.max(...analogs.map((a) => a.forwardReturns.length));
  const composite: number[] = [];
  const totalSimilarity = analogs.reduce((s, a) => s + a.similarity, 0);

  for (let i = 0; i < maxLen; i++) {
    let weightedReturn = 0;
    let weight = 0;
    for (const analog of analogs) {
      if (i < analog.forwardReturns.length) {
        weightedReturn += analog.forwardReturns[i] * analog.similarity;
        weight += analog.similarity;
      }
    }
    composite.push(weight > 0 ? weightedReturn / weight : 0);
  }

  return composite;
}

function generateAnalogPaths(
  startPrice: number,
  analogs: AnalogMatch[],
  _prices: number[],
  steps: number,
  count: number
): number[][] {
  const paths: number[][] = [];

  if (analogs.length === 0) {
    // Fallback to random walk
    for (let p = 0; p < count; p++) {
      paths.push(generateRandomWalk(startPrice, steps, 0.5));
    }
    return paths;
  }

  // Allocate paths per analog based on similarity weight
  const totalSim = analogs.reduce((s, a) => s + a.similarity, 0);

  for (const analog of analogs) {
    const allocation = Math.round((analog.similarity / totalSim) * count);

    for (let p = 0; p < allocation && paths.length < count; p++) {
      const path: number[] = [];
      let price = startPrice;

      for (let s = 0; s < steps; s++) {
        // Base return from analog
        const analogReturn = s < analog.forwardReturns.length
          ? analog.forwardReturns[s]
          : 0;

        // Add noise proportional to inverse similarity
        const noise = boxMullerRandom() * 0.01 * (1 - analog.similarity + 0.2);
        const stepReturn = analogReturn + noise;

        price = price * (1 + stepReturn);
        path.push(Math.round(price * 100) / 100);
      }

      paths.push(path);
    }
  }

  // Fill remaining with dispersed random walks
  while (paths.length < count) {
    paths.push(generateRandomWalk(startPrice, steps, 0.6));
  }

  return paths.slice(0, count);
}

function generateRandomWalk(startPrice: number, steps: number, vol: number): number[] {
  const dt = config.forge.timeIncrementSeconds / (365.25 * 24 * 3600);
  const path: number[] = [];
  let price = startPrice;

  for (let s = 0; s < steps; s++) {
    const z = boxMullerRandom();
    price = price * Math.exp(-0.5 * vol * vol * dt + vol * Math.sqrt(dt) * z);
    path.push(Math.round(price * 100) / 100);
  }

  return path;
}

function buildFallbackPrediction(currentPrice: number, horizonSeconds: number): PatternPredictionPayload {
  const steps = Math.floor(horizonSeconds / config.forge.timeIncrementSeconds);
  const paths: number[][] = [];
  for (let i = 0; i < 250; i++) {
    paths.push(generateRandomWalk(currentPrice, steps, 0.5));
  }

  return {
    type: 'pattern',
    topAnalogs: [],
    compositeForwardPath: [],
    paths,
    confidence: 0.2,
  };
}

function computeTrend(prices: number[]): number {
  const n = prices.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += prices[i];
    sumXY += i * prices[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgPrice = sumY / n;

  // Normalize to -1..1 range
  return Math.tanh((slope / avgPrice) * n);
}

function computeReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

function stdDev(values: number[]): number {
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

if (require.main === module) {
  (async () => {
    const { run } = require('@openserv-labs/sdk');
    const agent = createPatternMatcher();
    const { stop } = await run(agent);
    console.log('[Forge] Pattern Matcher agent connected via OpenServ tunnel');
    process.on('SIGINT', async () => { await stop(); process.exit(0); });
  })();
}
