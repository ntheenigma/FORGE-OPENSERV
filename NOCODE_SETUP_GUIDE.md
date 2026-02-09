# FORGE No-Code Setup Guide

## Step-by-Step OpenServ Agent Builder Instructions

This guide walks you through building all 13 FORGE agents and 3 workflows entirely within OpenServ's web interface. No code. No terminal. No hosting.

**Time estimate: ~60-90 minutes for full setup**

---

## Prerequisites

1. OpenServ account at [openserv.ai](https://openserv.ai)
2. OpenAI API key (for GPT-4o and GPT-4o-mini)
3. A web browser

That's it. No server, no Docker, no GitHub Actions, no deployment pipeline.

---

## Phase 1: Create the Workspace

### Step 1.1 — Create a New Workspace
1. Log in to OpenServ
2. Navigate to **Workspaces** in the sidebar
3. Click **Create Workspace**
4. Name: `FORGE Bitcoin Predictions`
5. Description: `13-agent ensemble for 15-minute BTC directional predictions`
6. Click **Create**

### Step 1.2 — Initialize File System
1. Inside your workspace, go to **File System**
2. Create these folders:
   - `forge/logs/`
   - `forge/scores/`
   - `forge/config/`
3. Upload these initial data files from this repo (`nocode/schemas/initial-data/`):
   - `forge/scores/accuracy.json` — Starting EMA scores (all 0.50)
   - `forge/scores/diversity.json` — Empty diversity metrics
   - `forge/config/weights.json` — Platform configuration
   - `forge/config/agent_pool.json` — Core agent registry

---

## Phase 2: Create All 13 Agents

For each agent below, go to **Agent Builder** → **Create Agent** and fill in the fields.

---

### Agent 1: ClockAgent

| Field | Value |
|-------|-------|
| Name | `ClockAgent` |
| Model | GPT-4o-mini |
| Description | Orchestration timer that triggers the FORGE prediction pipeline every 15 minutes |

**System Prompt:** Copy the full `system_prompt` from `nocode/agents/01-clock-agent.json`

**Capabilities:**
- Name: `trigger_pipeline`
- Description: Trigger the full FORGE prediction pipeline
- Parameters: `force` (boolean, optional)

**Tags:** orchestration, scheduling, pipeline

---

### Agent 2: DataFetcher

| Field | Value |
|-------|-------|
| Name | `DataFetcher` |
| Model | GPT-4o-mini |
| Description | Pure data aggregation. Fetches BTC data from Binance, Pyth, Coinbase. |

**System Prompt:** Copy from `nocode/agents/02-data-fetcher.json`

**Capabilities:**
- Name: `fetch_market_data`
- Description: Fetch BTC market data from all three sources
- Parameters: `asset` (string, default "BTCUSDT")

**Tags:** data, market-data, api, bitcoin

**API Access:** Enable HTTP requests to:
- `https://api.binance.com/*`
- `https://hermes.pyth.network/*`
- `https://api.exchange.coinbase.com/*`

---

### Agent 3: CandleAnalyst

| Field | Value |
|-------|-------|
| Name | `CandleAnalyst` |
| Model | GPT-4o-mini |
| Description | Candlestick pattern recognition specialist |

**System Prompt:** Copy from `nocode/agents/03-candle-analyst.json`

**Capabilities:**
- Name: `analyze_candles`
- Description: Analyze OHLCV candle data for patterns
- Parameters: `candles` (array, required)

**Tags:** prediction, technical-analysis, candlestick

---

### Agent 4: FlowAnalyst

| Field | Value |
|-------|-------|
| Name | `FlowAnalyst` |
| Model | GPT-4o-mini |
| Description | Order flow analyst using Level 2 order book depth |

**System Prompt:** Copy from `nocode/agents/04-flow-analyst.json`

**Capabilities:**
- Name: `analyze_orderbook`
- Description: Analyze Level 2 order book for flow signals
- Parameters: `orderbook` (object, required)

**Tags:** prediction, order-flow, orderbook

---

### Agent 5: MomentumAnalyst

| Field | Value |
|-------|-------|
| Name | `MomentumAnalyst` |
| Model | GPT-4o-mini |
| Description | Trend-following analyst using MA crossovers |

**System Prompt:** Copy from `nocode/agents/05-momentum-analyst.json`

**Capabilities:**
- Name: `analyze_momentum`
- Description: Calculate moving averages and momentum
- Parameters: `candles` (array, required)

**Tags:** prediction, momentum, trend, moving-average

---

### Agent 6: ReversionAnalyst

| Field | Value |
|-------|-------|
| Name | `ReversionAnalyst` |
| Model | GPT-4o-mini |
| Description | Mean reversion specialist using Bollinger Band analysis |

**System Prompt:** Copy from `nocode/agents/06-reversion-analyst.json`

**Capabilities:**
- Name: `analyze_reversion`
- Description: Calculate Bollinger Bands and reversion signals
- Parameters: `candles` (array, required)

**Tags:** prediction, mean-reversion, bollinger

---

### Agent 7: Collector

| Field | Value |
|-------|-------|
| Name | `Collector` |
| Model | GPT-4o-mini |
| Description | Prediction validator. Checks schema compliance and rejects malformed submissions. |

**System Prompt:** Copy from `nocode/agents/07-collector.json`

**Capabilities:**
- Name: `collect_predictions`
- Description: Validate and collect predictions from analysts
- Parameters: `predictions` (array, required), `window_id` (string)

**Tags:** validation, collection, quality-control

---

### Agent 8: Weigher

| Field | Value |
|-------|-------|
| Name | `Weigher` |
| Model | GPT-4o-mini |
| Description | Applies historical accuracy weights to predictions |

**System Prompt:** Copy from `nocode/agents/08-weigher.json`

**Capabilities:**
- Name: `apply_weights`
- Description: Apply accuracy weights to validated predictions
- Parameters: `predictions` (array, required)

**Tags:** weighting, scoring, accuracy

**File System Access:** `forge/scores/accuracy.json` (read)

---

### Agent 9: Synthesizer

| Field | Value |
|-------|-------|
| Name | `Synthesizer` |
| Model | **GPT-4o** (NOT mini) |
| Description | Consensus engine with regime detection and position sizing |

**System Prompt:** Copy from `nocode/agents/09-synthesizer.json`

**Capabilities:**
- Name: `synthesize_consensus`
- Description: Generate consensus from weighted predictions
- Parameters: `weighted_predictions` (array, required), `window_id` (string)

**Tags:** consensus, synthesis, prediction

> **Important:** This is the ONLY agent that uses GPT-4o. It's the quality-critical consensus step.

---

### Agent 10: Scorer

| Field | Value |
|-------|-------|
| Name | `Scorer` |
| Model | GPT-4o-mini |
| Description | Retrospective accuracy scorer. Compares predictions to realized prices. |

**System Prompt:** Copy from `nocode/agents/10-scorer.json`

**Capabilities:**
- Name: `score_predictions`
- Description: Score predictions against realized price
- Parameters: `window_id` (string, required)

**Tags:** scoring, accuracy, evaluation

**File System Access:** `forge/scores/accuracy.json` (read/write), `forge/logs/*.json` (read)
**API Access:** `https://hermes.pyth.network/*`

---

### Agent 11: Logger

| Field | Value |
|-------|-------|
| Name | `Logger` |
| Model | GPT-4o-mini |
| Description | Appends prediction data to daily log files |

**System Prompt:** Copy from `nocode/agents/11-logger.json`

**Capabilities:**
- Name: `log_prediction`
- Description: Log a completed prediction cycle to file system
- Parameters: `prediction_data` (object, required)

**Tags:** logging, storage, audit

**File System Access:** `forge/logs/*.json` (read/write)

---

### Agent 12: Paymaster

| Field | Value |
|-------|-------|
| Name | `Paymaster` |
| Model | GPT-4o-mini |
| Description | Weekly reward distribution based on multi-factor performance |

**System Prompt:** Copy from `nocode/agents/12-paymaster.json`

**Capabilities:**
- Name: `distribute_rewards`
- Description: Calculate and distribute weekly agent rewards
- Parameters: `week_ending` (string), `force` (boolean)

**Tags:** rewards, economics, payment, x402

**File System Access:** `forge/scores/*.json` (read/write), `forge/logs/*.json` (read), `forge/config/weights.json` (read)

---

### Agent 13: Registrar

| Field | Value |
|-------|-------|
| Name | `Registrar` |
| Model | GPT-4o-mini |
| Description | External agent onboarding gateway |

**System Prompt:** Copy from `nocode/agents/13-registrar.json`

**Capabilities:**
- Name: `register_agent` — Register a new external agent
- Name: `list_agents` — List all registered agents
- Name: `remove_agent` — Remove an external agent

**Tags:** registration, onboarding, management

**File System Access:** `forge/config/*.json` (read/write), `forge/scores/accuracy.json` (write)

---

## Phase 3: Create Workflows

### Workflow 1: Prediction Pipeline (Main)

1. Go to **Workflow Builder** → **Create Workflow**
2. Name: `FORGE Prediction Pipeline`
3. Trigger: **Cron** → `*/15 * * * *` (every 15 minutes)
4. Build the following step chain on the canvas:

```
[ClockAgent] → [DataFetcher] → ┬→ [CandleAnalyst]   ─┐
                                ├→ [FlowAnalyst]      ─┤
                                ├→ [MomentumAnalyst]  ─┤ (parallel)
                                └→ [ReversionAnalyst] ─┘
                                                        │
                                         [Collector] ←──┘
                                              │
                                         [Weigher]
                                              │
                                        [Synthesizer]
                                              │
                                         [Logger] + Output
```

**Step-by-step on canvas:**
1. Drag **ClockAgent** as first node. Set action: `trigger_pipeline`
2. Connect to **DataFetcher**. Set action: `fetch_market_data`. Map input: `{asset: "BTCUSDT"}`
3. From DataFetcher, create 4 parallel branches:
   - **CandleAnalyst**: Map `candles` from DataFetcher output
   - **FlowAnalyst**: Map `orderbook` from DataFetcher output
   - **MomentumAnalyst**: Map `candles` from DataFetcher output
   - **ReversionAnalyst**: Map `candles` from DataFetcher output
4. Add a **wait gate** after all 4 analysts (timeout: 60 seconds)
5. Connect all 4 to **Collector**. Map all predictions as array input
6. Connect to **Weigher**. Map `predictions` from Collector's valid predictions
7. Connect to **Synthesizer**. Map `weighted_predictions` from Weigher
8. Connect to **Logger**. Map full prediction cycle data
9. Set workflow output to Synthesizer's response

### Workflow 2: Scoring Pipeline

1. Create new workflow: `FORGE Scoring Pipeline`
2. Trigger: **Cron** → `7,22,37,52 * * * *` (offset 7 minutes from predictions)
3. Single step: **Scorer** with action `score_predictions`
4. The Scorer auto-calculates which window_id to score (15 minutes ago)

### Workflow 3: Weekly Rewards

1. Create new workflow: `FORGE Weekly Rewards`
2. Trigger: **Cron** → `0 0 * * 0` (Sunday midnight UTC)
3. Step 1: **Paymaster** with action `distribute_rewards`
4. Step 2: **Logger** to record the distribution

---

## Phase 4: Testing

### Test 1 — DataFetcher Standalone
1. Go to DataFetcher agent
2. Click **Test**
3. Send: `Fetch BTC market data from Binance, Pyth, and Coinbase`
4. Verify: Response contains candles array, pyth price, orderbook with bids/asks
5. Check: All three `sources_ok` are `true`

### Test 2 — Single Analyst
1. Copy the candles array from DataFetcher output
2. Go to CandleAnalyst → **Test**
3. Paste candles data
4. Verify: Response has prediction (UP/DOWN), confidence (0.50-0.80), reasoning, specialization

### Test 3 — Full Pipeline (Manual Trigger)
1. Go to the Prediction Pipeline workflow
2. Click **Run Now** (manual trigger)
3. Monitor each step in the execution log
4. Verify final output has all required fields
5. Check that `forge/logs/` has a new entry

### Test 4 — Scoring (after 15 min)
1. Wait 15 minutes after a successful prediction
2. Manually trigger the Scoring Pipeline
3. Verify `forge/scores/accuracy.json` was updated
4. Check that the log entry's `outcome` field was populated

---

## Phase 5: Go Live

1. Enable all three workflow cron triggers
2. Monitor the first 4 cycles (1 hour) for errors
3. Check file system after 1 hour:
   - `forge/logs/YYYY-MM-DD.json` should have 4 entries
   - `forge/scores/accuracy.json` should show EMA changes from 0.50
4. Set up OpenServ notifications for workflow failures
5. Review first weekly Paymaster output on Sunday

---

## Troubleshooting

### DataFetcher Returns Empty Data
- Check if Binance API is accessible (some regions block it)
- Verify Pyth Hermes endpoint is responding
- Coinbase may rate-limit — reduce to level=1 if needed

### Analyst Returns Invalid JSON
- The LLM occasionally adds markdown code fences
- The Collector will reject these — this is expected
- If persistent: strengthen the "no markdown" instruction in the prompt

### Scorer Can't Find Log Entry
- Verify Logger wrote successfully in the previous cycle
- Check that the window_id format matches (YYYYMMDD-HHMM)
- Ensure the scoring cron offset is correct (7 minutes after prediction)

### All Analysts Agree (Low Diversity)
- This is expected in strong trends
- The Synthesizer caps confidence at 0.85 even with unanimity
- Diversity scores will naturally be low — this is fine
- The system is designed to reward contrarians when they're RIGHT, not just different

### High Token Usage
- Check if agents are adding prose or markdown to outputs
- Trim Binance candles to 6 fields if returning full 12
- Reduce order book depth from 20 to 10 levels if needed
