// Design System Coverage Plugin
// Analyzes frames for component, token, and style coverage

import { postMessageToUI } from "./messaging";
import {
  applyEffectStyleForNode,
  assignEffectStyleId,
  createEffectStackKey,
  EffectStyleCapableNode,
  ensureEffectStyleForEffects,
  nodeSupportsEffectStyles,
  serializeEffectSnapshot,
} from "./utils/effects";

/// <reference types="@figma/plugin-typings" />

interface CoverageAnalysis {
  summary: CoverageSummary;
  details: CoverageDetails;
  settings: AnalysisSettings;
}

interface CoverageSummary {
  overallScore: number;
  componentCoverage: number;
  tokenCoverage: number;
  styleCoverage: number;
  totalLayers: number;
  compliantLayers: number;
  analyzedFrameName: string;
}

interface CoverageDetails {
  byType: TypeBreakdown;
  nonCompliantLayers: NonCompliantLayer[];
}

interface TypeBreakdown {
  [key: string]: {
    total: number;
    compliant: number;
    percentage: number;
  };
}

interface NonCompliantLayer {
  id: string;
  name: string;
  type: string;
  issues: string[];
  path: string;
}

interface AnalysisSettings {
  checkComponents: boolean;
  checkTokens: boolean;
  checkStyles: boolean;
  allowLocalStyles: boolean;
  ignoredTypes: string[];
}

// Default settings
const defaultSettings: AnalysisSettings = {
  checkComponents: true,
  checkTokens: true,
  checkStyles: true,
  allowLocalStyles: false,
  ignoredTypes: [],
};

let currentSettings: AnalysisSettings = { ...defaultSettings };

figma.showUI(__html__, { width: 480, height: 720 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "analyze-selection") {
    await analyzeSelection();
  } else if (msg.type === "update-settings") {
    currentSettings = { ...currentSettings, ...msg.settings };
    postMessageToUI({
      type: "settings-updated",
      settings: currentSettings,
    });
  } else if (msg.type === "get-settings") {
    postMessageToUI({
      type: "settings-updated",
      settings: currentSettings,
    });
  } else if (msg.type === "select-layer") {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node && "id" in node) {
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
    }
  } else if (msg.type === "get-layer-colors") {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node && "fills" in node) {
      const colors = extractColorsFromLayer(node as SceneNode);
      postMessageToUI({
        type: "layer-colors",
        colors,
        layerId: msg.layerId,
      });
    }
  } else if (msg.type === "get-layer-spacing") {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node) {
      const spacing = extractSpacingFromLayer(node as SceneNode);
      postMessageToUI({
        type: "layer-spacing",
        spacing,
        layerId: msg.layerId,
      });
    }
  } else if (msg.type === "get-layer-effects") {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node) {
      const effects = extractEffectsFromLayer(node as SceneNode);
      postMessageToUI({
        type: "layer-effects",
        effects,
        layerId: msg.layerId,
      });
    }
  } else if (msg.type === "apply-color-variables") {
    await applyColorVariables(msg.layerId, msg.variableBindings);
  } else if (msg.type === "apply-bulk-color-variables") {
    await applyBulkColorVariables(msg.layerIds, msg.colorToVariableMap);
  } else if (msg.type === "apply-spacing-variables") {
    await applySpacingVariables(msg.layerId, msg.variableBindings);
  } else if (msg.type === "apply-bulk-spacing-variables") {
    await applyBulkSpacingVariables(msg.layerIds, msg.spacingToVariableMap);
  } else if (msg.type === "apply-effect-styles") {
    await applyEffectStyles(msg.layerId, msg.styleBindings);
  } else if (msg.type === "apply-bulk-effect-styles") {
    await applyBulkEffectStyles(msg.layerIds, msg.effectAssignments);
  } else if (msg.type === "export-debug-data") {
    exportDebugData();
  } else if (msg.type === "close") {
    figma.closePlugin();
  }
};

async function analyzeSelection() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    postMessageToUI({
      type: "error",
      message: "Please select a frame to analyze",
    });
    return;
  }

  if (selection.length > 1) {
    postMessageToUI({
      type: "error",
      message: "Please select only one frame",
    });
    return;
  }

  const selectedNode = selection[0];

  if (
    selectedNode.type !== "FRAME" &&
    selectedNode.type !== "COMPONENT" &&
    selectedNode.type !== "INSTANCE"
  ) {
    postMessageToUI({
      type: "error",
      message: "Please select a frame, component, or instance",
    });
    return;
  }

  postMessageToUI({ type: "analysis-started" });

  try {
    const analysis = await analyzeNode(selectedNode);
    postMessageToUI({
      type: "analysis-complete",
      data: analysis,
    });
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Analysis failed: ${error}`,
    });
  }
}

async function analyzeNode(node: SceneNode): Promise<CoverageAnalysis> {
  const stats = {
    totalLayers: 0,
    compliantLayers: 0,
    byType: {} as TypeBreakdown,
    nonCompliantLayers: [] as NonCompliantLayer[],
  };

  const frameName = node.name;

  // Recursively analyze all nodes
  await traverseNode(node, stats, [frameName]);

  // Calculate coverage percentages
  const summary: CoverageSummary = {
    overallScore:
      stats.totalLayers > 0
        ? Math.round((stats.compliantLayers / stats.totalLayers) * 100)
        : 0,
    componentCoverage: calculateComponentCoverage(stats),
    tokenCoverage: calculateTokenCoverage(stats),
    styleCoverage: calculateStyleCoverage(stats),
    totalLayers: stats.totalLayers,
    compliantLayers: stats.compliantLayers,
    analyzedFrameName: frameName,
  };

  const details: CoverageDetails = {
    byType: stats.byType,
    nonCompliantLayers: stats.nonCompliantLayers,
  };

  return {
    summary,
    details,
    settings: currentSettings,
  };
}

async function traverseNode(
  node: SceneNode | PageNode,
  stats: any,
  path: string[]
): Promise<void> {
  // Skip certain node types if configured
  if ("type" in node && currentSettings.ignoredTypes.includes(node.type)) {
    return;
  }

  // Analyze current node if it's a scene node
  if ("type" in node && node.type !== "PAGE") {
    await analyzeLayer(node as SceneNode, stats, path);
  }

  // Traverse children
  if ("children" in node) {
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childPath = [...path, child.name];

      // Send progress update every 10 nodes
      if (stats.totalLayers % 10 === 0) {
        postMessageToUI({
          type: "analysis-progress",
          progress: stats.totalLayers,
        });
      }

      await traverseNode(child, stats, childPath);
    }
  }
}

function extractRawProperties(node: SceneNode): any {
  const props: any = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    locked: node.locked,
  };

  // Extract fills
  if ("fills" in node && node.fills !== figma.mixed) {
    props.fills = Array.isArray(node.fills)
      ? node.fills.map((fill: Paint) => ({
          type: fill.type,
          visible: fill.visible,
          opacity: fill.opacity,
          color: fill.type === "SOLID" ? fill.color : undefined,
          boundVariables: (fill as any).boundVariables,
        }))
      : [];
  }

  // Extract strokes
  if ("strokes" in node && Array.isArray(node.strokes)) {
    props.strokes = node.strokes.map((stroke: Paint) => ({
      type: stroke.type,
      visible: stroke.visible,
      opacity: stroke.opacity,
      color: stroke.type === "SOLID" ? stroke.color : undefined,
      boundVariables: (stroke as any).boundVariables,
    }));
  }

  // Extract text properties
  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    props.fontSize = textNode.fontSize;
    props.fontName = textNode.fontName;
    props.textStyleId = textNode.textStyleId;
    props.characters = textNode.characters.substring(0, 100); // First 100 chars
  }

  // Extract layout properties
  if ("layoutMode" in node) {
    props.layoutMode = (node as FrameNode).layoutMode;
    props.paddingLeft = (node as FrameNode).paddingLeft;
    props.paddingRight = (node as FrameNode).paddingRight;
    props.paddingTop = (node as FrameNode).paddingTop;
    props.paddingBottom = (node as FrameNode).paddingBottom;
  }

  // Extract corner radius
  if ("cornerRadius" in node) {
    props.cornerRadius = (node as any).cornerRadius;
  }

  // Extract effects
  if ("effects" in node && node.effects) {
    props.effects = node.effects.map((effect: Effect) => ({
      type: effect.type,
      visible: effect.visible,
      radius: "radius" in effect ? effect.radius : undefined,
      boundVariables:
        "boundVariables" in effect ? effect.boundVariables : undefined,
    }));
  }

  // Extract style IDs
  if ("fillStyleId" in node) props.fillStyleId = (node as any).fillStyleId;
  if ("strokeStyleId" in node)
    props.strokeStyleId = (node as any).strokeStyleId;
  if ("effectStyleId" in node)
    props.effectStyleId = (node as any).effectStyleId;
  if ("textStyleId" in node) props.textStyleId = (node as any).textStyleId;

  // Extract bound variables
  if ("boundVariables" in node && node.boundVariables) {
    props.boundVariables = node.boundVariables;
  }

  return props;
}

async function analyzeLayer(
  node: SceneNode,
  stats: any,
  path: string[]
): Promise<void> {
  stats.totalLayers++;

  const nodeType = node.type;
  if (!stats.byType[nodeType]) {
    stats.byType[nodeType] = { total: 0, compliant: 0, percentage: 0 };
  }
  stats.byType[nodeType].total++;

  const issues: string[] = [];
  let isCompliant = true;
  const analysisDetails: any = {
    componentCheck: null,
    tokenChecks: [],
    styleChecks: [],
  };

  // Check 1: Component Coverage (Story 2)
  if (currentSettings.checkComponents) {
    const componentIssue = await checkComponentUsage(node);
    analysisDetails.componentCheck = {
      enabled: true,
      issue: componentIssue,
      passed: !componentIssue,
    };
    if (componentIssue) {
      issues.push(componentIssue);
      isCompliant = false;
    }
  }

  // Check 2: Token Coverage (Story 3)
  if (currentSettings.checkTokens) {
    const tokenIssues = checkTokenUsage(node);
    analysisDetails.tokenChecks = tokenIssues.map((issue) => ({
      issue,
      category: "token",
    }));
    if (tokenIssues.length > 0) {
      issues.push(...tokenIssues);
      isCompliant = false;
    }
  }

  // Check 3: Style Coverage (Story 4)
  if (currentSettings.checkStyles) {
    const styleIssues = checkStyleUsage(node);
    analysisDetails.styleChecks = styleIssues.map((issue) => ({
      issue,
      type: issue.includes("🔴")
        ? "critical"
        : issue.includes("⚠️")
        ? "warning"
        : "success",
    }));
    if (styleIssues.length > 0) {
      // Only mark as non-compliant if there are actual issues (🔴 or ⚠️)
      const hasActualIssues = styleIssues.some(
        (issue) => issue.includes("🔴") || issue.includes("⚠️")
      );

      issues.push(...styleIssues);

      if (hasActualIssues) {
        isCompliant = false;
      }
    }
  }

  if (isCompliant) {
    stats.compliantLayers++;
    stats.byType[nodeType].compliant++;
  } else {
    // Extract raw properties for detailed inspection
    const rawProperties = extractRawProperties(node);

    stats.nonCompliantLayers.push({
      id: node.id,
      name: node.name,
      type: nodeType,
      issues,
      path: path.join(" > "),
      rawProperties,
      analysis: analysisDetails,
    });
  }

  // Update percentage for this type
  stats.byType[nodeType].percentage = Math.round(
    (stats.byType[nodeType].compliant / stats.byType[nodeType].total) * 100
  );
}

async function checkComponentUsage(node: SceneNode): Promise<string | null> {
  // Check if node is an instance of a library component
  if (node.type === "INSTANCE") {
    const mainComponent = await (node as InstanceNode).getMainComponentAsync();
    if (mainComponent && mainComponent.remote) {
      // It's a library component - compliant
      return null;
    } else if (mainComponent) {
      // It's a local component
      return "Uses local component instead of library component";
    }
  }

  // For non-instance nodes that could be instances (frames, rectangles, etc.)
  if (
    node.type === "FRAME" ||
    node.type === "RECTANGLE" ||
    node.type === "ELLIPSE" ||
    node.type === "POLYGON" ||
    node.type === "STAR" ||
    node.type === "VECTOR" ||
    node.type === "TEXT" ||
    node.type === "GROUP"
  ) {
    // These should ideally be instances if they represent reusable UI elements
    // This is a soft warning - you might want to make this configurable
    if (
      node.name.toLowerCase().includes("button") ||
      node.name.toLowerCase().includes("input") ||
      node.name.toLowerCase().includes("card") ||
      node.name.toLowerCase().includes("icon")
    ) {
      return "Potentially reusable element not using library component";
    }
  }

  return null;
}

function checkTokenUsage(node: SceneNode): string[] {
  const issues: string[] = [];

  // Check fills for color tokens
  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = node.fills as ReadonlyArray<Paint>;
    for (const fill of fills) {
      if (fill.type === "SOLID" && !(fill as SolidPaint).boundVariables) {
        // Check if it's using a style instead
        if ("fillStyleId" in node && !node.fillStyleId) {
          issues.push("Uses local fill instead of color token or style");
        }
      }
    }
  }

  // Check strokes for color tokens
  if ("strokes" in node) {
    const strokes = node.strokes;
    if (Array.isArray(strokes) && strokes.length > 0) {
      if ("strokeStyleId" in node && !node.strokeStyleId) {
        const hasTokenBinding = strokes.some(
          (stroke: Paint) => (stroke as SolidPaint).boundVariables
        );
        if (!hasTokenBinding) {
          issues.push("Uses local stroke instead of color token or style");
        }
      }
    }
  }

  // Check text properties for typography tokens
  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    if (!textNode.textStyleId) {
      issues.push("Uses local text style instead of typography token");
    }
  }

  // Check spacing/layout tokens (check auto-layout properties)
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    // This is an auto-layout frame
    // Check if spacing uses variables
    if ("itemSpacing" in node && typeof node.itemSpacing === "number") {
      // Ideally this should be bound to a spacing token
      // Note: Variable bindings for spacing are in boundVariables
      const hasSpacingToken =
        node.boundVariables && "itemSpacing" in node.boundVariables;
      if (!hasSpacingToken && node.itemSpacing > 0) {
        issues.push("Auto-layout spacing not using spacing token");
      }
    }
  }

  return issues;
}

function checkStyleUsage(node: SceneNode): string[] {
  const issues: string[] = [];

  // Check fill styles with detailed analysis
  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = node.fills as ReadonlyArray<Paint>;
    if (fills.length > 0) {
      const localFills = fills.filter(
        (fill) => fill.type === "SOLID" && !fill.boundVariables?.color
      );
      const variableBoundFills = fills.filter(
        (fill) => fill.type === "SOLID" && fill.boundVariables?.color
      );
      const nonSolidFills = fills.filter((fill) => fill.type !== "SOLID");
      const sharedStyleFills = node.fillStyleId ? 1 : 0;

      if (localFills.length > 0) {
        issues.push(
          `🔴 Uses ${localFills.length} local fill color${
            localFills.length > 1 ? "s" : ""
          } instead of design token${localFills.length > 1 ? "s" : ""}`
        );
      }

      if (variableBoundFills.length > 0) {
        issues.push(
          `✅ ${variableBoundFills.length} fill${
            variableBoundFills.length > 1 ? "s" : ""
          } properly bound to variable${
            variableBoundFills.length > 1 ? "s" : ""
          }`
        );
      }

      if (sharedStyleFills > 0) {
        issues.push(`✅ Uses shared fill style`);
      }

      if (nonSolidFills.length > 0) {
        issues.push(
          `⚠️ ${nonSolidFills.length} non-solid fill${
            nonSolidFills.length > 1 ? "s" : ""
          } (gradient/image) - needs manual review`
        );
      }
    }
  }

  // Check stroke styles with detailed analysis
  if ("strokes" in node && Array.isArray(node.strokes)) {
    const strokes = node.strokes;
    if (strokes.length > 0) {
      const localStrokes = strokes.filter(
        (stroke) => stroke.type === "SOLID" && !stroke.boundVariables?.color
      );
      const variableBoundStrokes = strokes.filter(
        (stroke) => stroke.type === "SOLID" && stroke.boundVariables?.color
      );
      const nonSolidStrokes = strokes.filter(
        (stroke) => stroke.type !== "SOLID"
      );
      const sharedStyleStrokes = node.strokeStyleId ? 1 : 0;

      if (localStrokes.length > 0) {
        issues.push(
          `🔴 Uses ${localStrokes.length} local stroke color${
            localStrokes.length > 1 ? "s" : ""
          } instead of design token${localStrokes.length > 1 ? "s" : ""}`
        );
      }

      if (variableBoundStrokes.length > 0) {
        issues.push(
          `✅ ${variableBoundStrokes.length} stroke${
            variableBoundStrokes.length > 1 ? "s" : ""
          } properly bound to variable${
            variableBoundStrokes.length > 1 ? "s" : ""
          }`
        );
      }

      if (sharedStyleStrokes > 0) {
        issues.push(`✅ Uses shared stroke style`);
      }

      if (nonSolidStrokes.length > 0) {
        issues.push(
          `⚠️ ${nonSolidStrokes.length} non-solid stroke${
            nonSolidStrokes.length > 1 ? "s" : ""
          } (gradient/image) - needs manual review`
        );
      }
    }
  }

  // Check text styles with detailed analysis
  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    if (!textNode.textStyleId) {
      const fontFamily =
        typeof textNode.fontName === "object"
          ? textNode.fontName.family
          : "Unknown";
      const fontSize =
        typeof textNode.fontSize === "number" ? textNode.fontSize : "Unknown";
      issues.push(
        `🔴 Uses local text style (${fontFamily}, ${fontSize}px) instead of shared text style`
      );
    } else {
      issues.push(`✅ Uses shared text style`);
    }
  }

  // Check effect styles with detailed analysis
  if ("effects" in node && node.effects && node.effects.length > 0) {
    const effects = node.effects;
    const supportsEffectStyles = "effectStyleId" in node;
    const usingEffectStyle =
      supportsEffectStyles && (node as any).effectStyleId
        ? true
        : false;

    const hasVariableBoundEffects = effects.some(
      (effect) =>
        (effect as any).boundVariables &&
        Object.keys((effect as any).boundVariables).length > 0
    );

    const hasLocalEffects =
      !usingEffectStyle &&
      effects.some(
        (effect) =>
          !(effect as any).boundVariables ||
          Object.keys((effect as any).boundVariables).length === 0
      );

    if (hasLocalEffects) {
      issues.push(`🔴 Uses local effects instead of design tokens or styles`);
    }

    if (hasVariableBoundEffects) {
      issues.push(`✅ Effects properly bound to variables`);
    }

    if (usingEffectStyle) {
      issues.push(`✅ Uses shared effect style`);
    }
  }

  // Check corner radius
  if (
    "cornerRadius" in node &&
    typeof node.cornerRadius === "number" &&
    node.cornerRadius > 0
  ) {
    // Check if any corner radius properties are bound to variables
    const cornerRadiusProperties = [
      "cornerRadius",
      "topLeftRadius",
      "topRightRadius",
      "bottomLeftRadius",
      "bottomRightRadius",
    ];

    const hasBoundCornerRadius =
      node.boundVariables &&
      cornerRadiusProperties.some((prop) => prop in node.boundVariables!);

    if (!hasBoundCornerRadius) {
      issues.push(
        `🔴 Uses local corner radius (${node.cornerRadius}px) instead of spacing token`
      );
    } else {
      issues.push(`✅ Corner radius bound to variable`);
    }
  }

  // Check padding/margin (for auto-layout)
  if ("paddingLeft" in node) {
    const paddingProps = [
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      "paddingBottom",
    ];
    const localPaddingProps = paddingProps.filter((prop) => {
      const value = (node as any)[prop];
      const hasBoundVariable =
        node.boundVariables && prop in node.boundVariables;
      return value !== 0 && !hasBoundVariable;
    });

    if (localPaddingProps.length > 0) {
      issues.push(`🔴 Uses local padding values instead of spacing tokens`);
    } else if (
      node.boundVariables &&
      paddingProps.some((prop) => prop in node.boundVariables!)
    ) {
      issues.push(`✅ Padding bound to variables`);
    }
  }

  // Skip if local styles are allowed and no issues found
  if (currentSettings.allowLocalStyles && issues.length === 0) {
    return issues;
  }

  return issues;
}

function calculateComponentCoverage(stats: any): number {
  let totalInstanceLayers = 0;
  let compliantInstanceLayers = 0;

  if (stats.byType["INSTANCE"]) {
    totalInstanceLayers = stats.byType["INSTANCE"].total;
    compliantInstanceLayers = stats.byType["INSTANCE"].compliant;
  }

  // Also count frames that could be components
  const potentialComponentTypes = ["FRAME", "RECTANGLE", "TEXT"];
  potentialComponentTypes.forEach((type) => {
    if (stats.byType[type]) {
      totalInstanceLayers += stats.byType[type].total;
      compliantInstanceLayers += stats.byType[type].compliant;
    }
  });

  return totalInstanceLayers > 0
    ? Math.round((compliantInstanceLayers / totalInstanceLayers) * 100)
    : 100;
}

function calculateTokenCoverage(stats: any): number {
  // Calculate based on layers that should use tokens
  const tokenRelevantTypes = [
    "TEXT",
    "RECTANGLE",
    "ELLIPSE",
    "FRAME",
    "POLYGON",
    "STAR",
    "VECTOR",
  ];
  let total = 0;
  let compliant = 0;

  tokenRelevantTypes.forEach((type) => {
    if (stats.byType[type]) {
      total += stats.byType[type].total;
      compliant += stats.byType[type].compliant;
    }
  });

  return total > 0 ? Math.round((compliant / total) * 100) : 100;
}

function calculateStyleCoverage(stats: any): number {
  // Similar to token coverage but focusing on style usage
  return calculateTokenCoverage(stats);
}

// Color Variable Fix Functions

interface ColorData {
  type: "fill" | "stroke";
  color: RGB;
  index: number;
}

function extractColorsFromLayer(node: SceneNode): ColorData[] {
  const colors: ColorData[] = [];

  if ("fills" in node && node.fills !== figma.mixed) {
    const fills = node.fills;
    if (Array.isArray(fills)) {
      fills.forEach((fill, index) => {
        if (fill.type === "SOLID") {
          colors.push({ type: "fill", color: fill.color, index });
        }
      });
    }
  }

  if ("strokes" in node) {
    const strokes = node.strokes;
    if (Array.isArray(strokes)) {
      strokes.forEach((stroke, index) => {
        if (stroke.type === "SOLID") {
          colors.push({ type: "stroke", color: stroke.color, index });
        }
      });
    }
  }

  return colors;
}

async function applyColorVariables(
  layerId: string,
  variableBindings: any[]
): Promise<void> {
  const node = await figma.getNodeByIdAsync(layerId);
  if (!node || !("fills" in node)) {
    postMessageToUI({
      type: "error",
      message: "Cannot apply variables to this layer",
    });
    return;
  }

  try {
    // Get or create variable collection
    const collections =
      await figma.variables.getLocalVariableCollectionsAsync();
    const collection =
      collections.length > 0
        ? collections[0]
        : figma.variables.createVariableCollection("Design System");

    const modeId = collection.modes[0].modeId;

    for (const binding of variableBindings) {
      // Check if variable already exists
      const allVariables = await figma.variables.getLocalVariablesAsync();
      const existingVariables = allVariables.filter(
        (v) => v.name === binding.variableName
      );

      let variable: Variable;

      if (existingVariables.length > 0) {
        variable = existingVariables[0];
      } else {
        // Create new variable
        variable = figma.variables.createVariable(
          binding.variableName,
          collection,
          "COLOR"
        );

        // Set color value
        variable.setValueForMode(modeId, binding.color);
      }

      // Bind to layer using the correct approach
      if (binding.type === "fill" && "fills" in node) {
        const fills = node.fills;
        if (Array.isArray(fills) && fills[binding.index]) {
          const updatedFills = [...fills];
          updatedFills[binding.index] =
            figma.variables.setBoundVariableForPaint(
              fills[binding.index],
              "color",
              variable
            );
          (node as any).fills = updatedFills;
        }
      } else if (binding.type === "stroke" && "strokes" in node) {
        const strokes = node.strokes;
        if (Array.isArray(strokes) && strokes[binding.index]) {
          const updatedStrokes = [...strokes];
          updatedStrokes[binding.index] =
            figma.variables.setBoundVariableForPaint(
              strokes[binding.index],
              "color",
              variable
            );
          (node as any).strokes = updatedStrokes;
        }
      }
    }

    postMessageToUI({ type: "fix-applied", layerId });
    figma.notify("✅ Color variables applied successfully!");
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Failed to apply variables: ${error}`,
    });
  }
}

async function applyBulkColorVariables(
  layerIds: string[],
  colorToVariableMap: Record<string, string>
): Promise<void> {
  try {
    // Get or create variable collection
    const collections =
      await figma.variables.getLocalVariableCollectionsAsync();
    const collection =
      collections.length > 0
        ? collections[0]
        : figma.variables.createVariableCollection("Design System");

    const modeId = collection.modes[0].modeId;

    // Create all variables first
    const variableCache = new Map<string, Variable>();
    const existingVariables = await figma.variables.getLocalVariablesAsync();

    for (const [colorKey, variableName] of Object.entries(colorToVariableMap)) {
      // Parse color from key
      const [r, g, b] = colorKey.split("-").map(Number);
      const color: RGB = { r, g, b };

      // Check if variable exists
      const existing = existingVariables.find((v) => v.name === variableName);

      let variable: Variable;
      if (existing) {
        variable = existing;
      } else {
        variable = figma.variables.createVariable(
          variableName,
          collection,
          "COLOR"
        );
        variable.setValueForMode(modeId, color);
      }

      variableCache.set(colorKey, variable);
    }

    // Apply variables to all layers
    for (const layerId of layerIds) {
      const node = await figma.getNodeByIdAsync(layerId);
      if (!node || !("fills" in node)) continue;

      // Update fills
      if ("fills" in node && Array.isArray(node.fills)) {
        const fills = node.fills;
        const updatedFills = fills.map((fill) => {
          if (fill.type === "SOLID") {
            const key = `${fill.color.r}-${fill.color.g}-${fill.color.b}`;
            const variable = variableCache.get(key);
            if (variable) {
              return figma.variables.setBoundVariableForPaint(
                fill,
                "color",
                variable
              );
            }
          }
          return fill;
        });
        (node as any).fills = updatedFills;
      }

      // Update strokes
      if ("strokes" in node && Array.isArray(node.strokes)) {
        const strokes = node.strokes;
        const updatedStrokes = strokes.map((stroke) => {
          if (stroke.type === "SOLID") {
            const key = `${stroke.color.r}-${stroke.color.g}-${stroke.color.b}`;
            const variable = variableCache.get(key);
            if (variable) {
              return figma.variables.setBoundVariableForPaint(
                stroke,
                "color",
                variable
              );
            }
          }
          return stroke;
        });
        (node as any).strokes = updatedStrokes;
      }
    }

    postMessageToUI({ type: "fix-applied", layerId: "bulk" });
    figma.notify(`✅ Color variables applied to ${layerIds.length} layers!`);
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Failed to apply bulk variables: ${error}`,
    });
  }
}

async function exportDebugData() {
  try {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      postMessageToUI({
        type: "error",
        message: "Please select frames to analyze first",
      });
      return;
    }

    // Get Figma environment data using async APIs
    const [
      localVariables,
      localVariableCollections,
      localTextStyles,
      localPaintStyles,
      localEffectStyles,
    ] = await Promise.all([
      figma.variables.getLocalVariablesAsync(),
      figma.variables.getLocalVariableCollectionsAsync(),
      figma.getLocalTextStylesAsync(),
      figma.getLocalPaintStylesAsync(),
      figma.getLocalEffectStylesAsync(),
    ]);

    const debugData = {
      timestamp: new Date().toISOString(),
      pluginVersion: "1.0.0",
      currentSettings,
      selection: selection.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        visible: node.visible,
        locked: node.locked,
        parent: node.parent
          ? { id: node.parent.id, name: node.parent.name }
          : null,
      })),
      analysisResults: [] as any[],
      figmaEnvironment: {
        pageName: figma.currentPage.name,
        documentName: figma.root.name,
        localVariables: localVariables.length,
        localVariableCollections: localVariableCollections.length,
        localStyles:
          localTextStyles.length +
          localPaintStyles.length +
          localEffectStyles.length,
        localComponents: 0, // figma.getLocalComponents() not available in current API
      },
    };

    // Analyze each selected frame
    const analysisPromises = selection.map(async (node) => {
      if (
        node.type === "FRAME" ||
        node.type === "COMPONENT" ||
        node.type === "INSTANCE"
      ) {
        return await analyzeFrameForDebug(
          node as FrameNode | ComponentNode | InstanceNode
        );
      }
      return null;
    });

    const analysisResults = await Promise.all(analysisPromises);
    debugData.analysisResults = analysisResults.filter(
      (result) => result !== null
    );

    // Send debug data to UI
    postMessageToUI({
      type: "debug-data-exported",
      debugData,
    });

    figma.notify("✅ Debug data exported to UI");
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Failed to export debug data: ${error}`,
    });
  }
}

async function analyzeFrameForDebug(
  node: FrameNode | ComponentNode | InstanceNode
) {
  const frameData = {
    frameId: node.id,
    frameName: node.name,
    frameType: node.type,
    frameProperties: {
      width: node.width,
      height: node.height,
      fills: node.fills,
      strokes: node.strokes,
      effects: node.effects,
      cornerRadius: node.cornerRadius,
      fillStyleId: node.fillStyleId,
      strokeStyleId: node.strokeStyleId,
      effectStyleId: node.effectStyleId,
      boundVariables: node.boundVariables,
      layoutMode: "layoutMode" in node ? node.layoutMode : null,
      paddingLeft: "paddingLeft" in node ? node.paddingLeft : null,
      paddingRight: "paddingRight" in node ? node.paddingRight : null,
      paddingTop: "paddingTop" in node ? node.paddingTop : null,
      paddingBottom: "paddingBottom" in node ? node.paddingBottom : null,
      itemSpacing: "itemSpacing" in node ? node.itemSpacing : null,
    },
    layers: [] as any[],
    summary: {
      totalLayers: 0,
      compliantLayers: 0,
      nonCompliantLayers: 0,
      issuesByType: {} as any,
      issuesByCategory: {
        component: 0,
        token: 0,
        style: 0,
      },
    },
  };

  // Traverse and analyze all layers
  const stats = {
    totalLayers: 0,
    compliantLayers: 0,
    nonCompliantLayers: 0,
    byType: {} as any,
  };

  await traverseNodeForDebug(node, stats, [node.name], frameData.layers);

  frameData.summary.totalLayers = stats.totalLayers;
  frameData.summary.compliantLayers = stats.compliantLayers;
  frameData.summary.nonCompliantLayers = stats.nonCompliantLayers;

  return frameData;
}

async function traverseNodeForDebug(
  node: BaseNode,
  stats: any,
  path: string[],
  layersArray: any[]
) {
  stats.totalLayers++;

  if ("type" in node && node.type !== "PAGE") {
    const layerDebugData = await analyzeLayerForDebug(node as SceneNode, path);
    layersArray.push(layerDebugData);

    if (layerDebugData.isCompliant) {
      stats.compliantLayers++;
    } else {
      stats.nonCompliantLayers++;
    }
  }

  // Traverse children
  if ("children" in node) {
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childPath = [...path, child.name];
      await traverseNodeForDebug(child, stats, childPath, layersArray);
    }
  }
}

async function analyzeLayerForDebug(node: SceneNode, path: string[]) {
  const layerData = {
    id: node.id,
    name: node.name,
    type: node.type,
    path: path.join(" > "),
    isCompliant: true,
    issues: [] as string[],
    rawProperties: {
      fills: "fills" in node ? node.fills : null,
      strokes: "strokes" in node ? node.strokes : null,
      effects: "effects" in node ? node.effects : null,
      cornerRadius: "cornerRadius" in node ? node.cornerRadius : null,
      fillStyleId: "fillStyleId" in node ? node.fillStyleId : null,
      strokeStyleId: "strokeStyleId" in node ? node.strokeStyleId : null,
      effectStyleId: "effectStyleId" in node ? node.effectStyleId : null,
      textStyleId: "textStyleId" in node ? node.textStyleId : null,
      fontName: "fontName" in node ? node.fontName : null,
      fontSize: "fontSize" in node ? node.fontSize : null,
      boundVariables: node.boundVariables,
      layoutMode: "layoutMode" in node ? node.layoutMode : null,
      paddingLeft: "paddingLeft" in node ? node.paddingLeft : null,
      paddingRight: "paddingRight" in node ? node.paddingRight : null,
      paddingTop: "paddingTop" in node ? node.paddingTop : null,
      paddingBottom: "paddingBottom" in node ? node.paddingBottom : null,
      itemSpacing: "itemSpacing" in node ? node.itemSpacing : null,
    },
    analysis: {
      componentCheck: null as string | null,
      tokenCheck: [] as string[],
      styleCheck: [] as string[],
    },
  };

  // Check 1: Component Coverage
  if (currentSettings.checkComponents) {
    layerData.analysis.componentCheck = await checkComponentUsage(node);
    if (layerData.analysis.componentCheck) {
      layerData.issues.push(layerData.analysis.componentCheck);
      layerData.isCompliant = false;
    }
  }

  // Check 2: Token Coverage
  if (currentSettings.checkTokens) {
    layerData.analysis.tokenCheck = checkTokenUsage(node);
    if (layerData.analysis.tokenCheck.length > 0) {
      layerData.issues.push(...layerData.analysis.tokenCheck);
      layerData.isCompliant = false;
    }
  }

  // Check 3: Style Coverage
  if (currentSettings.checkStyles) {
    layerData.analysis.styleCheck = checkStyleUsage(node);
    if (layerData.analysis.styleCheck.length > 0) {
      // Only mark as non-compliant if there are actual issues (🔴 or ⚠️)
      const hasActualIssues = layerData.analysis.styleCheck.some(
        (issue) => issue.includes("🔴") || issue.includes("⚠️")
      );

      layerData.issues.push(...layerData.analysis.styleCheck);

      if (hasActualIssues) {
        layerData.isCompliant = false;
      }
    }
  }

  return layerData;
}

// Spacing extraction and application functions
function extractSpacingFromLayer(node: SceneNode): any[] {
  const spacing: any[] = [];

  // Extract corner radius
  if ("cornerRadius" in node && (node as any).cornerRadius !== undefined) {
    spacing.push({
      type: "cornerRadius",
      value: (node as any).cornerRadius,
      property: "cornerRadius",
    });
  }

  // Extract padding and gap values (only for Auto Layout frames)
  if (node.type === "FRAME" && "layoutMode" in node) {
    const frameNode = node as FrameNode;
    if (frameNode.layoutMode !== "NONE") {
      // Extract padding for Auto Layout frames with smart grouping
      const paddingLeft = frameNode.paddingLeft;
      const paddingRight = frameNode.paddingRight;
      const paddingTop = frameNode.paddingTop;
      const paddingBottom = frameNode.paddingBottom;

      // Check for horizontal padding (left = right)
      if (
        paddingLeft !== undefined &&
        paddingRight !== undefined &&
        paddingLeft === paddingRight
      ) {
        spacing.push({
          type: "paddingHorizontal",
          value: paddingLeft,
          property: "paddingHorizontal",
          properties: ["paddingLeft", "paddingRight"], // Track which properties this applies to
        });
      } else {
        // Individual left/right padding
        if (paddingLeft !== undefined) {
          spacing.push({
            type: "paddingLeft",
            value: paddingLeft,
            property: "paddingLeft",
          });
        }
        if (paddingRight !== undefined) {
          spacing.push({
            type: "paddingRight",
            value: paddingRight,
            property: "paddingRight",
          });
        }
      }

      // Check for vertical padding (top = bottom)
      if (
        paddingTop !== undefined &&
        paddingBottom !== undefined &&
        paddingTop === paddingBottom
      ) {
        spacing.push({
          type: "paddingVertical",
          value: paddingTop,
          property: "paddingVertical",
          properties: ["paddingTop", "paddingBottom"], // Track which properties this applies to
        });
      } else {
        // Individual top/bottom padding
        if (paddingTop !== undefined) {
          spacing.push({
            type: "paddingTop",
            value: paddingTop,
            property: "paddingTop",
          });
        }
        if (paddingBottom !== undefined) {
          spacing.push({
            type: "paddingBottom",
            value: paddingBottom,
            property: "paddingBottom",
          });
        }
      }

      // Extract item spacing (gap) for Auto Layout frames
      if (frameNode.itemSpacing !== undefined) {
        spacing.push({
          type: "itemSpacing",
          value: frameNode.itemSpacing,
          property: "itemSpacing",
        });
      }
    }
  }

  return spacing;
}

function extractEffectsFromLayer(node: SceneNode): any[] {
  const effectCandidates: any[] = [];

  if (
    "effects" in node &&
    node.effects &&
    Array.isArray(node.effects) &&
    node.effects.length > 0
  ) {
    if (!nodeSupportsEffectStyles(node)) {
      return effectCandidates;
    }

    const effectNode = node as EffectStyleCapableNode;

    if (effectNode.effectStyleId) {
      return effectCandidates;
    }

    const hasBoundVariables = effectNode.effects.some(
      (effect: Effect) =>
        (effect as any).boundVariables &&
        Object.keys((effect as any).boundVariables).length > 0
    );

    if (hasBoundVariables) {
      return effectCandidates;
    }

    const stackKey = createEffectStackKey(effectNode.effects);
    const effectSnapshots = effectNode.effects.map((effect: Effect) =>
      serializeEffectSnapshot(effect)
    );
    const primaryEffect = effectSnapshots[0];

    effectCandidates.push({
      key: stackKey,
      index: 0,
      property: "effects",
      effect: primaryEffect,
      effects: effectSnapshots,
    });
  }

  return effectCandidates;
}

async function applySpacingVariables(
  layerId: string,
  variableBindings: any[]
): Promise<void> {
  const node = await figma.getNodeByIdAsync(layerId);
  if (!node) {
    postMessageToUI({
      type: "error",
      message: "Cannot apply variables to this layer",
    });
    return;
  }

  try {
    // Get or create variable collection
    const collections =
      await figma.variables.getLocalVariableCollectionsAsync();
    const collection =
      collections.length > 0
        ? collections[0]
        : figma.variables.createVariableCollection("Design System");

    const modeId = collection.modes[0].modeId;
    const existingVariables = await figma.variables.getLocalVariablesAsync();

    // Apply each spacing variable
    for (const binding of variableBindings) {
      // Find or create variable
      let variable = existingVariables.find(
        (v) => v.name === binding.variableName
      );

      if (!variable) {
        variable = figma.variables.createVariable(
          binding.variableName,
          collection,
          "FLOAT"
        );
      }

      // Set variable value
      variable.setValueForMode(modeId, binding.value);

      // Bind the property
      if (binding.type === "cornerRadius") {
        (node as any).setBoundVariable("cornerRadius", variable);
      } else if (
        binding.type.startsWith("padding") ||
        binding.type === "itemSpacing"
      ) {
        // Only bind padding and itemSpacing to Auto Layout frames
        if (node.type === "FRAME" && "layoutMode" in node) {
          const frameNode = node as FrameNode;
          if (frameNode.layoutMode !== "NONE") {
            // Handle grouped padding properties
            if (binding.properties && Array.isArray(binding.properties)) {
              // Apply the same variable to multiple properties (e.g., paddingHorizontal -> paddingLeft + paddingRight)
              for (const property of binding.properties) {
                (node as any).setBoundVariable(property, variable);
              }
            } else if (binding.type === "paddingHorizontal") {
              // Apply to both left and right padding
              (node as any).setBoundVariable("paddingLeft", variable);
              (node as any).setBoundVariable("paddingRight", variable);
            } else if (binding.type === "paddingVertical") {
              // Apply to both top and bottom padding
              (node as any).setBoundVariable("paddingTop", variable);
              (node as any).setBoundVariable("paddingBottom", variable);
            } else {
              // Apply to single property
              (node as any).setBoundVariable(binding.type, variable);
            }
          }
        }
      }
    }

    postMessageToUI({
      type: "fix-applied",
      message: `Applied ${variableBindings.length} spacing variables`,
    });
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Failed to apply spacing variables: ${error}`,
    });
  }
}

async function applyBulkSpacingVariables(
  layerIds: string[],
  spacingToVariableMap: Record<string, string>
): Promise<void> {
  try {
    // Get or create variable collection
    const collections =
      await figma.variables.getLocalVariableCollectionsAsync();
    const collection =
      collections.length > 0
        ? collections[0]
        : figma.variables.createVariableCollection("Design System");

    const modeId = collection.modes[0].modeId;
    const existingVariables = await figma.variables.getLocalVariablesAsync();

    // Create all variables first
    const variableCache = new Map<string, Variable>();

    for (const [spacingKey, variableName] of Object.entries(
      spacingToVariableMap
    )) {
      let variable = variableCache.get(variableName);

      if (!variable) {
        variable = existingVariables.find((v) => v.name === variableName);

        if (!variable) {
          // Parse value from key (format: "cornerRadius-6" or "paddingLeft-16")
          const [type, valueStr] = spacingKey.split("-");
          const value = parseFloat(valueStr);

          variable = figma.variables.createVariable(
            variableName,
            collection,
            "FLOAT"
          );
          variable.setValueForMode(modeId, value);
        }

        variableCache.set(variableName, variable);
      }
    }

    // Apply variables to all layers
    for (const layerId of layerIds) {
      const node = await figma.getNodeByIdAsync(layerId);
      if (!node) continue;

      // Apply each spacing variable
      for (const [spacingKey, variableName] of Object.entries(
        spacingToVariableMap
      )) {
        const variable = variableCache.get(variableName);
        if (!variable) continue;

        const [type, valueStr] = spacingKey.split("-");

        try {
          if (type === "cornerRadius") {
            (node as any).setBoundVariable("cornerRadius", variable);
          } else if (type.startsWith("padding") || type === "itemSpacing") {
            // Only bind padding and itemSpacing to Auto Layout frames
            if (node.type === "FRAME" && "layoutMode" in node) {
              const frameNode = node as FrameNode;
              if (frameNode.layoutMode !== "NONE") {
                // Handle grouped padding properties
                if (type === "paddingHorizontal") {
                  // Apply to both left and right padding
                  (node as any).setBoundVariable("paddingLeft", variable);
                  (node as any).setBoundVariable("paddingRight", variable);
                } else if (type === "paddingVertical") {
                  // Apply to both top and bottom padding
                  (node as any).setBoundVariable("paddingTop", variable);
                  (node as any).setBoundVariable("paddingBottom", variable);
                } else {
                  // Apply to single property
                  (node as any).setBoundVariable(type, variable);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to bind ${type} on layer ${layerId}:`, error);
        }
      }
    }

    postMessageToUI({
      type: "fix-applied",
      message: `Applied spacing variables to ${layerIds.length} layers`,
    });
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Failed to apply bulk spacing variables: ${error}`,
    });
  }
}

interface EffectStyleBinding {
  styleName: string;
  key: string;
  index: number;
}

interface BulkEffectStyleAssignment {
  key: string;
  styleName: string;
}

async function applyEffectStyles(
  layerId: string,
  styleBindings: EffectStyleBinding[]
): Promise<void> {
  const node = (await figma.getNodeByIdAsync(layerId)) as SceneNode | null;

  if (!node || !("effects" in node) || !node.effects || node.effects.length === 0) {
    postMessageToUI({
      type: "error",
      message: "Cannot apply effect styles to this layer",
    });
    return;
  }

  try {
    const primaryBinding = styleBindings[0];
    const preferredName =
      (primaryBinding && primaryBinding.styleName) || `Effect ${node.name}`;
    const expectedKey = primaryBinding ? primaryBinding.key : undefined;

    const appliedStyle = await applyEffectStyleForNode(
      node,
      preferredName,
      expectedKey
    );

    if (appliedStyle) {
      postMessageToUI({
        type: "fix-applied",
        message: `Applied effect style "${appliedStyle.name}"`,
      });
      figma.notify(`✅ Applied effect style "${appliedStyle.name}"`);
    } else {
      postMessageToUI({
        type: "fix-applied",
        message: "Layer already uses an effect style",
      });
    }
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Failed to apply effect styles: ${error}`,
    });
  }
}

async function applyBulkEffectStyles(
  layerIds: string[],
  effectAssignments: BulkEffectStyleAssignment[]
): Promise<void> {
  try {
    if (!effectAssignments || effectAssignments.length === 0) {
      postMessageToUI({
        type: "fix-applied",
        message: "No effect styles selected for bulk apply",
      });
      return;
    }

    const assignmentMap = new Map<string, BulkEffectStyleAssignment>();
    effectAssignments.forEach((assignment) =>
      assignmentMap.set(assignment.key, assignment)
    );

    const styleCache = new Map<string, EffectStyle>();
    let layersUpdated = 0;

    for (const layerId of layerIds) {
      const node = (await figma.getNodeByIdAsync(layerId)) as SceneNode | null;
      if (
        !node ||
        !("effects" in node) ||
        !node.effects ||
        node.effects.length === 0 ||
        !nodeSupportsEffectStyles(node)
      ) {
        continue;
      }

      const effectNode = node as EffectStyleCapableNode;

      if (effectNode.effectStyleId) {
        continue; // Already using an effect style
      }

      const stackKey = createEffectStackKey(effectNode.effects);
      const assignment = assignmentMap.get(stackKey);
      if (!assignment) {
        continue;
      }

      let style = styleCache.get(stackKey);
      if (!style) {
        style = await ensureEffectStyleForEffects(
          assignment.styleName,
          effectNode.effects
        );
        styleCache.set(stackKey, style);
      }

      await assignEffectStyleId(effectNode, style.id);
      layersUpdated++;
    }

    if (layersUpdated > 0) {
      postMessageToUI({
        type: "fix-applied",
        message: `Applied effect styles to ${layersUpdated} layer${
          layersUpdated === 1 ? "" : "s"
        }`,
      });
      figma.notify(
        `✅ Applied effect styles to ${layersUpdated} layer${
          layersUpdated === 1 ? "" : "s"
        }`
      );
    } else {
      postMessageToUI({
        type: "fix-applied",
        message: "No effect styles were applied",
      });
    }
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Failed to apply effect styles: ${error}`,
    });
  }
}
