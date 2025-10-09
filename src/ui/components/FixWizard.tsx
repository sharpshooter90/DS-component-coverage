import React, { useState, useEffect } from "react";
import {
  ColorData,
  VariableBinding,
  RGB,
  SpacingData,
  SpacingVariableBinding,
  EffectData,
  EffectVariableBinding,
} from "../types";

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
  const [loadingLayers, setLoadingLayers] = useState<Set<string>>(new Set());

  // Spacing state
  const [allSpacing, setAllSpacing] = useState<Map<string, SpacingData[]>>(
    new Map()
  );
  const [uniqueSpacing, setUniqueSpacing] = useState<
    Array<{ spacing: SpacingData; sources: string[] }>
  >([]);
  const [spacingVariableNames, setSpacingVariableNames] = useState<
    Record<number, string>
  >({});

  // Effects state
  const [allEffects, setAllEffects] = useState<Map<string, EffectData[]>>(
    new Map()
  );
  const [uniqueEffects, setUniqueEffects] = useState<
    Array<{ effect: EffectData; sources: string[] }>
  >([]);
  const [effectVariableNames, setEffectVariableNames] = useState<
    Record<number, string>
  >({});

  // Parse and categorize issues from all layers - only show fixable ones
  const parseIssues = (): StyleIssue[] => {
    const allIssues = layers.flatMap((layer) => layer.issues);
    const categorizedIssues: StyleIssue[] = [];

    allIssues.forEach((issue) => {
      if (
        issue.includes("🔴") &&
        (issue.includes("fill") || issue.includes("stroke")) &&
        !issue.includes("gradient") && // Exclude gradient issues (not fixable)
        !issue.includes("image") // Exclude image issues (not fixable)
      ) {
        categorizedIssues.push({
          type: "color",
          description: issue,
          fixable: true,
        });
      } else if (
        issue.includes("🔴") &&
        issue.includes("text") &&
        !issue.includes("local text style") // Only show if we can apply shared styles
      ) {
        categorizedIssues.push({
          type: "text",
          description: issue,
          fixable: true,
        });
      } else if (
        issue.includes("🔴") &&
        (issue.includes("corner") ||
          issue.includes("padding") ||
          issue.includes("spacing"))
      ) {
        categorizedIssues.push({
          type: "spacing",
          description: issue,
          fixable: true,
        });
      } else if (
        issue.includes("🔴") &&
        issue.includes("effect") &&
        issue.includes("local effects instead of design tokens") // Match the exact effect issue message
      ) {
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
    // Track which layers we're loading data for
    const layersToLoad = new Set<string>();

    // Request data only for layers that have fixable issues of each type
    layers.forEach((layer) => {
      const layerIssues = layer.issues;

      // Only request colors if layer has fixable color issues
      const hasColorIssues = layerIssues.some(
        (issue) =>
          issue.includes("🔴") &&
          (issue.includes("fill") || issue.includes("stroke")) &&
          !issue.includes("gradient") &&
          !issue.includes("image")
      );

      // Only request spacing if layer has fixable spacing issues
      const hasSpacingIssues = layerIssues.some(
        (issue) =>
          issue.includes("🔴") &&
          (issue.includes("corner") ||
            issue.includes("padding") ||
            issue.includes("spacing"))
      );

      // Only request effects if layer has fixable effect issues
      const hasEffectIssues = layerIssues.some(
        (issue) =>
          issue.includes("🔴") &&
          issue.includes("effect") &&
          issue.includes("local effects instead of design tokens")
      );

      // Add to loading set if we're requesting any data for this layer
      if (hasColorIssues || hasSpacingIssues || hasEffectIssues) {
        layersToLoad.add(layer.id);
      }

      // Send requests for applicable data types
      if (hasColorIssues) {
        window.parent.postMessage(
          { pluginMessage: { type: "get-layer-colors", layerId: layer.id } },
          "*"
        );
      }

      if (hasSpacingIssues) {
        window.parent.postMessage(
          { pluginMessage: { type: "get-layer-spacing", layerId: layer.id } },
          "*"
        );
      }

      if (hasEffectIssues) {
        window.parent.postMessage(
          { pluginMessage: { type: "get-layer-effects", layerId: layer.id } },
          "*"
        );
      }
    });

    // Set loading state for layers we're actually requesting data from
    setLoadingLayers(layersToLoad);

    // Listen for data responses
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
      } else if (msg.type === "layer-spacing") {
        setAllSpacing((prev) => {
          const newMap = new Map(prev);
          newMap.set(msg.layerId, msg.spacing);
          return newMap;
        });
      } else if (msg.type === "layer-effects") {
        setAllEffects((prev) => {
          const newMap = new Map(prev);
          newMap.set(msg.layerId, msg.effects);
          return newMap;
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

  // Deduplicate spacing and track sources
  useEffect(() => {
    if (allSpacing.size > 0) {
      const spacingMap = new Map<
        string,
        { spacing: SpacingData; sources: string[] }
      >();

      allSpacing.forEach((spacingArray, layerId) => {
        const layerName = layers.find((l) => l.id === layerId)?.name || layerId;
        spacingArray.forEach((spacingData) => {
          const key = `${spacingData.type}-${spacingData.value}`;
          if (spacingMap.has(key)) {
            const existing = spacingMap.get(key)!;
            if (!existing.sources.includes(layerName)) {
              existing.sources.push(layerName);
            }
          } else {
            spacingMap.set(key, {
              spacing: spacingData,
              sources: [layerName],
            });
          }
        });
      });

      setUniqueSpacing(Array.from(spacingMap.values()));
    }
  }, [allSpacing, layers]);

  // Deduplicate effects and track sources
  useEffect(() => {
    if (allEffects.size > 0) {
      const effectMap = new Map<
        string,
        { effect: EffectData; sources: string[] }
      >();

      allEffects.forEach((effectsArray, layerId) => {
        const layerName = layers.find((l) => l.id === layerId)?.name || layerId;
        effectsArray.forEach((effectData) => {
          const key = `${effectData.type}-${effectData.radius}`;
          if (effectMap.has(key)) {
            const existing = effectMap.get(key)!;
            if (!existing.sources.includes(layerName)) {
              existing.sources.push(layerName);
            }
          } else {
            effectMap.set(key, {
              effect: effectData,
              sources: [layerName],
            });
          }
        });
      });

      setUniqueEffects(Array.from(effectMap.values()));
    }
  }, [allEffects, layers]);

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

  const generateSpacingVariableName = (
    spacing: SpacingData,
    index: number,
    sources?: string[]
  ): string => {
    let base: string;

    // Handle grouped padding types with better naming
    let typeName = spacing.type;
    if (spacing.type === "paddingHorizontal") {
      typeName = "paddingHorizontal"; // Use original type name for consistency
    } else if (spacing.type === "paddingVertical") {
      typeName = "paddingVertical"; // Use original type name for consistency
    }

    if (isBulkMode) {
      // For bulk mode, use type and value
      base = `${namingConfig.spacingPrefix} ${typeName} ${spacing.value}`;
    } else {
      // For single layer, include layer name
      base = `${namingConfig.spacingPrefix} ${layers[0].name} ${typeName} ${spacing.value}`;
    }

    return applyCasing(base, namingConfig.casing);
  };

  const generateEffectVariableName = (
    effect: EffectData,
    index: number,
    sources?: string[]
  ): string => {
    let base: string;

    if (isBulkMode) {
      // For bulk mode, use type and radius
      base = `effect ${effect.type.toLowerCase().replace("_", "-")} ${
        effect.radius
      }`;
    } else {
      // For single layer, include layer name
      base = `effect ${layers[0].name} ${effect.type
        .toLowerCase()
        .replace("_", "-")} ${effect.radius}`;
    }

    return applyCasing(base, namingConfig.casing);
  };

  const handleApply = () => {
    if (isBulkMode) {
      // Bulk mode: Apply variables to all layers
      const colorToVariableMap = new Map<string, string>();
      const spacingToVariableMap = new Map<string, string>();
      const effectToVariableMap = new Map<string, string>();

      // Handle colors
      if (selectedIssueTypes.has("color")) {
        uniqueColors.forEach((colorData, idx) => {
          const key = `${colorData.color.r}-${colorData.color.g}-${colorData.color.b}`;
          const varName =
            variableNames[idx] ||
            generateVariableName(colorData.color, idx, colorData.sources);
          colorToVariableMap.set(key, varName);
        });
      }

      // Handle spacing
      if (selectedIssueTypes.has("spacing")) {
        uniqueSpacing.forEach((spacingData, idx) => {
          const key = `${spacingData.spacing.type}-${spacingData.spacing.value}`;
          const varName =
            spacingVariableNames[idx] ||
            generateSpacingVariableName(
              spacingData.spacing,
              idx,
              spacingData.sources
            );
          spacingToVariableMap.set(key, varName);
        });
      }

      // Handle effects
      if (selectedIssueTypes.has("effect")) {
        uniqueEffects.forEach((effectData, idx) => {
          const key = `${effectData.effect.type}-${effectData.effect.radius}`;
          const varName =
            effectVariableNames[idx] ||
            generateEffectVariableName(
              effectData.effect,
              idx,
              effectData.sources
            );
          effectToVariableMap.set(key, varName);
        });
      }

      // Send bulk update requests
      if (colorToVariableMap.size > 0) {
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
      }

      if (spacingToVariableMap.size > 0) {
        window.parent.postMessage(
          {
            pluginMessage: {
              type: "apply-bulk-spacing-variables",
              layerIds: layers.map((l) => l.id),
              spacingToVariableMap: Object.fromEntries(spacingToVariableMap),
            },
          },
          "*"
        );
      }

      if (effectToVariableMap.size > 0) {
        window.parent.postMessage(
          {
            pluginMessage: {
              type: "apply-bulk-effect-variables",
              layerIds: layers.map((l) => l.id),
              effectToVariableMap: Object.fromEntries(effectToVariableMap),
            },
          },
          "*"
        );
      }
    } else {
      // Single layer mode
      const layerColors = allColors.get(layers[0].id) || [];
      const layerSpacing = allSpacing.get(layers[0].id) || [];
      const layerEffects = allEffects.get(layers[0].id) || [];

      // Apply colors
      if (selectedIssueTypes.has("color") && layerColors.length > 0) {
        const colorBindings: VariableBinding[] = layerColors.map(
          (colorData, idx) => ({
            variableName:
              variableNames[idx] || generateVariableName(colorData.color, idx),
            color: colorData.color,
            type: colorData.type,
            index: colorData.index,
          })
        );

        window.parent.postMessage(
          {
            pluginMessage: {
              type: "apply-color-variables",
              layerId: layers[0].id,
              variableBindings: colorBindings,
            },
          },
          "*"
        );
      }

      // Apply spacing
      if (selectedIssueTypes.has("spacing") && layerSpacing.length > 0) {
        const spacingBindings: SpacingVariableBinding[] = layerSpacing.map(
          (spacingData, idx) => ({
            variableName:
              spacingVariableNames[idx] ||
              generateSpacingVariableName(spacingData, idx),
            value: spacingData.value,
            type: spacingData.type,
            property: spacingData.property,
          })
        );

        window.parent.postMessage(
          {
            pluginMessage: {
              type: "apply-spacing-variables",
              layerId: layers[0].id,
              variableBindings: spacingBindings,
            },
          },
          "*"
        );
      }

      // Apply effects
      if (selectedIssueTypes.has("effect") && layerEffects.length > 0) {
        const effectBindings: EffectVariableBinding[] = layerEffects.map(
          (effectData, idx) => ({
            variableName:
              effectVariableNames[idx] ||
              generateEffectVariableName(effectData, idx),
            radius: effectData.radius,
            type: effectData.type,
            index: effectData.index,
            property: effectData.property,
          })
        );

        window.parent.postMessage(
          {
            pluginMessage: {
              type: "apply-effect-variables",
              layerId: layers[0].id,
              variableBindings: effectBindings,
            },
          },
          "*"
        );
      }
    }
  };

  const canProceedToStep3 =
    selectedIssueTypes.size > 0 &&
    ((selectedIssueTypes.has("color") &&
      ((isBulkMode && uniqueColors.length > 0) ||
        (!isBulkMode && allColors.size > 0))) ||
      selectedIssueTypes.has("text") ||
      (selectedIssueTypes.has("spacing") &&
        ((isBulkMode && uniqueSpacing.length > 0) ||
          (!isBulkMode && allSpacing.size > 0))) ||
      (selectedIssueTypes.has("effect") &&
        ((isBulkMode && uniqueEffects.length > 0) ||
          (!isBulkMode && allEffects.size > 0))));

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
                Loading fixable properties from {loadingLayers.size} layer
                {loadingLayers.size > 1 ? "s" : ""}...
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <h4>Step 3: Review & Apply</h4>

            {/* Colors Section - only show if colors were actually loaded */}
            {selectedIssueTypes.has("color") && (
              <>
                <h5>🎨 Colors</h5>
                {isBulkMode ? (
                  uniqueColors.length === 0 ? (
                    <div className="info-message">
                      No fixable colors found in selected layers
                    </div>
                  ) : (
                    <>
                      <div className="bulk-info">
                        Found {uniqueColors.length} unique color
                        {uniqueColors.length > 1 ? "s" : ""} across{" "}
                        {layers.length} layers
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
                  <div className="info-message">
                    No fixable colors found on this layer
                  </div>
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
              </>
            )}

            {/* Spacing Section */}
            {selectedIssueTypes.has("spacing") && (
              <>
                <h5>📏 Spacing & Radius</h5>
                {isBulkMode ? (
                  uniqueSpacing.length === 0 ? (
                    <div className="info-message">
                      No fixable spacing values found in selected layers
                    </div>
                  ) : (
                    <>
                      <div className="bulk-info">
                        Found {uniqueSpacing.length} unique spacing value
                        {uniqueSpacing.length > 1 ? "s" : ""} across{" "}
                        {layers.length} layers
                      </div>
                      {uniqueSpacing.map((spacingData, idx) => (
                        <div key={idx} className="variable-mapping bulk">
                          <div className="spacing-preview">
                            <span className="spacing-value">
                              {spacingData.spacing.value}px
                            </span>
                            <span className="spacing-type">
                              {spacingData.spacing.type === "paddingHorizontal"
                                ? "padding-x (left & right)"
                                : spacingData.spacing.type === "paddingVertical"
                                ? "padding-y (top & bottom)"
                                : spacingData.spacing.type}
                            </span>
                          </div>
                          <div className="variable-details">
                            <input
                              className="filter-input"
                              value={
                                spacingVariableNames[idx] ||
                                generateSpacingVariableName(
                                  spacingData.spacing,
                                  idx,
                                  spacingData.sources
                                )
                              }
                              onChange={(e) =>
                                setSpacingVariableNames({
                                  ...spacingVariableNames,
                                  [idx]: e.target.value,
                                })
                              }
                            />
                            <div className="spacing-sources">
                              Used in: {spacingData.sources.join(", ")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )
                ) : allSpacing.get(layers[0].id)?.length === 0 ? (
                  <div className="info-message">
                    No fixable spacing values found on this layer
                  </div>
                ) : (
                  allSpacing.get(layers[0].id)?.map((spacingData, idx) => (
                    <div key={idx} className="variable-mapping">
                      <div className="spacing-preview">
                        <span className="spacing-value">
                          {spacingData.value}px
                        </span>
                        <span className="spacing-type">
                          {spacingData.type === "paddingHorizontal"
                            ? "padding-x (left & right)"
                            : spacingData.type === "paddingVertical"
                            ? "padding-y (top & bottom)"
                            : spacingData.type}
                        </span>
                      </div>
                      <input
                        className="filter-input"
                        value={
                          spacingVariableNames[idx] ||
                          generateSpacingVariableName(spacingData, idx)
                        }
                        onChange={(e) =>
                          setSpacingVariableNames({
                            ...spacingVariableNames,
                            [idx]: e.target.value,
                          })
                        }
                      />
                    </div>
                  ))
                )}
              </>
            )}

            {/* Effects Section */}
            {selectedIssueTypes.has("effect") && (
              <>
                <h5>✨ Effects</h5>
                {isBulkMode ? (
                  uniqueEffects.length === 0 ? (
                    <div className="info-message">
                      No fixable effects found in selected layers
                    </div>
                  ) : (
                    <>
                      <div className="bulk-info">
                        Found {uniqueEffects.length} unique effect
                        {uniqueEffects.length > 1 ? "s" : ""} across{" "}
                        {layers.length} layers
                      </div>
                      {uniqueEffects.map((effectData, idx) => (
                        <div key={idx} className="variable-mapping bulk">
                          <div className="effect-preview">
                            <span className="effect-value">
                              {effectData.effect.radius}px
                            </span>
                            <span className="effect-type">
                              {effectData.effect.type.replace("_", " ")}
                            </span>
                          </div>
                          <div className="variable-details">
                            <input
                              className="filter-input"
                              value={
                                effectVariableNames[idx] ||
                                generateEffectVariableName(
                                  effectData.effect,
                                  idx,
                                  effectData.sources
                                )
                              }
                              onChange={(e) =>
                                setEffectVariableNames({
                                  ...effectVariableNames,
                                  [idx]: e.target.value,
                                })
                              }
                            />
                            <div className="effect-sources">
                              Used in: {effectData.sources.join(", ")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )
                ) : allEffects.get(layers[0].id)?.length === 0 ? (
                  <div className="info-message">
                    No fixable effects found on this layer
                  </div>
                ) : (
                  allEffects.get(layers[0].id)?.map((effectData, idx) => (
                    <div key={idx} className="variable-mapping">
                      <div className="effect-preview">
                        <span className="effect-value">
                          {effectData.radius}px
                        </span>
                        <span className="effect-type">
                          {effectData.type.replace("_", " ")}
                        </span>
                      </div>
                      <input
                        className="filter-input"
                        value={
                          effectVariableNames[idx] ||
                          generateEffectVariableName(effectData, idx)
                        }
                        onChange={(e) =>
                          setEffectVariableNames({
                            ...effectVariableNames,
                            [idx]: e.target.value,
                          })
                        }
                      />
                    </div>
                  ))
                )}
              </>
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
