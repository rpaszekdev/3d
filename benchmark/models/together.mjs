// Llama 3.3 70B adapter via Together API (OpenAI-compatible)
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

export const MODEL_ID = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
export const MODEL_NAME = "llama-3.3-70b";

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
