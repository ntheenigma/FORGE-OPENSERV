import Groq from "groq-sdk";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export async function queryLLM(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = true
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY not set");
  }

  const res = await client.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 512,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  return res.choices[0]?.message?.content || "{}";
}

export async function queryAgent(
  agentName: string,
  systemPrompt: string,
  signals: string
): Promise<{ direction: "up" | "down"; confidence: number; reasoning: string }> {
  try {
    const raw = await queryLLM(systemPrompt, signals);
    const parsed = JSON.parse(raw);

    const direction = parsed.direction === "down" ? "down" : "up";
    const confidence = Math.max(10, Math.min(95, Number(parsed.confidence) || 50));
    const reasoning = String(parsed.reasoning || "no_reasoning").slice(0, 200);

    return { direction, confidence, reasoning };
  } catch (e) {
    console.error(`[ORACLE] ${agentName} LLM failed:`, e);
    throw e;
  }
}
