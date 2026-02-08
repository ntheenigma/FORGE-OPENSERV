import express, { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { getLatestPrediction, getPredictionHistory } from '../workflows/prediction-generation';
import { getValidationHistory } from '../workflows/validation-scoring';
import { getDistributionHistory } from '../workflows/reward-distribution';
import {
  registerAgent,
  getLeaderboard,
  getRegisteredAgents,
  getActiveAgents,
  getAgent,
} from '../registry/agent-registry';
import { AgentCapability } from '../types/agent';
import { SUPPORTED_ASSETS, SupportedAsset } from '../types/market-data';

/**
 * Forge API Server
 *
 * Subscription Tiers:
 *   Free:       Delayed 24h data, 1 asset, 100 queries/month, $0
 *   Professional: Real-time, all assets, 10K queries/month, $299
 *   Enterprise:   Raw paths, custom assets, unlimited, $2,000+
 *
 * Revenue flows into weekly reward pools:
 *   60% to agents, 20% platform, 20% insurance/dev reserves
 */

export function createApiServer(): express.Application {
  const app = express();
  app.use(express.json());

  // --- Health ---
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: config.forge.version, timestamp: new Date().toISOString() });
  });

  // --- Prediction Endpoints ---

  app.get('/api/v1/predictions/:asset', (req: Request, res: Response) => {
    const asset = req.params.asset.toUpperCase();
    const tier = (req.headers['x-subscription-tier'] as string) || 'free';

    if (!SUPPORTED_ASSETS.includes(asset as SupportedAsset)) {
      res.status(400).json({ error: `Unsupported asset: ${asset}` });
      return;
    }

    const prediction = getLatestPrediction(asset);
    if (!prediction) {
      res.status(404).json({ error: `No prediction available for ${asset}` });
      return;
    }

    // Apply tier restrictions
    const response = applyTierRestrictions(prediction, tier);
    res.json(response);
  });

  app.get('/api/v1/predictions/:asset/history', (req: Request, res: Response) => {
    const asset = req.params.asset.toUpperCase();
    const count = parseInt(req.query.count as string) || 10;
    const history = getPredictionHistory(asset, count);
    res.json({ asset, count: history.length, predictions: history.map((p) => stripPaths(p)) });
  });

  // --- Leaderboard ---

  app.get('/api/v1/leaderboard', (_req: Request, res: Response) => {
    res.json({ leaderboard: getLeaderboard() });
  });

  // --- Agent Registry ---

  app.post('/api/v1/agents/register', (req: Request, res: Response) => {
    const { name, endpointUrl, capabilities, architecture, walletAddress } = req.body;

    if (!name || !endpointUrl || !capabilities || !architecture || !walletAddress) {
      res.status(400).json({ error: 'Missing required fields: name, endpointUrl, capabilities, architecture, walletAddress' });
      return;
    }

    const result = registerAgent({
      name,
      endpointUrl,
      capabilities: capabilities as AgentCapability[],
      architecture,
      walletAddress,
    });

    if (result.success) {
      res.status(201).json({
        agentId: result.agentId,
        stakeRequired: config.agentRegistry.stakeAmountUsd,
        status: 'pending_validation',
        message: 'Agent registered. Stake $50 USDC to begin shadow validation.',
      });
    } else {
      res.status(409).json({ error: result.error });
    }
  });

  app.get('/api/v1/agents', (_req: Request, res: Response) => {
    const agents = getRegisteredAgents();
    res.json({
      total: agents.length,
      active: getActiveAgents().length,
      agents: agents.map((a) => ({
        agentId: a.agentId,
        name: a.name,
        capabilities: a.capabilities,
        status: a.status,
        architecture: a.architecture,
      })),
    });
  });

  app.get('/api/v1/agents/:agentId', (req: Request, res: Response) => {
    const agent = getAgent(req.params.agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(agent);
  });

  // --- Validation ---

  app.get('/api/v1/validation/history', (req: Request, res: Response) => {
    const count = parseInt(req.query.count as string) || 20;
    res.json({ validations: getValidationHistory(count) });
  });

  // --- Rewards ---

  app.get('/api/v1/rewards/history', (req: Request, res: Response) => {
    const count = parseInt(req.query.count as string) || 10;
    res.json({ distributions: getDistributionHistory(count) });
  });

  // --- Subscription Info ---

  app.get('/api/v1/subscription/tiers', (_req: Request, res: Response) => {
    res.json({
      tiers: config.subscriptionTiers,
      assets: SUPPORTED_ASSETS,
    });
  });

  // --- Supported Assets ---

  app.get('/api/v1/assets', (_req: Request, res: Response) => {
    res.json({ assets: SUPPORTED_ASSETS });
  });

  return app;
}

function applyTierRestrictions(prediction: any, tier: string): any {
  const tierConfig = (config.subscriptionTiers as any)[tier] || config.subscriptionTiers.free;

  const output = { ...prediction };

  // Free tier: no raw paths, delayed data warning
  if (tier === 'free') {
    output.simulations = {
      count: prediction.simulations.count,
      time_increment_seconds: prediction.simulations.time_increment_seconds,
      horizon_seconds: prediction.simulations.horizon_seconds,
      paths: '<<upgrade to Professional for path data>>',
    };
    output._tier_notice = 'Free tier: 24h delayed data. Upgrade for real-time access.';
  }

  // Professional tier: include summary paths (first 10)
  if (tier === 'professional') {
    output.simulations = {
      ...prediction.simulations,
      paths: prediction.simulations.paths?.slice(0, 10) ?? [],
      total_paths_available: prediction.simulations.count,
    };
  }

  // Enterprise: full access (no modification)

  return output;
}

function stripPaths(prediction: any): any {
  const { simulations, ...rest } = prediction;
  return {
    ...rest,
    simulations: {
      count: simulations.count,
      time_increment_seconds: simulations.time_increment_seconds,
      horizon_seconds: simulations.horizon_seconds,
    },
  };
}

export function startApiServer(): void {
  const app = createApiServer();
  app.listen(config.ports.apiServer, () => {
    console.log(`Forge API server running on port ${config.ports.apiServer}`);
  });
}

if (require.main === module) {
  startApiServer();
}
