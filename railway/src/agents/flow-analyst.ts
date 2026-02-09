import type { OrderBook, Prediction } from "@/lib/types";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function analyzeOrderFlow(orderbook: OrderBook): Prediction {
  const { bids, asks } = orderbook;

  if (bids.length < 5 || asks.length < 5) {
    return {
      prediction: "UP",
      confidence: 0.5,
      reasoning: "insufficient_depth",
      specialization: "order_flow",
      timestamp: new Date().toISOString(),
    };
  }

  let direction: "UP" | "DOWN" = "UP";
  let conf = 0.55;
  const reasons: string[] = [];

  // Bid/ask imbalance
  const totalBid = bids.reduce((s, b) => s + b[1], 0);
  const totalAsk = asks.reduce((s, a) => s + a[1], 0);
  const imbalance = totalAsk > 0 ? totalBid / totalAsk : 1;

  if (imbalance > 1.3) {
    direction = "UP";
    conf += 0.10;
    reasons.push(`strong_bid_imbalance_${imbalance.toFixed(2)}`);
  } else if (imbalance > 1.1) {
    direction = "UP";
    reasons.push(`mild_bid_pressure_${imbalance.toFixed(2)}`);
  } else if (imbalance < 0.7) {
    direction = "DOWN";
    conf += 0.10;
    reasons.push(`strong_ask_imbalance_${imbalance.toFixed(2)}`);
  } else if (imbalance < 0.9) {
    direction = "DOWN";
    reasons.push(`mild_ask_pressure_${imbalance.toFixed(2)}`);
  }

  // Wall detection
  const allSizes = [...bids.map((b) => b[1]), ...asks.map((a) => a[1])];
  allSizes.sort((a, b) => a - b);
  const median = allSizes[Math.floor(allSizes.length / 2)];
  const wallThreshold = median * 3;

  const midPrice = (bids[0][0] + asks[0][0]) / 2;
  const bidWalls = bids.filter(
    (b) => b[1] > wallThreshold && Math.abs(b[0] - midPrice) / midPrice < 0.001
  );
  const askWalls = asks.filter(
    (a) => a[1] > wallThreshold && Math.abs(a[0] - midPrice) / midPrice < 0.001
  );

  if (bidWalls.length > 0) {
    conf += 0.05;
    reasons.push("bid_wall");
  }
  if (askWalls.length > 0) {
    conf += 0.05;
    if (direction === "UP") direction = "DOWN"; // resistance
    reasons.push("ask_wall");
  }

  // Spread analysis
  const spread = asks[0][0] - bids[0][0];
  const spreadBps = (spread / midPrice) * 10000;

  if (spreadBps > 5) {
    conf -= 0.10;
    reasons.push("wide_spread");
  } else if (spreadBps < 2) {
    conf += 0.05;
    reasons.push("tight_spread");
  }

  // Depth gradient
  const topBidSize = bids.slice(0, 5).reduce((s, b) => s + b[1], 0);
  const topAskSize = asks.slice(0, 5).reduce((s, a) => s + a[1], 0);
  if (topBidSize / totalBid > 0.6) {
    direction = "UP";
    conf += 0.05;
    reasons.push("top_heavy_bids");
  } else if (topAskSize / totalAsk > 0.6) {
    direction = "DOWN";
    conf += 0.05;
    reasons.push("top_heavy_asks");
  }

  return {
    prediction: direction,
    confidence: clamp(Number(conf.toFixed(2)), 0.5, 0.8),
    reasoning: reasons.join("+").slice(0, 80),
    specialization: "order_flow",
    timestamp: new Date().toISOString(),
    indicators: {
      imbalance_ratio: Number(imbalance.toFixed(3)),
      spread_bps: Number(spreadBps.toFixed(1)),
    },
  };
}
