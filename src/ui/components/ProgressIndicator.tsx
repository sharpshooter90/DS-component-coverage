import React from "react";

interface ProgressIndicatorProps {
  progress: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  return (
    <div className="progress-container">
      <div className="progress-text">
        Analyzing design system coverage...
        {progress > 0 && ` (${progress} layers scanned)`}
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: "100%" }}></div>
      </div>
    </div>
  );
};

export default ProgressIndicator;
