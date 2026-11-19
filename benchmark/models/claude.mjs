// Claude Sonnet 4 adapter via Anthropic SDK
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export const MODEL_ID = "claude-sonnet-4-20250514";
export const MODEL_NAME = "claude-sonnet-4";

export async function generate(systemPrompt, userPrompt) {
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return response.content[0].text;
}
