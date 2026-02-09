import { fetchMarketData } from "./data-fetcher";
import { analyzeCandles } from "./candle-analyst";
import { analyzeOrderFlow } from "./flow-analyst";
import { analyzeMomentum } from "./momentum-analyst";
import { analyzeReversion } from "./reversion-analyst";
import { applyWeights } from "./weigher";
import { synthesizeConsensus } from "./synthesizer";
import { scorePredictions } from "./scorer";
import { appendLog, setLatestConsensus, readJSON } from "@/lib/store";
import type { PipelineResult, Prediction } from "@/lib/types";

let lastResult: PipelineResult | null = null;
let pendingScore: {
  windowId: string;
  predictions: Prediction[];
  consensusPrediction: string;
  consensusConfidence: number;
  price: number;
} | null = null;

export function getLastResult() {
  return lastResult;
}

function windowId(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function dateStr(): string {
  return new Date().toISOString().split("T")[0];
}

export async function runPipeline(): Promise<PipelineResult | null> {
  console.log(`[FORGE] Pipeline starting at ${new Date().toISOString()}`);

  // 1. Fetch data
  const data = await fetchMarketData();
  if (!data.sources.binance && !data.sources.pyth) {
    console.error("[FORGE] All data sources failed, aborting");
    return null;
  }

  // 2. Run analysts in parallel (pure math — instant)
  const predictions: Prediction[] = [];

  if (data.candles.length > 0) {
    predictions.push(analyzeCandles(data.candles));
    predictions.push(analyzeMomentum(data.candles));
    predictions.push(analyzeReversion(data.candles));
  }
  if (data.orderbook.bids.length > 0) {
    predictions.push(analyzeOrderFlow(data.orderbook));
  }

  if (predictions.length < 2) {
    console.error("[FORGE] Fewer than 2 predictions, aborting");
    return null;
  }

  // 3. Apply weights
  const weighted = applyWeights(predictions);

  // 4. Synthesize consensus (Groq LLM or fallback)
  const wid = windowId();
  const consensus = await synthesizeConsensus(weighted, wid);

  // 5. Build result
  const result: PipelineResult = {
    window_id: wid,
    market_data: data,
    predictions,
    consensus,
    timestamp: new Date().toISOString(),
  };

  // 6. Log
  appendLog(dateStr(), {
    window_id: wid,
    price_at_prediction: data.price,
    individual_predictions: predictions,
    consensus,
    outcome: null,
  });

  // 7. Store latest for API
  lastResult = result;
  setLatestConsensus(result);

  // 8. Queue for scoring in 15 min
  pendingScore = {
    windowId: wid,
    predictions,
    consensusPrediction: consensus.prediction,
    consensusConfidence: consensus.confidence,
    price: data.price,
  };

  console.log(
    `[FORGE] ${consensus.prediction} @ ${consensus.confidence} (${consensus.action}) | ${predictions.length} agents | ${wid}`
  );

  return result;
}

export async function runScoring(): Promise<void> {
  if (!pendingScore) {
    console.log("[FORGE] No pending score");
    return;
  }

  const { predictions, consensusPrediction, consensusConfidence, price, windowId: wid } =
    pendingScore;
  pendingScore = null;

  const scoreResult = await scorePredictions(
    predictions,
    consensusPrediction,
    consensusConfidence,
    price
  );

  if (scoreResult) {
    console.log(
      `[FORGE] Scored ${wid}: consensus ${scoreResult.consensus_correct ? "CORRECT" : "WRONG"} | change ${scoreResult.price_change_pct.toFixed(3)}%`
    );
  }
}
