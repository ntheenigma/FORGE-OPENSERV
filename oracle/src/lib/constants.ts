import type { AgentConfig, AgentType } from "./types";

export const ASSETS = ["BTC", "GOLD"] as const;
export const TIMEFRAMES = ["1m", "3m", "5m", "10m", "15m"] as const;

export const PREDICTION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const SCORING_DELAY_MS = 7 * 60 * 1000; // 7 min offset

export const EMA_ALPHA = 0.1;
export const FLAT_THRESHOLD = 0.0001; // 0.01%

export const MAX_PREDICTIONS_PER_MIN = 10;
export const MAX_FEED_SIZE = 500;

export const REPUTATION_MIN = 0.5;
export const REPUTATION_MAX = 2.0;
export const REPUTATION_DEFAULT = 1.0;

export const AGENT_CONFIGS: AgentConfig[] = [
  { type: "trend", name: "TrendBot", description: "EMA crossover & trend strength analysis", weight: 0.15, enabled: true },
  { type: "rsi", name: "RSIBot", description: "RSI divergence & overbought/oversold detection", weight: 0.15, enabled: true },
  { type: "volume", name: "VolumeBot", description: "Volume profile, VWAP, and order flow analysis", weight: 0.20, enabled: true },
  { type: "macro", name: "MacroBot", description: "Cross-asset correlation (DXY, SPX, yields)", weight: 0.20, enabled: true },
  { type: "pattern", name: "PatternBot", description: "Candlestick pattern recognition", weight: 0.15, enabled: true },
  { type: "sentiment", name: "SentimentBot", description: "Prediction feed sentiment & contrarian analysis", weight: 0.15, enabled: true },
];

export const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws";
export const BINANCE_REST_URL = "https://api.binance.com/api/v3";
export const PYTH_URL = "https://hermes.pyth.network/api/latest_price_feeds";
export const PYTH_BTC_FEED = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
export const PYTH_GOLD_FEED = "0x765d2ba906dbc32f7024b9ceae4ee3d254b44fca6f5c821d8e83fc7a3b37f5c0";

// Gold data sources (free tier)
export const GOLD_SOURCES = {
  exchangeRate: "https://api.exchangerate.host/latest?base=XAU&symbols=USD",
  metalPrice: "https://api.metalpriceapi.com/v1/latest?base=XAU&currencies=USD",
};
