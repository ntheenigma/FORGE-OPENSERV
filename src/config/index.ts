import 'dotenv/config';

export const config = {
  openserv: {
    apiKey: process.env.OPENSERV_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
  },

  ports: {
    volatilityAgent: parseInt(process.env.VOLATILITY_AGENT_PORT || '7378', 10),
    liquidationAgent: parseInt(process.env.LIQUIDATION_AGENT_PORT || '7379', 10),
    sentimentAgent: parseInt(process.env.SENTIMENT_AGENT_PORT || '7380', 10),
    patternAgent: parseInt(process.env.PATTERN_AGENT_PORT || '7381', 10),
    synthesizerAgent: parseInt(process.env.SYNTHESIZER_AGENT_PORT || '7382', 10),
    apiServer: parseInt(process.env.API_SERVER_PORT || '3000', 10),
  },

  marketData: {
    pythHermesUrl: process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network',
    deribitApiUrl: process.env.DERIBIT_API_URL || 'https://www.deribit.com/api/v2',
    coinglassApiKey: process.env.COINGLASS_API_KEY || '',
    coinglassApiUrl: process.env.COINGLASS_API_URL || 'https://open-api-v3.coinglass.com',
    twitterBearerToken: process.env.TWITTER_BEARER_TOKEN || '',
  },

  x402: {
    walletAddress: process.env.X402_WALLET_ADDRESS || '',
    settlementToken: process.env.X402_SETTLEMENT_TOKEN || 'USDC',
    network: process.env.X402_NETWORK || 'base',
  },

  scoring: {
    rollingWindowDays: parseInt(process.env.CRPS_ROLLING_WINDOW_DAYS || '10', 10),
    bottomDeprecationPct: parseInt(process.env.BOTTOM_DEPRECATION_PCT || '10', 10),
    softmaxTemperature: 1.0,
    emaAlpha: 2 / (10 + 1), // EMA smoothing factor for 10-day window
  },

  agentRegistry: {
    stakeAmountUsd: parseInt(process.env.AGENT_STAKE_AMOUNT_USD || '50', 10),
    maxSameArchitecturePct: parseInt(process.env.MAX_AGENTS_SAME_ARCHITECTURE_PCT || '30', 10),
  },

  forge: {
    version: '1.0.0',
    simulationCount: 1000,
    timeIncrementSeconds: 300,     // 5-minute increments
    horizonSeconds: 86400,          // 24-hour horizon
    ingestionIntervalMinutes: 30,
    validationDelayHours: 24,
    rewardDistributionCron: '0 0 * * 0', // Sundays at 00:00 UTC
  },

  subscriptionTiers: {
    free: {
      delayHours: 24,
      assets: 1,
      queriesPerMonth: 100,
      priceUsd: 0,
    },
    professional: {
      delayHours: 0,
      assets: 9, // all supported
      queriesPerMonth: 10000,
      priceUsd: 299,
    },
    enterprise: {
      delayHours: 0,
      assets: 9,
      queriesPerMonth: -1, // unlimited
      priceUsd: 2000,
      rawPathAccess: true,
      customAssets: true,
      dedicatedSupport: true,
    },
  },

  revenueShares: {
    agentRewardsPct: 60,
    platformOperationsPct: 20,
    insuranceReservePct: 20,
  },
} as const;
