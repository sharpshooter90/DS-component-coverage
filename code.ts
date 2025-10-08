// Design System Coverage Plugin
// Analyzes frames for component, token, and style coverage

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
    figma.ui.postMessage({
      type: "settings-updated",
      settings: currentSettings,
    });
  } else if (msg.type === "get-settings") {
    figma.ui.postMessage({
      type: "settings-updated",
      settings: currentSettings,
    });
  } else if (msg.type === "select-layer") {
    const node = figma.getNodeById(msg.layerId);
    if (node && "id" in node) {
      figma.currentPage.selection = [node as SceneNode];
      figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
    }
  } else if (msg.type === "close") {
    figma.closePlugin();
  }
};

async function analyzeSelection() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "error",
      message: "Please select a frame to analyze",
    });
    return;
  }

  if (selection.length > 1) {
    figma.ui.postMessage({
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
    figma.ui.postMessage({
      type: "error",
      message: "Please select a frame, component, or instance",
    });
    return;
  }

  figma.ui.postMessage({ type: "analysis-started" });

  try {
    const analysis = await analyzeNode(selectedNode);
    figma.ui.postMessage({
      type: "analysis-complete",
      data: analysis,
    });
  } catch (error) {
    figma.ui.postMessage({
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
        figma.ui.postMessage({
          type: "analysis-progress",
          progress: stats.totalLayers,
        });
      }

      await traverseNode(child, stats, childPath);
    }
  }
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

  // Check 1: Component Coverage (Story 2)
  if (currentSettings.checkComponents) {
    const componentIssue = await checkComponentUsage(node);
    if (componentIssue) {
      issues.push(componentIssue);
      isCompliant = false;
    }
  }

  // Check 2: Token Coverage (Story 3)
  if (currentSettings.checkTokens) {
    const tokenIssues = checkTokenUsage(node);
    if (tokenIssues.length > 0) {
      issues.push(...tokenIssues);
      isCompliant = false;
    }
  }

  // Check 3: Style Coverage (Story 4)
  if (currentSettings.checkStyles) {
    const styleIssues = checkStyleUsage(node);
    if (styleIssues.length > 0) {
      issues.push(...styleIssues);
      isCompliant = false;
    }
  }

  if (isCompliant) {
    stats.compliantLayers++;
    stats.byType[nodeType].compliant++;
  } else {
    stats.nonCompliantLayers.push({
      id: node.id,
      name: node.name,
      type: nodeType,
      issues,
      path: path.join(" > "),
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

  // Skip if local styles are allowed
  if (currentSettings.allowLocalStyles) {
    return issues;
  }

  // Check fill style
  if ("fillStyleId" in node && "fills" in node) {
    if (
      node.fills !== figma.mixed &&
      (node.fills as ReadonlyArray<Paint>).length > 0
    ) {
      if (!node.fillStyleId) {
        issues.push("Uses local fill style instead of shared style");
      }
    }
  }

  // Check stroke style
  if ("strokeStyleId" in node && "strokes" in node) {
    const strokes = node.strokes;
    if (Array.isArray(strokes) && strokes.length > 0) {
      if (!node.strokeStyleId) {
        issues.push("Uses local stroke style instead of shared style");
      }
    }
  }

  // Check text style
  if (node.type === "TEXT") {
    const textNode = node as TextNode;
    if (!textNode.textStyleId) {
      issues.push("Uses local text style instead of shared style");
    }
  }

  // Check effect style
  if ("effectStyleId" in node && "effects" in node) {
    const effects = node.effects;
    if (Array.isArray(effects) && effects.length > 0) {
      if (!node.effectStyleId) {
        issues.push("Uses local effects instead of shared effect style");
      }
    }
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
