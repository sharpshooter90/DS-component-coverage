import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./globals.css";
import SummaryView from "./components/SummaryView";
import DetailedView from "./components/DetailedView";
import SettingsView from "./components/SettingsView";
import ErrorMessage from "./components/ErrorMessage";
import ProgressIndicator from "./components/ProgressIndicator";
import FixWizard from "./components/FixWizard";
import DebugView from "./components/DebugView";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";

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
  const [showDebugView, setShowDebugView] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

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
        // Show success message and hide it after 3 seconds
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      } else if (msg.type === "debug-data-exported") {
        setDebugData(msg.debugData);
        setShowDebugView(true);
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

  const handleExportDebug = () => {
    window.parent.postMessage(
      { pluginMessage: { type: "export-debug-data" } },
      "*"
    );
  };

  return (
    <div className="figma-plugin bg-background text-foreground flex flex-col h-screen">
      <header className="border-b border-border p-4 bg-background">
        <h1 className="text-lg font-semibold mb-3">DS Coverage Analyzer</h1>
        <div className="flex gap-2">
          <Button onClick={handleAnalyze} disabled={isAnalyzing} size="sm">
            {isAnalyzing
              ? "Analyzing..."
              : analysis
              ? "Re-run Analysis"
              : "Analyze Selection"}
          </Button>
        </div>
      </header>

      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {showSuccessMessage && (
        <div className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-5 py-3 rounded-lg text-sm font-medium z-50 shadow-lg animate-in slide-in-from-top-2 duration-300">
          ✅ Fixes applied successfully! Click "🔄 Refresh" to see updated
          compliance status.
        </div>
      )}

      {isAnalyzing && <ProgressIndicator progress={progress} />}

      {!isAnalyzing && analysis && (
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as ViewType)}
          className="flex flex-col flex-1"
        >
          <TabsList className="grid w-full grid-cols-3 bg-muted p-1">
            <TabsTrigger value="summary" className="text-xs">
              Summary
            </TabsTrigger>
            <TabsTrigger value="detailed" className="text-xs">
              Detailed Report
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              Settings
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 figma-plugin-scroll">
            <TabsContent value="summary" className="p-4">
              <SummaryView analysis={analysis} onExport={handleExport} />
            </TabsContent>
            <TabsContent value="detailed" className="p-4">
              <DetailedView
                analysis={analysis}
                onSelectLayer={handleSelectLayer}
                onFixLayer={(layer) => {
                  setSelectedFixLayer(layer);
                  setShowFixWizard(true);
                }}
                onExportDebug={handleExportDebug}
                onRefresh={handleAnalyze}
              />
            </TabsContent>
            <TabsContent value="settings" className="p-4">
              <SettingsView
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            </TabsContent>
          </div>
        </Tabs>
      )}

      {!isAnalyzing && !analysis && !error && (
        <div className="flex flex-col items-center justify-center p-12 text-center flex-1">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-2">No Analysis Yet</h2>
          <p className="text-muted-foreground mb-6">
            Select a frame and click "Analyze Selection" to get started
          </p>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Card>
              <CardContent className="p-3 text-left">
                <strong className="text-sm">Component Coverage</strong>
                <span className="text-xs text-muted-foreground block">
                  Track library component usage
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-left">
                <strong className="text-sm">Token Coverage</strong>
                <span className="text-xs text-muted-foreground block">
                  Check design token adoption
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-left">
                <strong className="text-sm">Style Coverage</strong>
                <span className="text-xs text-muted-foreground block">
                  Monitor shared style usage
                </span>
              </CardContent>
            </Card>
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
