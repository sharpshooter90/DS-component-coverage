/// <reference types="@figma/plugin-typings" />

export interface LayerDataForAI {
  id: string;
  name: string;
  type: string;
  parent?: string;
  textContent?: string;
  size?: { width: number; height: number };
  childCount?: number;
  depth: number;
}

export interface LayerChunk {
  layers: LayerDataForAI[];
  type: string;
  estimatedSize: number;
}

export function serializeLayerForAI(
  node: SceneNode,
  depth = 0
): LayerDataForAI {
  const layer: LayerDataForAI = {
    id: node.id,
    name: node.name,
    type: node.type,
    depth,
  };

  if ("parent" in node && node.parent && "name" in node.parent) {
    layer.parent = node.parent.name;
  }

  if ("width" in node && "height" in node) {
    layer.size = {
      width: Math.round((node as any).width),
      height: Math.round((node as any).height),
    };
  }

  if ("children" in node) {
    layer.childCount = (node as any).children.length;
  }

  if (node.type === "TEXT") {
    try {
      const text = (node as TextNode).characters || "";
      layer.textContent =
        text.length > 100 ? `${text.slice(0, 100)}…` : text;
    } catch (error) {
      console.warn(
        `Unable to access text characters for node ${node.id}:`,
        error
      );
    }
  }

  return layer;
}

export function chunkLayersByType(
  layers: LayerDataForAI[],
  maxChunkSize = 50
): LayerChunk[] {
  if (!layers.length) {
    return [];
  }

  const chunks: LayerChunk[] = [];
  let current: LayerDataForAI[] = [];

  const flushChunk = () => {
    if (!current.length) return;
    const chunkLayers = current;
    current = [];

    const chunk: LayerChunk = {
      layers: chunkLayers,
      type: determineChunkType(chunkLayers),
      estimatedSize: 0,
    };

    chunk.estimatedSize = estimateChunkSize(chunk);
    chunks.push(chunk);
  };

  layers.forEach((layer) => {
    current.push(layer);
    if (current.length >= maxChunkSize) {
      flushChunk();
    }
  });

  flushChunk();
  return chunks;
}

export function estimateChunkSize(chunk: LayerChunk): number {
  return JSON.stringify(chunk.layers).length;
}

function determineChunkType(layers: LayerDataForAI[]): string {
  const counts: Record<string, number> = {};

  layers.forEach((layer) => {
    const category = getLayerCategory(layer.type);
    counts[category] = (counts[category] ?? 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [dominantType, dominantCount] = sorted[0] ?? ["MIXED", 0];
  const ratio = dominantCount / layers.length;

  return ratio >= 0.6 ? dominantType : "MIXED";
}

function getLayerCategory(type: string): string {
  switch (type) {
    case "TEXT":
      return "TEXT";
    case "FRAME":
    case "GROUP":
    case "SECTION":
    case "PAGE":
      return "FRAME";
    case "COMPONENT":
    case "COMPONENT_SET":
    case "INSTANCE":
      return "COMPONENT";
    case "RECTANGLE":
    case "VECTOR":
    case "ELLIPSE":
    case "POLYGON":
    case "STAR":
    case "LINE":
    case "BOOLEAN_OPERATION":
      return "SHAPE";
    default:
      return "OTHER";
  }
}
