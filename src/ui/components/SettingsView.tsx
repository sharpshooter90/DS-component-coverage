import React from "react";

interface Settings {
  checkComponents: boolean;
  checkTokens: boolean;
  checkStyles: boolean;
  allowLocalStyles: boolean;
  ignoredTypes: string[];
}

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (settings: Partial<Settings>) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  return (
    <div className="settings-view">
      <div className="settings-section">
        <h3 className="settings-title">Coverage Checks</h3>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Component Coverage</div>
            <div className="setting-description">
              Check if layers use library components instead of local elements
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.checkComponents}
              onChange={(e) =>
                onUpdateSettings({ checkComponents: e.target.checked })
              }
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Token Coverage</div>
            <div className="setting-description">
              Check if layers use design tokens for colors, typography, and
              spacing
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.checkTokens}
              onChange={(e) =>
                onUpdateSettings({ checkTokens: e.target.checked })
              }
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Style Coverage</div>
            <div className="setting-description">
              Check if layers use shared Figma styles
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.checkStyles}
              onChange={(e) =>
                onUpdateSettings({ checkStyles: e.target.checked })
              }
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">Analysis Options</h3>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Allow Local Styles</div>
            <div className="setting-description">
              Don't flag layers using local styles as non-compliant
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.allowLocalStyles}
              onChange={(e) =>
                onUpdateSettings({ allowLocalStyles: e.target.checked })
              }
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">About</h3>
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
            lineHeight: "1.6",
          }}
        >
          This plugin analyzes your designs for design system compliance. It
          checks component usage, design token adoption, and shared style usage
          to help maintain consistency across your designs.
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-secondary)",
            lineHeight: "1.6",
            marginTop: "12px",
          }}
        >
          <strong>How to use:</strong>
          <br />
          1. Select a frame, component, or instance
          <br />
          2. Click "Analyze Selection"
          <br />
          3. Review the summary and detailed report
          <br />
          4. Fix non-compliant layers and re-run the analysis
        </p>
      </div>
    </div>
  );
};

export default SettingsView;
