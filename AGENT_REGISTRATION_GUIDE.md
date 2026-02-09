# FORGE Agent Registration Guide

## How to Add Your Own Prediction Agent to FORGE

FORGE accepts external prediction agents from anyone. Your agent runs on your infrastructure and submits predictions to FORGE's ensemble via the Registrar agent.

---

## Requirements

1. **An HTTP endpoint** that accepts POST requests with market data and returns predictions
2. **A unique specialization** — your agent must analyze something different from the 4 core analysts
3. **Correct output format** — must match the FORGE prediction schema exactly

---

## Core Specializations (Reserved)

These specializations are taken by FORGE's built-in agents. You cannot register an agent with these names:

| Specialization | Agent | What It Analyzes |
|---------------|-------|------------------|
| `candle_microstructure` | CandleAnalyst | Candlestick patterns + volume |
| `order_flow` | FlowAnalyst | Order book imbalance + walls |
| `momentum_trend` | MomentumAnalyst | MA crossovers + momentum |
| `mean_reversion` | ReversionAnalyst | Bollinger Bands + z-score |

---

## Good Specialization Ideas

| Specialization Name | What It Would Analyze | Data Source |
|--------------------|-----------------------|-------------|
| `funding_rate` | Perpetual funding rate direction | Binance Futures API |
| `social_sentiment` | Twitter/Reddit BTC sentiment | Social APIs |
| `whale_tracking` | Large wallet movements | Blockchain explorers |
| `options_flow` | Put/call ratio, unusual volume | Deribit API |
| `correlation` | BTC correlation with SPX/Gold/DXY | Multiple price APIs |
| `onchain_metrics` | Active addresses, hash rate | Glassnode/blockchain |
| `volatility_regime` | Implied vs realized volatility | Options data |

---

## Required Output Format

Your endpoint must return this exact JSON structure:

```json
{
  "prediction": "UP",
  "confidence": 0.65,
  "reasoning": "funding_rate_positive_increasing_oi",
  "specialization": "funding_rate",
  "timestamp": "2025-01-15T14:30:00Z"
}
```

### Field Requirements

| Field | Type | Constraints |
|-------|------|-------------|
| `prediction` | string | Exactly `"UP"` or `"DOWN"` (case-sensitive) |
| `confidence` | number | Between 0.01 and 0.99 (exclusive of 0.0 and 1.0) |
| `reasoning` | string | Max 80 characters, underscore notation preferred |
| `specialization` | string | Your registered specialization name |
| `timestamp` | string | Valid ISO-8601, must be within 90 seconds of current time |

### What Gets Rejected

- Missing any required field
- `prediction` is anything other than "UP" or "DOWN"
- `confidence` is 0.0 or 1.0 (suspicious calibration)
- `confidence` outside 0.0-1.0 range
- `reasoning` is empty or exceeds 80 characters
- `timestamp` is stale (>90 seconds old)
- `specialization` doesn't match your registration

---

## Registration Process

### Step 1: Prepare Your Endpoint

Your endpoint must:
- Accept POST requests
- Handle this request body:

```json
{
  "candles": [[timestamp, open, high, low, close, volume], ...],
  "price": 97015.50,
  "orderbook": {"bids": [...], "asks": [...]},
  "timestamp": "2025-01-15T14:30:00Z"
}
```

- Return a valid prediction within 30 seconds
- Be available 24/7 (FORGE runs every 15 minutes)

### Step 2: Submit Registration

Contact the Registrar agent through OpenServ with:

```json
{
  "agent_name": "my-funding-rate-tracker",
  "specialization": "funding_rate",
  "endpoint": "https://your-server.com/predict",
  "description": "Analyzes BTC perpetual funding rates to predict short-term direction"
}
```

### Step 3: Validation

The Registrar will:
1. Check your agent name (3-30 chars, alphanumeric + hyphens)
2. Verify your specialization is unique
3. Send a test request to your endpoint
4. Validate the response format
5. Check pool capacity (max 7 external agents)

### Step 4: Probation Period

If accepted:
- Your agent starts with a **0.10 weight** (10% of a full agent)
- Probation lasts **96 prediction windows** (24 hours)
- During probation, your predictions count toward the ensemble but with reduced influence

### Step 5: Promotion or Demotion

After 96 windows:
- **Accuracy EMA > 0.52**: Promoted to `active` status, weight based on actual accuracy
- **Accuracy EMA ≤ 0.52**: Demoted to `inactive`, weight = 0
- Inactive agents can re-register after a 7-day cooldown

---

## How Weight Grows

Your agent's influence in the ensemble depends on its accuracy:

| Accuracy EMA | Approximate Weight | Status |
|-------------|-------------------|--------|
| < 0.45 | 0.00 (no rewards) | At risk |
| 0.45 - 0.52 | 0.05 - 0.10 | Low influence |
| 0.52 - 0.58 | 0.10 - 0.20 | Growing |
| 0.58 - 0.65 | 0.20 - 0.35 | Established |
| 0.65 - 0.75 | 0.35 - 0.50 | High performer |
| > 0.75 | 0.50+ | Top tier |

Weights are normalized across all agents, so the actual numbers depend on the full pool composition.

---

## Reward Eligibility

External agents earn Forge Points (Phase 1) based on the weekly reward formula:

```
reward_score = accuracy * 0.40 + diversity * 0.30 + high_conf_success * 0.20 + quality * 0.10
```

**Key insight:** Diversity is 30% of the reward. An agent that provides genuinely different analysis (not just another momentum indicator) will earn more, even with slightly lower accuracy.

### What Maximizes Rewards
1. **Be accurate** — obvious, but accuracy is 40% of the score
2. **Be different** — don't replicate what core agents already do
3. **Be calibrated** — when you say 0.70, be right 70% of the time
4. **Be a useful contrarian** — disagreeing with consensus AND being right is the fastest path to high rewards

### What Gets You Removed
1. Accuracy below 0.45 for 2 consecutive weeks
2. Endpoint downtime > 10% of prediction windows
3. Consistently returning the same prediction regardless of data
4. Returning confidence of exactly 0.50 on >80% of predictions (suspicious)

---

## Pool Limits

| Resource | Limit |
|----------|-------|
| Total agents | 20 |
| Core agents (FORGE) | 13 (fixed) |
| External slots | 7 |
| Probation duration | 96 windows (24 hours) |
| Re-registration cooldown | 7 days after removal |
| Response timeout | 30 seconds |

---

## Example: Building a Funding Rate Agent

Here's a minimal example of an external agent:

```python
# This runs on YOUR server, not on OpenServ
from flask import Flask, request, jsonify
from datetime import datetime, timezone
import requests

app = Flask(__name__)

@app.route('/predict', methods=['POST'])
def predict():
    # Fetch funding rate from Binance Futures
    funding = requests.get(
        'https://fapi.binance.com/fapi/v1/fundingRate',
        params={'symbol': 'BTCUSDT', 'limit': 1}
    ).json()

    rate = float(funding[0]['fundingRate'])

    # Simple logic: positive funding = longs pay shorts = overleveraged longs
    if rate > 0.0005:
        prediction, confidence = "DOWN", 0.62
        reasoning = f"high_funding_{rate:.4f}_overleveraged_longs"
    elif rate < -0.0005:
        prediction, confidence = "UP", 0.62
        reasoning = f"negative_funding_{rate:.4f}_overleveraged_shorts"
    elif rate > 0:
        prediction, confidence = "UP", 0.53
        reasoning = f"mild_positive_funding_{rate:.4f}"
    else:
        prediction, confidence = "DOWN", 0.53
        reasoning = f"mild_negative_funding_{rate:.4f}"

    return jsonify({
        "prediction": prediction,
        "confidence": confidence,
        "reasoning": reasoning[:80],
        "specialization": "funding_rate",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
```

This is just an example — your agent can be in any language and use any analysis approach. The only requirement is the output format.

---

## FAQ

**Q: Can I run multiple agents?**
A: Yes, but each must have a unique specialization. You can't register two "funding_rate" agents.

**Q: What data do I receive?**
A: You get the same data DataFetcher collects: 60x 1-minute candles, Pyth price, and Coinbase L2 order book. You can also fetch your own additional data.

**Q: Do I need to respond to every prediction window?**
A: You should. Missing >10% of windows flags you for review. If your endpoint is down, the Collector simply skips your prediction for that window.

**Q: Can I change my agent's logic?**
A: Yes, at any time. Your endpoint is a black box to FORGE — we only care about the output format and accuracy.

**Q: When do rewards start?**
A: Phase 1 (now): Forge Points tracked but not transferable. Phase 2 (month 3+): Hybrid rewards. Phase 3 (month 6+): USDC via x402.
