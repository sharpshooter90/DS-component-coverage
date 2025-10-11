import React, { useState, useEffect } from "react";
import { linearService } from "../utils/linearService";
import type { LinearConfig, LinearTeam } from "../types";

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
  const [linearConfig, setLinearConfig] = useState<LinearConfig>({
    enabled: false,
    apiKey: "",
    apiEndpoint: "http://localhost:3000",
    teamId: "",
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    // Request config from plugin storage
    linearService.requestConfig();

    // Listen for config loaded message
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === "linear-config-loaded" && msg.config) {
        linearService.loadConfig(msg.config);
        setLinearConfig(msg.config);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleVerifyApiKey = async () => {
    if (!linearConfig.apiKey || !linearConfig.apiEndpoint) {
      setVerificationStatus({
        type: "error",
        message: "Please enter both API key and endpoint",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationStatus({ type: null, message: "" });

    const result = await linearService.verifyApiKey(
      linearConfig.apiKey,
      linearConfig.apiEndpoint
    );

    if (result.success) {
      setVerificationStatus({
        type: "success",
        message: `✓ Connected as ${result.user?.name || result.user?.email}`,
      });

      // Set config first, then fetch teams
      linearService.setConfig(linearConfig);

      // Fetch teams using the API directly
      try {
        const response = await fetch(
          `${linearConfig.apiEndpoint}/api/linear/teams`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${linearConfig.apiKey}`,
            },
          }
        );

        const teamsData = await response.json();
        if (teamsData.success && teamsData.teams) {
          setTeams(teamsData.teams);
          console.log("Teams loaded:", teamsData.teams);
        } else {
          console.error("Failed to load teams:", teamsData.error);
        }
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    } else {
      setVerificationStatus({
        type: "error",
        message: result.error || "Failed to verify API key",
      });
    }

    setIsVerifying(false);
  };

  const handleSaveLinearConfig = () => {
    linearService.setConfig(linearConfig);
    setVerificationStatus({
      type: "success",
      message: "Linear configuration saved!",
    });
  };

  const handleToggleLinear = (enabled: boolean) => {
    const updated = { ...linearConfig, enabled };
    setLinearConfig(updated);
    linearService.setConfig(updated);
  };

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
        <h3 className="settings-title">Linear Integration</h3>

        <div className="setting-item">
          <div className="setting-info">
            <div className="setting-label">Enable Linear Integration</div>
            <div className="setting-description">
              Automatically create Linear issues from coverage reports
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={linearConfig.enabled}
              onChange={(e) => handleToggleLinear(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {linearConfig.enabled && (
          <>
            <div style={{ marginTop: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                API Endpoint
              </label>
              <input
                type="text"
                value={linearConfig.apiEndpoint}
                onChange={(e) =>
                  setLinearConfig({
                    ...linearConfig,
                    apiEndpoint: e.target.value,
                  })
                }
                placeholder="https://your-proxy.vercel.app"
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "11px",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  background: "var(--background)",
                  color: "var(--text-primary)",
                }}
              />
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text-secondary)",
                  marginTop: "4px",
                }}
              >
                Use http://localhost:3000 for local development
              </div>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                Linear API Key
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showApiKey ? "text" : "password"}
                  value={linearConfig.apiKey}
                  onChange={(e) =>
                    setLinearConfig({ ...linearConfig, apiKey: e.target.value })
                  }
                  placeholder="lin_api_..."
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "11px",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    background: "var(--background)",
                    color: "var(--text-primary)",
                    paddingRight: "60px",
                  }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{
                    position: "absolute",
                    right: "6px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    padding: "2px 6px",
                    fontSize: "10px",
                    border: "none",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text-secondary)",
                  marginTop: "4px",
                }}
              >
                Get your API key from{" "}
                <a
                  href="https://linear.app/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent)" }}
                >
                  Linear Settings
                </a>
              </div>
            </div>

            <button
              onClick={handleVerifyApiKey}
              disabled={isVerifying || !linearConfig.apiKey}
              style={{
                marginTop: "12px",
                width: "100%",
                padding: "8px 12px",
                fontSize: "11px",
                fontWeight: 600,
                border: "1px solid var(--border)",
                borderRadius: "4px",
                background: "var(--background)",
                color: "var(--text-primary)",
                cursor: isVerifying ? "not-allowed" : "pointer",
                opacity: isVerifying ? 0.6 : 1,
              }}
            >
              {isVerifying ? "Verifying..." : "Verify Connection"}
            </button>

            {verificationStatus.type && (
              <div
                style={{
                  marginTop: "8px",
                  padding: "8px",
                  fontSize: "10px",
                  borderRadius: "4px",
                  background:
                    verificationStatus.type === "success"
                      ? "rgba(0, 200, 100, 0.1)"
                      : "rgba(255, 60, 60, 0.1)",
                  color:
                    verificationStatus.type === "success"
                      ? "rgb(0, 200, 100)"
                      : "rgb(255, 60, 60)",
                }}
              >
                {verificationStatus.message}
              </div>
            )}

            {teams.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 600,
                    marginBottom: "6px",
                  }}
                >
                  Team
                </label>
                <select
                  value={linearConfig.teamId}
                  onChange={(e) =>
                    setLinearConfig({ ...linearConfig, teamId: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: "11px",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    background: "var(--background)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="">Select a team...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.key})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {linearConfig.teamId && (
              <>
                <div style={{ marginTop: "12px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "11px",
                      fontWeight: 600,
                      marginBottom: "6px",
                    }}
                  >
                    Assignee Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={linearConfig.assigneeEmail || ""}
                    onChange={(e) =>
                      setLinearConfig({
                        ...linearConfig,
                        assigneeEmail: e.target.value,
                      })
                    }
                    placeholder="designer@company.com"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      fontSize: "11px",
                      border: "1px solid var(--border)",
                      borderRadius: "4px",
                      background: "var(--background)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <button
                  onClick={handleSaveLinearConfig}
                  disabled={!linearConfig.teamId}
                  style={{
                    marginTop: "12px",
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: "11px",
                    fontWeight: 600,
                    border: "none",
                    borderRadius: "4px",
                    background: "var(--accent)",
                    color: "white",
                    cursor: linearConfig.teamId ? "pointer" : "not-allowed",
                    opacity: linearConfig.teamId ? 1 : 0.6,
                  }}
                >
                  Save Configuration
                </button>
              </>
            )}
          </>
        )}
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
