import React, { useState } from "react";

interface DebugViewProps {
  debugData: any;
  onClose: () => void;
}

const DebugView: React.FC<DebugViewProps> = ({ debugData, onClose }) => {
  const [activeTab, setActiveTab] = useState<"summary" | "layers" | "raw">(
    "summary"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompliant, setFilterCompliant] = useState<
    "all" | "compliant" | "non-compliant"
  >("all");

  const exportToJSON = () => {
    const dataStr = JSON.stringify(debugData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `figma-debug-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
    alert("Debug data copied to clipboard!");
  };

  const getFilteredLayers = () => {
    if (!debugData?.analysisResults) return [];

    let allLayers: any[] = [];
    debugData.analysisResults.forEach((frame: any) => {
      allLayers = allLayers.concat(frame.layers || []);
    });

    return allLayers.filter((layer) => {
      const matchesSearch =
        layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        layer.path.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter =
        filterCompliant === "all" ||
        (filterCompliant === "compliant" && layer.isCompliant) ||
        (filterCompliant === "non-compliant" && !layer.isCompliant);
      return matchesSearch && matchesFilter;
    });
  };

  const filteredLayers = getFilteredLayers();

  return (
    <div className="debug-view">
      <div className="debug-header">
        <div className="debug-title">
          <h3>🔧 Debug Analysis Data</h3>
          <div className="debug-meta">
            <span>
              Exported: {new Date(debugData.timestamp).toLocaleString()}
            </span>
            <span>Plugin v{debugData.pluginVersion}</span>
          </div>
        </div>
        <div className="debug-actions">
          <button className="btn btn-secondary" onClick={copyToClipboard}>
            📋 Copy JSON
          </button>
          <button className="btn btn-primary" onClick={exportToJSON}>
            💾 Download JSON
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            ✕ Close
          </button>
        </div>
      </div>

      <div className="debug-tabs">
        <button
          className={`tab ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          📊 Summary
        </button>
        <button
          className={`tab ${activeTab === "layers" ? "active" : ""}`}
          onClick={() => setActiveTab("layers")}
        >
          🔍 Layer Details
        </button>
        <button
          className={`tab ${activeTab === "raw" ? "active" : ""}`}
          onClick={() => setActiveTab("raw")}
        >
          📄 Raw JSON
        </button>
      </div>

      <div className="debug-content">
        {activeTab === "summary" && (
          <div className="summary-tab">
            <div className="summary-grid">
              <div className="summary-card">
                <h4>🎯 Analysis Settings</h4>
                <div className="setting-item">
                  <span className="setting-label">Check Components:</span>
                  <span
                    className={`setting-value ${
                      debugData.currentSettings.checkComponents
                        ? "enabled"
                        : "disabled"
                    }`}
                  >
                    {debugData.currentSettings.checkComponents
                      ? "✅ Enabled"
                      : "❌ Disabled"}
                  </span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Check Tokens:</span>
                  <span
                    className={`setting-value ${
                      debugData.currentSettings.checkTokens
                        ? "enabled"
                        : "disabled"
                    }`}
                  >
                    {debugData.currentSettings.checkTokens
                      ? "✅ Enabled"
                      : "❌ Disabled"}
                  </span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Check Styles:</span>
                  <span
                    className={`setting-value ${
                      debugData.currentSettings.checkStyles
                        ? "enabled"
                        : "disabled"
                    }`}
                  >
                    {debugData.currentSettings.checkStyles
                      ? "✅ Enabled"
                      : "❌ Disabled"}
                  </span>
                </div>
                <div className="setting-item">
                  <span className="setting-label">Allow Local Styles:</span>
                  <span
                    className={`setting-value ${
                      debugData.currentSettings.allowLocalStyles
                        ? "enabled"
                        : "disabled"
                    }`}
                  >
                    {debugData.currentSettings.allowLocalStyles
                      ? "✅ Enabled"
                      : "❌ Disabled"}
                  </span>
                </div>
              </div>

              <div className="summary-card">
                <h4>🏗️ Figma Environment</h4>
                <div className="env-item">
                  <span className="env-label">Document:</span>
                  <span className="env-value">
                    {debugData.figmaEnvironment.documentName}
                  </span>
                </div>
                <div className="env-item">
                  <span className="env-label">Page:</span>
                  <span className="env-value">
                    {debugData.figmaEnvironment.pageName}
                  </span>
                </div>
                <div className="env-item">
                  <span className="env-label">Local Variables:</span>
                  <span className="env-value">
                    {debugData.figmaEnvironment.localVariables}
                  </span>
                </div>
                <div className="env-item">
                  <span className="env-label">Variable Collections:</span>
                  <span className="env-value">
                    {debugData.figmaEnvironment.localVariableCollections}
                  </span>
                </div>
                <div className="env-item">
                  <span className="env-label">Local Styles:</span>
                  <span className="env-value">
                    {debugData.figmaEnvironment.localStyles}
                  </span>
                </div>
                <div className="env-item">
                  <span className="env-label">Local Components:</span>
                  <span className="env-value">
                    {debugData.figmaEnvironment.localComponents}
                  </span>
                </div>
              </div>

              <div className="summary-card">
                <h4>📋 Selection</h4>
                {debugData.selection.map((node: any, idx: number) => (
                  <div key={idx} className="selection-item">
                    <span className="selection-type">{node.type}</span>
                    <span className="selection-name">{node.name}</span>
                  </div>
                ))}
              </div>

              <div className="summary-card">
                <h4>📊 Analysis Results</h4>
                {debugData.analysisResults.map((result: any, idx: number) => (
                  <div key={idx} className="result-item">
                    <div className="result-header">
                      <span className="result-name">{result.frameName}</span>
                      <span className="result-type">({result.frameType})</span>
                    </div>
                    <div className="result-stats">
                      <span>Total: {result.summary.totalLayers}</span>
                      <span className="compliant">
                        ✅ {result.summary.compliantLayers}
                      </span>
                      <span className="non-compliant">
                        ❌ {result.summary.nonCompliantLayers}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "layers" && (
          <div className="layers-tab">
            <div className="layers-filters">
              <input
                type="text"
                placeholder="Search layers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-input"
              />
              <select
                value={filterCompliant}
                onChange={(e) => setFilterCompliant(e.target.value as any)}
                className="filter-input"
              >
                <option value="all">
                  All Layers ({filteredLayers.length})
                </option>
                <option value="compliant">Compliant Only</option>
                <option value="non-compliant">Non-Compliant Only</option>
              </select>
            </div>

            <div className="layers-list">
              {filteredLayers.map((layer: any, idx: number) => (
                <div
                  key={idx}
                  className={`layer-debug-item ${
                    layer.isCompliant ? "compliant" : "non-compliant"
                  }`}
                >
                  <div className="layer-debug-header">
                    <div className="layer-debug-info">
                      <div className="layer-debug-name">{layer.name}</div>
                      <div className="layer-debug-meta">
                        {layer.type} • {layer.path}
                      </div>
                    </div>
                    <div
                      className={`layer-debug-status ${
                        layer.isCompliant ? "compliant" : "non-compliant"
                      }`}
                    >
                      {layer.isCompliant ? "✅ Compliant" : "❌ Non-Compliant"}
                    </div>
                  </div>

                  {layer.issues.length > 0 && (
                    <div className="layer-debug-issues">
                      <strong>Issues:</strong>
                      {layer.issues.map((issue: string, issueIdx: number) => (
                        <div key={issueIdx} className="debug-issue">
                          {issue}
                        </div>
                      ))}
                    </div>
                  )}

                  <details className="layer-debug-details">
                    <summary>Raw Properties</summary>
                    <pre className="debug-json">
                      {JSON.stringify(layer.rawProperties, null, 2)}
                    </pre>
                  </details>

                  <details className="layer-debug-details">
                    <summary>Analysis Results</summary>
                    <pre className="debug-json">
                      {JSON.stringify(layer.analysis, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "raw" && (
          <div className="raw-tab">
            <pre className="debug-json-full">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugView;
