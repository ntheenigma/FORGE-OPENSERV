# Forge Platform — Complete Setup Guide (No Terminal Required)

Everything is done through web dashboards: OpenServ, Render/Railway, and GitHub.

---

## PHASE 1: Deploy Agent Code to Cloud (10 minutes)

You need the agent code running somewhere with a public URL. Pick ONE:

### Option A: Render (Recommended — Free Tier Available)

1. Go to **render.com** → Sign up / Log in
2. Click **New** → **Blueprint**
3. Connect your GitHub repo (`FORGE-OPENSERV`)
4. Render reads `render.yaml` automatically — it will show 6 services
5. Click **Apply** — all 6 services deploy automatically
6. For each service, go to **Environment** tab → add:
   - `OPENSERV_API_KEY` = your key from openserv.ai
   - `OPENAI_API_KEY` = your OpenAI key
   - `COINGLASS_API_KEY` = your CoinGlass key (optional)
7. Copy each service's public URL (e.g., `https://forge-volatility-predictor-xxxx.onrender.com`)

### Option B: Railway

1. Go to **railway.com** → Sign up / Log in
2. Click **New Project** → **Deploy from GitHub Repo**
3. Select `FORGE-OPENSERV`
4. Railway reads `railway.json` automatically
5. Go to **Variables** tab → add same env vars as above
6. Copy the public URL

### What Gets Deployed

| Service | What It Does | Start Command |
|---------|-------------|---------------|
| forge-volatility-predictor | GARCH volatility forecasting | `node dist/agents/volatility-predictor.js` |
| forge-liquidation-analyzer | Cascade mechanics modeling | `node dist/agents/liquidation-analyzer.js` |
| forge-sentiment-tracker | Sentiment quantification | `node dist/agents/sentiment-tracker.js` |
| forge-pattern-matcher | Historical analog search | `node dist/agents/pattern-matcher.js` |
| forge-synthesizer | Program Manager / combiner | `node dist/agents/forge-synthesizer.js` |
| forge-api | REST API for consumers | `node dist/api/server.js` |

---

## PHASE 2: Register Agents on OpenServ (15 minutes)

1. Go to **openserv.ai** → Log in
2. Navigate to **Agent Management**

### Register Agent 1: Volatility Predictor

3. Click **Create Agent**
4. Name: `Forge Volatility Predictor`
5. Endpoint URL: paste your Render/Railway URL for this service
6. System Prompt: copy from `openserv/agents/volatility-predictor.json` → `systemPrompt` field
7. Add Capability:
   - Name: `predict_volatility`
   - Description: `Analyze market data and generate volatility forecasts with simulated price paths using GARCH-family models with regime switching.`
8. Save → copy the **Agent ID** and **Secret Key**
9. Go to your Render/Railway service → add env var `OPENSERV_AUTH_TOKEN` = the secret key

### Register Agent 2: Liquidation Analyzer

10. Repeat steps 3-9 using `openserv/agents/liquidation-analyzer.json`
    - Name: `Forge Liquidation Analyzer`
    - Capability: `analyze_liquidations`

### Register Agent 3: Sentiment Tracker

11. Repeat using `openserv/agents/sentiment-tracker.json`
    - Name: `Forge Sentiment Tracker`
    - Capability: `track_sentiment`

### Register Agent 4: Pattern Matcher

12. Repeat using `openserv/agents/pattern-matcher.json`
    - Name: `Forge Pattern Matcher`
    - Capability: `match_patterns`

### Register Agent 5: Forge Synthesizer (Program Manager)

13. Repeat using `openserv/agents/forge-synthesizer.json`
    - Name: `Forge Synthesizer`
    - Capabilities: `synthesize_predictions`, `validate_prediction_format`
    - **Important**: Mark this as a Program Manager agent in OpenServ

---

## PHASE 3: Create Workflows on OpenServ (20 minutes)

Navigate to **Workflow Builder** on openserv.ai.

### Workflow 1: Data Ingestion

1. Click **Create Workflow**
2. Name: `Forge Data Ingestion`
3. Trigger: **Cron Schedule** → `*/30 * * * *` (every 30 minutes)
4. Add steps (reference `openserv/workflows/01-data-ingestion.json`):

   **Step 1** — Add a REST API task:
   - Description: "Fetch latest prices from Pyth Oracle for BTC, ETH, SOL"
   - URL: `https://hermes.pyth.network/v2/updates/price/latest`
   - Method: GET
   - Query params: `ids[]` with the Pyth feed IDs

   **Step 2** — Add a REST API task:
   - Description: "Fetch Deribit funding rates and OHLCV for BTC-PERPETUAL"
   - URL: `https://www.deribit.com/api/v2/public/get_tradingview_chart_data`

   **Step 3** — Add a REST API task:
   - Description: "Fetch CoinGlass open interest and liquidation levels"
   - URL: `https://open-api-v3.coinglass.com/api/futures/openInterest/chart`
   - Header: `coinglassSecret: {your key}`

   **Step 4** — Add a File task:
   - Description: "Store aggregated data as JSON with timestamp"

5. Save workflow

### Workflow 2: Prediction Generation

1. **Create Workflow** → Name: `Forge Prediction Generation`
2. Trigger: **Workflow Completion** → select "Forge Data Ingestion"
3. Enable **Parallel Execution**
4. Add 4 parallel branches (reference `openserv/workflows/02-prediction-generation.json`):

   **Branch 1**: Assign to `Forge Volatility Predictor` agent
   - Task: "Generate volatility prediction with GARCH models"
   - Input: ingested market data from workflow 1

   **Branch 2**: Assign to `Forge Liquidation Analyzer` agent
   - Task: "Analyze liquidation cascade risks"
   - Input: OI and liquidation data from workflow 1

   **Branch 3**: Assign to `Forge Sentiment Tracker` agent
   - Task: "Track market sentiment signals"
   - Input: funding and social data from workflow 1

   **Branch 4**: Assign to `Forge Pattern Matcher` agent
   - Task: "Find historical analogs and extract forward paths"
   - Input: price history from workflow 1

5. After all branches: Assign to `Forge Synthesizer` (Program Manager)
   - Task: "Combine all predictions into 1,000 weighted paths"
   - Input: all 4 branch outputs + current agent weights

6. Final step: Store output as prediction JSON
7. Save workflow

### Workflow 3: Validation & Scoring

1. **Create Workflow** → Name: `Forge Validation Scoring`
2. Trigger: **Cron Schedule** → `0 * * * *` (hourly, checks for 24h-old predictions)
3. Reference `openserv/workflows/03-validation-scoring.json` for steps:
   - Fetch realized prices from Pyth historical endpoint
   - Calculate CRPS per agent
   - Transform scores (best=0, worst capped at p90)
   - Update 10-day EMA
   - Update leaderboard file
   - Archive results
4. Save workflow

### Workflow 4: Reward Distribution

1. **Create Workflow** → Name: `Forge Reward Distribution`
2. Trigger: **Cron Schedule** → `0 0 * * 0` (Sundays 00:00 UTC)
3. Reference `openserv/workflows/04-reward-distribution.json` for steps:
   - Calculate softmax weights from EMA scores
   - Compute reward pool (revenue × 60%)
   - Distribute USDC via x402 to agent wallets
   - Auto-deprecate bottom 10% performers
   - Archive distribution record
4. Save workflow

---

## PHASE 4: Configure MCP Servers (5 minutes)

In OpenServ dashboard → **MCP Servers**:

1. **Pyth Oracle MCP**
   - Name: `pyth-oracle`
   - Type: HTTP
   - URL: `https://hermes.pyth.network`
   - Auto-register tools: Yes

2. **Deribit MCP**
   - Name: `deribit`
   - Type: HTTP
   - URL: `https://www.deribit.com/api/v2`
   - Auto-register tools: Yes

3. **CoinGlass MCP**
   - Name: `coinglass`
   - Type: HTTP
   - URL: `https://open-api-v3.coinglass.com`
   - Headers: `coinglassSecret: {your key}`
   - Auto-register tools: Yes

---

## PHASE 5: Configure x402 Payments (5 minutes)

1. In OpenServ dashboard → **Payments / x402**
2. Connect your wallet (Base network)
3. Settlement token: USDC
4. Fund the reward pool wallet with initial USDC
5. The weekly reward workflow will distribute automatically

---

## PHASE 6: Verify Everything Works

### Check agent connectivity:
- OpenServ dashboard → each agent should show **Connected** status
- If not: check Render/Railway logs for errors, verify env vars

### Check workflow execution:
- Wait 30 minutes for first ingestion cycle to trigger
- OpenServ dashboard → Workflows → check execution history
- Ingestion should complete → triggers Prediction Generation → completes

### Check API:
- Visit `https://your-forge-api-url.onrender.com/health`
- Should return `{"status":"ok","version":"1.0.0",...}`

### Test prediction endpoint:
- Visit `https://your-forge-api-url.onrender.com/api/v1/predictions/BTC`
- After first cycle completes, returns ForgeOutput JSON

---

## PHASE 7: Open for External Agents (Moltbot/OpenClaw)

External agent developers register via your API:

```
POST https://your-forge-api-url.onrender.com/api/v1/agents/register
{
  "name": "my-volatility-agent",
  "endpointUrl": "https://their-agent-url.com",
  "capabilities": ["volatility_prediction"],
  "architecture": "LSTM-custom-v2",
  "walletAddress": "0xTheirWallet"
}
```

They stake $50 USDC → enter shadow validation → if valid → active → start earning.

---

## Auto-Deploy on Code Changes

GitHub Actions (`.github/workflows/deploy.yml`) automatically:
1. Typechecks on every push
2. Builds on every push
3. Deploys to Render/Railway on push to `main`

To enable:
- **Render**: Get deploy hook URL from Render dashboard → add as GitHub secret `RENDER_DEPLOY_HOOK_URL`
- **Railway**: Get token from Railway dashboard → add as GitHub secret `RAILWAY_TOKEN`

---

## File Reference

| File | Purpose |
|------|---------|
| `openserv/agents/*.json` | Copy system prompts and configs when registering agents on OpenServ |
| `openserv/workflows/*.json` | Reference when building workflows in OpenServ workflow builder |
| `render.yaml` | Auto-configures Render Blueprint deployment |
| `railway.json` | Auto-configures Railway deployment |
| `docker-compose.yml` | For Docker-based deployment |
| `.github/workflows/deploy.yml` | CI/CD pipeline |
