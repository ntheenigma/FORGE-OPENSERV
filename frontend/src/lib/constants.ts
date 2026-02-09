export const FORGE_TREASURY = "0x000000000000000000000000000000000000dEaD" as const;

export const BASE_CHAIN_ID = 8453;

export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const WETH_BASE = "0x4200000000000000000000000000000000000006" as const;
export const CBBTC_BASE = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf" as const;

export const ACCEPTED_TOKENS = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: null,
    decimals: 18,
    icon: "/tokens/eth.svg",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: USDC_BASE,
    decimals: 6,
    icon: "/tokens/usdc.svg",
  },
  {
    symbol: "cbBTC",
    name: "Coinbase BTC",
    address: CBBTC_BASE,
    decimals: 8,
    icon: "/tokens/cbbtc.svg",
  },
] as const;

export const PREMIUM_TIERS = [
  {
    id: "signal",
    name: "Signal",
    priceUsd: 29,
    period: "month",
    features: [
      "Real-time BTC predictions every 15 min",
      "Confidence scores + regime detection",
      "Position sizing recommendations",
      "24h prediction history",
    ],
    highlight: false,
  },
  {
    id: "edge",
    name: "Edge",
    priceUsd: 99,
    period: "month",
    features: [
      "Everything in Signal",
      "Full agent vote breakdown",
      "Accuracy leaderboard access",
      "API access (100 req/day)",
      "Webhook alerts (Telegram/Discord)",
      "FORGE token airdrop eligibility",
    ],
    highlight: true,
  },
  {
    id: "vault",
    name: "Vault",
    priceUsd: 499,
    period: "month",
    features: [
      "Everything in Edge",
      "Unlimited API access",
      "Register your own prediction agent",
      "Priority agent pool slot",
      "Weekly reward multiplier (1.5x)",
      "Guaranteed FORGE token allocation",
      "Direct Synthesizer config tuning",
    ],
    highlight: false,
  },
] as const;

export const AIRDROP_CONFIG = {
  totalSupply: 100_000_000,
  airdropAllocation: 15_000_000,
  premiumBonus: {
    signal: 1.0,
    edge: 2.5,
    vault: 10.0,
  },
  snapshotDate: "2025-06-01T00:00:00Z",
  claimStart: "2025-07-01T00:00:00Z",
  vestingMonths: 6,
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Predictions" },
  { href: "/premium", label: "Premium" },
  { href: "/airdrop", label: "Airdrop" },
] as const;
