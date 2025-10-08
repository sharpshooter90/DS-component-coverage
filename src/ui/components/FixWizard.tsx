import React, { useState, useEffect } from "react";
import { ColorData, VariableBinding, RGB } from "../types";

interface FixWizardProps {
  layer: { id: string; name: string; issues: string[] };
  onClose: () => void;
}

const FixWizard: React.FC<FixWizardProps> = ({ layer, onClose }) => {
  const [step, setStep] = useState(1);
  const [namingConfig, setNamingConfig] = useState({
    prefix: "color",
    casing: "kebab-case" as "kebab-case" | "camelCase" | "snake_case",
  });
  const [colors, setColors] = useState<ColorData[]>([]);
  const [variableNames, setVariableNames] = useState<Record<number, string>>(
    {}
  );

  useEffect(() => {
    // Request colors from plugin
    window.parent.postMessage(
      { pluginMessage: { type: "get-layer-colors", layerId: layer.id } },
      "*"
    );

    // Listen for color data response
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg.type === "layer-colors" && msg.layerId === layer.id) {
        setColors(msg.colors);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [layer.id]);

  const rgbToHex = (color: RGB): string => {
    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  };

  const rgbToCss = (color: RGB): string => {
    return `rgb(${Math.round(color.r * 255)}, ${Math.round(
      color.g * 255
    )}, ${Math.round(color.b * 255)})`;
  };

  const applyCasing = (str: string, casing: string): string => {
    // Remove special characters and split into words
    const words = str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w);

    switch (casing) {
      case "kebab-case":
        return words.join("-");
      case "camelCase":
        return words
          .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
          .join("");
      case "snake_case":
        return words.join("_");
      default:
        return words.join("-");
    }
  };

  const generateVariableName = (color: RGB, index: number): string => {
    const hex = rgbToHex(color).replace("#", "");
    const base = `${namingConfig.prefix} ${layer.name} ${hex.slice(0, 6)}`;
    return applyCasing(base, namingConfig.casing);
  };

  const handleApply = () => {
    const bindings: VariableBinding[] = colors.map((colorData, idx) => ({
      variableName:
        variableNames[idx] || generateVariableName(colorData.color, idx),
      color: colorData.color,
      type: colorData.type,
      index: colorData.index,
    }));

    window.parent.postMessage(
      {
        pluginMessage: {
          type: "apply-color-variables",
          layerId: layer.id,
          variableBindings: bindings,
        },
      },
      "*"
    );
  };

  const canProceedToStep3 = colors.length > 0;

  return (
    <div className="fix-wizard-overlay" onClick={onClose}>
      <div className="fix-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h3>Fix Color Variables - {layer.name}</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {step === 1 && (
          <div className="wizard-step">
            <h4>Step 1: Choose Variable Source</h4>
            <div className="option-card active">
              <input type="radio" checked readOnly />
              <div className="option-content">
                <label>Create New Variables</label>
                <p>Generate variables with naming convention</p>
              </div>
            </div>
            <div className="option-card disabled">
              <input type="radio" disabled />
              <div className="option-content">
                <label>From Existing Library</label>
                <p className="coming-soon">Coming Soon</p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <h4>Step 2: Configure Naming Convention</h4>

            <div className="form-group">
              <label>Prefix</label>
              <input
                className="filter-input"
                value={namingConfig.prefix}
                onChange={(e) =>
                  setNamingConfig({ ...namingConfig, prefix: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label>Casing</label>
              <select
                className="filter-input"
                value={namingConfig.casing}
                onChange={(e) =>
                  setNamingConfig({
                    ...namingConfig,
                    casing: e.target.value as any,
                  })
                }
              >
                <option value="kebab-case">kebab-case</option>
                <option value="camelCase">camelCase</option>
                <option value="snake_case">snake_case</option>
              </select>
            </div>

            {colors.length > 0 && (
              <div className="preview">
                <strong>Preview:</strong>
                <code>{generateVariableName(colors[0].color, 0)}</code>
              </div>
            )}

            {colors.length === 0 && (
              <div className="info-message">Loading colors from layer...</div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step">
            <h4>Step 3: Review & Apply</h4>
            {colors.length === 0 ? (
              <div className="info-message">No colors found on this layer</div>
            ) : (
              colors.map((colorData, idx) => (
                <div key={idx} className="variable-mapping">
                  <div
                    className="color-preview"
                    style={{ background: rgbToCss(colorData.color) }}
                  />
                  <input
                    className="filter-input"
                    value={
                      variableNames[idx] ||
                      generateVariableName(colorData.color, idx)
                    }
                    onChange={(e) =>
                      setVariableNames({
                        ...variableNames,
                        [idx]: e.target.value,
                      })
                    }
                  />
                  <span className="color-type">{colorData.type}</span>
                </div>
              ))
            )}
          </div>
        )}

        <div className="wizard-footer">
          {step > 1 && (
            <button
              className="btn btn-secondary"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              className="btn btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !canProceedToStep3}
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={colors.length === 0}
            >
              Apply Fix
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FixWizard;
