import React, { useState, useEffect } from "react";
import { ColorData, VariableBinding, RGB } from "../types";

interface FixWizardProps {
  layers: Array<{ id: string; name: string; issues: string[] }>;
  onClose: () => void;
}

interface StyleIssue {
  type: "color" | "text" | "spacing" | "effect";
  description: string;
  fixable: boolean;
}

const FixWizard: React.FC<FixWizardProps> = ({ layers, onClose }) => {
  const isBulkMode = layers.length > 1;
  const [step, setStep] = useState(1);
  const [namingConfig, setNamingConfig] = useState({
    colorPrefix: "color",
    spacingPrefix: "spacing",
    textPrefix: "text",
    casing: "kebab-case" as "kebab-case" | "camelCase" | "snake_case",
  });
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<Set<string>>(
    new Set(["color"])
  );
  const [allColors, setAllColors] = useState<Map<string, ColorData[]>>(
    new Map()
  );
  const [uniqueColors, setUniqueColors] = useState<
    Array<{ color: RGB; sources: string[] }>
  >([]);
  const [variableNames, setVariableNames] = useState<Record<number, string>>(
    {}
  );
  const [loadingLayers, setLoadingLayers] = useState<Set<string>>(
    new Set(layers.map((l) => l.id))
  );

  // Parse and categorize issues from all layers
  const parseIssues = (): StyleIssue[] => {
    const allIssues = layers.flatMap((layer) => layer.issues);
    const categorizedIssues: StyleIssue[] = [];

    allIssues.forEach((issue) => {
      if (
        issue.includes("🔴") &&
        (issue.includes("fill") || issue.includes("stroke"))
      ) {
        categorizedIssues.push({
          type: "color",
          description: issue,
          fixable: true,
        });
      } else if (issue.includes("🔴") && issue.includes("text")) {
        categorizedIssues.push({
          type: "text",
          description: issue,
          fixable: true,
        });
      } else if (
        issue.includes("🔴") &&
        (issue.includes("corner") || issue.includes("padding"))
      ) {
        categorizedIssues.push({
          type: "spacing",
          description: issue,
          fixable: true,
        });
      } else if (issue.includes("🔴") && issue.includes("effect")) {
        categorizedIssues.push({
          type: "effect",
          description: issue,
          fixable: true,
        });
      }
    });

    return categorizedIssues;
  };

  const availableIssues = parseIssues();
  const uniqueIssueTypes = Array.from(
    new Set(availableIssues.map((i) => i.type))
  );

  const getIssueTypeLabel = (type: string): string => {
    switch (type) {
      case "color":
        return "🎨 Color Issues";
      case "text":
        return "📝 Text Styles";
      case "spacing":
        return "📏 Spacing & Radius";
      case "effect":
        return "✨ Effects";
      default:
        return type;
    }
  };

  const getIssueTypeDescription = (type: string): string => {
    switch (type) {
      case "color":
        return "Fix fill and stroke colors with design tokens";
      case "text":
        return "Apply shared text styles";
      case "spacing":
        return "Bind padding, margin, and corner radius to spacing tokens";
      case "effect":
        return "Apply effect styles and variables";
      default:
        return "Fix style issues";
    }
  };

  useEffect(() => {
    // Request colors from all layers
    layers.forEach((layer) => {
      window.parent.postMessage(
        { pluginMessage: { type: "get-layer-colors", layerId: layer.id } },
        "*"
      );
    });

    // Listen for color data responses
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg.type === "layer-colors") {
        setAllColors((prev) => {
          const newMap = new Map(prev);
          newMap.set(msg.layerId, msg.colors);
          return newMap;
        });
        setLoadingLayers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(msg.layerId);
          return newSet;
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [layers]);

  // Deduplicate colors and track sources
  useEffect(() => {
    if (loadingLayers.size === 0 && allColors.size > 0) {
      const colorMap = new Map<string, { color: RGB; sources: string[] }>();

      allColors.forEach((colors, layerId) => {
        const layerName = layers.find((l) => l.id === layerId)?.name || layerId;
        colors.forEach((colorData) => {
          const key = `${colorData.color.r}-${colorData.color.g}-${colorData.color.b}`;
          if (colorMap.has(key)) {
            const existing = colorMap.get(key)!;
            if (!existing.sources.includes(layerName)) {
              existing.sources.push(layerName);
            }
          } else {
            colorMap.set(key, {
              color: colorData.color,
              sources: [layerName],
            });
          }
        });
      });

      setUniqueColors(Array.from(colorMap.values()));
    }
  }, [allColors, loadingLayers, layers]);

  const rgbToHex = (color: RGB): string => {
    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  };

  const rgbToCss = (color: RGB): string => {
    return `rgb(${Math.round(color.r * 255)}, ${Math.round(
      color.g * 255
    )}, ${Math.round(color.b * 255)})`;
  };

  const applyCasing = (str: string, casing: string): string => {
    // Remove special characters and split into words
    const words = str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w);

    switch (casing) {
      case "kebab-case":
        return words.join("-");
      case "camelCase":
        return words
          .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
          .join("");
      case "snake_case":
        return words.join("_");
      default:
        return words.join("-");
    }
  };

  const generateVariableName = (
    color: RGB,
    index: number,
    sources?: string[]
  ): string => {
    const hex = rgbToHex(color).replace("#", "");
    let base: string;

    if (isBulkMode) {
      // For bulk mode, use just the color hex
      base = `${namingConfig.colorPrefix} ${hex.slice(0, 6)}`;
    } else {
      // For single layer, include layer name
      base = `${namingConfig.colorPrefix} ${layers[0].name} ${hex.slice(0, 6)}`;
    }

    return applyCasing(base, namingConfig.casing);
  };

  const handleApply = () => {
    if (isBulkMode) {
      // Bulk mode: Apply same variables to all layers
      const colorToVariableMap = new Map<string, string>();

      uniqueColors.forEach((colorData, idx) => {
        const key = `${colorData.color.r}-${colorData.color.g}-${colorData.color.b}`;
        const varName =
          variableNames[idx] ||
          generateVariableName(colorData.color, idx, colorData.sources);
        colorToVariableMap.set(key, varName);
      });

      // Send bulk update request
      window.parent.postMessage(
        {
          pluginMessage: {
            type: "apply-bulk-color-variables",
            layerIds: layers.map((l) => l.id),
            colorToVariableMap: Object.fromEntries(colorToVariableMap),
          },
        },
        "*"
      );
    } else {
      // Single layer mode
      const layerColors = allColors.get(layers[0].id) || [];
      const bindings: VariableBinding[] = layerColors.map((colorData, idx) => ({
        variableName:
          variableNames[idx] || generateVariableName(colorData.color, idx),
        color: colorData.color,
        type: colorData.type,
        index: colorData.index,
      }));

      window.parent.postMessage(
        {
          pluginMessage: {
            type: "apply-color-variables",
            layerId: layers[0].id,
            variableBindings: bindings,
          },
        },
        "*"
      );
    }
  };

  const canProceedToStep3 =
    selectedIssueTypes.size > 0 &&
    ((selectedIssueTypes.has("color") &&
      ((isBulkMode && uniqueColors.length > 0) ||
        (!isBulkMode && allColors.size > 0))) ||
      selectedIssueTypes.has("text") ||
      selectedIssueTypes.has("spacing") ||
      selectedIssueTypes.has("effect"));

  return (
    <div className="fix-wizard-overlay" onClick={onClose}>
      <div className="fix-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h3>
            Fix Color Variables{" "}
            {isBulkMode ? `- ${layers.length} Layers` : `- ${layers[0].name}`}
          </h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {step === 1 && (
          <div className="wizard-step">
            <h4>Step 1: Choose Issues to Fix</h4>
            <div className="issues-selection">
              {uniqueIssueTypes.map((issueType) => {
                const issueCount = availableIssues.filter(
                  (i) => i.type === issueType
                ).length;
                const isSelected = selectedIssueTypes.has(issueType);

                return (
                  <div
                    key={issueType}
                    className={`option-card ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      const newSelection = new Set(selectedIssueTypes);
                      if (newSelection.has(issueType)) {
                        newSelection.delete(issueType);
                      } else {
                        newSelection.add(issueType);
                      }
                      setSelectedIssueTypes(newSelection);
                    }}
                  >
                    <input type="checkbox" checked={isSelected} readOnly />
                    <div className="option-content">
                      <label>
                        {getIssueTypeLabel(issueType)} ({issueCount})
                      </label>
                      <p>{getIssueTypeDescription(issueType)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="option-card disabled">
              <input type="radio" disabled />
              <div className="option-content">
                <label>From Existing Library</label>
                <p className="coming-soon">Coming Soon</p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <h4>Step 2: Configure Naming Convention</h4>

            {selectedIssueTypes.has("color") && (
              <div className="naming-section">
                <h5>🎨 Color Variables</h5>
                <div className="form-group">
                  <label>Color Prefix</label>
                  <input
                    className="filter-input"
                    value={namingConfig.colorPrefix}
                    onChange={(e) =>
                      setNamingConfig({
                        ...namingConfig,
                        colorPrefix: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {selectedIssueTypes.has("spacing") && (
              <div className="naming-section">
                <h5>📏 Spacing Variables</h5>
                <div className="form-group">
                  <label>Spacing Prefix</label>
                  <input
                    className="filter-input"
                    value={namingConfig.spacingPrefix}
                    onChange={(e) =>
                      setNamingConfig({
                        ...namingConfig,
                        spacingPrefix: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            )}

            {selectedIssueTypes.has("text") && (
              <div className="naming-section">
                <h5>📝 Text Styles</h5>
                <div className="info-message">
                  Text styles will be applied from existing shared styles in
                  your library
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Casing</label>
              <select
                className="filter-input"
                value={namingConfig.casing}
                onChange={(e) =>
                  setNamingConfig({
                    ...namingConfig,
                    casing: e.target.value as any,
                  })
                }
              >
                <option value="kebab-case">kebab-case</option>
                <option value="camelCase">camelCase</option>
                <option value="snake_case">snake_case</option>
              </select>
            </div>

            {(isBulkMode ? uniqueColors.length > 0 : allColors.size > 0) && (
              <div className="preview">
                <strong>Preview:</strong>
                <code>
                  {isBulkMode && uniqueColors.length > 0
                    ? generateVariableName(
                        uniqueColors[0].color,
                        0,
                        uniqueColors[0].sources
                      )
                    : allColors.size > 0 &&
                      Array.from(allColors.values())[0]?.length > 0
                    ? generateVariableName(
                        Array.from(allColors.values())[0][0].color,
                        0
                      )
                    : "color-example"}
                </code>
              </div>
            )}

            {loadingLayers.size > 0 && (
              <div className="info-message">
                Loading colors from {loadingLayers.size} layer
                {loadingLayers.size > 1 ? "s" : ""}...
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <h4>Step 3: Review & Apply</h4>
            {isBulkMode ? (
              uniqueColors.length === 0 ? (
                <div className="info-message">
                  No colors found in selected layers
                </div>
              ) : (
                <>
                  <div className="bulk-info">
                    Found {uniqueColors.length} unique color
                    {uniqueColors.length > 1 ? "s" : ""} across {layers.length}{" "}
                    layers
                  </div>
                  {uniqueColors.map((colorData, idx) => (
                    <div key={idx} className="variable-mapping bulk">
                      <div
                        className="color-preview"
                        style={{ background: rgbToCss(colorData.color) }}
                      />
                      <div className="variable-details">
                        <input
                          className="filter-input"
                          value={
                            variableNames[idx] ||
                            generateVariableName(
                              colorData.color,
                              idx,
                              colorData.sources
                            )
                          }
                          onChange={(e) =>
                            setVariableNames({
                              ...variableNames,
                              [idx]: e.target.value,
                            })
                          }
                        />
                        <div className="color-sources">
                          Used in: {colorData.sources.join(", ")}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )
            ) : allColors.get(layers[0].id)?.length === 0 ? (
              <div className="info-message">No colors found on this layer</div>
            ) : (
              allColors.get(layers[0].id)?.map((colorData, idx) => (
                <div key={idx} className="variable-mapping">
                  <div
                    className="color-preview"
                    style={{ background: rgbToCss(colorData.color) }}
                  />
                  <input
                    className="filter-input"
                    value={
                      variableNames[idx] ||
                      generateVariableName(colorData.color, idx)
                    }
                    onChange={(e) =>
                      setVariableNames({
                        ...variableNames,
                        [idx]: e.target.value,
                      })
                    }
                  />
                  <span className="color-type">{colorData.type}</span>
                </div>
              ))
            )}
          </div>
        )}

        <div className="wizard-footer">
          {step > 1 && (
            <button
              className="btn btn-secondary"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              className="btn btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !canProceedToStep3}
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={!canProceedToStep3}
            >
              Apply Fix{isBulkMode ? ` to ${layers.length} Layers` : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FixWizard;
