import type { WeightedPrediction, Consensus } from "@/lib/types";
import { synthesize } from "@/lib/groq";

function fallbackSynthesize(
  predictions: WeightedPrediction[],
  windowId: string
): Consensus {
  // Pure math fallback if Groq is unavailable
  let upWeight = 0;
  let downWeight = 0;

  for (const p of predictions) {
    if (p.prediction === "UP") upWeight += p.normalized_weight;
    else downWeight += p.normalized_weight;
  }

  const direction: "UP" | "DOWN" = upWeight >= downWeight ? "UP" : "DOWN";
  const total = predictions.length;
  const agreeing = predictions.filter((p) => p.prediction === direction).length;
  const ratio = total > 0 ? agreeing / total : 0;

  let conf = Math.max(upWeight, downWeight);
  if (ratio >= 0.9) conf += 0.05;
  else if (ratio < 0.55) conf -= 0.12;

  const uniqueSpecs = new Set(predictions.map((p) => p.specialization)).size;
  if (uniqueSpecs / total >= 1) conf += 0.04;

  conf = Math.max(0.5, Math.min(0.85, conf));
  conf = Number(conf.toFixed(2));

  let action: Consensus["action"] = "no_trade";
  let sizePct = 0;
  if (conf >= 0.78) { action = "full"; sizePct = 60; }
  else if (conf >= 0.7) { action = "large"; sizePct = 40; }
  else if (conf >= 0.62) { action = "medium"; sizePct = 25; }
  else if (conf >= 0.55) { action = "small"; sizePct = 10; }

  // Simple regime detection
  const hasUp = predictions.some(
    (p) => p.specialization === "momentum_trend" && p.prediction === "UP"
  );
  const hasRevDown = predictions.some(
    (p) => p.specialization === "mean_reversion" && p.prediction === "DOWN"
  );
  const regime: Consensus["regime"] =
    hasUp && hasRevDown ? "trending" : !hasUp && !hasRevDown ? "ranging" : "uncertain";

  return {
    prediction: direction,
    confidence: conf,
    action,
    position_size_pct: sizePct,
    regime,
    reasoning: `${agreeing}/${total}_agents_${direction}_weighted_${Math.max(upWeight, downWeight).toFixed(2)}_${regime}`,
    vote_breakdown: {
      up_weight: Number(upWeight.toFixed(3)),
      down_weight: Number(downWeight.toFixed(3)),
      agreement_ratio: Number(ratio.toFixed(2)),
      unique_specializations: uniqueSpecs,
    },
    agent_contributions: predictions.map((p) => ({
      specialization: p.specialization,
      vote: p.prediction,
      weight: p.normalized_weight,
    })),
    timestamp: new Date().toISOString(),
    window_id: windowId,
    asset: "BTC-USD",
    horizon_minutes: 15,
  };
}

export async function synthesizeConsensus(
  predictions: WeightedPrediction[],
  windowId: string
): Promise<Consensus> {
  // Try Groq first, fall back to pure math
  if (!process.env.GROQ_API_KEY) {
    return fallbackSynthesize(predictions, windowId);
  }

  try {
    const prompt = `You are the FORGE consensus engine. Given these weighted BTC predictions, produce a JSON consensus.

PREDICTIONS:
${JSON.stringify(predictions, null, 2)}

Rules:
- Weighted vote: sum normalized_weight by direction, majority wins
- Agreement: ratio of agents agreeing. >=0.9 gives +0.05 conf, <0.55 gives -0.12
- Diversity: unique specializations / total. Full diversity = +0.04 conf
- Contrarian bonus: if one agent disagrees with high weight (>0.60), give it 1.2x
- Regime: momentum+candle agree = trending, reversion+flow agree = ranging, else uncertain
- Confidence clamped to [0.50, 0.85]
- Position sizing: <0.55=no_trade, 0.55-0.62=small(10%), 0.62-0.70=medium(25%), 0.70-0.78=large(40%), >=0.78=full(60%)

Output ONLY this JSON:
{"prediction":"UP"|"DOWN","confidence":0.xx,"action":"...","position_size_pct":N,"regime":"...","reasoning":"max 120 chars","vote_breakdown":{"up_weight":N,"down_weight":N,"agreement_ratio":N,"unique_specializations":N},"agent_contributions":[{"specialization":"...","vote":"...","weight":N}],"timestamp":"${new Date().toISOString()}","window_id":"${windowId}","asset":"BTC-USD","horizon_minutes":15}`;

    const raw = await synthesize(prompt);
    const parsed = JSON.parse(raw) as Consensus;

    // Validate and sanitize
    if (
      parsed.prediction !== "UP" &&
      parsed.prediction !== "DOWN"
    ) {
      return fallbackSynthesize(predictions, windowId);
    }
    parsed.confidence = Math.max(0.5, Math.min(0.85, parsed.confidence));
    parsed.window_id = windowId;
    parsed.timestamp = new Date().toISOString();
    return parsed;
  } catch {
    return fallbackSynthesize(predictions, windowId);
  }
}
