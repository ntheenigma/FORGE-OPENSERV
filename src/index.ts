import 'dotenv/config';
import { run } from '@openserv-labs/sdk';
import { config } from './config';
import {
  createVolatilityPredictor,
  createLiquidationAnalyzer,
  createSentimentTracker,
  createPatternMatcher,
  createForgeSynthesizer,
} from './agents';

/**
 * Forge Platform — Single-Service Entry Point for OpenServ
 *
 * This process starts all 5 agents and tunnels each one into OpenServ
 * via the SDK's run() function. OpenServ then handles:
 *   - Workflow orchestration (ingestion, prediction, validation, rewards)
 *   - Cron scheduling
 *   - Agent-to-agent communication
 *   - API serving to the frontend URL
 *   - x402 payment distribution
 *
 * Deploy this single service to Railway. OpenServ does everything else.
 */

const stopHandlers: (() => Promise<void>)[] = [];

async function main(): Promise<void> {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║           FORGE v${config.forge.version}                    ║
  ║   Multi-Agent Synthetic Data Platform     ║
  ║        Built entirely on OpenServ         ║
  ╚═══════════════════════════════════════════╝
  `);

  console.log('[Forge] Connecting agents to OpenServ via tunnel...\n');

  // Create all 5 agents
  const agents = [
    { name: 'Volatility Predictor', agent: createVolatilityPredictor() },
    { name: 'Liquidation Analyzer', agent: createLiquidationAnalyzer() },
    { name: 'Sentiment Tracker',    agent: createSentimentTracker() },
    { name: 'Pattern Matcher',      agent: createPatternMatcher() },
    { name: 'Forge Synthesizer',    agent: createForgeSynthesizer() },
  ];

  // Connect each agent to OpenServ via WebSocket tunnel
  // Each agent gets its own tunnel — OpenServ routes tasks to them
  // through workflow orchestration
  for (const { name, agent } of agents) {
    try {
      const result = await run(agent);
      stopHandlers.push(result.stop);
      console.log(`  [OK] ${name} — connected to OpenServ`);
    } catch (err: any) {
      console.error(`  [FAIL] ${name} — ${err.message}`);
    }
  }

  console.log(`
[Forge] All agents connected to OpenServ.

  Agents are now live on the OpenServ platform.
  OpenServ handles all orchestration from here:

    1. Data Ingestion     — cron every 30 min (Pyth / Deribit / CoinGlass)
    2. Prediction Gen     — parallel 4-agent + synthesizer
    3. Validation         — CRPS scoring 24h after predictions
    4. Reward Distribution— weekly x402 USDC payouts

  Configure workflows at: https://openserv.ai
  This process must stay running to keep agents connected.
  `);
}

// Graceful shutdown — disconnect all agents from OpenServ
async function shutdown(): Promise<void> {
  console.log('\n[Forge] Shutting down — disconnecting agents from OpenServ...');
  for (const stop of stopHandlers) {
    try { await stop(); } catch { /* ignore */ }
  }
  console.log('[Forge] All agents disconnected. Goodbye.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error('[Forge] Fatal error:', err);
  process.exit(1);
});
