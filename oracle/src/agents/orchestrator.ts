import type { AgentSignal, Asset, MarketSnapshot } from "@/lib/types";
import { AGENT_CONFIGS } from "@/lib/constants";
import { setAgentSignals, getLatestPrice } from "@/lib/store";
import { analyzeTrend } from "./trend-agent";
import { analyzeRSI } from "./rsi-agent";
import { analyzeVolume } from "./volume-agent";
import { analyzeMacro } from "./macro-agent";
import { analyzePatterns } from "./pattern-agent";
import { analyzeSentiment } from "./sentiment-agent";
import { callExternalAgents } from "./external-caller";

export async function runAgentAnalysis(
  asset: Asset,
  snapshot: MarketSnapshot
): Promise<AgentSignal[]> {
  const { candles, orderbook } = snapshot;

  if (candles.length < 20) {
    console.warn(`[ORACLE] Not enough candles for ${asset} analysis (${candles.length})`);
    return [];
  }

  const goldPrice = getLatestPrice("GOLD")?.price ?? 2650;

  // Run core agents in parallel
  const corePromises = AGENT_CONFIGS.filter((a) => a.enabled).map(
    async (config): Promise<AgentSignal | null> => {
      try {
        switch (config.type) {
          case "trend":
            return await analyzeTrend(asset, candles);
          case "rsi":
            return await analyzeRSI(asset, candles);
          case "volume":
            return await analyzeVolume(asset, candles, orderbook);
          case "macro":
            return await analyzeMacro(asset, candles, goldPrice);
          case "pattern":
            return await analyzePatterns(asset, candles);
          case "sentiment":
            return await analyzeSentiment(asset);
          default:
            return null;
        }
      } catch (e) {
        console.error(`[ORACLE] Agent ${config.type} failed for ${asset}:`, e);
        return null;
      }
    }
  );

  // Run external agents in parallel WITH core agents
  const [coreResults, externalSignals] = await Promise.all([
    Promise.all(corePromises),
    callExternalAgents(asset, snapshot),
  ]);

  const coreSignals = coreResults.filter((s): s is AgentSignal => s !== null);
  const allSignals = [...coreSignals, ...externalSignals];

  const coreCount = coreSignals.length;
  const extCount = externalSignals.length;
  const total = allSignals.length;

  console.log(
    `[ORACLE] ${asset}: ${coreCount} core + ${extCount} external = ${total} agents | ` +
    allSignals.map((s) => `${s.agentType}=${s.direction}(${s.confidence}%)`).join(", ")
  );

  setAgentSignals(asset, allSignals);
  return allSignals;
}
