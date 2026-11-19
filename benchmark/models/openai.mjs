// GPT-4o adapter via OpenAI SDK
import OpenAI from "openai";

const client = new OpenAI();

export const MODEL_ID = "gpt-4o";
export const MODEL_NAME = "gpt-4o";

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
