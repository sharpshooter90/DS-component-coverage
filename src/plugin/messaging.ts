/// <reference types="@figma/plugin-typings" />

function serializeSymbol(value: symbol): string {
  if (value === figma.mixed) {
    return "figma.mixed";
  }
  const symbolString = value.toString();
  const match = /^Symbol\((.*)\)$/.exec(symbolString);
  if (match && match[1] !== undefined && match[1].length > 0) {
    return `Symbol(${match[1]})`;
  }
  return symbolString;
}

export function sanitizeForUI(
  value: any,
  seen: WeakMap<object, any> = new WeakMap()
): any {
  if (typeof value === "symbol") {
    return serializeSymbol(value);
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value as any);
  }

  if (value instanceof Map) {
    const mapResult: Record<string, any> = {};
    value.forEach((mapValue, mapKey) => {
      mapResult[String(mapKey)] = sanitizeForUI(mapValue, seen);
    });
    return mapResult;
  }

  if (value instanceof Set) {
    const setResult: any[] = [];
    value.forEach((setValue) => {
      setResult.push(sanitizeForUI(setValue, seen));
    });
    return setResult;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const arr: any[] = [];
    seen.set(value, arr);
    value.forEach((item) => {
      arr.push(sanitizeForUI(item, seen));
    });
    return arr;
  }

  const output: Record<string, any> = {};
  seen.set(value, output);

  Reflect.ownKeys(value).forEach((key) => {
    const rawValue = (value as any)[key as any];
    const sanitizedKey =
      typeof key === "symbol"
        ? `[${serializeSymbol(key as symbol)}]`
        : (key as string);
    output[sanitizedKey] = sanitizeForUI(rawValue, seen);
  });

  return output;
}

export function postMessageToUI(message: any) {
  figma.ui.postMessage(sanitizeForUI(message));
}

