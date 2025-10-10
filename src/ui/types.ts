export interface CoverageAnalysis {
  summary: CoverageSummary;
  details: CoverageDetails;
  settings: AnalysisSettings;
}

export interface CoverageSummary {
  overallScore: number;
  componentCoverage: number;
  tokenCoverage: number;
  styleCoverage: number;
  totalLayers: number;
  compliantLayers: number;
  analyzedFrameName: string;
}

export interface CoverageDetails {
  byType: TypeBreakdown;
  nonCompliantLayers: NonCompliantLayer[];
  suggestions?: {
    autoLayout?: AutoLayoutSuggestion[];
  };
}

export interface TypeBreakdown {
  [key: string]: {
    total: number;
    compliant: number;
    percentage: number;
  };
}

export interface NonCompliantLayer {
  id: string;
  name: string;
  type: string;
  issues: string[];
  path: string;
}

export interface AutoLayoutSuggestion {
  id: string;
  name: string;
  type: string;
  path: string;
}

export interface AnalysisSettings {
  checkComponents: boolean;
  checkTokens: boolean;
  checkStyles: boolean;
  allowLocalStyles: boolean;
  ignoredTypes: string[];
}

export type PluginMessage =
  | { type: "analysis-started" }
  | { type: "analysis-progress"; progress: number }
  | { type: "analysis-complete"; data: CoverageAnalysis }
  | { type: "error"; message: string }
  | { type: "settings-updated"; settings: AnalysisSettings };

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ColorData {
  type: "fill" | "stroke";
  color: RGB;
  index: number;
}

export interface VariableBinding {
  variableName: string;
  color: RGB;
  type: "fill" | "stroke";
  index: number;
}

export interface SpacingData {
  type:
    | "cornerRadius"
    | "paddingTop"
    | "paddingRight"
    | "paddingBottom"
    | "paddingLeft"
    | "paddingHorizontal"
    | "paddingVertical"
    | "itemSpacing";
  value: number;
  property: string;
  properties?: string[]; // For grouped properties like paddingHorizontal -> ["paddingLeft", "paddingRight"]
}

export interface SpacingVariableBinding {
  variableName: string;
  value: number;
  type:
    | "cornerRadius"
    | "paddingTop"
    | "paddingRight"
    | "paddingBottom"
    | "paddingLeft"
    | "paddingHorizontal"
    | "paddingVertical"
    | "itemSpacing";
  property: string;
  properties?: string[]; // For grouped properties like paddingHorizontal -> ["paddingLeft", "paddingRight"]
}

export interface EffectData {
  key: string;
  index: number;
  property: string;
  effect: EffectSnapshot;
  effects: EffectSnapshot[];
}

export interface EffectSnapshot {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  radius?: number;
  spread?: number;
  offset?: { x: number; y: number };
  color?: RGBA | null;
  blendMode?: string | null;
  visible: boolean;
  showBehindNode?: boolean;
}

export interface EffectStyleBinding {
  styleName: string;
  key: string;
  index: number;
}

export interface BulkEffectStyleAssignment {
  key: string;
  styleName: string;
}
