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
import {
  AutoLayoutConversionOptions,
  AutoLayoutDirection,
  convertFrameNodeToAutoLayout,
} from "./utils/autoLayout";

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
  suggestions?: {
    autoLayout?: AutoLayoutSuggestion[];
  };
}

interface AutoLayoutSuggestion {
  id: string;
  name: string;
  type: string;
  path: string;
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

let selectionSubscriptionCount = 0;
let lastAnalyzedNodeId: string | null = null;
let rootScreenNodeId: string | null = null; // Track the root screen being analyzed
let isSelectingChildLayer = false; // Flag to prevent re-analysis when selecting child layers

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
      // Set flag to prevent re-analysis when selecting child layers
      isSelectingChildLayer = true;

      figma.currentPage.selection = [node as SceneNode];

      // Only zoom if it's the root screen or if explicitly requested
      // For child layers, just select without zooming to keep context
      const isRootScreen = msg.layerId === rootScreenNodeId;
      if (isRootScreen || msg.zoomToLayer) {
        figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
      }

      // Reset flag after a short delay to allow selection event to complete
      setTimeout(() => {
        isSelectingChildLayer = false;
      }, 100);
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
  } else if (msg.type === "convert-to-auto-layout") {
    await convertFrameToAutoLayoutById(msg.layerId, msg.direction);
  } else if (msg.type === "convert-bulk-auto-layout") {
    await convertFramesToAutoLayout(msg.layerIds, msg.direction);
  } else if (msg.type === "export-debug-data") {
    exportDebugData();
  } else if (msg.type === "export-report-to-canvas") {
    await exportReportToCanvas(msg.reportData);
  } else if (msg.type === "subscribe-selection") {
    selectionSubscriptionCount++;
    if (selectionSubscriptionCount === 1) {
      figma.on("selectionchange", handleSelectionChange);
      handleSelectionChange();
    }
  } else if (msg.type === "unsubscribe-selection") {
    selectionSubscriptionCount = Math.max(0, selectionSubscriptionCount - 1);
    if (selectionSubscriptionCount === 0) {
      figma.off("selectionchange", handleSelectionChange);
    }
  } else if (msg.type === "close") {
    figma.closePlugin();
  }
};

function notifySelectionChange(nodeId: string | null) {
  postMessageToUI({ type: "selection-changed", nodeId });
}

function handleSelectionChange() {
  // Don't trigger re-analysis if we're just selecting a child layer from the UI
  if (isSelectingChildLayer) {
    return;
  }

  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    lastAnalyzedNodeId = null;
    notifySelectionChange(null);
    return;
  }

  const node = selection[0];
  if (
    node.type !== "FRAME" &&
    node.type !== "COMPONENT" &&
    node.type !== "INSTANCE"
  ) {
    lastAnalyzedNodeId = null;
    notifySelectionChange(null);
    return;
  }

  if (lastAnalyzedNodeId === node.id) {
    notifySelectionChange(node.id);
    return;
  }

  lastAnalyzedNodeId = node.id;
  notifySelectionChange(node.id);
  runAnalysisOnNode(node);
}

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

  await runAnalysisOnNode(selectedNode);
}

async function runAnalysisOnNode(node: SceneNode) {
  lastAnalyzedNodeId = node.id;
  rootScreenNodeId = node.id; // Track the root screen being analyzed
  postMessageToUI({ type: "analysis-started" });

  try {
    const analysis = await analyzeNode(node);
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
    autoLayoutSuggestions: new Map<string, AutoLayoutSuggestion>(),
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
    suggestions: {
      autoLayout: Array.from(stats.autoLayoutSuggestions.values()),
    },
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

  const isFrameAutoLayout =
    node.type === "FRAME" &&
    "layoutMode" in node &&
    (node as FrameNode).layoutMode !== "NONE";

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

  if (node.type === "FRAME" && !isFrameAutoLayout) {
    stats.autoLayoutSuggestions.set(node.id, {
      id: node.id,
      name: node.name,
      type: node.type,
      path: path.join(" > "),
    });
  }
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
      supportsEffectStyles && (node as any).effectStyleId ? true : false;

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
  if (
    node.type === "FRAME" &&
    "layoutMode" in node &&
    (node as FrameNode).layoutMode !== "NONE"
  ) {
    const paddingProps = [
      "paddingLeft",
      "paddingRight",
      "paddingTop",
      "paddingBottom",
    ] as const;

    const frameNode = node as FrameNode;

    const localPaddingProps = paddingProps.filter((prop) => {
      const value = (frameNode as any)[prop];
      const hasBoundVariable =
        frameNode.boundVariables && prop in frameNode.boundVariables;
      return value !== 0 && !hasBoundVariable;
    });

    if (localPaddingProps.length > 0) {
      issues.push(`🔴 Uses local padding values instead of spacing tokens`);
    } else if (
      frameNode.boundVariables &&
      paddingProps.some((prop) => prop in frameNode.boundVariables!)
    ) {
      issues.push(`✅ Padding bound to variables`);
    }
  }

  if (node.type === "FRAME") {
    const frameNode = node as FrameNode;
    if (frameNode.layoutMode === "NONE") {
      issues.push(`💡 Frame can use Auto Layout`);
    } else {
      issues.push(`✅ Uses Auto Layout`);
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

  if (
    !node ||
    !("effects" in node) ||
    !node.effects ||
    node.effects.length === 0
  ) {
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

type RawAutoLayoutDirection = "HORIZONTAL" | "VERTICAL" | undefined;

function toAutoLayoutOptions(
  direction: RawAutoLayoutDirection
): AutoLayoutConversionOptions {
  if (direction === "HORIZONTAL" || direction === "VERTICAL") {
    return { direction };
  }
  return {};
}

interface AutoLayoutConversionResult {
  converted: boolean;
  alreadyAutoLayout: boolean;
  skipped: boolean;
  direction: AutoLayoutDirection | null;
}

async function convertFrameToAutoLayoutById(
  layerId: string,
  direction?: RawAutoLayoutDirection,
  notify: boolean = true
): Promise<AutoLayoutConversionResult> {
  const node = await figma.getNodeByIdAsync(layerId);
  if (!node || node.type !== "FRAME") {
    if (notify) {
      postMessageToUI({
        type: "error",
        message: "Cannot convert this layer to Auto Layout",
      });
    }
    return {
      converted: false,
      alreadyAutoLayout: false,
      skipped: true,
      direction: null,
    };
  }

  try {
    const result = convertFrameNodeToAutoLayout(
      node as FrameNode,
      toAutoLayoutOptions(direction)
    );

    if (result.converted) {
      if (notify) {
        postMessageToUI({
          type: "fix-applied",
          message: `Converted "${
            node.name
          }" to Auto Layout (${result.direction.toLowerCase()})`,
        });
        figma.notify(`✅ Converted ${node.name} to Auto Layout`);
      }
      return {
        converted: true,
        alreadyAutoLayout: false,
        skipped: false,
        direction: result.direction,
      };
    } else {
      if (notify) {
        postMessageToUI({
          type: "fix-applied",
          message: `"${node.name}" already uses Auto Layout`,
        });
      }
      return {
        converted: false,
        alreadyAutoLayout: true,
        skipped: false,
        direction: result.direction,
      };
    }
  } catch (error) {
    if (notify) {
      postMessageToUI({
        type: "error",
        message: `Failed to convert to Auto Layout: ${error}`,
      });
    }
    return {
      converted: false,
      alreadyAutoLayout: false,
      skipped: true,
      direction: null,
    };
  }
}

async function convertFramesToAutoLayout(
  layerIds: string[],
  direction?: RawAutoLayoutDirection
): Promise<void> {
  try {
    const uniqueIds = [...new Set(layerIds)];
    let converted = 0;
    let alreadyLayout = 0;
    let skipped = 0;

    for (const layerId of uniqueIds) {
      const result = await convertFrameToAutoLayoutById(
        layerId,
        direction,
        false
      );

      if (result.converted) {
        converted++;
      } else if (result.alreadyAutoLayout) {
        alreadyLayout++;
      } else {
        skipped++;
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (converted > 0) {
      postMessageToUI({
        type: "fix-applied",
        message: `Converted ${converted} frame${
          converted === 1 ? "" : "s"
        } to Auto Layout`,
      });
      figma.notify(
        `✅ Converted ${converted} frame${
          converted === 1 ? "" : "s"
        } to Auto Layout`
      );
    } else {
      postMessageToUI({
        type: "fix-applied",
        message:
          alreadyLayout > 0
            ? "Selected frames already use Auto Layout"
            : "No frames were converted to Auto Layout",
      });
    }

    if (skipped > 0) {
      figma.notify(
        `⚠️ Skipped ${skipped} layer${
          skipped === 1 ? "" : "s"
        } that cannot be converted`
      );
    }
  } catch (error) {
    postMessageToUI({
      type: "error",
      message: `Failed to convert frames to Auto Layout: ${error}`,
    });
  }
}

/**
 * Export the analysis report as a visual presentation on the canvas
 */
async function exportReportToCanvas(reportData: any) {
  try {
    // Load fonts first
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Italic" });

    const { summary, details } = reportData;

    // Create main report frame
    const reportFrame = figma.createFrame();
    reportFrame.name = `DS Coverage Report - ${summary.analyzedFrameName}`;
    reportFrame.resize(1200, 1600);
    reportFrame.x = figma.viewport.center.x + 100;
    reportFrame.y = figma.viewport.center.y - 800;
    reportFrame.fills = [
      { type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } },
    ];
    reportFrame.layoutMode = "VERTICAL";
    reportFrame.paddingTop = 40;
    reportFrame.paddingBottom = 40;
    reportFrame.paddingLeft = 40;
    reportFrame.paddingRight = 40;
    reportFrame.itemSpacing = 32;
    reportFrame.primaryAxisSizingMode = "AUTO";
    reportFrame.counterAxisSizingMode = "FIXED";

    // Header Section
    const headerFrame = createHeaderSection(summary);
    reportFrame.appendChild(headerFrame);

    // Summary Section
    const summaryFrame = createSummarySection(summary);
    reportFrame.appendChild(summaryFrame);

    // Coverage by Type Section
    const coverageByTypeFrame = createCoverageByTypeSection(details.byType);
    reportFrame.appendChild(coverageByTypeFrame);

    // Non-Compliant Layers Section
    if (details.nonCompliantLayers && details.nonCompliantLayers.length > 0) {
      const nonCompliantFrame = createNonCompliantLayersSection(
        details.nonCompliantLayers
      );
      reportFrame.appendChild(nonCompliantFrame);
    }

    // Auto Layout Suggestions Section
    if (
      details.suggestions?.autoLayout &&
      details.suggestions.autoLayout.length > 0
    ) {
      const autoLayoutFrame = createAutoLayoutSuggestionsSection(
        details.suggestions.autoLayout
      );
      reportFrame.appendChild(autoLayoutFrame);
    }

    // Select and zoom to the report
    figma.currentPage.selection = [reportFrame];
    figma.viewport.scrollAndZoomIntoView([reportFrame]);

    figma.notify("✅ Report added to canvas successfully!");

    postMessageToUI({
      type: "fix-applied",
      message: "Report exported to canvas successfully",
    });
  } catch (error) {
    console.error("Error exporting report to canvas:", error);
    postMessageToUI({
      type: "error",
      message: `Failed to export report to canvas: ${error}`,
    });
  }
}

function createHeaderSection(summary: any): FrameNode {
  const headerFrame = figma.createFrame();
  headerFrame.name = "Header";
  headerFrame.resize(1120, 120);
  headerFrame.fills = [
    {
      type: "SOLID",
      color: { r: 0.26, g: 0.54, b: 1 }, // Accent blue
    },
  ];
  headerFrame.layoutMode = "VERTICAL";
  headerFrame.paddingTop = 24;
  headerFrame.paddingBottom = 24;
  headerFrame.paddingLeft = 32;
  headerFrame.paddingRight = 32;
  headerFrame.itemSpacing = 8;
  headerFrame.cornerRadius = 12;

  // Title
  const titleText = figma.createText();
  titleText.characters = "📊 DS Coverage Analysis Report";
  titleText.fontSize = 28;
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  headerFrame.appendChild(titleText);

  // Frame name
  const frameNameText = figma.createText();
  frameNameText.characters = `Frame: ${summary.analyzedFrameName}`;
  frameNameText.fontSize = 16;
  frameNameText.fontName = { family: "Inter", style: "Medium" };
  frameNameText.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.95, b: 1 } }];
  headerFrame.appendChild(frameNameText);

  // Date
  const dateText = figma.createText();
  dateText.characters = `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  dateText.fontSize = 12;
  dateText.fontName = { family: "Inter", style: "Regular" };
  dateText.fills = [{ type: "SOLID", color: { r: 0.8, g: 0.9, b: 1 } }];
  headerFrame.appendChild(dateText);

  return headerFrame;
}

function createSummarySection(summary: any): FrameNode {
  const summaryFrame = figma.createFrame();
  summaryFrame.name = "Summary";
  summaryFrame.resize(1120, 200);
  summaryFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  summaryFrame.layoutMode = "VERTICAL";
  summaryFrame.paddingTop = 24;
  summaryFrame.paddingBottom = 24;
  summaryFrame.paddingLeft = 32;
  summaryFrame.paddingRight = 32;
  summaryFrame.itemSpacing = 16;
  summaryFrame.cornerRadius = 12;
  summaryFrame.primaryAxisSizingMode = "AUTO";
  summaryFrame.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.05 },
      offset: { x: 0, y: 2 },
      radius: 8,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  // Section title
  const titleText = figma.createText();
  titleText.characters = "Summary";
  titleText.fontSize = 20;
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  summaryFrame.appendChild(titleText);

  // Stats grid
  const statsGrid = figma.createFrame();
  statsGrid.name = "Stats Grid";
  statsGrid.resize(1056, 100);
  statsGrid.fills = [];
  statsGrid.layoutMode = "HORIZONTAL";
  statsGrid.itemSpacing = 16;
  statsGrid.primaryAxisSizingMode = "AUTO";

  const stats = [
    {
      label: "Overall Score",
      value: `${summary.overallScore}%`,
      color: getScoreColor(summary.overallScore),
    },
    {
      label: "Component Coverage",
      value: `${summary.componentCoverage}%`,
      color: getScoreColor(summary.componentCoverage),
    },
    {
      label: "Token Coverage",
      value: `${summary.tokenCoverage}%`,
      color: getScoreColor(summary.tokenCoverage),
    },
    {
      label: "Style Coverage",
      value: `${summary.styleCoverage}%`,
      color: getScoreColor(summary.styleCoverage),
    },
  ];

  stats.forEach((stat) => {
    const statCard = createStatCard(stat.label, stat.value, stat.color);
    statsGrid.appendChild(statCard);
  });

  summaryFrame.appendChild(statsGrid);

  // Layer counts
  const countsText = figma.createText();
  countsText.characters = `${summary.compliantLayers} of ${summary.totalLayers} layers are compliant`;
  countsText.fontSize = 14;
  countsText.fontName = { family: "Inter", style: "Medium" };
  countsText.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
  summaryFrame.appendChild(countsText);

  return summaryFrame;
}

function createStatCard(label: string, value: string, color: RGB): FrameNode {
  const card = figma.createFrame();
  card.name = label;
  card.resize(250, 80);
  card.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.98, b: 1 } }];
  card.layoutMode = "VERTICAL";
  card.paddingTop = 12;
  card.paddingBottom = 12;
  card.paddingLeft = 16;
  card.paddingRight = 16;
  card.itemSpacing = 4;
  card.cornerRadius = 8;
  card.strokeWeight = 2;
  card.strokes = [{ type: "SOLID", color }];

  const valueText = figma.createText();
  valueText.characters = value;
  valueText.fontSize = 24;
  valueText.fontName = { family: "Inter", style: "Bold" };
  valueText.fills = [{ type: "SOLID", color }];
  card.appendChild(valueText);

  const labelText = figma.createText();
  labelText.characters = label;
  labelText.fontSize = 12;
  labelText.fontName = { family: "Inter", style: "Medium" };
  labelText.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
  card.appendChild(labelText);

  return card;
}

function createCoverageByTypeSection(byType: any): FrameNode {
  const section = figma.createFrame();
  section.name = "Coverage by Type";
  section.resize(1120, 300);
  section.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  section.layoutMode = "VERTICAL";
  section.paddingTop = 24;
  section.paddingBottom = 24;
  section.paddingLeft = 32;
  section.paddingRight = 32;
  section.itemSpacing = 16;
  section.cornerRadius = 12;
  section.primaryAxisSizingMode = "AUTO";
  section.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.05 },
      offset: { x: 0, y: 2 },
      radius: 8,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  // Section title
  const titleText = figma.createText();
  titleText.characters = "Coverage by Layer Type";
  titleText.fontSize = 20;
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  section.appendChild(titleText);

  // Type rows
  Object.entries(byType).forEach(([type, data]: [string, any]) => {
    const row = createTypeRow(type, data);
    section.appendChild(row);
  });

  return section;
}

function createTypeRow(type: string, data: any): FrameNode {
  const row = figma.createFrame();
  row.name = type;
  row.resize(1056, 60);
  row.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
  row.layoutMode = "HORIZONTAL";
  row.paddingTop = 12;
  row.paddingBottom = 12;
  row.paddingLeft = 16;
  row.paddingRight = 16;
  row.itemSpacing = 16;
  row.primaryAxisAlignItems = "CENTER";
  row.counterAxisAlignItems = "CENTER";
  row.cornerRadius = 6;

  // Type name
  const typeText = figma.createText();
  typeText.characters = type;
  typeText.fontSize = 14;
  typeText.fontName = { family: "Inter", style: "Medium" };
  typeText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  typeText.layoutGrow = 1;
  row.appendChild(typeText);

  // Progress bar
  const progressBar = createProgressBar(data.percentage);
  row.appendChild(progressBar);

  // Stats
  const statsText = figma.createText();
  statsText.characters = `${data.compliant}/${data.total} (${data.percentage}%)`;
  statsText.fontSize = 14;
  statsText.fontName = { family: "Inter", style: "Medium" };
  statsText.fills = [{ type: "SOLID", color: getScoreColor(data.percentage) }];
  row.appendChild(statsText);

  return row;
}

function createProgressBar(percentage: number): FrameNode {
  const container = figma.createFrame();
  container.name = "Progress Bar";
  container.resize(200, 8);
  container.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
  container.cornerRadius = 4;
  container.clipsContent = true;

  const fill = figma.createFrame();
  fill.name = "Fill";
  fill.resize((200 * percentage) / 100, 8);
  fill.fills = [{ type: "SOLID", color: getScoreColor(percentage) }];
  fill.cornerRadius = 4;
  container.appendChild(fill);

  return container;
}

function createNonCompliantLayersSection(layers: any[]): FrameNode {
  const section = figma.createFrame();
  section.name = "Non-Compliant Layers";
  section.resize(1120, 400);
  section.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  section.layoutMode = "VERTICAL";
  section.paddingTop = 24;
  section.paddingBottom = 24;
  section.paddingLeft = 32;
  section.paddingRight = 32;
  section.itemSpacing = 12;
  section.cornerRadius = 12;
  section.primaryAxisSizingMode = "AUTO";
  section.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.05 },
      offset: { x: 0, y: 2 },
      radius: 8,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  // Section title
  const titleText = figma.createText();
  titleText.characters = `❌ Non-Compliant Layers (${layers.length})`;
  titleText.fontSize = 20;
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  section.appendChild(titleText);

  // Show top 10 non-compliant layers
  const topLayers = layers.slice(0, 10);
  topLayers.forEach((layer, index) => {
    const layerRow = createLayerRow(layer, index + 1);
    section.appendChild(layerRow);
  });

  if (layers.length > 10) {
    const moreText = figma.createText();
    moreText.characters = `... and ${layers.length - 10} more layers`;
    moreText.fontSize = 12;
    moreText.fontName = { family: "Inter", style: "Italic" };
    moreText.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
    section.appendChild(moreText);
  }

  return section;
}

function createLayerRow(layer: any, index: number): FrameNode {
  const row = figma.createFrame();
  row.name = `Layer ${index}`;
  row.resize(1056, 60);
  row.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.96, b: 0.96 } }];
  row.layoutMode = "HORIZONTAL";
  row.paddingTop = 12;
  row.paddingBottom = 12;
  row.paddingLeft = 16;
  row.paddingRight = 16;
  row.itemSpacing = 12;
  row.primaryAxisAlignItems = "CENTER";
  row.counterAxisAlignItems = "CENTER";
  row.cornerRadius = 6;

  // Index
  const indexText = figma.createText();
  indexText.characters = `${index}`;
  indexText.fontSize = 12;
  indexText.fontName = { family: "Inter", style: "Bold" };
  indexText.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
  row.appendChild(indexText);

  // Layer info
  const infoFrame = figma.createFrame();
  infoFrame.name = "Info";
  infoFrame.resize(700, 40);
  infoFrame.fills = [];
  infoFrame.layoutMode = "VERTICAL";
  infoFrame.itemSpacing = 4;

  const nameText = figma.createText();
  nameText.characters = layer.name;
  nameText.fontSize = 13;
  nameText.fontName = { family: "Inter", style: "Medium" };
  nameText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  infoFrame.appendChild(nameText);

  const pathText = figma.createText();
  pathText.characters = `${layer.type} • ${layer.path}`;
  pathText.fontSize = 10;
  pathText.fontName = { family: "Inter", style: "Regular" };
  pathText.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
  infoFrame.appendChild(pathText);

  row.appendChild(infoFrame);

  // Issue count
  const issueCount = Array.isArray(layer.issues) ? layer.issues.length : 0;
  const issuesText = figma.createText();
  issuesText.characters = `${issueCount} issue${issueCount === 1 ? "" : "s"}`;
  issuesText.fontSize = 12;
  issuesText.fontName = { family: "Inter", style: "Medium" };
  issuesText.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.3, b: 0.3 } }];
  row.appendChild(issuesText);

  return row;
}

function createAutoLayoutSuggestionsSection(suggestions: any[]): FrameNode {
  const section = figma.createFrame();
  section.name = "Auto Layout Suggestions";
  section.resize(1120, 300);
  section.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  section.layoutMode = "VERTICAL";
  section.paddingTop = 24;
  section.paddingBottom = 24;
  section.paddingLeft = 32;
  section.paddingRight = 32;
  section.itemSpacing = 12;
  section.cornerRadius = 12;
  section.primaryAxisSizingMode = "AUTO";
  section.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0, g: 0, b: 0, a: 0.05 },
      offset: { x: 0, y: 2 },
      radius: 8,
      visible: true,
      blendMode: "NORMAL",
    },
  ];

  // Section title
  const titleText = figma.createText();
  titleText.characters = `💡 Frames not using Auto Layout (${suggestions.length})`;
  titleText.fontSize = 20;
  titleText.fontName = { family: "Inter", style: "Bold" };
  titleText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  section.appendChild(titleText);

  suggestions.forEach((layer, index) => {
    const layerRow = createSuggestionRow(layer, index + 1);
    section.appendChild(layerRow);
  });

  return section;
}

function createSuggestionRow(layer: any, index: number): FrameNode {
  const row = figma.createFrame();
  row.name = `Suggestion ${index}`;
  row.resize(1056, 50);
  row.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.98, b: 1 } }];
  row.layoutMode = "HORIZONTAL";
  row.paddingTop = 12;
  row.paddingBottom = 12;
  row.paddingLeft = 16;
  row.paddingRight = 16;
  row.itemSpacing = 12;
  row.primaryAxisAlignItems = "CENTER";
  row.counterAxisAlignItems = "CENTER";
  row.cornerRadius = 6;

  // Index
  const indexText = figma.createText();
  indexText.characters = `${index}`;
  indexText.fontSize = 12;
  indexText.fontName = { family: "Inter", style: "Bold" };
  indexText.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
  row.appendChild(indexText);

  // Layer name
  const nameText = figma.createText();
  nameText.characters = layer.name;
  nameText.fontSize = 13;
  nameText.fontName = { family: "Inter", style: "Medium" };
  nameText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
  nameText.layoutGrow = 1;
  row.appendChild(nameText);

  // Path
  const pathText = figma.createText();
  pathText.characters = layer.path;
  pathText.fontSize = 10;
  pathText.fontName = { family: "Inter", style: "Regular" };
  pathText.fills = [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }];
  row.appendChild(pathText);

  return row;
}

function getScoreColor(score: number): RGB {
  if (score >= 80) {
    return { r: 0.13, g: 0.77, b: 0.29 }; // Green
  } else if (score >= 60) {
    return { r: 1, g: 0.73, b: 0 }; // Yellow
  } else {
    return { r: 0.96, g: 0.26, b: 0.21 }; // Red
  }
}
