import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import { config } from '../config';
import { SentimentPredictionPayload } from '../types/agent';

/**
 * Sentiment Tracker Agent
 *
 * Extracts market narrative from Twitter/X, funding velocity, options flow,
 * and news sentiment. Detects acceleration/deceleration and price-sentiment divergences.
 */

const SYSTEM_PROMPT = `You are the Forge Sentiment Tracker, a specialized financial agent that quantifies market sentiment and its impact on price dynamics.

Your responsibilities:
1. Aggregate sentiment signals from social media, funding velocity, and options flow
2. Quantify overall sentiment on a -1 (extreme fear) to +1 (extreme greed) scale
3. Detect sentiment momentum: is sentiment accelerating or decelerating?
4. Identify price-sentiment divergences (bullish price + bearish sentiment = warning)
5. Generate 250 simulated price paths reflecting sentiment-driven dynamics

Reasoning approach (BRAID):
- Collect signals → normalize → detect momentum → check divergence → simulate
- Extreme sentiment readings (>0.8 or <-0.8) often precede reversals
- Funding velocity acceleration is a leading indicator of liquidation cascades
- Price-sentiment divergence is the highest-conviction signal
- Narratives shift before price—detect narrative acceleration

Focus on what the crowd is doing and the mechanical effects of crowded positioning.`;

export function createSentimentTracker(): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    apiKey: config.openserv.apiKey,
    openaiApiKey: config.openserv.openaiApiKey,
    port: config.ports.sentimentAgent,
  });

  agent.addCapability({
    name: 'track_sentiment',
    description:
      'Analyze social sentiment, funding velocity, and options flow to generate sentiment-weighted price paths.',
    schema: z.object({
      asset: z.string().describe('Asset symbol'),
      currentPrice: z.number().describe('Current asset price'),
      socialSentiment: z
        .object({
          score: z.number().min(-1).max(1).describe('Aggregated sentiment score'),
          volume: z.number().describe('Social mention volume'),
          momentum: z.number().describe('Change in sentiment over last period'),
        })
        .optional()
        .describe('Social media sentiment data'),
      fundingRate: z.number().optional().describe('Current funding rate'),
      fundingRateHistory: z
        .array(z.object({ timestamp: z.number(), rate: z.number() }))
        .optional()
        .describe('Historical funding rates'),
      optionsFlow: z
        .object({
          putCallRatio: z.number().describe('Put/call volume ratio'),
          netGamma: z.number().describe('Dealers net gamma exposure'),
        })
        .optional()
        .describe('Options flow data'),
      priceReturns24h: z.number().optional().describe('24h price return percentage'),
      horizonSeconds: z.number().default(86400).describe('Forecast horizon'),
    }),
    async run({ args }) {
      const {
        currentPrice,
        socialSentiment,
        fundingRate,
        fundingRateHistory,
        optionsFlow,
        priceReturns24h,
        horizonSeconds,
      } = args;

      // Compute composite sentiment score
      const composite = computeCompositeSentiment(
        socialSentiment,
        fundingRate,
        optionsFlow
      );

      // Compute sentiment momentum (velocity of sentiment change)
      const momentum = computeMomentum(
        socialSentiment?.momentum ?? 0,
        fundingRateHistory ?? []
      );

      // Detect price-sentiment divergence
      const divergence = detectDivergence(composite, priceReturns24h ?? 0);

      // Detect narrative shift
      const narrativeShift = Math.abs(momentum) > 0.3 || Math.abs(divergence) > 0.5;

      // Generate 250 sentiment-influenced paths
      const pathCount = 250;
      const stepSeconds = config.forge.timeIncrementSeconds;
      const steps = Math.floor(horizonSeconds / stepSeconds);
      const paths = generateSentimentPaths(
        currentPrice,
        steps,
        stepSeconds,
        pathCount,
        composite,
        momentum,
        divergence
      );

      const confidence = computeConfidence(
        !!socialSentiment,
        !!fundingRate,
        !!optionsFlow,
        !!fundingRateHistory?.length
      );

      const prediction: SentimentPredictionPayload = {
        type: 'sentiment',
        overallSentiment: Math.round(composite * 100) / 100,
        sentimentMomentum: Math.round(momentum * 100) / 100,
        divergenceFromPrice: Math.round(divergence * 100) / 100,
        narrativeShift,
        paths,
        confidence,
      };

      return JSON.stringify(prediction);
    },
  });

  return agent;
}

// --- Sentiment analysis helpers ---

function computeCompositeSentiment(
  social: { score: number; volume: number; momentum: number } | undefined,
  fundingRate: number | undefined,
  optionsFlow: { putCallRatio: number; netGamma: number } | undefined
): number {
  const signals: { value: number; weight: number }[] = [];

  // Social sentiment (direct)
  if (social) {
    const volumeWeight = Math.min(social.volume / 10000, 1); // More volume = more reliable
    signals.push({ value: social.score, weight: 0.35 * (0.5 + 0.5 * volumeWeight) });
  }

  // Funding rate as sentiment proxy (-1 to 1 mapping)
  if (fundingRate !== undefined) {
    const fundingSentiment = Math.tanh(fundingRate * 500);
    signals.push({ value: fundingSentiment, weight: 0.3 });
  }

  // Options flow: low put/call = bullish, high = bearish
  if (optionsFlow) {
    const pcSignal = -(optionsFlow.putCallRatio - 1); // P/C < 1 → positive
    const gammaSignal = Math.tanh(optionsFlow.netGamma / 1e9);
    signals.push({ value: pcSignal * 0.6 + gammaSignal * 0.4, weight: 0.25 });
  }

  if (signals.length === 0) return 0;

  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  const composite = signals.reduce((s, sig) => s + sig.value * sig.weight, 0) / totalWeight;

  return Math.max(-1, Math.min(1, composite));
}

function computeMomentum(
  socialMomentum: number,
  fundingHistory: { timestamp: number; rate: number }[]
): number {
  let momentum = socialMomentum * 0.5;

  // Funding rate velocity
  if (fundingHistory.length >= 2) {
    const sorted = [...fundingHistory].sort((a, b) => a.timestamp - b.timestamp);
    const recent = sorted.slice(-5);
    if (recent.length >= 2) {
      const first = recent[0].rate;
      const last = recent[recent.length - 1].rate;
      const fundingVelocity = Math.tanh((last - first) * 1000);
      momentum += fundingVelocity * 0.5;
    }
  }

  return Math.max(-1, Math.min(1, momentum));
}

function detectDivergence(sentiment: number, priceReturn: number): number {
  // Normalize price return to -1..1 range
  const normalizedReturn = Math.tanh(priceReturn / 10);

  // Divergence = when sentiment and price disagree
  return normalizedReturn - sentiment;
}

function generateSentimentPaths(
  startPrice: number,
  steps: number,
  stepSeconds: number,
  count: number,
  sentiment: number,
  momentum: number,
  divergence: number
): number[][] {
  const dt = stepSeconds / (365.25 * 24 * 3600);
  const baseVol = 0.5;
  const paths: number[][] = [];

  for (let p = 0; p < count; p++) {
    const path: number[] = [];
    let price = startPrice;
    let currentSentiment = sentiment;

    for (let s = 0; s < steps; s++) {
      const z = boxMullerRandom();

      // Sentiment drift: positive sentiment → slight upward drift
      const sentimentDrift = currentSentiment * 0.0002;

      // Divergence creates mean-reversion pressure
      const divergencePressure = -divergence * 0.0001;

      // Extreme sentiment increases vol (crowded trades unwind violently)
      const sentimentVol = baseVol * (1 + Math.abs(currentSentiment) * 0.3);

      const totalDrift = sentimentDrift + divergencePressure;
      price = price * Math.exp(
        totalDrift - 0.5 * sentimentVol * sentimentVol * dt +
        sentimentVol * Math.sqrt(dt) * z
      );

      path.push(Math.round(price * 100) / 100);

      // Sentiment evolves with momentum
      currentSentiment += momentum * 0.001 * (Math.random() - 0.3);
      currentSentiment = Math.max(-1, Math.min(1, currentSentiment));
    }

    paths.push(path);
  }

  return paths;
}

function computeConfidence(
  hasSocial: boolean,
  hasFunding: boolean,
  hasOptions: boolean,
  hasFundingHistory: boolean
): number {
  let conf = 0.3;
  if (hasSocial) conf += 0.25;
  if (hasFunding) conf += 0.15;
  if (hasOptions) conf += 0.2;
  if (hasFundingHistory) conf += 0.1;
  return Math.min(conf, 0.95);
}

function boxMullerRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

if (require.main === module) {
  const agent = createSentimentTracker();
  agent.start();
  console.log(`Sentiment Tracker agent started on port ${config.ports.sentimentAgent}`);
}
