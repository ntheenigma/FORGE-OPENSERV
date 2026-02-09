export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");
    const { runPipeline, runScoring } = await import("@/agents/pipeline");

    // Run prediction pipeline every 15 minutes
    cron.schedule("*/15 * * * *", async () => {
      try {
        await runPipeline();
      } catch (e) {
        console.error("[FORGE] Pipeline cron error:", e);
      }
    });

    // Run scoring 7 minutes after each prediction
    cron.schedule("7,22,37,52 * * * *", async () => {
      try {
        await runScoring();
      } catch (e) {
        console.error("[FORGE] Scoring cron error:", e);
      }
    });

    // Run once on startup after 5 seconds
    setTimeout(async () => {
      console.log("[FORGE] Initial pipeline run...");
      try {
        await runPipeline();
      } catch (e) {
        console.error("[FORGE] Initial run error:", e);
      }
    }, 5000);

    console.log("[FORGE] Cron jobs registered: prediction (*/15), scoring (+7min offset)");
  }
}
