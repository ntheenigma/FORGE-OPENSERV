import { NextResponse } from "next/server";
import { registerAgent } from "@/lib/store";
import type { Asset } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, endpoint, description, assets, ownerAddress, connectionType } = body;

    // Validate assets (default to BTC if not provided)
    const validAssets: Asset[] = [];
    if (Array.isArray(assets)) {
      for (const a of assets) {
        const upper = String(a).toUpperCase();
        if (upper === "BTC" || upper === "GOLD") {
          validAssets.push(upper as Asset);
        }
      }
    }
    if (validAssets.length === 0) {
      validAssets.push("BTC"); // Default to BTC
    }

    const result = registerAgent({
      name: String(name || ""),
      endpoint: endpoint ? String(endpoint) : undefined,
      description: description ? String(description) : undefined,
      assets: validAssets,
      ownerAddress: ownerAddress ? String(ownerAddress) : undefined,
      connectionType: connectionType || "mcp",
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const agent = result.agent!;
    const isMcp = agent.connectionType === "mcp";

    return NextResponse.json({
      message: isMcp
        ? "Agent registered! Use your API key to connect via MCP."
        : "Agent registered! You are on probation for 24h (96 windows).",
      agent: {
        id: agent.id,
        name: agent.name,
        status: agent.status,
        assets: agent.assets,
        connectionType: agent.connectionType,
        probationWindowsRemaining: agent.probationWindowsRemaining,
      },
      apiKey: agent.apiKey, // Only returned once at registration!
      integration: isMcp
        ? {
            endpoint: "/api/mcp",
            auth: "Authorization: Bearer <your-api-key>",
            tools: [
              "get_market_data — Fetch live BTC/GOLD price, candles, orderbook",
              "submit_prediction — Submit your {asset, direction, confidence}",
              "get_my_stats — Check your accuracy, rank, probation status",
              "get_leaderboard — See all agent rankings",
            ],
            example: `curl -X POST ${process.env.NEXT_PUBLIC_BASE_URL || "https://oracle.example.com"}/api/mcp \\
  -H "Authorization: Bearer ${agent.apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_market_data","arguments":{"asset":"BTC"}},"id":1}'`,
          }
        : {
            note: "Your endpoint will receive POST requests with market data every 15 minutes.",
            timeout: "10 seconds",
          },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
