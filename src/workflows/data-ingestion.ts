import { Agent } from '@openserv-labs/sdk';
import { config } from '../config';
import { fetchMarketDataBundle } from '../lib/market-data';
import { SupportedAsset, SUPPORTED_ASSETS, MarketDataBundle } from '../types/market-data';

/**
 * Data Ingestion Workflow
 *
 * Trigger: Cron schedule, every 30 minutes.
 * Steps:
 *   1. REST API agent calls Pyth Oracle for prices
 *   2. REST API agent calls Deribit for order book / funding
 *   3. Browser agent scrapes CoinGlass for liquidation levels / OI
 *   4. File System agent stores aggregated raw data with timestamp indexing
 *
 * Mapped to OpenServ workflow builder as the first workflow.
 */

export interface IngestionResult {
  timestamp: number;
  bundles: Map<string, MarketDataBundle>;
  errors: { asset: string; error: string }[];
}

// In-memory store for latest ingested data (replaced by OpenServ file storage in production)
const dataStore = new Map<string, MarketDataBundle[]>();

export async function runIngestion(assets?: SupportedAsset[]): Promise<IngestionResult> {
  const targetAssets = assets ?? SUPPORTED_ASSETS;
  const timestamp = Date.now();
  const bundles = new Map<string, MarketDataBundle>();
  const errors: { asset: string; error: string }[] = [];

  // Fetch all assets in parallel
  const results = await Promise.allSettled(
    targetAssets.map((asset) => fetchMarketDataBundle(asset))
  );

  for (let i = 0; i < targetAssets.length; i++) {
    const result = results[i];
    const asset = targetAssets[i];

    if (result.status === 'fulfilled') {
      bundles.set(asset, result.value);

      // Append to historical store
      if (!dataStore.has(asset)) dataStore.set(asset, []);
      const history = dataStore.get(asset)!;
      history.push(result.value);
      // Keep last 1000 entries
      if (history.length > 1000) history.splice(0, history.length - 1000);
    } else {
      errors.push({ asset, error: result.reason?.message ?? 'Unknown error' });
    }
  }

  return { timestamp, bundles, errors };
}

export function getLatestData(asset: string): MarketDataBundle | undefined {
  const history = dataStore.get(asset);
  return history?.[history.length - 1];
}

export function getHistoricalData(asset: string, count?: number): MarketDataBundle[] {
  const history = dataStore.get(asset) ?? [];
  return count ? history.slice(-count) : history;
}

/**
 * Register ingestion as an OpenServ agent capability for workflow integration.
 */
export function registerIngestionCapabilities(agent: Agent): void {
  const { z } = require('zod');

  agent.addCapability({
    name: 'ingest_market_data',
    description: 'Fetch and store market data for specified assets from Pyth, Deribit, and CoinGlass.',
    schema: z.object({
      assets: z.array(z.string()).optional().describe('Assets to ingest (defaults to all supported)'),
    }),
    async run({ args }: { args: { assets?: string[] } }) {
      const result = await runIngestion(args.assets as SupportedAsset[] | undefined);
      return JSON.stringify({
        timestamp: result.timestamp,
        assetsIngested: Array.from(result.bundles.keys()),
        errors: result.errors,
      });
    },
  });

  agent.addCapability({
    name: 'get_market_data',
    description: 'Retrieve the latest ingested market data for an asset.',
    schema: z.object({
      asset: z.string().describe('Asset symbol'),
    }),
    async run({ args }: { args: { asset: string } }) {
      const data = getLatestData(args.asset);
      if (!data) return JSON.stringify({ error: `No data for ${args.asset}` });
      return JSON.stringify(data);
    },
  });
}
