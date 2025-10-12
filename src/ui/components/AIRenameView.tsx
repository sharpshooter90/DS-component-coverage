import React from "react";

const placeholderFeatures = [
  {
    title: "Naming Conventions",
    description: "Preset templates like BEM, semantic names, and custom rules",
  },
  {
    title: "API Configuration",
    description: "Manage Gemini models, tokens, and backend endpoints",
  },
  {
    title: "Layer Exclusions",
    description: "Skip hidden, locked, or pattern-matched layers automatically",
  },
  {
    title: "Review Mode",
    description: "Preview rename suggestions and approve changes in batches",
  },
];

export default function AIRenameView() {
  return (
    <div className="ai-rename-view">
      <div className="ai-rename-hero">
        <div className="ai-rename-icon" aria-hidden="true">
          🤖
        </div>
        <h2>AI Rename Settings — Coming Soon</h2>
        <p>
          Configure AI naming conventions, patterns, and review workflows to
          keep layers tidy and consistent across large files.
        </p>
      </div>

      <div className="ai-rename-feature-grid">
        {placeholderFeatures.map((feature) => (
          <div className="ai-rename-feature-card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
