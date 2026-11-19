// Gemini 2.5 Pro adapter via Google GenAI SDK
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export const MODEL_ID = "gemini-2.5-pro-preview-06-05";
export const MODEL_NAME = "gemini-2.5-pro";

export async function generate(systemPrompt, userPrompt) {
  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 4096,
    },
  });

  return response.text;
}
