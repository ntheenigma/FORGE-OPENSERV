import type { AgentSignal, Asset, MarketSnapshot, ExternalPredictionResponse, RegisteredAgent } from "@/lib/types";
import { getActiveExternalAgents, getAgentHistoricalAccuracy, markExternalAgentFailure } from "@/lib/store";

const EXTERNAL_TIMEOUT_MS = 10_000; // 10 second timeout

async function callExternalAgent(
  agent: RegisteredAgent,
  asset: Asset,
  snapshot: MarketSnapshot
): Promise<AgentSignal | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);

  try {
    const payload = {
      asset,
      price: snapshot.price,
      candles: snapshot.candles.slice(-60),
      orderbook: {
        bids: snapshot.orderbook.bids.slice(0, 20),
        asks: snapshot.orderbook.asks.slice(0, 20),
      },
      timestamp: snapshot.timestamp,
    };

    const res = await fetch(agent.endpoint!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Oracle-Agent-Id": agent.id,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[ORACLE] External agent ${agent.name} returned ${res.status}`);
      markExternalAgentFailure(agent.id);
      return null;
    }

    const data: ExternalPredictionResponse = await res.json();

    // Validate response
    if (!data.direction || !["up", "down"].includes(data.direction)) {
      console.warn(`[ORACLE] External agent ${agent.name} returned invalid direction: ${data.direction}`);
      markExternalAgentFailure(agent.id);
      return null;
    }

    const confidence = Math.max(1, Math.min(95, Number(data.confidence) || 50));

    return {
      agentType: `ext:${agent.id}`,
      asset,
      direction: data.direction,
      confidence,
      reasoning: String(data.reasoning || agent.name).slice(0, 200),
      indicators: data.indicators || {},
      historicalAccuracy: getAgentHistoricalAccuracy(`ext:${agent.id}`),
      timestamp: Date.now(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort")) {
      console.warn(`[ORACLE] External agent ${agent.name} timed out (${EXTERNAL_TIMEOUT_MS}ms)`);
    } else {
      console.warn(`[ORACLE] External agent ${agent.name} failed: ${msg}`);
    }
    markExternalAgentFailure(agent.id);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callExternalAgents(
  asset: Asset,
  snapshot: MarketSnapshot
): Promise<AgentSignal[]> {
  // Only call HTTP-push agents — MCP agents submit their own predictions
  const agents = getActiveExternalAgents(asset).filter(
    (a) => a.connectionType === "http" && a.endpoint
  );

  if (agents.length === 0) {
    return [];
  }

  console.log(`[ORACLE] Calling ${agents.length} HTTP agents for ${asset}...`);

  const results = await Promise.allSettled(
    agents.map((agent) => callExternalAgent(agent, asset, snapshot))
  );

  const signals: AgentSignal[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      signals.push(result.value);
    }
  }

  console.log(
    `[ORACLE] External agents: ${signals.length}/${agents.length} responded for ${asset}`
  );

  return signals;
}
