// Qwen adapter via DashScope API (OpenAI-compatible) — FREE TIER available
// Sign up at https://dashscope.console.aliyun.com/ for free API key
// Or use OpenRouter free tier: set QWEN_BASE_URL=https://openrouter.ai/api/v1
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY,
  baseURL: process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});

export const MODEL_ID = process.env.QWEN_MODEL || "qwen-plus";
export const MODEL_NAME = "qwen-plus";

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
