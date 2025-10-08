import React from "react";

interface SummaryViewProps {
  analysis: {
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
    };
  };
  onExport: (format: "json" | "csv") => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ analysis, onExport }) => {
  const { summary, details } = analysis;

  const getScoreClass = (score: number) => {
    if (score >= 80) return "high";
    if (score >= 50) return "medium";
    return "low";
  };

  return (
    <div className="summary-view">
      <div className="score-card">
        <div className={`score-value ${getScoreClass(summary.overallScore)}`}>
          {summary.overallScore}%
        </div>
        <div className="score-label">Design System Compliance</div>
        <div className="score-sublabel">{summary.analyzedFrameName}</div>
      </div>

      <div className="metrics-grid">
        <div className="metric">
          <div className="metric-label">Component Coverage</div>
          <div
            className={`metric-value ${getScoreClass(
              summary.componentCoverage
            )}`}
          >
            {summary.componentCoverage}%
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Token Coverage</div>
          <div
            className={`metric-value ${getScoreClass(summary.tokenCoverage)}`}
          >
            {summary.tokenCoverage}%
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Style Coverage</div>
          <div
            className={`metric-value ${getScoreClass(summary.styleCoverage)}`}
          >
            {summary.styleCoverage}%
          </div>
        </div>
      </div>

      <div className="type-breakdown">
        <h3 className="breakdown-title">Coverage by Element Type</h3>
        {Object.entries(details.byType)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([type, stats]) => (
            <div key={type} className="breakdown-item">
              <div className="breakdown-name">{type}</div>
              <div className="breakdown-stats">
                <div className="breakdown-count">
                  {stats.compliant} / {stats.total}
                </div>
                <div
                  className={`breakdown-percentage ${getScoreClass(
                    stats.percentage
                  )}`}
                >
                  {stats.percentage}%
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="export-section">
        <h3 className="export-title">Export Results</h3>
        <div className="export-buttons">
          <button
            className="btn btn-secondary"
            onClick={() => onExport("json")}
          >
            Export JSON
          </button>
          <button className="btn btn-secondary" onClick={() => onExport("csv")}>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryView;
