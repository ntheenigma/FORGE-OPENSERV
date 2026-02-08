import 'dotenv/config';
import { CronJob } from 'cron';
import { config } from './config';
import {
  createVolatilityPredictor,
  createLiquidationAnalyzer,
  createSentimentTracker,
  createPatternMatcher,
  createForgeSynthesizer,
} from './agents';
import { runIngestion } from './workflows/data-ingestion';
import { runPredictionGeneration } from './workflows/prediction-generation';
import { calculateDistribution, executeDistribution } from './workflows/reward-distribution';
import { getActiveAgents } from './registry/agent-registry';
import { createApiServer } from './api/server';
import { SUPPORTED_ASSETS, SupportedAsset } from './types/market-data';
import { AgentPredictionPayload } from './types/agent';

/**
 * Forge Platform - Main Entry Point
 *
 * Orchestrates all components:
 *   1. Starts all 5 OpenServ agents (4 predictors + 1 synthesizer)
 *   2. Starts the API server for data consumers
 *   3. Schedules cron workflows:
 *      - Data ingestion every 30 minutes
 *      - Prediction generation after each ingestion
 *      - Reward distribution weekly (Sundays 00:00 UTC)
 */

let epoch = 0;

async function main(): Promise<void> {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║           FORGE v${config.forge.version}                    ║
  ║   Multi-Agent Synthetic Data Platform     ║
  ║        Built on OpenServ                  ║
  ╚═══════════════════════════════════════════╝
  `);

  // --- Phase 1: Start OpenServ agents ---
  console.log('[Forge] Starting OpenServ agents...');

  const volatilityAgent = createVolatilityPredictor();
  const liquidationAgent = createLiquidationAnalyzer();
  const sentimentAgent = createSentimentTracker();
  const patternAgent = createPatternMatcher();
  const synthesizerAgent = createForgeSynthesizer();

  // Start all agents (each on its own port)
  await Promise.all([
    volatilityAgent.start(),
    liquidationAgent.start(),
    sentimentAgent.start(),
    patternAgent.start(),
    synthesizerAgent.start(),
  ]);

  console.log('[Forge] All agents started:');
  console.log(`  - Volatility Predictor  :${config.ports.volatilityAgent}`);
  console.log(`  - Liquidation Analyzer  :${config.ports.liquidationAgent}`);
  console.log(`  - Sentiment Tracker     :${config.ports.sentimentAgent}`);
  console.log(`  - Pattern Matcher       :${config.ports.patternAgent}`);
  console.log(`  - Forge Synthesizer     :${config.ports.synthesizerAgent}`);

  // --- Phase 2: Start API server ---
  const apiApp = createApiServer();
  apiApp.listen(config.ports.apiServer, () => {
    console.log(`[Forge] API server running on :${config.ports.apiServer}`);
  });

  // --- Phase 3: Schedule cron workflows ---

  // Data ingestion: every 30 minutes
  const ingestionJob = new CronJob(
    `*/${config.forge.ingestionIntervalMinutes} * * * *`,
    async () => {
      console.log(`[Forge] Running data ingestion cycle...`);
      try {
        const result = await runIngestion();
        const assets = Array.from(result.bundles.keys());
        console.log(`[Forge] Ingestion complete: ${assets.length} assets, ${result.errors.length} errors`);

        // Trigger prediction generation for each asset
        for (const asset of assets) {
          try {
            epoch++;
            const output = await runPredictionGeneration(
              asset as SupportedAsset,
              epoch,
              localAgentInvoker
            );
            console.log(`[Forge] Prediction generated for ${asset}, epoch ${epoch}, ${output.simulations.count} paths`);
          } catch (err: any) {
            console.error(`[Forge] Prediction failed for ${asset}: ${err.message}`);
          }
        }
      } catch (err: any) {
        console.error(`[Forge] Ingestion failed: ${err.message}`);
      }
    },
    null,
    false,
    'UTC'
  );

  // Reward distribution: Sundays at 00:00 UTC
  const rewardJob = new CronJob(
    config.forge.rewardDistributionCron,
    async () => {
      console.log('[Forge] Running weekly reward distribution...');
      try {
        const active = getActiveAgents();
        if (active.length === 0) {
          console.log('[Forge] No active agents for reward distribution');
          return;
        }

        // Calculate weekly revenue (placeholder — in production, from subscription tracking)
        const weeklyRevenueUsd = 5000; // Example
        const distribution = calculateDistribution(active, weeklyRevenueUsd, epoch);
        const result = await executeDistribution(distribution);
        console.log(`[Forge] Rewards distributed: $${distribution.totalPoolUsd} across ${distribution.distributions.length} agents`);
      } catch (err: any) {
        console.error(`[Forge] Reward distribution failed: ${err.message}`);
      }
    },
    null,
    false,
    'UTC'
  );

  ingestionJob.start();
  rewardJob.start();

  console.log('[Forge] Cron workflows scheduled:');
  console.log(`  - Ingestion:  every ${config.forge.ingestionIntervalMinutes} min`);
  console.log(`  - Rewards:    ${config.forge.rewardDistributionCron} (weekly)`);
  console.log('[Forge] Platform ready.\n');
}

/**
 * Local agent invoker — calls agent capabilities directly in-process.
 * In production on OpenServ, this is replaced by workflow orchestration
 * calling agents via their registered endpoints.
 */
async function localAgentInvoker(
  agentId: string,
  capability: string,
  input: Record<string, any>
): Promise<AgentPredictionPayload> {
  // For local execution, we invoke the capability functions directly.
  // In OpenServ production deployment, each agent runs as a separate service
  // and the workflow builder handles invocation via HTTP endpoints.

  // Import capability runners dynamically based on agent ID
  const { createVolatilityPredictor } = require('./agents/volatility-predictor');
  const { createLiquidationAnalyzer } = require('./agents/liquidation-analyzer');
  const { createSentimentTracker } = require('./agents/sentiment-tracker');
  const { createPatternMatcher } = require('./agents/pattern-matcher');

  // Map agent IDs to their capability functions
  const capabilityMap: Record<string, () => any> = {
    'volatility-predictor': () => {
      const agent = createVolatilityPredictor();
      const cap = agent.tools?.find((t: any) => t.name === capability);
      return cap;
    },
    'liquidation-analyzer': () => {
      const agent = createLiquidationAnalyzer();
      const cap = agent.tools?.find((t: any) => t.name === capability);
      return cap;
    },
    'sentiment-tracker': () => {
      const agent = createSentimentTracker();
      const cap = agent.tools?.find((t: any) => t.name === capability);
      return cap;
    },
    'pattern-matcher': () => {
      const agent = createPatternMatcher();
      const cap = agent.tools?.find((t: any) => t.name === capability);
      return cap;
    },
  };

  const factory = capabilityMap[agentId];
  if (!factory) {
    throw new Error(`Unknown agent: ${agentId}`);
  }

  const cap = factory();
  if (!cap) {
    throw new Error(`Capability ${capability} not found on agent ${agentId}`);
  }

  const result = await cap.run({ args: input }, []);
  return JSON.parse(result);
}

main().catch((err) => {
  console.error('[Forge] Fatal error:', err);
  process.exit(1);
});
