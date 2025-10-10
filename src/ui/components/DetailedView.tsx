import React, { useState } from "react";

interface DetailedViewProps {
  analysis: {
    details: {
      nonCompliantLayers: Array<{
        id: string;
        name: string;
        type: string;
        issues: string[];
        path: string;
        rawProperties?: any;
        analysis?: any;
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
  };
  onSelectLayer: (layerId: string) => void;
  onFixLayer?: (
    layers: Array<{
      id: string;
      name: string;
      type: string;
      issues: string[];
      path: string;
    }>
  ) => void;
  onConvertToAutoLayout?: (layerId: string) => void;
  onExportDebug?: () => void;
  onRefresh?: () => void;
}

const DetailedView: React.FC<DetailedViewProps> = ({
  analysis,
  onSelectLayer,
  onFixLayer,
  onConvertToAutoLayout,
  onExportDebug,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"severity" | "name" | "type">(
    "severity"
  );
  const [showCompliant, setShowCompliant] = useState<boolean>(false);

  const { nonCompliantLayers, suggestions } = analysis.details;

  const hasFixableIssue = (issues: string[]) => {
    return issues.some((issue) => {
      if (typeof issue !== "string") {
        return false;
      }
      const normalized = issue.toLowerCase();
      const isCritical =
        issue.includes("🔴") ||
        issue.includes("⚠️") ||
        issue.includes("💡 frame can use auto layout");
      if (!isCritical) return false;
      return (
        normalized.includes("color") ||
        normalized.includes("fill") ||
        normalized.includes("stroke") ||
        normalized.includes("token") ||
        normalized.includes("text") ||
        normalized.includes("spacing") ||
        normalized.includes("corner") ||
        normalized.includes("padding") ||
        normalized.includes("effect") ||
        normalized.includes("auto layout")
      );
    });
  };

  const isCompliant = (issues: string[]) => {
    // Layer is compliant if it has no critical (🔴) or warning (⚠️) issues
    return !issues.some(
      (issue) => issue.includes("🔴") || issue.includes("⚠️")
    );
  };

  const getSeverityScore = (issues: string[]) => {
    // Calculate severity: higher score = more severe
    // Non-compliant with critical issues = highest priority
    let score = 0;
    const criticalCount = issues.filter((issue) => issue.includes("🔴")).length;
    const warningCount = issues.filter((issue) => issue.includes("⚠️")).length;

    // Critical issues: 100 points each
    score += criticalCount * 100;
    // Warning issues: 10 points each
    score += warningCount * 10;
    // Compliant (only ✅): -1000 points (lowest priority)
    if (isCompliant(issues)) {
      score = -1000;
    }

    return score;
  };

  const getIssues = (layer: { issues: string[] }) =>
    Array.isArray(layer.issues) ? layer.issues : [];

  const layersWithFixableIssues = nonCompliantLayers.filter((layer) =>
    hasFixableIssue(getIssues(layer))
  );

  const autoLayoutSuggestions = suggestions?.autoLayout ?? [];
  const autoLayoutSuggestionIds = React.useMemo(
    () => new Set(autoLayoutSuggestions.map((layer) => layer.id)),
    [autoLayoutSuggestions]
  );

  // Filter auto layout suggestions based on search term and type
  const filteredAutoLayoutSuggestions = autoLayoutSuggestions.filter(
    (layer) => {
      const matchesSearch =
        searchTerm === "" ||
        layer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        layer.path?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || layer.type === filterType;
      return matchesSearch && matchesType;
    }
  );

  const toggleLayerSelection = (layerId: string) => {
    const newSelection = new Set(selectedLayers);
    if (newSelection.has(layerId)) {
      newSelection.delete(layerId);
    } else {
      newSelection.add(layerId);
    }
    setSelectedLayers(newSelection);
  };

  const selectAll = () => {
    const allFixableLayerIds = filteredLayers
      .filter((layer) => hasFixableIssue(getIssues(layer)))
      .map((layer) => layer.id);
    setSelectedLayers(new Set(allFixableLayerIds));
  };

  const deselectAll = () => {
    setSelectedLayers(new Set());
  };

  const handleBulkFix = () => {
    const layersToFix = nonCompliantLayers.filter((layer) =>
      selectedLayers.has(layer.id)
    );
    if (onFixLayer && layersToFix.length > 0) {
      onFixLayer(layersToFix);
      setSelectedLayers(new Set());
    }
  };

  // Get unique types for filter
  const uniqueTypes = Array.from(
    new Set(nonCompliantLayers.map((layer) => layer.type))
  );

  // Filter and sort layers
  const filteredLayers = nonCompliantLayers
    .filter((layer) => {
      const issues = getIssues(layer);
      if (!showCompliant && isCompliant(issues)) {
        return false;
      }
      const matchesSearch =
        layer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        layer.path?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issues.some((issue) =>
          issue.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesType = filterType === "all" || layer.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const issuesA = getIssues(a);
      const issuesB = getIssues(b);
      if (sortBy === "severity") {
        // Sort by severity: highest severity first
        return getSeverityScore(issuesB) - getSeverityScore(issuesA);
      } else if (sortBy === "name") {
        // Sort alphabetically by name
        return a.name.localeCompare(b.name);
      } else if (sortBy === "type") {
        // Sort by type, then by name
        const typeCompare = a.type.localeCompare(b.type);
        return typeCompare !== 0 ? typeCompare : a.name.localeCompare(b.name);
      }
      return 0;
    });

  return (
    <div className="detailed-view">
      {/* Top Action Bar */}
      <div className="detailed-action-bar">
        <div className="action-bar-left">
          <h3 className="action-bar-title">📋 Layer Compliance</h3>
          {layersWithFixableIssues.length > 0 && (
            <span className="fixable-count">
              {layersWithFixableIssues.length} fixable
            </span>
          )}
        </div>
        <div className="action-bar-right">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showCompliant}
              onChange={(e) => setShowCompliant(e.target.checked)}
            />
            Show compliant layers
          </label>
          {layersWithFixableIssues.length > 0 && (
            <>
              <button
                className="btn btn-small btn-secondary"
                onClick={selectAll}
              >
                Select All
              </button>
              {selectedLayers.size > 0 && (
                <>
                  <button
                    className="btn btn-small btn-secondary"
                    onClick={deselectAll}
                  >
                    Deselect ({selectedLayers.size})
                  </button>
                  <button
                    className="btn btn-small btn-primary"
                    onClick={handleBulkFix}
                  >
                    🔧 Fix {selectedLayers.size} Layer
                    {selectedLayers.size > 1 ? "s" : ""}
                  </button>
                </>
              )}
            </>
          )}
          {onRefresh && (
            <button
              className="btn btn-small btn-secondary"
              onClick={onRefresh}
              title="Refresh compliance status after applying fixes"
            >
              🔄 Refresh
            </button>
          )}
          {onExportDebug && (
            <button
              className="btn btn-small btn-secondary"
              onClick={onExportDebug}
            >
              💾 Export Debug
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="filter-section">
        <input
          type="text"
          className="filter-input"
          placeholder="🔍 Search by name, path, or issue..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-input"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="all">All Types ({nonCompliantLayers.length})</option>
          {uniqueTypes.map((type) => {
            const count = nonCompliantLayers.filter(
              (l) => l.type === type
            ).length;
            return (
              <option key={type} value={type}>
                {type} ({count})
              </option>
            );
          })}
        </select>
        <select
          className="filter-input"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
        >
          <option value="severity">Sort: Severity (Critical First)</option>
          <option value="name">Sort: Name (A-Z)</option>
          <option value="type">Sort: Type</option>
        </select>
      </div>

      {filteredAutoLayoutSuggestions.length > 0 && (
        <div className="suggestion-card">
          <div className="suggestion-header">
            <div>
              <div className="suggestion-title">
                📐 Frames not using Auto Layout
              </div>
              <div className="suggestion-subtitle">
                {filteredAutoLayoutSuggestions.length} frame
                {filteredAutoLayoutSuggestions.length === 1 ? "" : "s"} can be
                converted to Auto Layout.
                {searchTerm &&
                  autoLayoutSuggestions.length >
                    filteredAutoLayoutSuggestions.length && (
                    <span
                      style={{
                        marginLeft: "8px",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      (filtered from {autoLayoutSuggestions.length})
                    </span>
                  )}
              </div>
            </div>
            <div className="suggestion-actions">
              <button
                className="btn btn-small btn-secondary"
                onClick={() => {
                  filteredAutoLayoutSuggestions.forEach((layer) =>
                    onSelectLayer(layer.id)
                  );
                }}
              >
                📍 Select All
              </button>
              {onConvertToAutoLayout && (
                <button
                  className="btn btn-small btn-primary"
                  onClick={() => {
                    filteredAutoLayoutSuggestions.forEach((layer) =>
                      onConvertToAutoLayout(layer.id)
                    );
                  }}
                  style={{ whiteSpace: "nowrap" }}
                >
                  📐 Convert to Auto Layout
                </button>
              )}
            </div>
          </div>
          <div className="suggestion-layers-list">
            {filteredAutoLayoutSuggestions.map((layer) => {
              // Find the full layer data from nonCompliantLayers if available
              const fullLayer = nonCompliantLayers.find(
                (l) => l.id === layer.id
              );
              const layerIssues = fullLayer ? getIssues(fullLayer) : [];

              return (
                <div key={layer.id} className="layer-item enhanced">
                  <div className="layer-header">
                    <div className="layer-info">
                      <div className="layer-name-row">
                        <div className="layer-name">{layer.name}</div>
                        <span className="layer-status-badge suggestion">
                          💡 Can use Auto Layout
                        </span>
                      </div>
                      <div className="layer-meta">
                        <span className="layer-type">{layer.type}</span>
                        <span className="layer-path-short">{layer.path}</span>
                      </div>
                    </div>
                    <div className="layer-actions">
                      <button
                        className="btn btn-small btn-secondary layer-select-btn"
                        onClick={() => onSelectLayer(layer.id)}
                        title="Select in Figma"
                      >
                        📍 Select
                      </button>
                      {onConvertToAutoLayout && (
                        <button
                          className="btn btn-small btn-primary layer-auto-layout-btn"
                          onClick={() => onConvertToAutoLayout(layer.id)}
                          title="Convert this frame to Auto Layout"
                        >
                          📐 Auto Layout
                        </button>
                      )}
                    </div>
                  </div>

                  {layerIssues.length > 0 && (
                    <div className="layer-issues">
                      <div className="issues-header">
                        <strong>Issues:</strong>
                      </div>
                      {layerIssues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`issue ${
                            issue.includes("🔴")
                              ? "critical"
                              : issue.includes("⚠️")
                              ? "warning"
                              : "success"
                          }`}
                        >
                          {issue}
                        </div>
                      ))}
                    </div>
                  )}

                  {fullLayer?.rawProperties && (
                    <details className="layer-details">
                      <summary className="details-toggle">
                        🔍 View Raw Properties
                      </summary>
                      <div className="details-content">
                        <pre className="properties-json">
                          {JSON.stringify(fullLayer.rawProperties, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}

                  {fullLayer?.analysis && (
                    <details className="layer-details">
                      <summary className="details-toggle">
                        📊 View Analysis Results
                      </summary>
                      <div className="details-content">
                        <pre className="properties-json">
                          {JSON.stringify(fullLayer.analysis, null, 2)}
                        </pre>
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="layers-list">
        {filteredLayers.length === 0 ? (
          <div className="empty-state">
            <p>No non-compliant layers found</p>
          </div>
        ) : (
          filteredLayers.map((layer) => (
            <div
              key={layer.id}
              className={`layer-item enhanced ${
                selectedLayers.has(layer.id) ? "selected" : ""
              }`}
            >
              <div className="layer-header">
                {hasFixableIssue(getIssues(layer)) && (
                  <input
                    type="checkbox"
                    className="layer-checkbox"
                    checked={selectedLayers.has(layer.id)}
                    onChange={() => toggleLayerSelection(layer.id)}
                  />
                )}
                <div className="layer-info">
                  <div className="layer-name-row">
                    <div className="layer-name">{layer.name}</div>
                    <span
                      className={`layer-status-badge ${
                        isCompliant(getIssues(layer))
                          ? "compliant"
                          : "non-compliant"
                      }`}
                    >
                      {isCompliant(getIssues(layer))
                        ? "✅ Compliant"
                        : "❌ Non-Compliant"}
                    </span>
                  </div>
                  <div className="layer-meta">
                    <span className="layer-type">{layer.type}</span>
                    <span className="layer-path-short">{layer.path}</span>
                  </div>
                </div>
                <div className="layer-actions">
                  <button
                    className="btn btn-small btn-secondary layer-select-btn"
                    onClick={() => onSelectLayer(layer.id)}
                    title="Select in Figma"
                  >
                    📍 Select
                  </button>
                  {onConvertToAutoLayout &&
                    layer.type.toLowerCase() === "frame" && (
                      <button
                        className="btn btn-small btn-secondary layer-auto-layout-btn"
                        onClick={() => onConvertToAutoLayout(layer.id)}
                        title="Convert this frame to Auto Layout"
                      >
                        📐 Auto Layout
                      </button>
                    )}
                  {onFixLayer && hasFixableIssue(getIssues(layer)) && (
                    <button
                      className="btn btn-small btn-primary layer-fix-btn"
                      onClick={() => onFixLayer([layer])}
                      title="Fix this layer"
                    >
                      🔧 Fix
                    </button>
                  )}
                </div>
              </div>

              <div className="layer-issues">
                <div className="issues-header">
                  <strong>Issues:</strong>
                </div>
                {getIssues(layer).map((issue, idx) => (
                  <div
                    key={idx}
                    className={`issue ${
                      issue.includes("🔴")
                        ? "critical"
                        : issue.includes("⚠️")
                        ? "warning"
                        : "success"
                    }`}
                  >
                    {issue}
                  </div>
                ))}
              </div>

              {layer.rawProperties && (
                <details className="layer-details">
                  <summary className="details-toggle">
                    🔍 View Raw Properties
                  </summary>
                  <div className="details-content">
                    <pre className="properties-json">
                      {JSON.stringify(layer.rawProperties, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {layer.analysis && (
                <details className="layer-details">
                  <summary className="details-toggle">
                    📊 View Analysis Results
                  </summary>
                  <div className="details-content">
                    <pre className="properties-json">
                      {JSON.stringify(layer.analysis, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          ))
        )}
      </div>

      {filteredLayers.length > 0 && (
        <div
          style={{
            marginTop: "16px",
            textAlign: "center",
            fontSize: "11px",
            color: "var(--text-secondary)",
          }}
        >
          Showing {filteredLayers.length} of {nonCompliantLayers.length}{" "}
          non-compliant layers
        </div>
      )}
    </div>
  );
};

export default DetailedView;
