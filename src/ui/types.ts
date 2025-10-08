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
