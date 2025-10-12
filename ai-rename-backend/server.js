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

    const safeConfig = sanitizeConfig(config);
    console.log("[AI Rename] Incoming request", {
      chunkIndex: context?.chunkIndex ?? null,
      totalChunks: context?.totalChunks ?? null,
      layerCount: layers.length,
      namingConvention: safeConfig.namingConvention || "semantic",
      modelId,
      reviewMode: Boolean(config.reviewMode),
    });
    console.log("[AI Rename] Config snapshot", safeConfig);

    const prompt = buildPrompt(layers, context, config);
    console.log("[AI Rename] Prompt preview\n%s", previewPrompt(prompt));

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

function buildPrompt(layers, context, config = {}) {
  const { frameName, totalLayers, chunkIndex, totalChunks } = context;
  const chunkType = inferChunkType(layers);
  const serializedLayers = JSON.stringify(layers, null, 2);
  const namingGuidance = createNamingGuidance(config, frameName);
  const templateGuidance = createTemplateGuidance(config);
  const layerRuleGuidance = createLayerRuleGuidance(config);
  const exclusionGuidance = createExclusionGuidance(config);

  return [
    "You are a Figma layer naming expert. Analyze these layers and propose new names that follow the configured naming system exactly.",
    "",
    "Guidelines:",
    ...namingGuidance.map((line) => `- ${line}`),
    "- Keep names concise but meaningful (<= 50 characters).",
    "- Reflect hierarchy and parent context in the name.",
    "- Return an empty array if every layer already complies.",
    "",
    ...templateGuidance,
    ...layerRuleGuidance,
    ...exclusionGuidance,
    "",
    "Context:",
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

function createNamingGuidance(config = {}, frameName = "the root") {
  const convention = String(config?.namingConvention || "semantic").toLowerCase();
  const guidance = [];

  switch (convention) {
    case "bem": {
      const frameLabel = frameName && frameName.trim().length ? `"${frameName}"` : "the frame name";
      guidance.push(
        `Apply strict BEM syntax: Block__Element--Modifier. Use ${frameLabel} as the Block name when it describes the component.`,
        "Elements inherit the block name followed by double underscores (e.g., card__title).",
        "Use double hyphen modifiers for state or variation (e.g., button__icon--active).",
        "Keep block, element, and modifier tokens lowercase; separate multi-word tokens with hyphens."
      );
      break;
    }
    case "pascal-case":
      guidance.push(
        "Use PascalCase (capitalize each word without separators) for every renamed layer.",
        "Example: PrimaryButton, CardTitle, FooterLinks."
      );
      break;
    case "camel-case":
      guidance.push(
        "Use camelCase (lowercase first word, capitalize subsequent words) for every renamed layer.",
        "Example: primaryButton, cardTitle, footerLinks."
      );
      break;
    case "kebab-case":
      guidance.push(
        "Use kebab-case (all lowercase words separated by hyphen) for every renamed layer.",
        "Example: primary-button, card-title, footer-links."
      );
      break;
    case "snake-case":
      guidance.push(
        "Use snake_case (all lowercase words separated by underscores) for every renamed layer.",
        "Example: primary_button, card_title, footer_links."
      );
      break;
    case "custom":
      if (config?.customNamingPattern) {
        guidance.push(
          `Follow the custom template "${config.customNamingPattern}". Replace tokens like {{frame}}, {{layerType}}, {{role}}, and {{index}} with relevant values.`,
          "Preserve literal characters from the template and only substitute token placeholders."
        );
      } else {
        guidance.push(
          "Use the provided naming templates to determine the correct pattern for each layer.",
          "If no template applies, fall back to clear semantic naming."
        );
      }
      break;
    default:
      guidance.push(
        "Use clear semantic names that describe the element's role (e.g., CardHeader, CtaButtonIcon).",
        "Reuse consistent prefixes/suffixes so related layers group naturally in Figma."
      );
      break;
  }

  guidance.push(
    "Avoid generic placeholders like \"Group\" or \"Rectangle\" unless the shape is intentionally unnamed.",
    "Do not include quotes, Markdown, or additional commentary in the name."
  );

  return guidance;
}

function createTemplateGuidance(config = {}) {
  const templates = Array.isArray(config?.namingTemplates)
    ? config.namingTemplates.filter(
        (template) => template && typeof template.pattern === "string" && template.pattern.trim().length
      )
    : [];

  if (!templates.length) {
    return [];
  }

  const lines = ["Naming templates to prefer (use the best match):"];

  templates.forEach((template, index) => {
    const label = template.label?.trim() || `Template ${index + 1}`;
    const pattern = template.pattern.trim();
    const defaultFlag = template.isDefault ? " [default]" : "";
    lines.push(`- ${label}${defaultFlag}: ${pattern}`);
    if (template.description?.trim()) {
      lines.push(`  (Notes: ${template.description.trim()})`);
    }
  });

  return lines;
}

function createLayerRuleGuidance(config = {}) {
  const rules = Array.isArray(config?.layerTypeRules)
    ? config.layerTypeRules.filter(
        (rule) =>
          rule &&
          rule.enabled !== false &&
          typeof rule.layerType === "string" &&
          rule.layerType.trim().length &&
          typeof rule.pattern === "string" &&
          rule.pattern.trim().length
      )
    : [];

  if (!rules.length) {
    return [];
  }

  const lines = ["Layer-type overrides (use these patterns when the layer matches):"];

  rules.forEach((rule) => {
    const typeLabel = rule.layerType.trim().toUpperCase();
    const pattern = rule.pattern.trim();
    lines.push(`- ${typeLabel}: ${pattern}`);
    if (rule.example?.trim()) {
      lines.push(`  (Example: ${rule.example.trim()})`);
    }
  });

  return lines;
}

function createExclusionGuidance(config = {}) {
  const patterns = Array.isArray(config?.excludePatterns)
    ? config.excludePatterns
        .map((pattern) => (typeof pattern === "string" ? pattern.trim() : ""))
        .filter(Boolean)
    : [];

  if (!patterns.length) {
    return [];
  }

  const lines = ["Do not rename layers whose current names match these regex patterns:"];
  patterns.forEach((pattern) => {
    lines.push(`- /${pattern}/i`);
  });

  return lines;
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

  console.log("[AI Rename] Gemini response summary", {
    modelId,
    renamedCount: parsed.length,
    sample: parsed.slice(0, 5),
    tokensUsed: usage,
  });

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

function sanitizeConfig(config = {}) {
  if (!config || typeof config !== "object") {
    return {};
  }

  const copy = { ...config };
  if (copy.apiKey) {
    copy.apiKey = "***redacted***";
  }
  return copy;
}

function previewPrompt(prompt, maxLines = 40, maxChars = 2000) {
  if (typeof prompt !== "string") {
    return "[invalid prompt]";
  }

  const lines = prompt.split("\n").slice(0, maxLines);
  let preview = lines.join("\n");
  if (preview.length > maxChars) {
    preview = `${preview.slice(0, maxChars)}…`;
  }
  return preview;
}

const port = process.env.PORT || 3001;

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`AI rename backend listening on http://localhost:${port}`);
  });
}

export default app;
