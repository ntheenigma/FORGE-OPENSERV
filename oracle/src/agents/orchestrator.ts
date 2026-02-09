import type { AgentSignal, Asset, MarketSnapshot } from "@/lib/types";
import { AGENT_CONFIGS } from "@/lib/constants";
import { setAgentSignals, getLatestPrice } from "@/lib/store";
import { analyzeTrend } from "./trend-agent";
import { analyzeRSI } from "./rsi-agent";
import { analyzeVolume } from "./volume-agent";
import { analyzeMacro } from "./macro-agent";
import { analyzePatterns } from "./pattern-agent";
import { analyzeSentiment } from "./sentiment-agent";

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

  // Run all agents in parallel
  const agentPromises = AGENT_CONFIGS.filter((a) => a.enabled).map(
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

  const results = await Promise.all(agentPromises);
  const signals = results.filter((s): s is AgentSignal => s !== null);

  console.log(
    `[ORACLE] ${asset} agents: ${signals.length}/${AGENT_CONFIGS.length} succeeded | ` +
    signals.map((s) => `${s.agentType}=${s.direction}(${s.confidence}%)`).join(", ")
  );

  setAgentSignals(asset, signals);
  return signals;
}
