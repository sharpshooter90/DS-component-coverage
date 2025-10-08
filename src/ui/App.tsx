import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import SummaryView from "./components/SummaryView";
import DetailedView from "./components/DetailedView";
import SettingsView from "./components/SettingsView";
import ErrorMessage from "./components/ErrorMessage";
import ProgressIndicator from "./components/ProgressIndicator";
import FixWizard from "./components/FixWizard";

type ViewType = "summary" | "detailed" | "settings";

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

  useEffect(() => {
    // Request current settings on mount
    window.parent.postMessage({ pluginMessage: { type: "get-settings" } }, "*");

    // Listen for messages from plugin
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;

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
        // Re-run analysis to update results
        handleAnalyze();
      }
    };
  }, []);

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

  const handleSelectLayer = (layerId: string) => {
    window.parent.postMessage(
      { pluginMessage: { type: "select-layer", layerId } },
      "*"
    );
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">DS Coverage Analyzer</h1>
        <div className="header-actions">
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
              />
            )}
            {view === "settings" && (
              <SettingsView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
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
          layer={selectedFixLayer}
          onClose={() => {
            setShowFixWizard(false);
            setSelectedFixLayer(null);
          }}
        />
      )}
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
