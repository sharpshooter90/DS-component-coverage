import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();

const jsonLimit = process.env.JSON_LIMIT || "1mb";
app.use(express.json({ limit: jsonLimit }));

// CORS configuration - allow all origins including null (Figma plugins)
// When credentials: true, we need a function to properly set Access-Control-Allow-Origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins including null (Figma plugins)
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Requested-With", "x-api-key"],
  })
);

// Default model - gemini-2.5-flash (Gemini 2.5 Flash - stable)
// Best model for price-performance with low latency, perfect for high-volume layer renaming
// Alternative: "gemini-2.5-pro" for more complex reasoning (higher cost)
// See: https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TEMPERATURE = 0.7;

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/rename-layers", async (req, res) => {
  try {
    const { layers, context, config = {} } = req.body ?? {};

    if (!Array.isArray(layers) || layers.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Request must include layers array" });
    }

    if (!context || typeof context !== "object") {
      return res.status(400).json({
        success: false,
        message: "Request must include context information",
      });
    }

    const apiKey =
      config.apiKey ||
      req.headers["x-api-key"] ||
      process.env.GEMINI_API_KEY ||
      "";

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Gemini API key is not configured",
      });
    }

    const modelId = config.model || DEFAULT_MODEL;
    const temperature =
      typeof config.temperature === "number"
        ? config.temperature
        : DEFAULT_TEMPERATURE;

    const prompt = buildPrompt(layers, context);

    const renamedLayers = await generateRenamedLayers({
      apiKey,
      modelId,
      temperature,
      prompt,
    });

    res.json(renamedLayers);
  } catch (error) {
    console.error("AI rename error", error);
    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Unknown error occurred",
      });
    }
  }
});

function buildPrompt(layers, context) {
  const { frameName, totalLayers, chunkIndex, totalChunks } = context;
  const chunkType = inferChunkType(layers);
  const serializedLayers = JSON.stringify(layers, null, 2);

  return [
    "You are a Figma layer naming expert. Analyze these layers and suggest semantic, descriptive names following these rules:",
    "",
    "1. Use descriptive names based on content and purpose",
    "2. Use PascalCase for components, camelCase for properties",
    '3. Group related elements with prefixes (e.g., "Button/Icon", "Card/Title")',
    '4. For text layers, use content as context but avoid generic "Text" names',
    "5. Consider hierarchy and parent context",
    "6. Keep names concise but meaningful (max 50 chars)",
    "",
    `Context:`,
    `- Frame: "${frameName || "Unknown Frame"}"`,
    `- Total layers in selection: ${
      Number.isFinite(totalLayers) ? totalLayers : "unknown"
    }`,
    `- Chunk: ${
      Number.isFinite(chunkIndex) && Number.isFinite(totalChunks)
        ? `${chunkIndex + 1} of ${totalChunks}`
        : "unspecified"
    }`,
    `- Chunk type: ${chunkType}`,
    "",
    "Layers to rename (JSON):",
    serializedLayers,
    "",
    "Respond with ONLY valid JSON array (no markdown, no explanation).",
    'Each item must include "id" and "newName". If you cannot rename a layer, return an empty array.',
  ].join("\n");
}

function inferChunkType(layers) {
  if (!Array.isArray(layers) || layers.length === 0) {
    return "MIXED";
  }

  const counts = layers.reduce((acc, layer) => {
    const type = (layer?.type || "UNKNOWN").toUpperCase();
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const dominantType = sorted[0]?.[0] ?? "MIXED";

  if (sorted.length === 1) {
    return dominantType;
  }

  const dominantRatio = sorted[0][1] / layers.length;
  return dominantRatio >= 0.75 ? dominantType : "MIXED";
}

async function generateRenamedLayers({ apiKey, modelId, temperature, prompt }) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  const request = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
    },
  };

  const response = await model.generateContent(request);

  const usage = response?.response?.usageMetadata ?? null;
  const text = extractResponseText(response);
  const parsed = parseRenamedLayers(text);

  return {
    success: true,
    renamedLayers: parsed,
    tokensUsed: usage
      ? {
          promptTokens: usage.promptTokenCount ?? null,
          responseTokens: usage.candidatesTokenCount ?? null,
          totalTokens: usage.totalTokenCount ?? null,
        }
      : null,
  };
}

function extractResponseText(result) {
  const candidate = result?.response?.candidates?.[0];
  if (!candidate) {
    throw new Error("No response candidates returned from Gemini");
  }

  const parts = candidate.content?.parts ?? [];
  const textParts = parts
    .map((part) => part.text ?? (typeof part === "string" ? part : ""))
    .filter(Boolean);

  const combined = textParts.join("").trim();
  if (!combined) {
    throw new Error("Empty response from Gemini");
  }

  return combined.replace(/```json|```/g, "").trim();
}

function parseRenamedLayers(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Failed to parse Gemini response as JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini response must be a JSON array");
  }

  return parsed
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.newName === "string" &&
        item.newName.trim().length > 0
    )
    .map((item) => ({
      id: item.id,
      newName: item.newName.trim(),
    }));
}

const port = process.env.PORT || 3001;

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`AI rename backend listening on http://localhost:${port}`);
  });
}

export default app;
