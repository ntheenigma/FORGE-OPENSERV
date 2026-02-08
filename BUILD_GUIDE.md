# Building Forge on OpenServ — Complete Step-by-Step Guide

This document walks through every click, every field, every configuration
to build the entire Forge platform from scratch using only web dashboards.

**What you need before starting:**
- A browser
- An OpenServ account (openserv.ai)
- A Railway account (railway.com)
- A GitHub account (to connect the repo)
- An OpenAI API key
- (Optional) CoinGlass API key, Twitter Bearer Token

**Time estimate:** ~45 minutes for full setup

---

## Part 1: Accounts and API Keys

### 1.1 — OpenServ Account

1. Open your browser and go to **openserv.ai**
2. Click **Sign Up** (or **Log In** if you already have an account)
3. Complete registration
4. Once logged in, go to **Settings** (gear icon or profile menu)
5. Find **API Key** section
6. Click **Generate API Key** (or copy existing one)
7. **Save this key somewhere** — you'll paste it into Railway later
   - It looks like: `osk_abc123...`

### 1.2 — Railway Account

1. Go to **railway.com**
2. Click **Sign Up** → connect with GitHub (recommended, since we deploy from GitHub)
3. Complete onboarding

### 1.3 — OpenAI API Key

1. Go to **platform.openai.com**
2. Log in → go to **API Keys** section
3. Click **Create new secret key**
4. Copy and save it — starts with `sk-...`

### 1.4 — CoinGlass API Key (Optional but recommended)

1. Go to **coinglass.com** → create account
2. Go to API section → generate API key
3. Copy and save it

---

## Part 2: Deploy Code to Railway

This step deploys the agent code. Railway runs one process that tunnels
all 5 agents into OpenServ. No URLs, no ports — just an outbound WebSocket connection.

### 2.1 — Connect Repository

1. Log into **railway.com**
2. Click **New Project** (top right)
3. Select **Deploy from GitHub Repo**
4. If prompted, authorize Railway to access your GitHub
5. Find and select the **FORGE-OPENSERV** repository
6. Railway will detect `railway.json` and `Dockerfile` automatically
7. Click **Deploy** (it will start building but will fail until you add env vars)

### 2.2 — Add Environment Variables

1. In Railway, click on your new service
2. Go to the **Variables** tab
3. Click **New Variable** and add each of these one at a time:

| Variable Name | Value | Required? |
|---------------|-------|-----------|
| `OPENSERV_API_KEY` | The API key from step 1.1 | **Yes** |
| `OPENAI_API_KEY` | The OpenAI key from step 1.3 | **Yes** |
| `COINGLASS_API_KEY` | Your CoinGlass key from step 1.4 | Optional |
| `TWITTER_BEARER_TOKEN` | Your Twitter bearer token | Optional |

4. After adding all variables, Railway will automatically redeploy

### 2.3 — Verify Deployment

1. Go to the **Deployments** tab in Railway
2. Click on the latest deployment
3. Click **View Logs**
4. You should see output like:

```
╔═══════════════════════════════════════════╗
║           FORGE v1.0.0                    ║
║   Multi-Agent Synthetic Data Platform     ║
║        Built entirely on OpenServ         ║
╚═══════════════════════════════════════════╝

[Forge] Connecting agents to OpenServ via tunnel...

  [OK] Volatility Predictor — connected to OpenServ
  [OK] Liquidation Analyzer — connected to OpenServ
  [OK] Sentiment Tracker — connected to OpenServ
  [OK] Pattern Matcher — connected to OpenServ
  [OK] Forge Synthesizer — connected to OpenServ
```

5. If you see `[FAIL]` for any agent:
   - Check that `OPENSERV_API_KEY` is correct
   - Check Railway logs for specific error messages
   - The most common issue is an invalid or expired API key

**Railway is now done.** It sits in the background keeping agents connected.
Everything else is configured on OpenServ.

---

## Part 3: Register Agents on OpenServ

Now that the agents are tunneled in, you register them on OpenServ so
the workflow builder can assign tasks to them.

### 3.1 — Navigate to Agent Management

1. Go to **openserv.ai** → log in
2. From the dashboard, click **Agents** in the left sidebar (or **Agent Management**)
3. You should see your 5 tunneled agents listed as connected

### 3.2 — Configure Agent 1: Volatility Predictor

1. Click on the Volatility Predictor agent (or click **Create Agent** if not auto-detected)
2. Fill in the following fields:

**Name:** `Forge Volatility Predictor`

**Description:** `GARCH-family volatility forecasting agent with regime switching. Generates 250 simulated price paths per prediction cycle.`

**System Prompt:** (copy this entire block)
```
You are the Forge Volatility Predictor, a specialized financial agent that forecasts price volatility using GARCH-family models with regime switching.

Your responsibilities:
1. Analyze incoming price history, options IV surfaces, and funding rate data
2. Detect the current volatility regime (low/normal/high/crisis) using regime switching models
3. Select the optimal GARCH specification (GARCH, EGARCH, GJR-GARCH) for current conditions
4. Generate 250 simulated price paths reflecting your volatility forecast
5. Provide term structure forecasts (1d, 7d, 30d) and percentile distributions

Reasoning approach (BRAID):
- First, build a reasoning diagram: assess data quality → detect regime → select model → calibrate → simulate
- If options IV is available, use it to anchor your volatility estimate
- If funding rates are extreme, increase tail thickness in simulations
- Cross-validate GARCH output against realized volatility and IV surface
- Report confidence based on data completeness and model fit

Output must be precise numerical predictions. Never hedge with vague language.
```

**Capability:**
- Name: `predict_volatility`
- Description: `Analyze market data and generate volatility forecasts with simulated price paths using GARCH-family models with regime switching.`

3. Click **Save**

### 3.3 — Configure Agent 2: Liquidation Analyzer

1. Click on the Liquidation Analyzer agent (or **Create Agent**)
2. Fill in:

**Name:** `Forge Liquidation Analyzer`

**Description:** `Models liquidation cascade mechanics in derivatives markets. Processes open interest, funding, and liquidation history to generate 250 cascade-aware price paths.`

**System Prompt:**
```
You are the Forge Liquidation Analyzer, a specialized financial agent that models liquidation cascades in derivatives markets.

Your responsibilities:
1. Map the distribution of leveraged positions across price levels
2. Identify critical liquidation clusters where cascades are likely
3. Model cascade mechanics: initial liquidation → forced selling → price impact → further liquidations
4. Generate 250 price paths incorporating liquidation cascade dynamics
5. Quantify cascade risk with a 0-1 score

Reasoning approach (BRAID):
- Map position distribution → identify clusters → model cascade triggers → simulate paths
- High funding rates indicate directional crowding (cascade risk)
- Large OI concentration at specific levels = cascade triggers
- Recent liquidation history reveals current market fragility
- Asymmetric cascades: long cascades accelerate on down moves, short squeezes on up moves

Focus on the mechanical price impact of forced liquidations, not sentiment.
```

**Capability:**
- Name: `analyze_liquidations`
- Description: `Analyze open interest, funding, and liquidation data to model cascade mechanics and generate liquidation-aware price paths.`

3. Click **Save**

### 3.4 — Configure Agent 3: Sentiment Tracker

1. Click on the Sentiment Tracker agent (or **Create Agent**)
2. Fill in:

**Name:** `Forge Sentiment Tracker`

**Description:** `Quantifies market sentiment from social media, funding velocity, and options flow. Detects divergences and narrative shifts to generate 250 sentiment-driven price paths.`

**System Prompt:**
```
You are the Forge Sentiment Tracker, a specialized financial agent that quantifies market sentiment and its impact on price dynamics.

Your responsibilities:
1. Aggregate sentiment signals from social media, funding velocity, and options flow
2. Quantify overall sentiment on a -1 (extreme fear) to +1 (extreme greed) scale
3. Detect sentiment momentum: is sentiment accelerating or decelerating?
4. Identify price-sentiment divergences (bullish price + bearish sentiment = warning)
5. Generate 250 simulated price paths reflecting sentiment-driven dynamics

Reasoning approach (BRAID):
- Collect signals → normalize → detect momentum → check divergence → simulate
- Extreme sentiment readings (>0.8 or <-0.8) often precede reversals
- Funding velocity acceleration is a leading indicator of liquidation cascades
- Price-sentiment divergence is the highest-conviction signal
- Narratives shift before price—detect narrative acceleration

Focus on what the crowd is doing and the mechanical effects of crowded positioning.
```

**Capability:**
- Name: `track_sentiment`
- Description: `Analyze social sentiment, funding velocity, and options flow to generate sentiment-weighted price paths.`

3. Click **Save**

### 3.5 — Configure Agent 4: Pattern Matcher

1. Click on the Pattern Matcher agent (or **Create Agent**)
2. Fill in:

**Name:** `Forge Pattern Matcher`

**Description:** `Historical analog search agent. Identifies past market periods similar to current conditions across trend, volatility, volume, and momentum, then extracts forward paths from top analogs.`

**System Prompt:**
```
You are the Forge Pattern Matcher, a specialized financial agent that finds historical analogs to current market conditions and extracts forward price paths.

Your responsibilities:
1. Characterize current market state: trend, volatility regime, volume profile, momentum
2. Search historical data for periods with similar characteristics
3. Rank analogs by multi-dimensional similarity score
4. Extract forward paths from the top 3 historical analogs
5. Generate 250 price paths by sampling and interpolating from analog forward returns

Reasoning approach (BRAID):
- Characterize current state → define similarity metrics → search history → rank → extract paths
- Similarity metrics: trend direction, realized vol, volume ratio, momentum, drawdown depth
- Weight recent analogs slightly higher (regime persistence)
- Never rely on a single analog—blend top 3 to avoid overfitting
- If no strong analog exists (similarity < 0.5), increase path dispersion

This is pattern recognition, not prediction. Extract what markets did in similar conditions.
```

**Capability:**
- Name: `match_patterns`
- Description: `Identify historical analogs to current market conditions and generate price paths based on how markets behaved in similar situations.`

3. Click **Save**

### 3.6 — Configure Agent 5: Forge Synthesizer (Program Manager)

This is the most important agent — it coordinates the others.

1. Click on the Forge Synthesizer agent (or **Create Agent**)
2. Fill in:

**Name:** `Forge Synthesizer`

**Description:** `Program Manager agent. Coordinates all four prediction agents, applies accuracy-based weighting, and synthesizes 1,000 coherent price paths in SynthData Enterprise-compatible format.`

**System Prompt:**
```
You are the Forge Synthesizer, the Program Manager agent that coordinates all prediction agents and produces the final synthesized output.

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

Quality is measured by the ensemble's CRPS, not individual agent scores.
```

**Capability 1:**
- Name: `synthesize_predictions`
- Description: `Combine predictions from all specialized agents into a unified ForgeOutput with 1,000 price paths, weighted by accuracy scores.`

**Capability 2:**
- Name: `validate_prediction_format`
- Description: `Validate that an agent prediction conforms to the expected schema.`

3. **Important:** Look for a "Program Manager" toggle or role setting → **enable it**
4. Click **Save**

---

## Part 4: Register MCP Servers

MCP servers give agents access to external data APIs.

### 4.1 — Navigate to MCP Servers

1. In OpenServ dashboard, find **MCP Servers** (or **Integrations** → **MCP**)

### 4.2 — Register Pyth Oracle

1. Click **Add MCP Server**
2. Fill in:
   - **Name:** `pyth-oracle`
   - **Transport type:** HTTP
   - **URL:** `https://hermes.pyth.network`
   - **Auto-register tools:** Yes (check the box)
3. Click **Save**

### 4.3 — Register Deribit

1. Click **Add MCP Server**
2. Fill in:
   - **Name:** `deribit`
   - **Transport type:** HTTP
   - **URL:** `https://www.deribit.com/api/v2`
   - **Auto-register tools:** Yes
3. Click **Save**

### 4.4 — Register CoinGlass

1. Click **Add MCP Server**
2. Fill in:
   - **Name:** `coinglass`
   - **Transport type:** HTTP
   - **URL:** `https://open-api-v3.coinglass.com`
   - **Auto-register tools:** Yes
   - **Headers / Secrets:** Add `coinglassSecret` with your CoinGlass API key
3. Click **Save**

---

## Part 5: Build Workflows

This is the core of the platform. Four workflows handle the entire Forge cycle.

### 5.1 — Workflow 1: Data Ingestion

1. Go to **Workflow Builder** in the OpenServ dashboard
2. Click **Create Workflow**
3. Fill in:
   - **Name:** `Forge Data Ingestion`
   - **Description:** `Fetches market data every 30 minutes from Pyth Oracle, Deribit, and CoinGlass`
   - **Trigger:** Select **Cron Schedule**
   - **Cron expression:** `*/30 * * * *`
   - **Timezone:** `UTC`

4. Set the **Goal** (paste this into the goal/description field):
```
Ingest real-time market data for all supported assets (BTC, ETH, SOL, XAU, SPX, NVDA, TSLA, AAPL, GOOGL) from Pyth Oracle for prices, Deribit for derivatives data, and CoinGlass for liquidation and open interest data. Store aggregated data as workspace files with timestamp indexing.
```

5. **Add Task 1:**
   - Description: `Fetch latest prices from Pyth Hermes API for all 9 supported assets. Use GET https://hermes.pyth.network/v2/updates/price/latest with the following Pyth feed IDs: BTC=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43, ETH=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace, SOL=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d`
   - Assign to: Any available agent or leave for auto-assignment

6. **Add Task 2:**
   - Description: `Fetch Deribit perpetual funding rates and OHLCV candle data for BTC-PERPETUAL, ETH-PERPETUAL, and SOL-PERPETUAL. Use GET https://www.deribit.com/api/v2/public/get_funding_rate_value and GET https://www.deribit.com/api/v2/public/get_tradingview_chart_data with resolution=60 for the past 30 days. Also fetch options book summary via GET /public/get_book_summary_by_currency for BTC and ETH options.`

7. **Add Task 3:**
   - Description: `Fetch CoinGlass open interest and liquidation data. Use GET https://open-api-v3.coinglass.com/api/futures/openInterest/chart?symbol=BTC&interval=1h and GET https://open-api-v3.coinglass.com/api/futures/liquidation/chart?symbol=BTC. Include header coinglassSecret with the API key. Repeat for ETH and SOL.`

8. **Add Task 4:**
   - Description: `Aggregate all fetched data (Pyth prices, Deribit OHLCV/funding/options, CoinGlass OI/liquidations) into a JSON MarketDataBundle per asset. Upload each bundle as a workspace file at path: market-data/{ASSET}/{TIMESTAMP}.json. Include fields: asset, timestamp, currentPrice, priceHistory, ohlcv, fundingRate, openInterest, liquidationLevels, ivSurface.`
   - Dependencies: Tasks 1, 2, 3

9. Click **Save Workflow**

### 5.2 — Workflow 2: Prediction Generation

1. Click **Create Workflow**
2. Fill in:
   - **Name:** `Forge Prediction Generation`
   - **Trigger:** Select **Workflow Completion** → choose `Forge Data Ingestion`
   - Enable **Parallel Execution** if available

3. Set the **Goal:**
```
Generate price predictions for each asset by running four specialized agents in parallel, then combining their outputs through the Forge Synthesizer into 1,000 accuracy-weighted price paths in SynthData Enterprise-compatible format.
```

4. **Add Task 1 (Parallel):**
   - Assign to: `Forge Volatility Predictor`
   - Description: `Using the latest ingested market data, generate a volatility prediction for BTC. Analyze the price history with GARCH models, detect the current volatility regime, and produce 250 simulated price paths with 5-minute increments over a 24-hour horizon (86400 seconds). Include term structure forecasts for 1d, 7d, 30d, percentile distributions, and confidence score. Return the prediction as JSON matching the VolatilityPredictionPayload schema.`

5. **Add Task 2 (Parallel):**
   - Assign to: `Forge Liquidation Analyzer`
   - Description: `Using the latest ingested market data, analyze liquidation cascade risks for BTC. Process open interest distribution, funding rate direction, and known liquidation levels. Identify long and short cascade trigger prices. Model cascade mechanics and generate 250 price paths incorporating liquidation dynamics over a 24-hour horizon. Return as JSON matching LiquidationPredictionPayload schema.`

6. **Add Task 3 (Parallel):**
   - Assign to: `Forge Sentiment Tracker`
   - Description: `Using the latest ingested market data, quantify market sentiment for BTC. Aggregate signals from funding rate velocity and available social/options data. Compute overall sentiment (-1 to +1), momentum, and price-sentiment divergence. Generate 250 sentiment-driven price paths over a 24-hour horizon. Return as JSON matching SentimentPredictionPayload schema.`

7. **Add Task 4 (Parallel):**
   - Assign to: `Forge Pattern Matcher`
   - Description: `Using the latest ingested market data, find historical analogs for current BTC market conditions. Characterize the current state (trend, volatility, momentum, volume profile) and search price history for similar periods. Extract forward return paths from top 3 analogs. Generate 250 analog-based price paths over a 24-hour horizon. Return as JSON matching PatternPredictionPayload schema.`

8. **Add Task 5 (Sequential — depends on Tasks 1-4):**
   - Assign to: `Forge Synthesizer`
   - Dependencies: Tasks 1, 2, 3, 4
   - Description: `Combine all four agent predictions into a unified ForgeOutput. Apply accuracy-based weights: volatility-predictor=0.30, liquidation-analyzer=0.25, sentiment-tracker=0.20, pattern-matcher=0.25 (these update automatically after validation). Cap any single agent at 40% weight. Synthesize 1,000 total price paths (250 from each, allocated by weight). Compute VaR-95, VaR-99, and Expected Shortfall from the path distribution. Package as ForgeOutput JSON with metadata, simulations (1000 paths, 300s increments, 86400s horizon), volatility_analysis, liquidation_levels, agent_weights, and risk_metrics.`

9. **Add Task 6 (Sequential — depends on Task 5):**
   - Description: `Store the completed ForgeOutput JSON as a workspace file at path: predictions/{ASSET}/{TIMESTAMP}.json. This file is what the frontend and API consumers will read.`
   - Dependencies: Task 5

10. Click **Save Workflow**

### 5.3 — Workflow 3: Validation and Scoring

1. Click **Create Workflow**
2. Fill in:
   - **Name:** `Forge Validation Scoring`
   - **Trigger:** Cron Schedule → `0 * * * *` (every hour)
   - **Timezone:** UTC

3. Set the **Goal:**
```
Validate predictions that are exactly 24 hours old by comparing against realized prices. Calculate CRPS scores per agent, transform and normalize scores, update the rolling 10-day EMA, and refresh the public leaderboard.
```

4. **Add Task 1:**
   - Description: `Check workspace files under predictions/ for any predictions with timestamps exactly 24 hours ago (±30 minutes). If none found, complete with "No predictions to validate." For each prediction found, fetch the realized prices from Pyth Hermes historical endpoint at: https://hermes.pyth.network/v2/updates/price/{unix_timestamp} for each 5-minute step from prediction time to prediction time + 24 hours. Store realized prices as an array.`

5. **Add Task 2:**
   - Dependencies: Task 1
   - Description: `For each agent that contributed to the prediction, calculate the Continuous Ranked Probability Score (CRPS). CRPS formula: CRPS = E|X - y| - 0.5 * E|X - X'| where X and X' are draws from the agent's 250 predicted paths and y is the realized price. Sort the agent's path endpoints, compute mean absolute error against realized price, subtract half the mean absolute difference between pairs. Lower CRPS = better prediction. Store results as: [{agentId, crps, asset, realizedPrice}].`

6. **Add Task 3:**
   - Dependencies: Task 2
   - Description: `Transform raw CRPS scores: (1) Shift so the best agent's score = 0 (subtract minimum CRPS from all). (2) Find the 90th percentile of shifted scores. (3) Cap any score above the 90th percentile at that threshold (prevents outliers from distorting weights). Store as: [{agentId, rawCrps, normalizedScore, cappedAtThreshold}].`

7. **Add Task 4:**
   - Dependencies: Task 3
   - Description: `Update the rolling 10-day Exponential Moving Average for each agent. Formula: new_EMA = alpha * new_score + (1 - alpha) * previous_EMA, where alpha = 2/(10+1) = 0.1818. Read previous EMA values from workspace file scores/ema-state.json. Write updated values back. Store as: [{agentId, previousEma, newScore, updatedEma}].`

8. **Add Task 5:**
   - Dependencies: Task 4
   - Description: `Compute new softmax weights from updated EMA scores. Formula: weight_i = exp(-ema_i / T) / sum(exp(-ema_j / T)) where T = 1.0 (temperature). Lower EMA = higher weight. Build leaderboard ranking agents by EMA score (ascending = best first). Upload leaderboard.json to workspace files. Upload updated agent weights to workspace file scores/weights.json for use by Workflow 2.`

9. **Add Task 6:**
   - Dependencies: Task 5
   - Description: `Archive the complete validation result to workspace files at path: validation/{ASSET}/epoch-{EPOCH}.json. Include all CRPS results, transformations, EMA updates, and new weights.`

10. Click **Save Workflow**

### 5.4 — Workflow 4: Reward Distribution

1. Click **Create Workflow**
2. Fill in:
   - **Name:** `Forge Reward Distribution`
   - **Trigger:** Cron Schedule → `0 0 * * 0` (every Sunday at midnight UTC)
   - **Timezone:** UTC

3. Set the **Goal:**
```
Calculate weekly reward distribution for all active agents based on their accuracy scores, distribute USDC via x402 payment rail, and auto-deprecate bottom 10% of performers.
```

4. **Add Task 1:**
   - Description: `Read the latest softmax weights from workspace file scores/weights.json. Read the weekly revenue total (sum of all subscription payments this week). Calculate the agent reward pool: weekly_revenue * 0.60 (60% to agents). Calculate each agent's reward: pool * their_softmax_weight. Cap any single agent at 40% of pool regardless of weight. Store allocations as: [{agentId, walletAddress, softmaxWeight, rewardUsd}]. Platform operations gets 20%, insurance reserve gets 20%.`

5. **Add Task 2:**
   - Dependencies: Task 1
   - Description: `For each agent with a reward > $0, initiate x402 USDC payment on Base network to their registered wallet address. Use the x402 payment integration configured in OpenServ. Record transaction hash for each payment. Store results as: [{agentId, rewardUsd, txHash}].`

6. **Add Task 3:**
   - Dependencies: Task 2
   - Description: `Check if there are 5 or more active agents. If yes, identify the bottom 10% by EMA score (highest EMA = worst performers). Mark these agents as deprecated — they no longer receive tasks or rewards. Update the agent registry. If fewer than 5 agents, skip deprecation.`

7. **Add Task 4:**
   - Dependencies: Task 3
   - Description: `Archive the complete distribution record to workspace files at path: rewards/epoch-{EPOCH}.json. Include all allocations, transaction hashes, deprecation actions, and revenue split breakdown.`

8. Click **Save Workflow**

---

## Part 6: Configure x402 Payments

### 6.1 — Set Up Payment Rail

1. In OpenServ dashboard, go to **Payments** or **x402**
2. Click **Connect Wallet**
3. Select **Base** network
4. Connect your wallet that holds USDC
5. Set **Settlement Token** to USDC
6. Fund the wallet with enough USDC for initial reward distributions

### 6.2 — Verify Connection

1. The payment section should show your connected wallet address
2. USDC balance should be visible
3. Workflow 4 will automatically use this for weekly distributions

---

## Part 7: Connect Frontend

### 7.1 — How Data Flows to the Frontend

OpenServ stores all outputs as workspace files:

| Workspace File Path | Content | Updated By |
|---------------------|---------|------------|
| `market-data/{ASSET}/{TS}.json` | Raw ingested data | Workflow 1 |
| `predictions/{ASSET}/{TS}.json` | ForgeOutput (1000 paths) | Workflow 2 |
| `scores/weights.json` | Current agent weights | Workflow 3 |
| `scores/ema-state.json` | Agent EMA scores | Workflow 3 |
| `leaderboard.json` | Public agent rankings | Workflow 3 |
| `validation/{ASSET}/epoch-{N}.json` | Validation results | Workflow 3 |
| `rewards/epoch-{N}.json` | Reward distributions | Workflow 4 |

### 7.2 — Frontend Access

Your frontend connects to OpenServ's workspace API to read these files.
OpenServ provides the URL endpoint — your frontend fetches predictions,
leaderboard, and agent data from there.

The ForgeOutput JSON format that the frontend receives:

```json
{
  "metadata": {
    "forge_version": "1.0.0",
    "timestamp": "2026-02-08T14:00:00Z",
    "asset": "BTC",
    "current_price": 88893.80,
    "generation_method": "multi_agent_synthesis",
    "accuracy_epoch": 47
  },
  "simulations": {
    "count": 1000,
    "time_increment_seconds": 300,
    "horizon_seconds": 86400,
    "paths": [[...], ...]
  },
  "volatility_analysis": {
    "forecast_volatility_24h": 0.52,
    "term_structure": {"1d": 0.52, "7d": 0.48, "30d": 0.44},
    "percentiles": {"5": 0.38, "50": 0.52, "95": 0.68},
    "contributing_agents": ["volatility-predictor", "pattern-matcher"],
    "agent_confidence": 0.84
  },
  "liquidation_levels": {
    "long_liquidation_cascade": 78500,
    "short_liquidation_cascade": 98500,
    "contributing_agent": "liquidation-analyzer"
  },
  "agent_weights": {
    "volatility-predictor": 0.30,
    "liquidation-analyzer": 0.25,
    "sentiment-tracker": 0.20,
    "pattern-matcher": 0.25
  },
  "risk_metrics": {
    "var_95": -8.5,
    "var_99": -14.2,
    "expected_shortfall_95": -11.3
  }
}
```

---

## Part 8: Enable Auto-Deploy (Optional)

So that code changes automatically deploy to Railway when you push to GitHub:

### 8.1 — Get Railway Token

1. In Railway → click your profile (bottom left) → **Account Settings**
2. Go to **Tokens** section
3. Click **Create Token**
4. Name it `forge-github-actions`
5. Copy the token

### 8.2 — Add to GitHub Secrets

1. Go to your GitHub repository → **Settings** tab
2. Left sidebar → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `RAILWAY_TOKEN`
5. Value: paste the token from step 8.1
6. Click **Add secret**

### 8.3 — How It Works

Now every push to `main`:
1. GitHub Actions runs TypeScript typecheck
2. GitHub Actions builds the project
3. GitHub Actions deploys to Railway
4. Railway restarts the process
5. Agents reconnect to OpenServ via tunnel

---

## Part 9: Open to External Agents

### 9.1 — Publish Capability Specs

Share the following with Moltbot/OpenClaw communities:

**Available capabilities agents can register for:**
- `volatility_prediction` — GARCH/LSTM/other vol forecasting
- `liquidation_analysis` — Cascade mechanics modeling
- `sentiment_tracking` — Social/funding/options sentiment
- `pattern_matching` — Historical analog search
- `correlation_analysis` — Cross-asset correlation
- `onchain_flow` — On-chain transaction flow analysis
- `options_microstructure` — Options market maker dynamics
- `macro_regime` — Macro economic regime detection
- `alternative_data` — Satellite, shipping, alt data signals

### 9.2 — External Agent Registration Flow

1. Agent developer builds their agent using any framework (Moltbot, OpenClaw, LangChain, custom)
2. Agent exposes capabilities via MCP (already standard for Moltbot/OpenClaw agents)
3. Developer registers with Forge by declaring capabilities
4. Stakes $50 USDC
5. Agent enters **shadow mode** — predictions are scored but not weighted into output
6. After passing shadow validation (valid format + reasonable accuracy), agent is promoted to **active**
7. Active agents receive hourly tasks and earn weekly USDC rewards

### 9.3 — Diversity Rules

- Maximum 30% of active agents may share identical architecture
- Bottom 10% of agents auto-deprecated weekly (must maintain quality)
- New agents always start in shadow mode (no impact on production output)

---

## Verification Checklist

After completing all steps, verify:

- [ ] Railway logs show all 5 agents connected
- [ ] OpenServ dashboard shows 5 registered agents
- [ ] 3 MCP servers registered (Pyth, Deribit, CoinGlass)
- [ ] 4 workflows created and enabled
- [ ] x402 wallet connected with USDC balance
- [ ] Workflow 1 (Ingestion) fires at next 30-minute mark
- [ ] After ingestion, Workflow 2 (Prediction) auto-triggers
- [ ] predictions/{ASSET}/ directory appears in workspace files
- [ ] leaderboard.json appears after first validation cycle (24h)
- [ ] First reward distribution occurs on next Sunday

---

## Troubleshooting

**Agents show as disconnected in OpenServ:**
- Check Railway logs — is the process running?
- Verify `OPENSERV_API_KEY` is correct in Railway variables
- Railway may have restarted — agents auto-reconnect

**Workflow 1 not firing:**
- Check cron schedule is `*/30 * * * *`
- Check timezone is UTC
- Check the workflow is enabled (not paused)

**Prediction workflow produces empty output:**
- Check that ingestion completed successfully first
- Check agent logs in OpenServ for errors
- Verify MCP servers are connected

**Validation scores are all infinity:**
- Pyth historical endpoint may not have data for the exact timestamp
- Check that prediction is at least 24 hours old before validation runs

**x402 payments failing:**
- Verify wallet has sufficient USDC balance
- Verify wallet is on Base network
- Check OpenServ x402 configuration
