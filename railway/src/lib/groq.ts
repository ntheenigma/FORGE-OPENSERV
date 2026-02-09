import Groq from "groq-sdk";

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY || "",
});

export async function synthesize(prompt: string): Promise<string> {
  const res = await client.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 1024,
    response_format: { type: "json_object" },
  });
  return res.choices[0]?.message?.content || "{}";
}
