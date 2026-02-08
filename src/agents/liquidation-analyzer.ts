import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import { config } from '../config';
import { LiquidationPredictionPayload } from '../types/agent';

/**
 * Liquidation Analyzer Agent
 *
 * Processes open interest distribution, funding direction, and liquidation history.
 * Models cascade mechanics—how liquidations trigger further liquidations.
 * Generates 250 simulated price paths reflecting liquidation-driven scenarios.
 */

const SYSTEM_PROMPT = `You are the Forge Liquidation Analyzer, a specialized financial agent that models liquidation cascades in derivatives markets.

Your responsibilities:
1. Map the distribution of leveraged positions across price levels
2. Identify critical liquidation clusters where cascades are likely
3. Model cascade mechanics: initial liquidation → forced selling → price impact → further liquidations
4. Generate 250 price paths incorporating liquidation cascade dynamics
5. Quantify cascade risk with a 0-1 score

Reasoning approach (BRAID):
- Map position distribution → identify clusters → model cascade triggers → simulate paths
- High funding rates indicate directional crowding (cascade risk)
- Large OI concentration at specific levels = cascade triggers
- Recent liquidation history reveals current market fragility
- Asymmetric cascades: long cascades accelerate on down moves, short squeezes on up moves

Focus on the mechanical price impact of forced liquidations, not sentiment.`;

export function createLiquidationAnalyzer(): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    apiKey: config.openserv.apiKey,
    openaiApiKey: config.openserv.openaiApiKey,
    port: config.ports.liquidationAgent,
  });

  agent.addCapability({
    name: 'analyze_liquidations',
    description:
      'Analyze open interest, funding, and liquidation data to model cascade mechanics and generate liquidation-aware price paths.',
    schema: z.object({
      asset: z.string().describe('Asset symbol'),
      currentPrice: z.number().describe('Current asset price'),
      openInterest: z.number().optional().describe('Total open interest in USD'),
      longRatio: z.number().optional().describe('Long ratio (0-1)'),
      shortRatio: z.number().optional().describe('Short ratio (0-1)'),
      fundingRate: z.number().optional().describe('Current funding rate'),
      liquidationLevels: z
        .array(
          z.object({
            price: z.number(),
            cumulativeSize: z.number(),
            side: z.enum(['long', 'short']),
          })
        )
        .optional()
        .describe('Known liquidation levels'),
      recentLiquidations: z
        .array(
          z.object({
            timestamp: z.number(),
            side: z.enum(['long', 'short']),
            price: z.number(),
            quantity: z.number(),
          })
        )
        .optional()
        .describe('Recent liquidation events'),
      horizonSeconds: z.number().default(86400).describe('Forecast horizon'),
    }),
    async run({ args }) {
      const {
        currentPrice,
        openInterest,
        longRatio,
        shortRatio,
        fundingRate,
        liquidationLevels,
        recentLiquidations,
        horizonSeconds,
      } = args;

      // Analyze position imbalance
      const imbalance = computePositionImbalance(longRatio ?? 0.5, shortRatio ?? 0.5, fundingRate ?? 0);

      // Find cascade trigger prices
      const longCascade = findCascadePrice(currentPrice, liquidationLevels ?? [], 'long');
      const shortCascade = findCascadePrice(currentPrice, liquidationLevels ?? [], 'short');

      // Compute cascade risk score
      const cascadeRisk = computeCascadeRisk(
        currentPrice,
        longCascade,
        shortCascade,
        openInterest ?? 0,
        imbalance,
        recentLiquidations ?? []
      );

      // Build liquidation heatmap
      const heatmap = buildHeatmap(currentPrice, liquidationLevels ?? []);

      // Generate 250 paths incorporating cascade dynamics
      const pathCount = 250;
      const stepSeconds = config.forge.timeIncrementSeconds;
      const steps = Math.floor(horizonSeconds / stepSeconds);
      const paths = generateCascadePaths(
        currentPrice,
        steps,
        stepSeconds,
        pathCount,
        longCascade,
        shortCascade,
        cascadeRisk,
        imbalance
      );

      const prediction: LiquidationPredictionPayload = {
        type: 'liquidation',
        longCascadePrice: Math.round(longCascade * 100) / 100,
        shortCascadePrice: Math.round(shortCascade * 100) / 100,
        cascadeRiskScore: Math.round(cascadeRisk * 100) / 100,
        liquidationHeatmap: heatmap,
        paths,
        confidence: computeConfidence(!!liquidationLevels?.length, !!openInterest, !!recentLiquidations?.length),
      };

      return JSON.stringify(prediction);
    },
  });

  return agent;
}

// --- Liquidation analysis helpers ---

function computePositionImbalance(longRatio: number, shortRatio: number, fundingRate: number): number {
  // Imbalance from -1 (extreme short) to +1 (extreme long)
  const ratioImbalance = longRatio - shortRatio;
  const fundingSignal = Math.tanh(fundingRate * 1000); // normalize funding
  return 0.7 * ratioImbalance + 0.3 * fundingSignal;
}

function findCascadePrice(
  currentPrice: number,
  levels: { price: number; cumulativeSize: number; side: string }[],
  side: 'long' | 'short'
): number {
  const sideLevels = levels
    .filter((l) => l.side === side)
    .sort((a, b) => (side === 'long' ? a.price - b.price : b.price - a.price));

  if (sideLevels.length === 0) {
    // Estimate from current price
    const defaultPct = side === 'long' ? 0.12 : 0.12;
    return side === 'long'
      ? currentPrice * (1 - defaultPct)
      : currentPrice * (1 + defaultPct);
  }

  // Find the densest cluster of liquidation levels
  let maxDensity = 0;
  let cascadePrice = sideLevels[0].price;

  for (let i = 0; i < sideLevels.length; i++) {
    let clusterSize = 0;
    for (let j = i; j < sideLevels.length; j++) {
      if (Math.abs(sideLevels[j].price - sideLevels[i].price) / currentPrice < 0.02) {
        clusterSize += sideLevels[j].cumulativeSize;
      }
    }
    if (clusterSize > maxDensity) {
      maxDensity = clusterSize;
      cascadePrice = sideLevels[i].price;
    }
  }

  return cascadePrice;
}

function computeCascadeRisk(
  currentPrice: number,
  longCascade: number,
  shortCascade: number,
  openInterest: number,
  imbalance: number,
  recentLiquidations: { quantity: number }[]
): number {
  let risk = 0;

  // Proximity to cascade levels (closer = higher risk)
  const longProximity = Math.abs(currentPrice - longCascade) / currentPrice;
  const shortProximity = Math.abs(currentPrice - shortCascade) / currentPrice;
  const minProximity = Math.min(longProximity, shortProximity);

  if (minProximity < 0.03) risk += 0.4;
  else if (minProximity < 0.05) risk += 0.25;
  else if (minProximity < 0.1) risk += 0.1;

  // Position imbalance amplifies cascade risk
  risk += Math.abs(imbalance) * 0.3;

  // Recent liquidation activity indicates fragility
  const recentLiqVolume = recentLiquidations.reduce((s, l) => s + l.quantity, 0);
  if (recentLiqVolume > 0) {
    risk += Math.min(0.2, recentLiqVolume / (openInterest || 1e9));
  }

  return Math.min(risk, 1.0);
}

function buildHeatmap(
  currentPrice: number,
  levels: { price: number; cumulativeSize: number; side: string }[]
): { price: number; size: number; side: 'long' | 'short' }[] {
  if (levels.length === 0) {
    // Generate synthetic heatmap based on typical distribution
    const heatmap: { price: number; size: number; side: 'long' | 'short' }[] = [];
    for (let pct = -15; pct <= 15; pct += 1) {
      if (pct === 0) continue;
      const price = currentPrice * (1 + pct / 100);
      const size = Math.exp(-Math.abs(pct) / 5) * 1e6;
      heatmap.push({
        price: Math.round(price * 100) / 100,
        size: Math.round(size),
        side: pct < 0 ? 'long' : 'short',
      });
    }
    return heatmap;
  }

  return levels.map((l) => ({
    price: l.price,
    size: l.cumulativeSize,
    side: l.side as 'long' | 'short',
  }));
}

function generateCascadePaths(
  startPrice: number,
  steps: number,
  stepSeconds: number,
  count: number,
  longCascade: number,
  shortCascade: number,
  cascadeRisk: number,
  imbalance: number
): number[][] {
  const dt = stepSeconds / (365.25 * 24 * 3600);
  const baseVol = 0.5; // annualized
  const paths: number[][] = [];

  for (let p = 0; p < count; p++) {
    const path: number[] = [];
    let price = startPrice;
    let inCascade = false;
    let cascadeDirection = 0;

    for (let s = 0; s < steps; s++) {
      const z = boxMullerRandom();
      let vol = baseVol;

      // Check cascade trigger
      if (!inCascade) {
        if (price <= longCascade * 1.01 && Math.random() < cascadeRisk * 0.5) {
          inCascade = true;
          cascadeDirection = -1; // long liquidations push price down
        } else if (price >= shortCascade * 0.99 && Math.random() < cascadeRisk * 0.5) {
          inCascade = true;
          cascadeDirection = 1; // short squeeze pushes price up
        }
      }

      // Cascade dynamics: increased vol + directional drift
      if (inCascade) {
        vol *= 2.5;
        const cascadeDrift = cascadeDirection * 0.002;
        price = price * Math.exp(cascadeDrift + vol * Math.sqrt(dt) * z);

        // Cascade dissipates probabilistically
        if (Math.random() < 0.1) inCascade = false;
      } else {
        // Normal dynamics with slight imbalance drift
        const drift = imbalance * 0.0001;
        price = price * Math.exp(drift - 0.5 * vol * vol * dt + vol * Math.sqrt(dt) * z);
      }

      path.push(Math.round(price * 100) / 100);
    }

    paths.push(path);
  }

  return paths;
}

function computeConfidence(hasLevels: boolean, hasOI: boolean, hasRecentLiqs: boolean): number {
  let conf = 0.4;
  if (hasLevels) conf += 0.25;
  if (hasOI) conf += 0.15;
  if (hasRecentLiqs) conf += 0.15;
  return Math.min(conf, 0.95);
}

function boxMullerRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

if (require.main === module) {
  const agent = createLiquidationAnalyzer();
  agent.start();
  console.log(`Liquidation Analyzer agent started on port ${config.ports.liquidationAgent}`);
}
