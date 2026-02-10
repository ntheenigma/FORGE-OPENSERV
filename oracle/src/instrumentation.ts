export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");

    // Run agent analysis every 15 minutes for BTC
    cron.default.schedule("*/15 * * * *", async () => {
      console.log("[ORACLE] Cron: Running BTC agent analysis...");
      try {
        const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        await fetch(`${base}/api/agents/analyze?asset=BTC`, { method: "POST" });
      } catch (e) {
        console.error("[ORACLE] BTC cron failed:", e);
      }
    });

    // Run agent analysis every 15 minutes for GOLD (offset by 2 min)
    cron.default.schedule("2,17,32,47 * * * *", async () => {
      console.log("[ORACLE] Cron: Running GOLD agent analysis...");
      try {
        const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        await fetch(`${base}/api/agents/analyze?asset=GOLD`, { method: "POST" });
      } catch (e) {
        console.error("[ORACLE] GOLD cron failed:", e);
      }
    });

    // Multi-timeframe scoring: resolve 1m/5m/15m predictions every minute
    cron.default.schedule("* * * * *", async () => {
      try {
        const { resolveMultiTimeframe } = await import("@/lib/store");
        const resolved = resolveMultiTimeframe();
        if (resolved > 0) {
          console.log(`[ORACLE] Multi-timeframe: resolved ${resolved} horizon checks`);
        }
      } catch (e) {
        console.error("[ORACLE] Multi-timeframe scoring failed:", e);
      }
    });

    console.log("[ORACLE] Cron jobs registered: BTC (*/15), GOLD (2,17,32,47), Scoring (*/1)");
  }
}
