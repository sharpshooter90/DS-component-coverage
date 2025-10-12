import React, { useState, useEffect, useRef } from "react";
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
} from "./types";
import { AIRenameService } from "./utils/aiRenameService";

type ViewType = "summary" | "detailed" | "settings" | "ai-rename";

// For local testing, use http://localhost:3001
// For production, replace with your Vercel deployment URL
const DEFAULT_BACKEND_URL = "http://localhost:3001";

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

  const aiRenameServiceRef = useRef<AIRenameService | null>(null);

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
        setAIRenameConfig(msg.config ?? null);
      } else if (msg.type === "ai-rename-started") {
        setIsAIRenaming(true);
        setAIRenameProgress({ current: 0, total: msg.totalChunks });
        setAIStatusMessage("Preparing layers…");
        setAIRenameCounts({ renamed: 0, failed: 0 });
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
      } else if (msg.type === "ai-rename-error") {
        setError(msg.message);
        setIsAIRenaming(false);
        setAIStatusMessage(null);
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
      });

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

  const handleSaveAIRenameConfig = (config: AIRenameConfig) => {
    const normalized: AIRenameConfig = {
      backendUrl: config.backendUrl || DEFAULT_BACKEND_URL,
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
    };

    setAIRenameConfig(normalized);
    window.parent.postMessage(
      { pluginMessage: { type: "store-ai-rename-config", config: normalized } },
      "*"
    );
    setShowApiKeyModal(false);

    if (pendingAIRename) {
      setPendingAIRename(false);
      triggerAIRename();
    }
  };

  const handleSkipAIRenameConfig = () => {
    const fallback =
      aiRenameConfig ||
      ({
        backendUrl: DEFAULT_BACKEND_URL,
      } as AIRenameConfig);

    setAIRenameConfig(fallback);
    window.parent.postMessage(
      { pluginMessage: { type: "store-ai-rename-config", config: fallback } },
      "*"
    );
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
            {view === "ai-rename" && <AIRenameView />}
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
