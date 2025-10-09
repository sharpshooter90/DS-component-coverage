/// <reference types="@figma/plugin-typings" />

export type AutoLayoutDirection = "HORIZONTAL" | "VERTICAL";

export interface AutoLayoutConversionOptions {
  direction?: AutoLayoutDirection;
}

interface ChildBounds {
  node: SceneNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

function getChildBounds(node: SceneNode): ChildBounds {
  const width = "width" in node ? node.width : 0;
  const height = "height" in node ? node.height : 0;

  return {
    node,
    x: node.x,
    y: node.y,
    width,
    height,
  };
}

export function inferAutoLayoutDirection(
  frame: FrameNode
): AutoLayoutDirection {
  const children = frame.children;
  if (!children || children.length <= 1) {
    return "VERTICAL";
  }

  const bounds = children.map(getChildBounds);
  const minX = Math.min(...bounds.map((b) => b.x));
  const maxX = Math.max(...bounds.map((b) => b.x + b.width));
  const minY = Math.min(...bounds.map((b) => b.y));
  const maxY = Math.max(...bounds.map((b) => b.y + b.height));

  const horizontalSpan = maxX - minX;
  const verticalSpan = maxY - minY;

  return horizontalSpan > verticalSpan ? "HORIZONTAL" : "VERTICAL";
}

function sortChildren(
  children: ChildBounds[],
  direction: AutoLayoutDirection
): ChildBounds[] {
  return children
    .slice()
    .sort((a, b) =>
      direction === "VERTICAL"
        ? a.y - b.y || a.x - b.x
        : a.x - b.x || a.y - b.y
    );
}

function round(value: number): number {
  return Math.max(0, Math.round(value));
}

function computeAverageGap(
  sorted: ChildBounds[],
  direction: AutoLayoutDirection
): number {
  if (sorted.length <= 1) {
    return 0;
  }

  const gaps: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];
    const gap =
      direction === "VERTICAL"
        ? current.y - (prev.y + prev.height)
        : current.x - (prev.x + prev.width);
    if (!Number.isNaN(gap)) {
      gaps.push(Math.max(0, gap));
    }
  }

  if (gaps.length === 0) {
    return 0;
  }

  const total = gaps.reduce((sum, value) => sum + value, 0);
  return total / gaps.length;
}

function applyPaddingFromBounds(frame: FrameNode, bounds: ChildBounds[]): void {
  if (bounds.length === 0) {
    frame.paddingLeft = 0;
    frame.paddingRight = 0;
    frame.paddingTop = 0;
    frame.paddingBottom = 0;
    return;
  }

  const minX = Math.min(...bounds.map((b) => b.x));
  const maxX = Math.max(...bounds.map((b) => b.x + b.width));
  const minY = Math.min(...bounds.map((b) => b.y));
  const maxY = Math.max(...bounds.map((b) => b.y + b.height));

  frame.paddingLeft = round(minX);
  frame.paddingRight = round(frame.width - maxX);
  frame.paddingTop = round(minY);
  frame.paddingBottom = round(frame.height - maxY);
}

function resetChildLayoutAttributes(node: SceneNode): void {
  if ("layoutAlign" in node) {
    try {
      (node as unknown as LayoutMixin).layoutAlign = "MIN";
    } catch {
      // ignore if layoutAlign is not assignable
    }
  }

  if ("layoutGrow" in node) {
    try {
      (node as unknown as LayoutMixin).layoutGrow = 0;
    } catch {
      // ignore if layoutGrow is not assignable
    }
  }
}

export function convertFrameNodeToAutoLayout(
  frame: FrameNode,
  options: AutoLayoutConversionOptions = {}
): { converted: boolean; direction: AutoLayoutDirection } {
  if (frame.layoutMode !== "NONE") {
    const direction: AutoLayoutDirection =
      frame.layoutMode === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL";
    return { converted: false, direction };
  }

  const bounds = frame.children.map(getChildBounds);
  const direction = options.direction ?? inferAutoLayoutDirection(frame);

  const sorted = sortChildren(bounds, direction);
  sorted.forEach((childBounds, index) => {
    if (frame.children[index] !== childBounds.node) {
      frame.insertChild(index, childBounds.node);
    }
  });

  frame.layoutMode = direction;
  frame.layoutWrap = "NO_WRAP";
  frame.primaryAxisSizingMode = "AUTO";
  frame.counterAxisSizingMode = "AUTO";
  frame.primaryAxisAlignItems = "MIN";
  frame.counterAxisAlignItems = "MIN";

  applyPaddingFromBounds(frame, sorted);
  frame.itemSpacing = round(computeAverageGap(sorted, direction));

  sorted.forEach((child) => resetChildLayoutAttributes(child.node));

  return { converted: true, direction };
}
