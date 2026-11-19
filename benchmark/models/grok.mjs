// Grok 3 adapter via xAI API (OpenAI-compatible)
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export const MODEL_ID = "grok-3";
export const MODEL_NAME = "grok-3";

export async function generate(systemPrompt, userPrompt) {
  const response = await client.chat.completions.create({
    model: MODEL_ID,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  return response.choices[0].message.content;
}
