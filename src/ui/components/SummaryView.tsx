import React, { useState, useEffect } from "react";
import { linearService } from "../utils/linearService";
import type { CoverageAnalysis, LinearIssue, LinearConfig } from "../types";

interface SummaryViewProps {
  analysis: CoverageAnalysis;
  onExport: (format: "json" | "csv") => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ analysis, onExport }) => {
  const { summary, details } = analysis;
  const [showPerfect, setShowPerfect] = React.useState<boolean>(false);
  const [isSendingToLinear, setIsSendingToLinear] = useState(false);
  const [linearStatus, setLinearStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
    issue?: LinearIssue;
  }>({ type: null, message: "" });
  const [assigneeEmail, setAssigneeEmail] = useState("");
  const [showAssigneeSection, setShowAssigneeSection] = useState(false);
  const [teamMembers, setTeamMembers] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
  const [linearConfig, setLinearConfig] = useState<LinearConfig | null>(null);

  // Load Linear config on component mount
  useEffect(() => {
    console.log("📥 SummaryView: Requesting Linear config...");
    linearService.requestConfig();

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === "linear-config-loaded") {
        console.log("📥 SummaryView: Received Linear config:", msg.config);
        if (msg.config) {
          linearService.loadConfig(msg.config);
          setLinearConfig(msg.config);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const sortedEntries = React.useMemo(
    () =>
      Object.entries(details.byType)
        .sort((a, b) => a[1].percentage - b[1].percentage)
        .filter(([, stats]) => showPerfect || stats.percentage < 100),
    [details.byType, showPerfect]
  );

  const getScoreClass = (score: number) => {
    if (score >= 80) return "high";
    if (score >= 50) return "medium";
    return "low";
  };

  const handleLoadTeamMembers = async () => {
    const config = linearService.getConfig();
    console.log("🔍 Loading team members...");
    console.log("📋 Linear config:", config);

    if (!config || !config.teamId) {
      console.warn("⚠️ No Linear config or team ID found");
      return;
    }

    setLoadingTeamMembers(true);
    try {
      console.log("🚀 Fetching users from Linear API...");
      console.log("🔗 API Endpoint:", config.apiEndpoint);
      console.log("🏢 Team ID:", config.teamId);

      const result = await linearService.getUsers();

      console.log("✅ Linear API Response:", result);

      if (result.success && result.users) {
        console.log(
          `👥 Found ${result.users.length} team members:`,
          result.users
        );
        setTeamMembers(result.users);
      } else {
        console.error("❌ Failed to load team members:", result.error);
      }
    } catch (error) {
      console.error("💥 Error loading team members:", error);
    } finally {
      setLoadingTeamMembers(false);
      console.log("✔️ Team members loading complete");
    }
  };

  const handleToggleAssigneeSection = async () => {
    const newState = !showAssigneeSection;
    setShowAssigneeSection(newState);

    // Load team members when opening the section
    if (newState && teamMembers.length === 0) {
      await handleLoadTeamMembers();
    }
  };

  const handleSendToLinear = async () => {
    const config = linearService.getConfig();

    if (!config || !config.enabled) {
      setLinearStatus({
        type: "error",
        message:
          "Linear integration not configured. Please configure in Settings.",
      });
      return;
    }

    if (!config.teamId) {
      setLinearStatus({
        type: "error",
        message: "Please select a team in Linear settings.",
      });
      return;
    }

    setIsSendingToLinear(true);
    setLinearStatus({ type: null, message: "" });

    try {
      // Get Figma file info from parent
      parent.postMessage({ pluginMessage: { type: "get-file-info" } }, "*");

      // Wait for file info response
      const fileInfo = await new Promise<{
        fileKey: string;
        nodeId: string;
      }>((resolve) => {
        const handler = (event: MessageEvent) => {
          if (event.data.pluginMessage?.type === "file-info") {
            window.removeEventListener("message", handler);
            resolve(event.data.pluginMessage.data);
          }
        };
        window.addEventListener("message", handler);

        // Timeout after 5 seconds
        setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve({ fileKey: "", nodeId: "" });
        }, 5000);
      });

      const result = await linearService.createIssue(
        analysis,
        fileInfo.fileKey,
        fileInfo.nodeId,
        assigneeEmail
      );

      if (result.success && result.issue) {
        setLinearStatus({
          type: "success",
          message: `Issue created successfully!`,
          issue: result.issue,
        });

        // Create canvas report with Linear link
        parent.postMessage(
          {
            pluginMessage: {
              type: "create-canvas-report",
              analysis: analysis,
              linearIssue: result.issue,
              assigneeEmail: assigneeEmail,
            },
          },
          "*"
        );
      } else {
        setLinearStatus({
          type: "error",
          message: result.error || "Failed to create Linear issue",
        });
      }
    } catch (error) {
      setLinearStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSendingToLinear(false);
    }
  };

  return (
    <div className="summary-view">
      <div className="score-card">
        <div className={`score-value ${getScoreClass(summary.overallScore)}`}>
          {summary.overallScore}%
        </div>
        <div className="score-label">Design System Compliance</div>
        <div className="score-sublabel">{summary.analyzedFrameName}</div>
      </div>

      <div className="metrics-grid">
        <div className="metric">
          <div className="metric-label">Component Coverage</div>
          <div
            className={`metric-value ${getScoreClass(
              summary.componentCoverage
            )}`}
          >
            {summary.componentCoverage}%
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Token Coverage</div>
          <div
            className={`metric-value ${getScoreClass(summary.tokenCoverage)}`}
          >
            {summary.tokenCoverage}%
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Style Coverage</div>
          <div
            className={`metric-value ${getScoreClass(summary.styleCoverage)}`}
          >
            {summary.styleCoverage}%
          </div>
        </div>
      </div>

      <div className="type-breakdown">
        <div className="breakdown-header">
          <h3 className="breakdown-title">Coverage by Element Type</h3>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={showPerfect}
              onChange={(e) => setShowPerfect(e.target.checked)}
            />
            Show 100% items
          </label>
        </div>
        {sortedEntries.map(([type, stats]) => (
          <div key={type} className="breakdown-item">
            <div className="breakdown-name">{type}</div>
            <div className="breakdown-stats">
              <div className="breakdown-count">
                {stats.compliant} / {stats.total}
              </div>
              <div
                className={`breakdown-percentage ${getScoreClass(
                  stats.percentage
                )}`}
              >
                {stats.percentage}%
              </div>
            </div>
            <div className="breakdown-actions">
              <button className="btn btn-small btn-secondary" disabled>
                📦 Select All
              </button>
              <button className="btn btn-small btn-primary" disabled>
                ⚡ Fix Layer Type
              </button>
            </div>
          </div>
        ))}
      </div>

      {linearConfig && linearConfig.enabled && (
        <div className="linear-section">
          <h3 className="export-title">Linear Integration</h3>

          <button
            onClick={handleToggleAssigneeSection}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "11px",
              fontWeight: 600,
              border: "1px solid var(--border)",
              borderRadius: "4px",
              background: "var(--background)",
              color: "var(--text-primary)",
              cursor: "pointer",
              marginBottom: "8px",
            }}
          >
            {showAssigneeSection
              ? "Hide Assignee Options"
              : "Show Assignee Options"}
          </button>

          {showAssigneeSection && (
            <div
              style={{
                marginBottom: "12px",
                padding: "12px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                background: "var(--background-secondary)",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 600,
                  marginBottom: "6px",
                  color: "var(--text-primary)",
                }}
              >
                Assign to (Optional)
              </label>

              {loadingTeamMembers ? (
                <div
                  style={{
                    padding: "8px",
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                  }}
                >
                  Loading team members...
                </div>
              ) : teamMembers.length > 0 ? (
                <select
                  value={assigneeEmail}
                  onChange={(e) => setAssigneeEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "11px",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    background: "var(--background)",
                    color: "var(--text-primary)",
                    marginBottom: "6px",
                  }}
                >
                  <option value="">-- Select team member --</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.email}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="email"
                  value={assigneeEmail}
                  onChange={(e) => setAssigneeEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    fontSize: "11px",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    background: "var(--background)",
                    color: "var(--text-primary)",
                    marginBottom: "6px",
                  }}
                />
              )}

              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text-secondary)",
                }}
              >
                {teamMembers.length > 0
                  ? "Select a team member or leave unassigned"
                  : "Enter email manually or leave empty to create unassigned issue"}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSendToLinear}
            disabled={isSendingToLinear}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {isSendingToLinear ? "Creating Issue..." : "📋 Assign this report"}
          </button>

          {linearStatus.type && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                fontSize: "12px",
                borderRadius: "6px",
                background:
                  linearStatus.type === "success"
                    ? "rgba(0, 200, 100, 0.1)"
                    : "rgba(255, 60, 60, 0.1)",
                color:
                  linearStatus.type === "success"
                    ? "rgb(0, 200, 100)"
                    : "rgb(255, 60, 60)",
              }}
            >
              {linearStatus.message}
              {linearStatus.issue && (
                <div style={{ marginTop: "8px" }}>
                  <a
                    href={linearStatus.issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "rgb(0, 200, 100)",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                  >
                    {linearStatus.issue.identifier}: {linearStatus.issue.title}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="export-section">
        <h3 className="export-title">Export Results</h3>
        <div className="export-buttons">
          <button
            className="btn btn-secondary"
            onClick={() => onExport("json")}
          >
            Export JSON
          </button>
          <button className="btn btn-secondary" onClick={() => onExport("csv")}>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryView;
