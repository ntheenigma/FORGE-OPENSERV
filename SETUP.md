# Forge Platform — Setup Guide

Everything runs on OpenServ. Railway just keeps the agent process alive.
No terminal access required — all setup through web dashboards.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   OpenServ Platform                  │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │  Workflow 1  │  │  Workflow 2  │  │ Workflow 3 │  │
│  │  Ingestion   │→ │  Prediction  │  │ Validation │  │
│  │  (30m cron)  │  │  (parallel)  │  │ (24h CRPS) │  │
│  └─────────────┘  └──────┬──────┘  └────────────┘  │
│                          │                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
│  │ Vol  │ │ Liq  │ │ Sent │ │ Pat  │ │Synthesizer│  │
│  │Agent │ │Agent │ │Agent │ │Agent │ │  (PM)     │  │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └────┬─────┘  │
│     │        │        │        │           │        │
│     └────────┴────────┴────────┴───────────┘        │
│              WebSocket Tunnels                       │
│  ┌─────────────┐                  ┌──────────────┐  │
│  │  Workflow 4  │                  │  Frontend    │  │
│  │  Rewards     │                  │  URL / API   │  │
│  │  (weekly)    │                  │              │  │
│  └─────────────┘                  └──────────────┘  │
└─────────────────────────┬───────────────────────────┘
                          │ tunnels
                   ┌──────┴──────┐
                   │   Railway   │
                   │  (1 service)│
                   │  node index │
                   └─────────────┘
```

Railway runs ONE process (`node dist/index.js`) that creates all 5 agents
and connects them to OpenServ via WebSocket tunnels. No ports, no URLs,
no HTTP servers. OpenServ routes all tasks to the agents through the tunnels.

---

## Step 1: Create OpenServ Account (2 min)

1. Go to **openserv.ai**
2. Sign up / Log in
3. Go to **Settings** → copy your **API Key**
4. Save it — you'll need it for Railway

---

## Step 2: Deploy to Railway (5 min)

1. Go to **railway.com** → Sign up / Log in
2. Click **New Project** → **Deploy from GitHub Repo**
3. Select this repository (`FORGE-OPENSERV`)
4. Railway auto-detects `railway.json` and `Dockerfile`
5. Go to **Variables** tab → **Add Variable** for each:

   | Variable | Value |
   |----------|-------|
   | `OPENSERV_API_KEY` | Your OpenServ API key from step 1 |
   | `OPENAI_API_KEY` | Your OpenAI API key |
   | `COINGLASS_API_KEY` | Your CoinGlass key (optional — for liquidation data) |
   | `TWITTER_BEARER_TOKEN` | Your Twitter key (optional — for sentiment) |

6. Click **Deploy**
7. Railway builds the Docker image and starts the process
8. Check **Logs** — you should see:

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

That's it for Railway. It just keeps the tunnel alive. Everything else is on OpenServ.

---

## Step 3: Register Agents on OpenServ (10 min)

Once the agents are connected via tunnel, register them on the OpenServ dashboard
so they appear in the workflow builder.

1. Go to **openserv.ai** → **Agent Management**
2. Your tunneled agents should appear as connected agents
3. For each agent, configure the details from the JSON files in `openserv/agents/`:

### Agent 1: Volatility Predictor
- Open `openserv/agents/volatility-predictor.json` in this repo
- Copy the **systemPrompt** into the agent's system prompt field
- Verify capability `predict_volatility` is registered
- Tags: `volatility`, `garch`, `prediction`, `forge`

### Agent 2: Liquidation Analyzer
- Use `openserv/agents/liquidation-analyzer.json`
- Capability: `analyze_liquidations`
- Tags: `liquidation`, `cascade`, `derivatives`, `forge`

### Agent 3: Sentiment Tracker
- Use `openserv/agents/sentiment-tracker.json`
- Capability: `track_sentiment`
- Tags: `sentiment`, `social`, `options-flow`, `forge`

### Agent 4: Pattern Matcher
- Use `openserv/agents/pattern-matcher.json`
- Capability: `match_patterns`
- Tags: `pattern`, `analog`, `historical`, `forge`

### Agent 5: Forge Synthesizer (Program Manager)
- Use `openserv/agents/forge-synthesizer.json`
- Capabilities: `synthesize_predictions`, `validate_prediction_format`
- **Set as Program Manager** in OpenServ
- Tags: `synthesizer`, `program-manager`, `orchestration`, `forge`

---

## Step 4: Create Workflows on OpenServ (15 min)

Go to **Workflow Builder** on openserv.ai. Create 4 workflows.
Use the JSON files in `openserv/workflows/` as reference for each step.

### Workflow 1: Data Ingestion
**Reference:** `openserv/workflows/01-data-ingestion.json`

1. **Create Workflow** → Name: `Forge Data Ingestion`
2. **Trigger**: Cron → `*/30 * * * *` (every 30 minutes, UTC)
3. **Goal**: "Fetch market data for BTC, ETH, SOL from Pyth Oracle, Deribit, and CoinGlass"
4. **Add tasks**:
   - Task 1: "Fetch latest prices from Pyth Hermes API for all supported assets"
   - Task 2: "Fetch Deribit perpetual funding rates and OHLCV candles"
   - Task 3: "Fetch CoinGlass open interest and liquidation levels"
   - Task 4: "Aggregate all data into MarketDataBundle and store as workspace file"
5. **On complete**: Trigger Workflow 2

### Workflow 2: Prediction Generation
**Reference:** `openserv/workflows/02-prediction-generation.json`

1. **Create Workflow** → Name: `Forge Prediction Generation`
2. **Trigger**: Completion of `Forge Data Ingestion`
3. **Enable parallel execution**
4. **Add 4 parallel tasks** — one for each prediction agent:
   - Assign to `Forge Volatility Predictor`: "Generate GARCH volatility forecast and 250 price paths"
   - Assign to `Forge Liquidation Analyzer`: "Model liquidation cascades and generate 250 paths"
   - Assign to `Forge Sentiment Tracker`: "Quantify sentiment and generate 250 paths"
   - Assign to `Forge Pattern Matcher`: "Find historical analogs and generate 250 paths"
5. **Add synthesizer task** (depends on all 4 above):
   - Assign to `Forge Synthesizer`: "Combine all predictions into 1,000 weighted paths"
   - This is the Program Manager task
6. **Final task**: "Store ForgeOutput as workspace file predictions/{asset}/{timestamp}.json"

### Workflow 3: Validation & Scoring
**Reference:** `openserv/workflows/03-validation-scoring.json`

1. **Create Workflow** → Name: `Forge Validation Scoring`
2. **Trigger**: Cron → `0 * * * *` (hourly — checks for predictions that are 24h old)
3. **Add tasks**:
   - "Fetch realized prices from Pyth historical endpoint for each 5-min step"
   - "Calculate CRPS for each agent's contributed paths vs realized prices"
   - "Transform scores: normalize best to 0, cap worst 10% at 90th percentile"
   - "Update rolling 10-day EMA for each agent"
   - "Update leaderboard and store as workspace file"

### Workflow 4: Reward Distribution
**Reference:** `openserv/workflows/04-reward-distribution.json`

1. **Create Workflow** → Name: `Forge Reward Distribution`
2. **Trigger**: Cron → `0 0 * * 0` (Sundays 00:00 UTC)
3. **Add tasks**:
   - "Calculate softmax weights from EMA accuracy scores"
   - "Compute reward pool: weekly revenue × 60%"
   - "Distribute USDC via x402 to each agent's wallet based on softmax weight"
   - "Auto-deprecate bottom 10% of agents if pool has 5+ agents"
   - "Archive distribution record"

---

## Step 5: Configure MCP Servers (3 min)

In OpenServ → **MCP Servers**, register data sources:

| Server Name | Type | URL |
|-------------|------|-----|
| `pyth-oracle` | HTTP | `https://hermes.pyth.network` |
| `deribit` | HTTP | `https://www.deribit.com/api/v2` |
| `coinglass` | HTTP | `https://open-api-v3.coinglass.com` |

Set `autoRegisterTools: true` for each. Add CoinGlass API key as a header secret.

---

## Step 6: Configure x402 Payments (3 min)

1. OpenServ → **Payments / x402**
2. Connect wallet (Base network)
3. Settlement token: USDC
4. Fund reward pool with initial USDC
5. Workflow 4 handles weekly distribution automatically

---

## Step 7: Connect Frontend URL

OpenServ provides workspace APIs that your frontend connects to:

- Predictions are stored as workspace files by Workflow 2
- Leaderboard is updated by Workflow 3
- Use OpenServ's workspace file API to serve data to your frontend
- The frontend URL points to OpenServ's platform — no separate API server needed

---

## How It All Flows

```
Every 30 minutes:
  OpenServ cron → Workflow 1 (Ingestion)
    → Fetches Pyth / Deribit / CoinGlass
    → Stores data as workspace files
    → Triggers Workflow 2

  Workflow 2 (Prediction)
    → Sends tasks IN PARALLEL to 4 agents via tunnel:
       • Volatility Predictor → 250 GARCH paths
       • Liquidation Analyzer → 250 cascade paths
       • Sentiment Tracker    → 250 sentiment paths
       • Pattern Matcher      → 250 analog paths
    → All complete → Synthesizer combines into 1,000 paths
    → Stores ForgeOutput as workspace file

Every hour:
  OpenServ cron → Workflow 3 (Validation)
    → Checks for 24h-old predictions
    → Fetches realized prices from Pyth
    → Calculates CRPS per agent
    → Updates EMA scores and leaderboard

Every Sunday:
  OpenServ cron → Workflow 4 (Rewards)
    → Softmax weights from EMA scores
    → Distributes USDC via x402
    → Auto-deprecates bottom 10%
```

---

## Auto-Deploy on Code Changes

When you push to `main`, GitHub Actions (`.github/workflows/deploy.yml`):
1. Typechecks the code
2. Builds TypeScript
3. Deploys to Railway automatically

To enable: add `RAILWAY_TOKEN` as a GitHub repository secret
(get it from Railway dashboard → Account → Tokens).

---

## Opening to External Agents (Moltbot/OpenClaw)

External agents register through OpenServ's standard agent onboarding:

1. Agent developer builds their agent using any framework
2. Agent connects to OpenServ via MCP
3. Developer declares Forge capabilities (e.g., `volatility_prediction`)
4. Stakes $50 USDC
5. Enters shadow validation — predictions scored but not weighted
6. Passes validation → promoted to active → earns from reward pool

Architecture diversity enforced: max 30% of active agents may share the same architecture.
Bottom 10% auto-deprecated weekly.

---

## File Reference

| Path | What It's For |
|------|---------------|
| `openserv/agents/*.json` | System prompts + capability schemas — copy into OpenServ agent registration |
| `openserv/workflows/*.json` | Step-by-step workflow definitions — follow when building in OpenServ workflow builder |
| `railway.json` | Railway auto-deploy config (single service) |
| `Dockerfile` | Build config for Railway |
| `.github/workflows/deploy.yml` | CI/CD: typecheck → build → deploy to Railway on push to main |
| `src/agents/` | Agent source code — runs on Railway, tunnels to OpenServ |
| `src/lib/` | Core math: CRPS, scoring, synthesis, market data |
| `src/types/` | TypeScript types for the entire platform |
