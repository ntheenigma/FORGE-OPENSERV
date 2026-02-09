# FORGE: Bitcoin Prediction System

## No-Code Multi-Agent Ensemble on OpenServ

FORGE is a 13-agent ensemble that generates 15-minute directional Bitcoin predictions through coordinated specialization. Every agent runs inside OpenServ's Agent Builder with zero external hosting, zero SDK code, and zero infrastructure management.

---

## Architecture Overview

```
                          ┌─────────────────┐
                          │   ClockAgent     │  Cron: */15 * * * *
                          │   (Orchestrator) │
                          └────────┬────────┘
                                   │
                          ┌────────▼────────┐
                          │   DataFetcher    │  3 API calls:
                          │   (Ingestion)    │  Binance + Pyth + Coinbase
                          └────────┬────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                  │
        ┌────────▼──────┐ ┌───────▼───────┐ ┌───────▼───────┐
        │ CandleAnalyst │ │ FlowAnalyst   │ │ MomentumAnlst │
        │ (Patterns)    │ │ (Order Book)  │ │ (MA Cross)    │
        └────────┬──────┘ └───────┬───────┘ └───────┬───────┘
                 │                │                  │
                 │         ┌──────▼──────┐           │
                 │         │ ReversionA  │           │
                 │         │ (Bollinger) │           │
                 │         └──────┬──────┘           │
                 │                │                  │
                 └────────────────┼──────────────────┘
                                  │
                          ┌───────▼───────┐
                          │   Collector    │  Validate schemas
                          │   (QA Gate)    │  Reject malformed
                          └───────┬───────┘
                                  │
                          ┌───────▼───────┐
                          │    Weigher     │  Read accuracy.json
                          │   (Scoring)    │  Apply EMA weights
                          └───────┬───────┘
                                  │
                          ┌───────▼───────┐
                          │  Synthesizer   │  Consensus + regime
                          │  (GPT-4o)      │  detection + sizing
                          └───────┬───────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │                           │
             ┌──────▼──────┐            ┌───────▼──────┐
             │   Logger     │            │  OUTPUT      │
             │ (File Write) │            │  (Prediction)│
             └──────────────┘            └──────────────┘

        ═══════════════════ 15 min delay ═══════════════════

                          ┌─────────────────┐
                          │    Scorer        │  Compare vs Pyth
                          │  (Evaluation)    │  Update EMA scores
                          └─────────────────┘

        ═══════════════════ Weekly (Sunday) ═══════════════════

                          ┌─────────────────┐
                          │   Paymaster      │  Multi-factor rewards
                          │  (Distribution)  │  70/20/10 split
                          └─────────────────┘

        ═══════════════════ On-Demand ═══════════════════

                          ┌─────────────────┐
                          │   Registrar      │  External agent
                          │  (Onboarding)    │  registration
                          └─────────────────┘
```

---

## Agent Specifications Table

| # | Agent | Model | Role | Input | Output | Trigger |
|---|-------|-------|------|-------|--------|---------|
| 1 | ClockAgent | GPT-4o-mini | Orchestrator | Cron tick | Pipeline status JSON | */15 * * * * |
| 2 | DataFetcher | GPT-4o-mini | Data ingestion | Asset pair | {candles, pyth, orderbook} | From ClockAgent |
| 3 | CandleAnalyst | GPT-4o-mini | Prediction | 60x 1m candles | {prediction, confidence, reasoning} | From DataFetcher |
| 4 | FlowAnalyst | GPT-4o-mini | Prediction | L2 order book | {prediction, confidence, reasoning} | From DataFetcher |
| 5 | MomentumAnalyst | GPT-4o-mini | Prediction | 60x 1m candles | {prediction, confidence, reasoning} | From DataFetcher |
| 6 | ReversionAnalyst | GPT-4o-mini | Prediction | 60x 1m candles | {prediction, confidence, reasoning} | From DataFetcher |
| 7 | Collector | GPT-4o-mini | Aggregation | 4 predictions | {valid_predictions, rejected} | After analysts |
| 8 | Weigher | GPT-4o-mini | Aggregation | Valid predictions | {weighted_predictions} | After Collector |
| 9 | Synthesizer | **GPT-4o** | Consensus | Weighted predictions | {prediction, confidence, action, regime} | After Weigher |
| 10 | Scorer | GPT-4o-mini | Evaluation | window_id | {results, updated_scores} | */15 + 7min offset |
| 11 | Logger | GPT-4o-mini | Storage | Prediction cycle | {status, file_path} | After Synthesizer |
| 12 | Paymaster | GPT-4o-mini | Economics | Weekly data | {distributions, amounts} | 0 0 * * 0 |
| 13 | Registrar | GPT-4o-mini | Management | Agent spec | {agent_id, status, weight} | On-demand |

---

## Data Sources

### 1. Binance - 1-Minute Candles
```
GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=60
```
- No API key required
- Rate limit: 1200 requests/minute
- Returns: [[timestamp, open, high, low, close, volume, ...], ...]
- Used by: CandleAnalyst, MomentumAnalyst, ReversionAnalyst

### 2. Pyth Network - Price Oracle
```
GET https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
```
- No API key required
- Sub-second latency
- Returns: BTC/USD price with confidence interval
- Used by: DataFetcher (live price), Scorer (realized price)

### 3. Coinbase - Level 2 Order Book
```
GET https://api.exchange.coinbase.com/products/BTC-USD/book?level=2
```
- No API key required
- Rate limit: 10 requests/second
- Returns: {bids: [[price, size, num_orders]], asks: [[price, size, num_orders]]}
- Used by: FlowAnalyst

---

## Prediction Output Schema

Each 15-minute window produces this final output:

```json
{
  "prediction": "UP",
  "confidence": 0.68,
  "action": "medium",
  "position_size_pct": 25,
  "regime": "trending",
  "reasoning": "3/4_agents_UP_weighted_0.72_trending_regime_momentum+candle_aligned",
  "vote_breakdown": {
    "up_weight": 0.72,
    "down_weight": 0.28,
    "agreement_ratio": 0.75,
    "unique_specializations": 4
  },
  "agent_contributions": [
    {"specialization": "candle_microstructure", "vote": "UP", "weight": 0.31},
    {"specialization": "order_flow", "vote": "UP", "weight": 0.28},
    {"specialization": "momentum_trend", "vote": "UP", "weight": 0.22},
    {"specialization": "mean_reversion", "vote": "DOWN", "weight": 0.19}
  ],
  "asset": "BTC-USD",
  "horizon_minutes": 15,
  "timestamp": "2025-01-15T14:30:00Z",
  "window_id": "20250115-1430"
}
```

---

## Scoring System

### Per-Prediction Scoring
| Outcome | Score Delta |
|---------|------------|
| Correct, confidence > 0.70 | +2 |
| Correct, confidence ≤ 0.70 | +1 |
| Incorrect, confidence > 0.70 | -2 |
| Incorrect, confidence ≤ 0.70 | -1 |
| Flat market (< 0.01% move) | Both UP and DOWN count as correct |

### EMA Accuracy Updates
```
new_ema = 0.10 * (correct ? 1.0 : 0.0) + 0.90 * old_ema
```
- Smoothing factor (alpha): 0.10
- Starting EMA: 0.50 (neutral)
- Updated every 15 minutes per agent

### Calibration Monitoring
- Tracks average confidence when correct vs actual accuracy
- Drift > 0.15 flags the agent as poorly calibrated
- Poorly calibrated agents may lose weight in future versions

---

## Reward Economics

### Weekly Distribution Formula
```
reward_score = accuracy * 0.40 + diversity * 0.30 + high_conf_success * 0.20 + quality * 0.10
```

### Pool Split
| Recipient | Share | Purpose |
|-----------|-------|---------|
| Agents | 70% | Performance rewards |
| Platform | 20% | Operations, development |
| Reserve | 10% | Buffer, new agent onboarding |

### Phases
| Phase | Timeline | Currency | Stake |
|-------|----------|----------|-------|
| Phase 1 | Months 0-3 | Forge Points | None (free) |
| Phase 2 | Months 3-6 | Hybrid (Points + Token) | Optional |
| Phase 3 | Month 6+ | USDC via x402 | Required |

### Penalty Thresholds
- Accuracy EMA < 0.45: Zero rewards for the week
- Bottom 10% of agents: Flagged for review
- External agents below 0.52 after probation: Demoted to inactive

---

## Differentiation from SYNTH (Subnet 50)

| Dimension | SYNTH | FORGE |
|-----------|-------|-------|
| Output type | 100 synthetic price paths | Binary UP/DOWN + confidence |
| Scoring | CRPS (probabilistic) | Directional accuracy + calibration |
| Architecture | Homogeneous miners | Diverse specialist ensemble |
| Diversity | Not incentivized | 30% of reward weight |
| Cost | Mining hardware + stake | ~$5/month API costs |
| Hosting | Self-hosted validators | Zero infrastructure (OpenServ) |
| Entry barrier | High (subnet stake) | Low (free tier) |
| Contrarian value | Penalized (deviation from consensus) | Rewarded (1.2x boost) |

---

## File System Structure

```
forge/
├── logs/
│   ├── 2025-01-15.json     # Daily prediction logs (array of entries)
│   ├── 2025-01-16.json
│   └── ...
├── scores/
│   ├── accuracy.json        # Per-agent EMA accuracy scores
│   └── diversity.json       # Per-agent contrarian metrics
└── config/
    ├── weights.json          # Platform config (pool size, splits, thresholds)
    └── agent_pool.json       # Registry of all core + external agents
```

---

## Cost Breakdown

### Monthly API Costs (Estimated)

| Agent | Model | Calls/Day | Tokens/Call | Monthly Cost |
|-------|-------|-----------|-------------|--------------|
| ClockAgent | GPT-4o-mini | 96 | ~200 | $0.06 |
| DataFetcher | GPT-4o-mini | 96 | ~800 | $0.23 |
| CandleAnalyst | GPT-4o-mini | 96 | ~1,500 | $0.43 |
| FlowAnalyst | GPT-4o-mini | 96 | ~1,200 | $0.35 |
| MomentumAnalyst | GPT-4o-mini | 96 | ~1,000 | $0.29 |
| ReversionAnalyst | GPT-4o-mini | 96 | ~1,000 | $0.29 |
| Collector | GPT-4o-mini | 96 | ~600 | $0.17 |
| Weigher | GPT-4o-mini | 96 | ~500 | $0.14 |
| **Synthesizer** | **GPT-4o** | 96 | ~1,500 | **$1.44** |
| Scorer | GPT-4o-mini | 96 | ~800 | $0.23 |
| Logger | GPT-4o-mini | 96 | ~400 | $0.12 |
| Paymaster | GPT-4o-mini | 0.14 (weekly) | ~2,000 | $0.001 |
| Registrar | GPT-4o-mini | ~2 (on-demand) | ~500 | $0.003 |
| **TOTAL** | | | **~200K tokens/day** | **~$3.76/month** |

### Pricing Assumptions
- GPT-4o-mini: $0.15/1M input + $0.60/1M output tokens
- GPT-4o: $2.50/1M input + $10.00/1M output tokens
- 96 prediction cycles per day (every 15 minutes)
- External API calls (Binance, Pyth, Coinbase): Free, no API keys needed

### Cost Optimization Applied
1. GPT-4o only for Synthesizer (quality-critical consensus)
2. GPT-4o-mini for all other agents (sufficient for structured tasks)
3. Compact prompt design: underscore notation, no prose in outputs
4. Candle data trimmed to 6 fields (dropped unnecessary Binance fields)
5. Order book limited to top 20 levels (sufficient for flow analysis)

---

## Success Metrics

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Active agents | 13 core | 13 core + 5 external | 13 core + 7 external |
| Subscribers | 50 | 200 | 500+ |
| Directional accuracy | 55% | 65% | 68%+ |
| Calibration drift (avg) | < 0.15 | < 0.10 | < 0.08 |
| Revenue | $0 (free) | Points economy | $5K/month (subscriptions) |
| Prediction windows/day | 96 | 96 | 96 |
| Uptime | 95% | 98% | 99% |
