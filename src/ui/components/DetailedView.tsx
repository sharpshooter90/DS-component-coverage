import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { cn } from "../lib/utils";

interface DetailedViewProps {
  analysis: {
    details: {
      nonCompliantLayers: Array<{
        id: string;
        name: string;
        type: string;
        issues: string[];
        path: string;
        rawProperties?: any;
        analysis?: any;
      }>;
    };
  };
  onSelectLayer: (layerId: string) => void;
  onFixLayer?: (
    layers: Array<{
      id: string;
      name: string;
      type: string;
      issues: string[];
      path: string;
    }>
  ) => void;
  onExportDebug?: () => void;
  onRefresh?: () => void;
}

const DetailedView: React.FC<DetailedViewProps> = ({
  analysis,
  onSelectLayer,
  onFixLayer,
  onExportDebug,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"severity" | "name" | "type">(
    "severity"
  );

  const { nonCompliantLayers } = analysis.details;

  const hasFixableIssue = (issues: string[]) => {
    return issues.some(
      (issue) =>
        issue.includes("🔴") &&
        (issue.toLowerCase().includes("color") ||
          issue.toLowerCase().includes("fill") ||
          issue.toLowerCase().includes("stroke") ||
          issue.toLowerCase().includes("token") ||
          issue.toLowerCase().includes("text") ||
          issue.toLowerCase().includes("spacing") ||
          issue.toLowerCase().includes("corner") ||
          issue.toLowerCase().includes("padding") ||
          issue.toLowerCase().includes("effect"))
    );
  };

  const isCompliant = (issues: string[]) => {
    // Layer is compliant if it has no critical (🔴) or warning (⚠️) issues
    return !issues.some(
      (issue) => issue.includes("🔴") || issue.includes("⚠️")
    );
  };

  const getSeverityScore = (issues: string[]) => {
    // Calculate severity: higher score = more severe
    // Non-compliant with critical issues = highest priority
    let score = 0;
    const criticalCount = issues.filter((issue) => issue.includes("🔴")).length;
    const warningCount = issues.filter((issue) => issue.includes("⚠️")).length;

    // Critical issues: 100 points each
    score += criticalCount * 100;
    // Warning issues: 10 points each
    score += warningCount * 10;
    // Compliant (only ✅): -1000 points (lowest priority)
    if (isCompliant(issues)) {
      score = -1000;
    }

    return score;
  };

  const layersWithFixableIssues = nonCompliantLayers.filter((layer) =>
    hasFixableIssue(layer.issues)
  );

  const toggleLayerSelection = (layerId: string) => {
    const newSelection = new Set(selectedLayers);
    if (newSelection.has(layerId)) {
      newSelection.delete(layerId);
    } else {
      newSelection.add(layerId);
    }
    setSelectedLayers(newSelection);
  };

  const selectAll = () => {
    const allFixableLayerIds = filteredLayers
      .filter((layer) => hasFixableIssue(layer.issues))
      .map((layer) => layer.id);
    setSelectedLayers(new Set(allFixableLayerIds));
  };

  const deselectAll = () => {
    setSelectedLayers(new Set());
  };

  const handleBulkFix = () => {
    const layersToFix = nonCompliantLayers.filter((layer) =>
      selectedLayers.has(layer.id)
    );
    if (onFixLayer && layersToFix.length > 0) {
      onFixLayer(layersToFix);
      setSelectedLayers(new Set());
    }
  };

  // Get unique types for filter
  const uniqueTypes = Array.from(
    new Set(nonCompliantLayers.map((layer) => layer.type))
  );

  // Filter and sort layers
  const filteredLayers = nonCompliantLayers
    .filter((layer) => {
      const matchesSearch =
        layer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        layer.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        layer.issues.some((issue) =>
          issue.toLowerCase().includes(searchTerm.toLowerCase())
        );
      const matchesType = filterType === "all" || layer.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "severity") {
        // Sort by severity: highest severity first
        return getSeverityScore(b.issues) - getSeverityScore(a.issues);
      } else if (sortBy === "name") {
        // Sort alphabetically by name
        return a.name.localeCompare(b.name);
      } else if (sortBy === "type") {
        // Sort by type, then by name
        const typeCompare = a.type.localeCompare(b.type);
        return typeCompare !== 0 ? typeCompare : a.name.localeCompare(b.name);
      }
      return 0;
    });

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm">
                📋 Non-Compliant Layers ({nonCompliantLayers.length})
              </CardTitle>
              {layersWithFixableIssues.length > 0 && (
                <Badge variant="warning" className="text-xs">
                  {layersWithFixableIssues.length} fixable
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              {layersWithFixableIssues.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  {selectedLayers.size > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={deselectAll}>
                        Deselect ({selectedLayers.size})
                      </Button>
                      <Button size="sm" onClick={handleBulkFix}>
                        🔧 Fix {selectedLayers.size} Layer
                        {selectedLayers.size > 1 ? "s" : ""}
                      </Button>
                    </>
                  )}
                </>
              )}
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  title="Refresh compliance status after applying fixes"
                >
                  🔄 Refresh
                </Button>
              )}
              {onExportDebug && (
                <Button variant="outline" size="sm" onClick={onExportDebug}>
                  💾 Export Debug
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 flex-wrap">
            <Input
              placeholder="🔍 Search by name, path, or issue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-48"
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Types ({nonCompliantLayers.length})
                </SelectItem>
                {uniqueTypes.map((type) => {
                  const count = nonCompliantLayers.filter(
                    (l) => l.type === type
                  ).length;
                  return (
                    <SelectItem key={type} value={type}>
                      {type} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as any)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">
                  Sort: Severity (Critical First)
                </SelectItem>
                <SelectItem value="name">Sort: Name (A-Z)</SelectItem>
                <SelectItem value="type">Sort: Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {filteredLayers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No non-compliant layers found
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredLayers.map((layer) => (
            <Card
              key={layer.id}
              className={cn(
                "transition-all duration-200 hover:shadow-md",
                selectedLayers.has(layer.id) &&
                  "ring-2 ring-primary bg-primary/5"
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {hasFixableIssue(layer.issues) && (
                    <Checkbox
                      checked={selectedLayers.has(layer.id)}
                      onCheckedChange={() => toggleLayerSelection(layer.id)}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-semibold truncate">
                        {layer.name}
                      </h4>
                      <Badge
                        variant={
                          isCompliant(layer.issues) ? "success" : "destructive"
                        }
                        className="text-xs shrink-0"
                      >
                        {isCompliant(layer.issues)
                          ? "✅ Compliant"
                          : "❌ Non-Compliant"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {layer.type}
                      </Badge>
                      <span className="truncate">{layer.path}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Issues:
                      </div>
                      <div className="space-y-1">
                        {layer.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "text-xs p-2 rounded border-l-2",
                              issue.includes("🔴")
                                ? "border-l-red-500 bg-red-50 text-red-700"
                                : issue.includes("⚠️")
                                ? "border-l-yellow-500 bg-yellow-50 text-yellow-700"
                                : "border-l-green-500 bg-green-50 text-green-700"
                            )}
                          >
                            {issue}
                          </div>
                        ))}
                      </div>
                    </div>

                    {(layer.rawProperties || layer.analysis) && (
                      <div className="mt-3 space-y-2">
                        {layer.rawProperties && (
                          <details className="group">
                            <summary className="text-xs text-primary cursor-pointer hover:text-primary/80 font-medium">
                              🔍 View Raw Properties
                            </summary>
                            <div className="mt-2 p-3 bg-muted rounded-md">
                              <pre className="text-xs font-mono overflow-x-auto">
                                {JSON.stringify(layer.rawProperties, null, 2)}
                              </pre>
                            </div>
                          </details>
                        )}

                        {layer.analysis && (
                          <details className="group">
                            <summary className="text-xs text-primary cursor-pointer hover:text-primary/80 font-medium">
                              📊 View Analysis Results
                            </summary>
                            <div className="mt-2 p-3 bg-muted rounded-md">
                              <pre className="text-xs font-mono overflow-x-auto">
                                {JSON.stringify(layer.analysis, null, 2)}
                              </pre>
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectLayer(layer.id)}
                      title="Select in Figma"
                    >
                      📍 Select
                    </Button>
                    {onFixLayer && hasFixableIssue(layer.issues) && (
                      <Button
                        size="sm"
                        onClick={() => onFixLayer([layer])}
                        title="Fix this layer"
                      >
                        🔧 Fix
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {filteredLayers.length > 0 && (
        <div className="text-center text-xs text-muted-foreground mt-4">
          Showing {filteredLayers.length} of {nonCompliantLayers.length}{" "}
          non-compliant layers
        </div>
      )}
    </div>
  );
};

export default DetailedView;
