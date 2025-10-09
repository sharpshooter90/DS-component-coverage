import React from "react";
import { Card, CardContent } from "./ui/card";
import { Progress } from "./ui/progress";

interface ProgressIndicatorProps {
  progress: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  return (
    <Card className="m-4">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-2 text-center">
          Analyzing design system coverage...
          {progress > 0 && ` (${progress} layers scanned)`}
        </div>
        <Progress value={100} className="h-1" />
      </CardContent>
    </Card>
  );
};

export default ProgressIndicator;
