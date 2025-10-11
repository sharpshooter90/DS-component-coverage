import type {
  LinearConfig,
  LinearTeam,
  LinearUser,
  LinearProject,
  LinearIssue,
  CoverageAnalysis,
} from "../types";

class LinearService {
  private config: LinearConfig | null = null;
  private storageKey = "linearConfig";

  setConfig(config: LinearConfig) {
    this.config = config;
    // Store config by sending to plugin
    parent.postMessage(
      {
        pluginMessage: {
          type: "store-linear-config",
          config: config,
        },
      },
      "*"
    );
  }

  getConfig(): LinearConfig | null {
    return this.config;
  }

  loadConfig(config: LinearConfig) {
    // Called when config is loaded from plugin storage
    this.config = config;
  }

  clearConfig() {
    this.config = null;
    parent.postMessage(
      {
        pluginMessage: {
          type: "clear-linear-config",
        },
      },
      "*"
    );
  }

  // Request config from plugin storage on init
  requestConfig() {
    parent.postMessage(
      {
        pluginMessage: {
          type: "get-linear-config",
        },
      },
      "*"
    );
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    if (!this.config) {
      return { success: false, error: "Linear not configured" };
    }

    try {
      const url = `${this.config.apiEndpoint}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        };
      }

      return { success: true, data };
    } catch (error) {
      console.error("Linear API request failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async verifyApiKey(
    apiKey: string,
    apiEndpoint: string
  ): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const response = await fetch(`${apiEndpoint}/api/linear/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return { success: false, error: data.error || "Invalid API key" };
      }

      return { success: true, user: data.user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  async getTeams(): Promise<{
    success: boolean;
    teams?: LinearTeam[];
    error?: string;
  }> {
    return this.request<{ teams: LinearTeam[] }>("/api/linear/teams");
  }

  async getUsers(): Promise<{
    success: boolean;
    users?: LinearUser[];
    error?: string;
  }> {
    return this.request<{ users: LinearUser[] }>("/api/linear/users");
  }

  async getProjects(teamId: string): Promise<{
    success: boolean;
    projects?: LinearProject[];
    error?: string;
  }> {
    return this.request<{ projects: LinearProject[] }>(
      `/api/linear/projects/${teamId}`
    );
  }

  async createIssue(
    analysis: CoverageAnalysis,
    figmaFileKey?: string,
    figmaNodeId?: string,
    assigneeEmail?: string
  ): Promise<{ success: boolean; issue?: LinearIssue; error?: string }> {
    if (!this.config) {
      return { success: false, error: "Linear not configured" };
    }

    const title = `[DS Coverage] ${analysis.summary.analyzedFrameName}`;
    const description = this.formatCoverageReport(analysis);

    const payload = {
      title,
      description,
      teamId: this.config.teamId,
      assigneeEmail: assigneeEmail || this.config.assigneeEmail,
      projectId: this.config.projectId,
      labelIds: this.config.labelIds,
      priority: this.config.priority,
      figmaFileKey,
      figmaNodeId,
    };

    const result = await this.request<{ issue: LinearIssue }>(
      "/api/linear/create-issue",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    if (result.success && result.data) {
      return { success: true, issue: result.data.issue };
    }

    return { success: false, error: result.error };
  }

  private formatCoverageReport(analysis: CoverageAnalysis): string {
    const { summary, details } = analysis;

    const lines: string[] = [];

    // Summary
    lines.push("## 📊 Coverage Summary\n");
    lines.push(`**Overall Score:** ${summary.overallScore}%`);
    lines.push(`**Total Layers:** ${summary.totalLayers}`);
    lines.push(`**Compliant Layers:** ${summary.compliantLayers}`);
    lines.push("");

    // Breakdown
    lines.push("### Coverage Breakdown\n");
    lines.push(`- **Component Coverage:** ${summary.componentCoverage}%`);
    lines.push(`- **Token Coverage:** ${summary.tokenCoverage}%`);
    lines.push(`- **Style Coverage:** ${summary.styleCoverage}%`);
    lines.push("");

    // Type breakdown
    if (Object.keys(details.byType).length > 0) {
      lines.push("### By Layer Type\n");
      Object.entries(details.byType).forEach(([type, data]) => {
        lines.push(
          `- **${type}:** ${data.compliant}/${data.total} (${data.percentage}%)`
        );
      });
      lines.push("");
    }

    // Non-compliant layers
    if (details.nonCompliantLayers.length > 0) {
      lines.push(
        `### ⚠️ Non-Compliant Layers (${details.nonCompliantLayers.length})\n`
      );

      // Group by type
      const grouped = details.nonCompliantLayers.reduce((acc, layer) => {
        if (!acc[layer.type]) acc[layer.type] = [];
        acc[layer.type].push(layer);
        return acc;
      }, {} as Record<string, typeof details.nonCompliantLayers>);

      Object.entries(grouped).forEach(([type, layers]) => {
        lines.push(`**${type}** (${layers.length})`);
        layers.slice(0, 10).forEach((layer) => {
          lines.push(`- \`${layer.name}\``);
          layer.issues.forEach((issue) => {
            lines.push(`  - ${issue}`);
          });
        });
        if (layers.length > 10) {
          lines.push(`  _...and ${layers.length - 10} more_`);
        }
        lines.push("");
      });
    }

    // Auto-layout suggestions
    if (
      details.suggestions?.autoLayout &&
      details.suggestions.autoLayout.length > 0
    ) {
      lines.push(
        `### 💡 Auto-Layout Suggestions (${details.suggestions.autoLayout.length})\n`
      );
      details.suggestions.autoLayout.slice(0, 5).forEach((suggestion) => {
        lines.push(`- \`${suggestion.name}\` (${suggestion.type})`);
      });
      if (details.suggestions.autoLayout.length > 5) {
        lines.push(
          `  _...and ${details.suggestions.autoLayout.length - 5} more_`
        );
      }
      lines.push("");
    }

    // Next steps
    lines.push("### 📝 Next Steps\n");
    lines.push("1. Review non-compliant layers in Figma");
    lines.push(
      "2. Replace with design system components/tokens where possible"
    );
    lines.push("3. Apply shared styles for consistent appearance");
    lines.push("4. Re-run analysis to verify improvements");

    return lines.join("\n");
  }
}

export const linearService = new LinearService();
