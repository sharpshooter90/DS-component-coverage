import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import SummaryView from "./components/SummaryView";
import DetailedView from "./components/DetailedView";
import SettingsView from "./components/SettingsView";
import ErrorMessage from "./components/ErrorMessage";
import ProgressIndicator from "./components/ProgressIndicator";
import FixWizard from "./components/FixWizard";
import DebugView from "./components/DebugView";
import AIRenameView from "./components/AIRenameView";
import ApiKeyModal from "./components/ApiKeyModal";
import AIRenameProgress from "./components/AIRenameProgress";
import {
  AIRenameConfig,
  AIRenameContext,
  LayerDataForAI,
  RenamedLayer,
  NamingTemplate,
  LayerNamingRule,
} from "./types";
import { AIRenameService } from "./utils/aiRenameService";

type ViewType = "summary" | "detailed" | "settings" | "ai-rename";

// For local testing, use http://localhost:3001
// For production, replace with your Vercel deployment URL
const DEFAULT_BACKEND_URL = "http://localhost:3001";
const DEFAULT_AI_RENAME_CONFIG: AIRenameConfig = {
  backendUrl: DEFAULT_BACKEND_URL,
  model: "gemini-2.5-flash",
  temperature: 0.7,
  namingConvention: "semantic",
  namingTemplates: [],
  layerTypeRules: [],
  excludePatterns: [],
  reviewMode: false,
  batchSize: 50,
  undoHistoryLimit: 20,
};

const GEMINI_MODEL_OPTIONS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
] as const;

const NAMING_CONVENTIONS = [
  "semantic",
  "bem",
  "pascal-case",
  "camel-case",
  "kebab-case",
  "snake-case",
  "custom",
] as const;

interface CoverageAnalysis {
  summary: {
    overallScore: number;
    componentCoverage: number;
    tokenCoverage: number;
    styleCoverage: number;
    totalLayers: number;
    compliantLayers: number;
    analyzedFrameName: string;
  };
  details: {
    byType: Record<
      string,
      { total: number; compliant: number; percentage: number }
    >;
    nonCompliantLayers: Array<{
      id: string;
      name: string;
      type: string;
      issues: string[];
      path: string;
    }>;
    suggestions?: {
      autoLayout?: Array<{
        id: string;
        name: string;
        type: string;
        path: string;
      }>;
    };
  };
  settings: any;
}

interface Settings {
  checkComponents: boolean;
  checkTokens: boolean;
  checkStyles: boolean;
  allowLocalStyles: boolean;
  ignoredTypes: string[];
}

interface PendingRenameChunk {
  chunkIndex: number;
  context: AIRenameContext;
  renamedLayers: RenamedLayer[];
  originalLayers: LayerDataForAI[];
}

function normalizeAIRenameConfig(
  base: AIRenameConfig | null,
  incoming?: Partial<AIRenameConfig>
): AIRenameConfig {
  const source = incoming ?? {};
  const backendUrlCandidate =
    source.backendUrl ?? base?.backendUrl ?? DEFAULT_AI_RENAME_CONFIG.backendUrl;
  const backendUrl =
    typeof backendUrlCandidate === "string" && backendUrlCandidate.trim().length
      ? backendUrlCandidate.trim()
      : DEFAULT_AI_RENAME_CONFIG.backendUrl;

  const apiKeySource =
    source.apiKey !== undefined ? source.apiKey : base?.apiKey;
  const apiKey =
    typeof apiKeySource === "string" && apiKeySource.trim().length
      ? apiKeySource.trim()
      : undefined;

  const model = normalizeModel(
    source.model ?? base?.model ?? DEFAULT_AI_RENAME_CONFIG.model
  );

  const temperature = normalizeTemperature(
    source.temperature ?? base?.temperature ?? DEFAULT_AI_RENAME_CONFIG.temperature
  );

  const namingConvention = normalizeNamingConvention(
    source.namingConvention ??
      base?.namingConvention ??
      DEFAULT_AI_RENAME_CONFIG.namingConvention
  );

  const customNamingPatternSource =
    source.customNamingPattern !== undefined
      ? source.customNamingPattern
      : base?.customNamingPattern;
  const customNamingPattern =
    typeof customNamingPatternSource === "string" &&
    customNamingPatternSource.trim().length
      ? customNamingPatternSource.trim()
      : undefined;

  const namingTemplates = sanitizeNamingTemplates(
    source.namingTemplates ??
      base?.namingTemplates ??
      DEFAULT_AI_RENAME_CONFIG.namingTemplates
  );

  const layerTypeRules = sanitizeLayerNamingRules(
    source.layerTypeRules ??
      base?.layerTypeRules ??
      DEFAULT_AI_RENAME_CONFIG.layerTypeRules
  );

  const excludePatterns = sanitizeExcludePatterns(
    source.excludePatterns ??
      base?.excludePatterns ??
      DEFAULT_AI_RENAME_CONFIG.excludePatterns
  );

  const reviewMode =
    source.reviewMode ?? base?.reviewMode ?? DEFAULT_AI_RENAME_CONFIG.reviewMode;

  const batchSize = normalizeBatchSize(
    source.batchSize ?? base?.batchSize ?? DEFAULT_AI_RENAME_CONFIG.batchSize
  );

  const undoHistoryLimit = normalizeUndoHistoryLimit(
    source.undoHistoryLimit ??
      base?.undoHistoryLimit ??
      DEFAULT_AI_RENAME_CONFIG.undoHistoryLimit
  );

  return {
    backendUrl,
    apiKey,
    model,
    temperature,
    namingConvention,
    customNamingPattern,
    namingTemplates,
    layerTypeRules,
    excludePatterns,
    reviewMode,
    batchSize,
    undoHistoryLimit,
  };
}

function sanitizeNamingTemplates(
  templates: NamingTemplate[] | undefined
): NamingTemplate[] {
  if (!templates || !templates.length) {
    return [];
  }

  return templates
    .map((template, index) => {
      const pattern = template.pattern?.trim() ?? "";
      if (!pattern) {
        return null;
      }

      const label = template.label?.trim() ?? "";
      return {
        id: template.id?.trim() || `template-${index}`,
        label: label || `Template ${index + 1}`,
        pattern,
        description: template.description?.trim() || undefined,
        isDefault: template.isDefault ?? false,
      };
    })
    .filter((template): template is NamingTemplate => template !== null);
}

function sanitizeLayerNamingRules(
  rules: LayerNamingRule[] | undefined
): LayerNamingRule[] {
  if (!rules || !rules.length) {
    return [];
  }

  return rules
    .map((rule) => {
      const layerType = rule.layerType?.trim();
      const pattern = rule.pattern?.trim() ?? "";
      if (!layerType || !pattern) {
        return null;
      }

      return {
        layerType,
        pattern,
        enabled: rule.enabled !== false,
        example: rule.example?.trim() || undefined,
      };
    })
    .filter((rule): rule is LayerNamingRule => rule !== null);
}

function sanitizeExcludePatterns(patterns: string[] | undefined): string[] {
  if (!patterns || !patterns.length) {
    return [];
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  patterns.forEach((pattern) => {
    const trimmed = pattern.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    sanitized.push(trimmed);
  });

  return sanitized;
}

function normalizeBatchSize(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_AI_RENAME_CONFIG.batchSize ?? 50;
  }

  const normalized = Math.floor(value);
  const min = 5;
  const max = 200;
  return Math.min(Math.max(normalized, min), max);
}

function normalizeUndoHistoryLimit(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_AI_RENAME_CONFIG.undoHistoryLimit ?? 20;
  }

  const normalized = Math.floor(value);
  const min = 0;
  const max = 200;
  return Math.min(Math.max(normalized, min), max);
}

function normalizeTemperature(value: number | undefined): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_AI_RENAME_CONFIG.temperature;
  }

  const clamped = Math.min(Math.max(value, 0), 1);
  return Number.isFinite(clamped)
    ? parseFloat(clamped.toFixed(2))
    : DEFAULT_AI_RENAME_CONFIG.temperature;
}

function normalizeNamingConvention(value: string | undefined): string {
  if (!value) {
    return DEFAULT_AI_RENAME_CONFIG.namingConvention ?? "semantic";
  }

  const match = NAMING_CONVENTIONS.find(
    (convention) => convention === value
  );
  return match ?? (DEFAULT_AI_RENAME_CONFIG.namingConvention ?? "semantic");
}

function normalizeModel(value: string | undefined): string | undefined {
  if (!value) {
    return DEFAULT_AI_RENAME_CONFIG.model;
  }

  const match = GEMINI_MODEL_OPTIONS.find((model) => model === value);
  return match ?? DEFAULT_AI_RENAME_CONFIG.model;
}

function App() {
  const [view, setView] = useState<ViewType>("summary");
  const [analysis, setAnalysis] = useState<CoverageAnalysis | null>(null);
  const [settings, setSettings] = useState<Settings>({
    checkComponents: true,
    checkTokens: true,
    checkStyles: true,
    allowLocalStyles: false,
    ignoredTypes: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showFixWizard, setShowFixWizard] = useState(false);
  const [selectedFixLayer, setSelectedFixLayer] = useState<any>(null);
  const [showDebugView, setShowDebugView] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [isAIRenaming, setIsAIRenaming] = useState(false);
  const [aiRenameProgress, setAIRenameProgress] = useState({
    current: 0,
    total: 0,
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [aiRenameConfig, setAIRenameConfig] = useState<AIRenameConfig | null>(
    null
  );
  const [aiStatusMessage, setAIStatusMessage] = useState<string | null>(null);
  const [aiRenameCounts, setAIRenameCounts] = useState({
    renamed: 0,
    failed: 0,
  });
  const [pendingAIRename, setPendingAIRename] = useState(false);
  const [renameReviewQueue, setRenameReviewQueue] = useState<
    PendingRenameChunk[]
  >([]);
  const [aiRenameHistoryState, setAIRenameHistoryState] = useState({
    canUndo: false,
    canRedo: false,
    historyDepth: 0,
    redoDepth: 0,
  });

  const aiRenameServiceRef = useRef<AIRenameService | null>(null);

  const persistAIRenameConfigToPlugin = (config: AIRenameConfig) => {
    setAIRenameConfig(config);
    window.parent.postMessage(
      { pluginMessage: { type: "store-ai-rename-config", config } },
      "*"
    );
  };

  const updateAIRenameConfig = (partial: Partial<AIRenameConfig>) => {
    const normalized = normalizeAIRenameConfig(aiRenameConfig, partial);
    persistAIRenameConfigToPlugin(normalized);
  };

  const effectiveAIRenameConfig = useMemo(() => {
    const source = aiRenameConfig ?? DEFAULT_AI_RENAME_CONFIG;
    return {
      ...source,
      namingTemplates: [...(source.namingTemplates ?? [])],
      layerTypeRules: [...(source.layerTypeRules ?? [])],
      excludePatterns: [...(source.excludePatterns ?? [])],
    };
  }, [aiRenameConfig]);

  useEffect(() => {
    window.parent.postMessage({ pluginMessage: { type: "get-settings" } }, "*");
    window.parent.postMessage(
      { pluginMessage: { type: "get-ai-rename-config" } },
      "*"
    );

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === "analysis-started") {
        setIsAnalyzing(true);
        setProgress(0);
        setError(null);
      } else if (msg.type === "analysis-progress") {
        setProgress(msg.progress);
      } else if (msg.type === "analysis-complete") {
        setAnalysis(msg.data);
        setIsAnalyzing(false);
        setView("summary");
      } else if (msg.type === "error") {
        setError(msg.message);
        setIsAnalyzing(false);
      } else if (msg.type === "settings-updated") {
        setSettings(msg.settings);
      } else if (msg.type === "fix-applied") {
        setShowFixWizard(false);
        setSelectedFixLayer(null);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } else if (msg.type === "debug-data-exported") {
        setDebugData(msg.debugData);
        setShowDebugView(true);
      } else if (msg.type === "selection-changed") {
        setHasSelection(Boolean(msg.nodeId));
        if (!msg.nodeId) {
          setAnalysis(null);
          setView("summary");
        } else {
          window.parent.postMessage(
            { pluginMessage: { type: "analyze-selection" } },
            "*"
          );
        }
      } else if (msg.type === "ai-rename-config-loaded") {
        if (msg.config) {
          setAIRenameConfig(normalizeAIRenameConfig(null, msg.config));
        } else {
          setAIRenameConfig(null);
        }
      } else if (msg.type === "ai-rename-started") {
        setIsAIRenaming(true);
        setAIRenameProgress({ current: 0, total: msg.totalChunks });
        setAIStatusMessage("Preparing layers…");
        setAIRenameCounts({ renamed: 0, failed: 0 });
        setRenameReviewQueue([]);
      } else if (msg.type === "ai-rename-chunk-request") {
        setAIRenameProgress({
          current: msg.context.chunkIndex + 1,
          total: msg.context.totalChunks,
        });
        setAIStatusMessage("Generating names with Gemini…");
        handleAIRenameChunk(msg.chunk, msg.context);
      } else if (msg.type === "ai-rename-chunk-complete") {
        setAIRenameCounts((previous) => ({
          renamed: previous.renamed + (msg.renamedCount ?? 0),
          failed: previous.failed + (msg.failedCount ?? 0),
        }));
        setAIStatusMessage("Applied rename suggestions in Figma");
        if (typeof msg.chunkIndex === "number") {
          setRenameReviewQueue((previous) =>
            previous.filter((item) => item.chunkIndex !== msg.chunkIndex)
          );
        }
      } else if (msg.type === "ai-rename-complete") {
        setIsAIRenaming(false);
        setAIStatusMessage("AI rename complete");
        setAIRenameCounts({
          renamed: msg.totalRenamed,
          failed: msg.totalFailed,
        });
        setAIRenameProgress((previous) => ({
          current: previous.total,
          total: previous.total,
        }));
        setRenameReviewQueue([]);
      } else if (msg.type === "ai-rename-error") {
        setError(msg.message);
        setIsAIRenaming(false);
        setAIStatusMessage(null);
        setRenameReviewQueue([]);
      } else if (msg.type === "ai-rename-history-updated") {
        setAIRenameHistoryState({
          canUndo: msg.canUndo,
          canRedo: msg.canRedo,
          historyDepth: msg.historyDepth,
          redoDepth: msg.redoDepth,
        });
      } else if (msg.type === "ai-rename-undo-result") {
        if (msg.success) {
          setAIStatusMessage(
            `Reverted ${msg.restored ?? 0} layer name${
              (msg.restored ?? 0) === 1 ? "" : "s"
            }`
          );
        } else {
          setError(msg.message ?? "Failed to undo AI rename.");
        }
      } else if (msg.type === "ai-rename-redo-result") {
        if (msg.success) {
          setAIStatusMessage(
            `Reapplied ${msg.applied ?? 0} layer name${
              (msg.applied ?? 0) === 1 ? "" : "s"
            }`
          );
        } else {
          setError(msg.message ?? "Failed to redo AI rename.");
        }
      }
    };

    window.addEventListener("message", handleMessage);

    window.parent.postMessage(
      { pluginMessage: { type: "subscribe-selection" } },
      "*"
    );

    return () => {
      window.removeEventListener("message", handleMessage);
      window.parent.postMessage(
        { pluginMessage: { type: "unsubscribe-selection" } },
        "*"
      );
    };
  }, []);

  useEffect(() => {
    if (aiRenameConfig?.backendUrl) {
      aiRenameServiceRef.current = new AIRenameService(
        aiRenameConfig.backendUrl
      );
    } else {
      aiRenameServiceRef.current = null;
    }
  }, [aiRenameConfig?.backendUrl]);

  const handleAnalyze = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "analyze-selection" } },
      "*"
    );
  };

  const handleUpdateSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    window.parent.postMessage(
      { pluginMessage: { type: "update-settings", settings: updated } },
      "*"
    );
  };

  const handleExport = (format: "json" | "csv") => {
    if (!analysis) return;

    if (format === "json") {
      exportJSON(analysis);
    } else if (format === "csv") {
      exportCSV(analysis);
    }
  };

  const triggerAIRename = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "ai-rename-selection" } },
      "*"
    );
  };

  const handleAIRename = () => {
    if (isAnalyzing || isAIRenaming) return;

    if (!hasSelection) {
      setError("Select a frame or component before running AI Rename.");
      return;
    }

    if (!aiRenameConfig?.backendUrl) {
      setShowApiKeyModal(true);
      setPendingAIRename(true);
      return;
    }

    setError(null);
    triggerAIRename();
  };

  const handleAIRenameChunk = async (
    chunk: LayerDataForAI[],
    context: AIRenameContext
  ) => {
    const service = aiRenameServiceRef.current;

    if (!service) {
      const message =
        "AI rename backend is not configured. Please set it up in AI Rename settings.";
      setError(message);
      window.parent.postMessage(
        {
          pluginMessage: {
            type: "ai-rename-chunk-error",
            message,
            chunkIndex: context.chunkIndex,
          },
        },
        "*"
      );
      return;
    }

    try {
      const renamedLayers = await service.renameLayersWithAI(chunk, context, {
        apiKey: aiRenameConfig?.apiKey,
        model: aiRenameConfig?.model,
        temperature: aiRenameConfig?.temperature,
        namingConvention: aiRenameConfig?.namingConvention,
        customNamingPattern: aiRenameConfig?.customNamingPattern,
        namingTemplates: aiRenameConfig?.namingTemplates,
        layerTypeRules: aiRenameConfig?.layerTypeRules,
        excludePatterns: aiRenameConfig?.excludePatterns,
        reviewMode: aiRenameConfig?.reviewMode,
        undoHistoryLimit: aiRenameConfig?.undoHistoryLimit,
        batchSize: aiRenameConfig?.batchSize,
      });

      if (aiRenameConfig?.reviewMode) {
        if (renamedLayers.length === 0) {
          setAIStatusMessage("No rename suggestions for this chunk.");
          window.parent.postMessage(
            {
              pluginMessage: {
                type: "apply-ai-rename-batch",
                renamedLayers: [],
                chunkIndex: context.chunkIndex,
              },
            },
            "*"
          );
          return;
        }

        setRenameReviewQueue((previous) => {
          const withoutCurrent = previous.filter(
            (item) => item.chunkIndex !== context.chunkIndex
          );
          return [
            ...withoutCurrent,
            {
              chunkIndex: context.chunkIndex,
              context,
              renamedLayers,
              originalLayers: chunk,
            },
          ];
        });
        setAIStatusMessage(
          `Review ${renamedLayers.length} rename suggestion${
            renamedLayers.length === 1 ? "" : "s"
          }`
        );
        setView("ai-rename");
        return;
      }

      setAIStatusMessage(
        renamedLayers.length === 0
          ? "No rename suggestions for this chunk."
          : "Sending rename suggestions to Figma…"
      );

      window.parent.postMessage(
        {
          pluginMessage: {
            type: "apply-ai-rename-batch",
            renamedLayers,
            chunkIndex: context.chunkIndex,
          },
        },
        "*"
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate rename suggestions.";
      setError(message);
      setAIStatusMessage("AI rename interrupted");
      window.parent.postMessage(
        {
          pluginMessage: {
            type: "ai-rename-chunk-error",
            message,
            chunkIndex: context.chunkIndex,
          },
        },
        "*"
      );
    }
  };

  const handleApproveRenameChunk = (
    chunkIndex: number,
    approvedLayers: RenamedLayer[]
  ) => {
    setRenameReviewQueue((previous) =>
      previous.filter((item) => item.chunkIndex !== chunkIndex)
    );
    setAIStatusMessage(
      approvedLayers.length
        ? `Sending ${approvedLayers.length} rename suggestion${
            approvedLayers.length === 1 ? "" : "s"
          } to Figma…`
        : "Skipping rename suggestions for this chunk."
    );
    window.parent.postMessage(
      {
        pluginMessage: {
          type: "apply-ai-rename-batch",
          renamedLayers: approvedLayers,
          chunkIndex,
        },
      },
      "*"
    );
  };

  const handleRejectRenameChunk = (chunkIndex: number) => {
    handleApproveRenameChunk(chunkIndex, []);
  };

  const handleUndoAIRenameHistory = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "undo-ai-rename" } },
      "*"
    );
  };

  const handleRedoAIRenameHistory = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "redo-ai-rename" } },
      "*"
    );
  };

  const handleSaveAIRenameConfig = (config: AIRenameConfig) => {
    const normalized = normalizeAIRenameConfig(aiRenameConfig, config);
    persistAIRenameConfigToPlugin(normalized);
    setShowApiKeyModal(false);

    if (pendingAIRename) {
      setPendingAIRename(false);
      triggerAIRename();
    }
  };

  const handleSkipAIRenameConfig = () => {
    const fallback = normalizeAIRenameConfig(aiRenameConfig, {
      backendUrl: aiRenameConfig?.backendUrl ?? DEFAULT_BACKEND_URL,
    });
    persistAIRenameConfigToPlugin(fallback);
    setShowApiKeyModal(false);

    if (pendingAIRename) {
      setPendingAIRename(false);
      triggerAIRename();
    }
  };

  const handleCancelAIRename = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "cancel-ai-rename" } },
      "*"
    );
    setIsAIRenaming(false);
    setAIStatusMessage("AI rename cancelled");
  };

  const handleCloseApiKeyModal = () => {
    setShowApiKeyModal(false);
    setPendingAIRename(false);
  };

  const handleSelectLayer = (layerId: string) => {
    window.parent.postMessage(
      { pluginMessage: { type: "select-layer", layerId } },
      "*"
    );
  };

  const handleConvertToAutoLayout = (layerId: string) => {
    window.parent.postMessage(
      { pluginMessage: { type: "convert-to-auto-layout", layerId } },
      "*"
    );
  };

  const handleExportDebug = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "export-debug-data" } },
      "*"
    );
  };

  const handleExportReportToCanvas = () => {
    if (!analysis) return;

    window.parent.postMessage(
      {
        pluginMessage: {
          type: "export-report-to-canvas",
          reportData: analysis,
        },
      },
      "*"
    );
  };

  return (
    <div className="app">
      <header className="header">
        {analysis ? (
          <div className="title-with-frame">
            <div className="title-label">Analyzing Frame:</div>
            <h1 className="title frame-name">
              {analysis.summary.analyzedFrameName}
            </h1>
          </div>
        ) : (
          <h1 className="title">DS Coverage Analyzer</h1>
        )}
        <div className="header-actions">
          {analysis && !isAnalyzing && (
            <button
              className="btn btn-secondary"
              onClick={handleExportReportToCanvas}
              title="Export analysis report to Figma canvas"
            >
              📊 Add Report to Canvas
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={handleAIRename}
            disabled={isAnalyzing || isAIRenaming || !hasSelection}
            title={
              !hasSelection
                ? "Select a frame or component to enable AI Rename"
                : "AI-powered layer naming"
            }
          >
            ✨ AI Rename
          </button>
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing
              ? "Analyzing..."
              : analysis
              ? "Re-run Analysis"
              : "Analyze Selection"}
          </button>
        </div>
      </header>

      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {showSuccessMessage && (
        <div className="success-message">
          ✅ Fixes applied successfully! Click "🔄 Refresh" to see updated
          compliance status.
        </div>
      )}

      {isAnalyzing && <ProgressIndicator progress={progress} />}

      {!isAnalyzing && analysis && (
        <>
          <nav className="tabs">
            <button
              className={`tab ${view === "summary" ? "active" : ""}`}
              onClick={() => setView("summary")}
            >
              Summary
            </button>
            <button
              className={`tab ${view === "detailed" ? "active" : ""}`}
              onClick={() => setView("detailed")}
            >
              Detailed Report
            </button>
            <button
              className={`tab ${view === "settings" ? "active" : ""}`}
              onClick={() => setView("settings")}
            >
              Settings
            </button>
            <button
              className={`tab ${view === "ai-rename" ? "active" : ""}`}
              onClick={() => setView("ai-rename")}
            >
              AI Rename
            </button>
          </nav>

          <main className="content">
            {view === "summary" && (
              <SummaryView analysis={analysis} onExport={handleExport} />
            )}
            {view === "detailed" && (
              <DetailedView
                analysis={analysis}
                onSelectLayer={handleSelectLayer}
                onFixLayer={(layer) => {
                  setSelectedFixLayer(layer);
                  setShowFixWizard(true);
                }}
                onConvertToAutoLayout={handleConvertToAutoLayout}
                onExportDebug={handleExportDebug}
                onRefresh={handleAnalyze}
              />
            )}
            {view === "settings" && (
              <SettingsView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}
            {view === "ai-rename" && (
              <AIRenameView
                config={effectiveAIRenameConfig}
                onUpdateConfig={updateAIRenameConfig}
                onEditBackend={() => setShowApiKeyModal(true)}
                pendingChunks={renameReviewQueue}
                onApproveChunk={handleApproveRenameChunk}
                onRejectChunk={handleRejectRenameChunk}
                historyState={aiRenameHistoryState}
                onUndo={handleUndoAIRenameHistory}
                onRedo={handleRedoAIRenameHistory}
                statusMessage={aiStatusMessage ?? undefined}
                isRenaming={isAIRenaming}
                renameCounts={aiRenameCounts}
                progress={aiRenameProgress}
              />
            )}
          </main>
        </>
      )}

      {!isAnalyzing && !analysis && !error && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <h2>No Analysis Yet</h2>
          <p>Select a frame and click "Analyze Selection" to get started</p>
          <div className="features">
            <div className="feature">
              <strong>Component Coverage</strong>
              <span>Track library component usage</span>
            </div>
            <div className="feature">
              <strong>Token Coverage</strong>
              <span>Check design token adoption</span>
            </div>
            <div className="feature">
              <strong>Style Coverage</strong>
              <span>Monitor shared style usage</span>
            </div>
          </div>
        </div>
      )}

      {showFixWizard && selectedFixLayer && (
        <FixWizard
          layers={
            Array.isArray(selectedFixLayer)
              ? selectedFixLayer
              : [selectedFixLayer]
          }
          onClose={() => {
            setShowFixWizard(false);
            setSelectedFixLayer(null);
          }}
        />
      )}

      {showDebugView && debugData && (
        <DebugView
          debugData={debugData}
          onClose={() => {
            setShowDebugView(false);
            setDebugData(null);
          }}
        />
      )}

      <ApiKeyModal
        isOpen={showApiKeyModal}
        initialConfig={aiRenameConfig}
        onSave={handleSaveAIRenameConfig}
        onSkip={handleSkipAIRenameConfig}
        onClose={handleCloseApiKeyModal}
      />

      <AIRenameProgress
        isOpen={isAIRenaming}
        currentChunk={aiRenameProgress.current}
        totalChunks={aiRenameProgress.total}
        renamedCount={aiRenameCounts.renamed}
        failedCount={aiRenameCounts.failed}
        statusMessage={aiStatusMessage ?? undefined}
        onCancel={handleCancelAIRename}
      />
    </div>
  );
}

function exportJSON(analysis: CoverageAnalysis) {
  const dataStr = JSON.stringify(analysis, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `coverage-report-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCSV(analysis: CoverageAnalysis) {
  const rows = [
    ["Layer Name", "Type", "Path", "Issues"],
    ...analysis.details.nonCompliantLayers.map((layer) => [
      layer.name,
      layer.type,
      layer.path,
      layer.issues.join("; "),
    ]),
  ];

  const csvContent = rows
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `coverage-report-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
