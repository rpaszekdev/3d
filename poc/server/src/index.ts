import "dotenv/config";
import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { createChatRouter } from "./routes/chat.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Initialize Anthropic client
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey || apiKey === "your-api-key-here") {
  console.warn("⚠️  ANTHROPIC_API_KEY not set in .env — AI features will fail");
  console.warn("   Set it in poc/.env to enable Claude integration");
}

const client = new Anthropic({ apiKey: apiKey || "" });

// Routes
app.use("/api", createChatRouter(client));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!apiKey && apiKey !== "your-api-key-here",
  });
});

app.listen(PORT, () => {
  console.log(`🔢 Spatial Canvas server running on http://localhost:${PORT}`);
  console.log(
    `   Claude integration: ${apiKey && apiKey !== "your-api-key-here" ? "✅ ready" : "❌ no API key"}`,
  );
});
