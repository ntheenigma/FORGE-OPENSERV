import { NextResponse } from "next/server";
import {
  getAgentByApiKey,
  submitAgentPrediction,
  getAgentLeaderboard,
  getLatestPrice,
  getCandleCache,
  getConsensus,
  getPendingResolutionCount,
} from "@/lib/store";
import { fetchMarketSnapshot } from "@/lib/market-data";
import type { Asset, Direction } from "@/lib/types";

// ── JSON-RPC 2.0 MCP Server ──
// Agents authenticate with API key and call tools to get data + submit predictions

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return NextResponse.json({
    jsonrpc: "2.0",
    error: { code, message },
    id,
  });
}

function jsonRpcResult(id: string | number | null, result: unknown) {
  return NextResponse.json({
    jsonrpc: "2.0",
    result,
    id,
  });
}

// ── Tool Definitions ──

const TOOLS = [
  {
    name: "get_market_data",
    description: "Get live market data for BTC or GOLD: price, last 60 candles, orderbook (top 20 levels)",
    inputSchema: {
      type: "object",
      properties: {
        asset: { type: "string", enum: ["BTC", "GOLD"], description: "Asset to get data for" },
      },
      required: ["asset"],
    },
  },
  {
    name: "submit_prediction",
    description: "Submit your directional prediction for the next window",
    inputSchema: {
      type: "object",
      properties: {
        asset: { type: "string", enum: ["BTC", "GOLD"], description: "Asset to predict" },
        direction: { type: "string", enum: ["up", "down"], description: "Your directional call" },
        confidence: { type: "number", minimum: 1, maximum: 95, description: "Confidence 1-95" },
        reasoning: { type: "string", maxLength: 200, description: "Optional reasoning" },
      },
      required: ["asset", "direction", "confidence"],
    },
  },
  {
    name: "get_my_stats",
    description: "Get your agent's accuracy, rank, probation status, and performance stats",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_leaderboard",
    description: "Get the current agent leaderboard with rankings and accuracy",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max entries (default 20)" },
      },
    },
  },
];

// ── Tool Handlers ──

async function handleGetMarketData(args: Record<string, unknown>) {
  const asset = String(args.asset || "BTC").toUpperCase();
  if (asset !== "BTC" && asset !== "GOLD") {
    return { error: "Invalid asset. Use BTC or GOLD." };
  }

  // Try cache first, fallback to live fetch
  const cachedPrice = getLatestPrice(asset);
  const cachedCandles = getCandleCache(`${asset}:1m`);
  const consensus = getConsensus(asset);

  if (cachedPrice && cachedCandles && cachedCandles.length > 0) {
    return {
      asset,
      price: cachedPrice.price,
      change24h: cachedPrice.change24h,
      candles: cachedCandles.slice(-60),
      timestamp: cachedPrice.timestamp,
      consensus: consensus
        ? {
            direction: consensus.direction,
            confidence: consensus.confidence,
            agentCount: consensus.agentCount,
          }
        : null,
    };
  }

  // Live fetch
  const snapshot = await fetchMarketSnapshot(asset as Asset);
  return {
    asset,
    price: snapshot.price,
    change24h: snapshot.change24h,
    candles: snapshot.candles.slice(-60),
    orderbook: {
      bids: snapshot.orderbook.bids.slice(0, 20),
      asks: snapshot.orderbook.asks.slice(0, 20),
    },
    timestamp: snapshot.timestamp,
    consensus: consensus
      ? {
          direction: consensus.direction,
          confidence: consensus.confidence,
          agentCount: consensus.agentCount,
        }
      : null,
  };
}

function handleSubmitPrediction(
  agentId: string,
  args: Record<string, unknown>,
) {
  const asset = String(args.asset || "BTC").toUpperCase();
  if (asset !== "BTC" && asset !== "GOLD") {
    return { error: "Invalid asset. Use BTC or GOLD." };
  }

  const direction = String(args.direction || "").toLowerCase();
  if (direction !== "up" && direction !== "down") {
    return { error: 'Invalid direction. Use "up" or "down".' };
  }

  const confidence = Number(args.confidence);
  if (!confidence || confidence < 1 || confidence > 95) {
    return { error: "Confidence must be between 1 and 95." };
  }

  const reasoning = args.reasoning ? String(args.reasoning).slice(0, 200) : undefined;

  return submitAgentPrediction(
    agentId,
    asset as Asset,
    direction as Direction,
    confidence,
    reasoning,
  );
}

function handleGetMyStats(agentId: string) {
  const leaderboard = getAgentLeaderboard();
  const entry = leaderboard.find((e) => e.id === agentId);
  const rank = entry ? leaderboard.indexOf(entry) + 1 : null;

  // Find the agent in the pool for more details
  const agent = getAgentByApiKey(""); // Can't use this, need by ID
  // Use leaderboard entry instead
  if (!entry) {
    return {
      agentId,
      message: "No predictions yet. Submit your first prediction to appear in stats.",
      pendingResolutions: getPendingResolutionCount(),
    };
  }

  return {
    agentId,
    name: entry.name,
    rank,
    totalAgents: leaderboard.length,
    accuracy: Number((entry.accuracy * 100).toFixed(1)),
    totalPredictions: entry.totalPredictions,
    correctPredictions: entry.correctPredictions,
    status: entry.status,
    pendingResolutions: getPendingResolutionCount(),
  };
}

function handleGetLeaderboard(args: Record<string, unknown>) {
  const limit = Math.min(Number(args.limit) || 20, 50);
  const leaderboard = getAgentLeaderboard();

  return {
    leaderboard: leaderboard.slice(0, limit).map((entry, i) => ({
      rank: i + 1,
      name: entry.name,
      type: entry.type,
      accuracy: Number((entry.accuracy * 100).toFixed(1)),
      totalPredictions: entry.totalPredictions,
      status: entry.status,
    })),
    total: leaderboard.length,
  };
}

// ── Main Handler ──

export async function POST(req: Request) {
  // Authenticate via Bearer token
  const authHeader = req.headers.get("authorization") || "";
  const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!apiKey) {
    return jsonRpcError(null, -32000, "Missing Authorization header. Use: Bearer <your-api-key>");
  }

  const agent = getAgentByApiKey(apiKey);
  if (!agent) {
    return jsonRpcError(null, -32000, "Invalid API key or agent is banned");
  }

  // Parse JSON-RPC request
  let rpc: JsonRpcRequest;
  try {
    rpc = await req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  if (rpc.jsonrpc !== "2.0") {
    return jsonRpcError(rpc.id ?? null, -32600, "Invalid JSON-RPC version");
  }

  const id = rpc.id ?? null;
  const method = rpc.method;
  const params = (rpc.params || {}) as Record<string, unknown>;

  // Route methods
  switch (method) {
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "ORACLE Prediction Platform", version: "1.0.0" },
        capabilities: { tools: {} },
      });

    case "tools/list":
      return jsonRpcResult(id, { tools: TOOLS });

    case "tools/call": {
      const toolName = String(params.name || "");
      const args = (params.arguments || {}) as Record<string, unknown>;

      switch (toolName) {
        case "get_market_data": {
          const result = await handleGetMarketData(args);
          return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
        }

        case "submit_prediction": {
          const result = handleSubmitPrediction(agent.id, args);
          return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
        }

        case "get_my_stats": {
          const result = handleGetMyStats(agent.id);
          return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
        }

        case "get_leaderboard": {
          const result = handleGetLeaderboard(args);
          return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(result) }] });
        }

        default:
          return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`);
      }
    }

    default:
      return jsonRpcError(id, -32601, `Unknown method: ${method}`);
  }
}

// Health check / tool discovery for GET
export async function GET() {
  return NextResponse.json({
    name: "ORACLE MCP Server",
    version: "1.0.0",
    protocol: "MCP (Model Context Protocol) over JSON-RPC 2.0",
    endpoint: "POST /api/mcp",
    auth: "Bearer <api-key> in Authorization header",
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    quickstart: {
      "1_register": "POST /api/agents/register with { name: 'MyAgent' }",
      "2_get_data": "POST /api/mcp with tools/call get_market_data",
      "3_predict": "POST /api/mcp with tools/call submit_prediction",
      "4_check": "POST /api/mcp with tools/call get_my_stats",
    },
  });
}
