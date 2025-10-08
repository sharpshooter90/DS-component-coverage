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
      }>;
    };
  };
  onSelectLayer: (layerId: string) => void;
  onFixLayer?: (layer: {
    id: string;
    name: string;
    type: string;
    issues: string[];
    path: string;
  }) => void;
}

const DetailedView: React.FC<DetailedViewProps> = ({
  analysis,
  onSelectLayer,
  onFixLayer,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { nonCompliantLayers } = analysis.details;

  const hasColorIssue = (issues: string[]) => {
    return issues.some(
      (issue) =>
        issue.toLowerCase().includes("color") ||
        issue.toLowerCase().includes("fill") ||
        issue.toLowerCase().includes("stroke") ||
        issue.toLowerCase().includes("token")
    );
  };

  // Get unique types for filter
  const uniqueTypes = Array.from(
    new Set(nonCompliantLayers.map((layer) => layer.type))
  );

  // Filter layers based on search and type
  const filteredLayers = nonCompliantLayers.filter((layer) => {
    const matchesSearch =
      layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      layer.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      layer.issues.some((issue) =>
        issue.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesType = filterType === "all" || layer.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="detailed-view">
      <div className="filter-section">
        <input
          type="text"
          className="filter-input"
          placeholder="Search layers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="filter-section">
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
      </div>

      <div className="layers-list">
        {filteredLayers.length === 0 ? (
          <div className="empty-state">
            <p>No non-compliant layers found</p>
          </div>
        ) : (
          filteredLayers.map((layer) => (
            <div key={layer.id} className="layer-item">
              <div className="layer-header">
                <div className="layer-info">
                  <div className="layer-name">{layer.name}</div>
                  <div className="layer-meta">{layer.type}</div>
                </div>
                <div className="layer-actions">
                  <button
                    className="layer-select-btn"
                    onClick={() => onSelectLayer(layer.id)}
                  >
                    Select
                  </button>
                  {onFixLayer && hasColorIssue(layer.issues) && (
                    <button
                      className="layer-fix-btn"
                      onClick={() => onFixLayer(layer)}
                    >
                      Fix
                    </button>
                  )}
                </div>
              </div>
              <div className="layer-path">{layer.path}</div>
              <div className="layer-issues">
                {layer.issues.map((issue, idx) => (
                  <div key={idx} className="issue">
                    {issue}
                  </div>
                ))}
              </div>
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
