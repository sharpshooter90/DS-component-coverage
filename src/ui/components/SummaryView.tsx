import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

interface SummaryViewProps {
  analysis: {
    summary: {
      overallScore: number;
      componentCoverage: number;
      tokenCoverage: number;
      styleCoverage: number;
      totalLayers: number;
      compliantLayers: number;
      analyzedFrameName: string;
    };
    details: {
      byType: Record<
        string,
        { total: number; compliant: number; percentage: number }
      >;
    };
  };
  onExport: (format: "json" | "csv") => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ analysis, onExport }) => {
  const { summary, details } = analysis;

  const getScoreVariant = (
    score: number
  ): "success" | "warning" | "destructive" => {
    if (score >= 80) return "success";
    if (score >= 50) return "warning";
    return "destructive";
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <CardHeader className="pb-2">
          <div
            className={cn(
              "text-4xl font-bold mb-2",
              getScoreColor(summary.overallScore)
            )}
          >
            {summary.overallScore}%
          </div>
          <CardTitle className="text-sm">Design System Compliance</CardTitle>
          <CardDescription className="text-xs">
            {summary.analyzedFrameName}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">
              Component Coverage
            </div>
            <div
              className={cn(
                "text-lg font-semibold",
                getScoreColor(summary.componentCoverage)
              )}
            >
              {summary.componentCoverage}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">
              Token Coverage
            </div>
            <div
              className={cn(
                "text-lg font-semibold",
                getScoreColor(summary.tokenCoverage)
              )}
            >
              {summary.tokenCoverage}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">
              Style Coverage
            </div>
            <div
              className={cn(
                "text-lg font-semibold",
                getScoreColor(summary.styleCoverage)
              )}
            >
              {summary.styleCoverage}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Coverage by Element Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(details.byType)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([type, stats]) => (
              <div
                key={type}
                className="flex justify-between items-center py-1 border-b border-border last:border-b-0"
              >
                <div className="text-sm font-medium">{type}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {stats.compliant} / {stats.total}
                  </span>
                  <Badge
                    variant={getScoreVariant(stats.percentage)}
                    className="text-xs"
                  >
                    {stats.percentage}%
                  </Badge>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Export Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onExport("json")}
            >
              Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExport("csv")}>
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SummaryView;
