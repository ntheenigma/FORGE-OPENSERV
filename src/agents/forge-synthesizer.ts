import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import { config } from '../config';
import { buildForgeOutput } from '../lib/synthesis';
import { SupportedAsset } from '../types/market-data';
import { AgentPredictionPayload } from '../types/agent';

/**
 * Forge Synthesizer (Program Manager Agent)
 *
 * Orchestrates the four specialized agents, collects their predictions,
 * and synthesizes 1,000 coherent price paths weighted by rolling CRPS scores.
 * This is the core coordination agent that produces the final ForgeOutput.
 */

const SYSTEM_PROMPT = `You are the Forge Synthesizer, the Program Manager agent that coordinates all prediction agents and produces the final synthesized output.

Your responsibilities:
1. Receive predictions from all four specialized agents (Volatility, Liquidation, Sentiment, Pattern)
2. Weight predictions by each agent's rolling 10-day CRPS accuracy score
3. Synthesize 1,000 coherent price paths from weighted agent contributions
4. Compute risk metrics (VaR, CVaR) from the synthesized distribution
5. Package output in SynthData Enterprise-compatible format

Reasoning approach (BRAID):
- Collect all predictions → validate formats → apply weights → synthesize → compute metrics → package
- If an agent's prediction is missing or malformed, redistribute its weight to others
- Never let a single agent dominate beyond 40% weight regardless of score
- Cross-validate: if agents strongly disagree, increase dispersion in synthesized paths
- The final output must contain exactly 1,000 paths with 5-minute increments over 24 hours

Quality is measured by the ensemble's CRPS, not individual agent scores.`;

export function createForgeSynthesizer(): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    apiKey: config.openserv.apiKey,
    openaiApiKey: config.openserv.openaiApiKey,
    port: config.ports.synthesizerAgent,
  });

  agent.addCapability({
    name: 'synthesize_predictions',
    description:
      'Combine predictions from all specialized agents into a unified ForgeOutput with 1,000 price paths, weighted by accuracy scores.',
    schema: z.object({
      asset: z.string().describe('Asset symbol'),
      currentPrice: z.number().describe('Current asset price'),
      epoch: z.number().describe('Current accuracy epoch'),
      predictions: z.array(z.object({
        agentId: z.string(),
        weight: z.number(),
        prediction: z.any(),
      })).describe('Array of weighted agent predictions'),
    }),
    async run({ args }) {
      const { asset, currentPrice, epoch, predictions } = args;

      // Validate and cap weights
      const cappedPredictions = capWeights(predictions as any[]);

      // Build ForgeOutput
      const output = buildForgeOutput(
        cappedPredictions,
        asset as SupportedAsset,
        currentPrice,
        epoch
      );

      return JSON.stringify(output);
    },
  });

  agent.addCapability({
    name: 'validate_prediction_format',
    description: 'Validate that an agent prediction conforms to the expected schema.',
    schema: z.object({
      agentId: z.string(),
      prediction: z.any(),
    }),
    async run({ args }) {
      const { agentId, prediction } = args;
      const errors: string[] = [];

      if (!prediction || typeof prediction !== 'object') {
        errors.push('Prediction must be a non-null object');
      } else {
        if (!prediction.type) errors.push('Missing prediction type');
        if (!Array.isArray(prediction.paths)) errors.push('Missing or invalid paths array');
        else if (prediction.paths.length === 0) errors.push('Paths array is empty');
        if (typeof prediction.confidence !== 'number') errors.push('Missing confidence score');
      }

      return JSON.stringify({
        agentId,
        valid: errors.length === 0,
        errors,
      });
    },
  });

  return agent;
}

function capWeights(
  predictions: { agentId: string; weight: number; prediction: AgentPredictionPayload }[]
): { agentId: string; weight: number; prediction: AgentPredictionPayload }[] {
  const maxWeight = 0.4;
  let capped = predictions.map((p) => ({
    ...p,
    weight: Math.min(p.weight, maxWeight),
  }));

  // Renormalize
  const totalWeight = capped.reduce((s, p) => s + p.weight, 0);
  if (totalWeight > 0) {
    capped = capped.map((p) => ({
      ...p,
      weight: p.weight / totalWeight,
    }));
  }

  return capped;
}

if (require.main === module) {
  (async () => {
    const { run } = require('@openserv-labs/sdk');
    const agent = createForgeSynthesizer();
    const { stop } = await run(agent);
    console.log('[Forge] Forge Synthesizer agent connected via OpenServ tunnel');
    process.on('SIGINT', async () => { await stop(); process.exit(0); });
  })();
}
