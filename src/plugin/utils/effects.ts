/// <reference types="@figma/plugin-typings" />

export type EffectStyleCapableNode = SceneNode & {
  effectStyleId: string;
  effects: ReadonlyArray<Effect>;
  setEffectStyleIdAsync?: (styleId: string) => Promise<void>;
};

export function nodeSupportsEffectStyles(
  node: SceneNode
): node is EffectStyleCapableNode {
  return "effectStyleId" in node;
}

export async function assignEffectStyleId(
  node: EffectStyleCapableNode,
  styleId: string
): Promise<void> {
  const setter = node.setEffectStyleIdAsync;

  if (typeof setter === "function") {
    await setter.call(node, styleId);
  } else {
    (node as any).effectStyleId = styleId;
  }
}

export function cloneEffect(effect: Effect): Effect {
  const clone = { ...(effect as any) };

  if ("color" in clone && clone.color) {
    clone.color = { ...(clone.color as RGBA) };
  }

  if ("offset" in clone && clone.offset) {
    clone.offset = { ...(clone.offset as Vector) };
  }

  if ("boundVariables" in clone) {
    delete clone.boundVariables;
  }

  return clone as Effect;
}

export function normalizeNumber(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return parseFloat(value.toFixed(4));
}

export function normalizeEffectForKey(effect: Effect): any {
  const clone = cloneEffect(effect) as any;

  if ("radius" in clone) {
    clone.radius = normalizeNumber(clone.radius);
  }

  if ("spread" in clone) {
    clone.spread = normalizeNumber(clone.spread);
  }

  if ("offset" in clone && clone.offset) {
    clone.offset = {
      x: normalizeNumber(clone.offset.x),
      y: normalizeNumber(clone.offset.y),
    };
  }

  if ("color" in clone && clone.color) {
    clone.color = {
      r: normalizeNumber(clone.color.r),
      g: normalizeNumber(clone.color.g),
      b: normalizeNumber(clone.color.b),
      a: normalizeNumber(clone.color.a ?? 1),
    };
  }

  return clone;
}

export function serializeEffectSnapshot(effect: Effect): any {
  const clone = cloneEffect(effect) as any;
  const snapshot: any = {
    type: clone.type,
    visible: typeof clone.visible === "boolean" ? clone.visible : true,
  };

  if ("radius" in clone) {
    snapshot.radius = clone.radius;
  }

  if ("spread" in clone) {
    snapshot.spread = clone.spread;
  }

  if ("offset" in clone && clone.offset) {
    snapshot.offset = { x: clone.offset.x, y: clone.offset.y };
  }

  if ("color" in clone && clone.color) {
    snapshot.color = { ...clone.color };
  }

  if ("blendMode" in clone) {
    snapshot.blendMode = clone.blendMode;
  }

  if ("showBehindNode" in clone) {
    snapshot.showBehindNode = clone.showBehindNode;
  }

  return snapshot;
}

export function createEffectStackKey(effects: ReadonlyArray<Effect>): string {
  if (!effects || effects.length === 0) {
    return "no-effects";
  }

  const normalized = effects.map((effect) => normalizeEffectForKey(effect));
  return JSON.stringify(normalized);
}

export async function ensureEffectStyleForEffects(
  preferredName: string,
  effects: ReadonlyArray<Effect>
): Promise<EffectStyle> {
  const sanitizedEffects = effects.map((effect) => cloneEffect(effect));
  const targetKey = createEffectStackKey(effects);
  const localStyles = await figma.getLocalEffectStylesAsync();

  for (const style of localStyles) {
    const styleKey = createEffectStackKey(
      style.effects as ReadonlyArray<Effect>
    );
    if (styleKey === targetKey) {
      return style;
    }
  }

  const baseName =
    preferredName && preferredName.trim().length > 0
      ? preferredName.trim()
      : "Effect Style";

  const existingNames = new Set(localStyles.map((style) => style.name));
  let finalName = baseName;
  let suffix = 2;

  while (existingNames.has(finalName)) {
    finalName = `${baseName} ${suffix}`;
    suffix++;
  }

  const style = figma.createEffectStyle();
  style.name = finalName;
  style.effects = sanitizedEffects;

  return style;
}

export async function applyEffectStyleForNode(
  node: SceneNode,
  preferredName: string,
  expectedKey?: string
): Promise<EffectStyle | null> {
  if (!("effects" in node) || !node.effects || node.effects.length === 0) {
    return null;
  }

  if (!nodeSupportsEffectStyles(node)) {
    return null;
  }

  const effectNode = node as EffectStyleCapableNode;
  const currentKey = createEffectStackKey(effectNode.effects);

  if (expectedKey && currentKey !== expectedKey) {
    console.warn(
      `Effect stack changed since analysis for node ${node.name}. Proceeding with current effects.`
    );
  }

  if (effectNode.effectStyleId) {
    return null;
  }

  const style = await ensureEffectStyleForEffects(
    preferredName,
    effectNode.effects
  );
  await assignEffectStyleId(effectNode, style.id);
  return style;
}

