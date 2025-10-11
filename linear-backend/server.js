import express from "express";
import { LinearClient } from "@linear/sdk";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  })
);

// Initialize Linear client
const getLinearClient = (apiKey) => {
  const client = new LinearClient({
    apiKey: apiKey || process.env.LINEAR_API_KEY,
  });
  return client;
};

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "figma-linear-proxy" });
});

// Get teams
app.get("/api/linear/teams", async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace("Bearer ", "");
    const client = getLinearClient(apiKey);

    const teams = await client.teams();

    res.json({
      success: true,
      teams: teams.nodes.map((team) => ({
        id: team.id,
        name: team.name,
        key: team.key,
      })),
    });
  } catch (err) {
    console.error("Error fetching teams:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get users
app.get("/api/linear/users", async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace("Bearer ", "");
    const client = getLinearClient(apiKey);

    const users = await client.users();

    res.json({
      success: true,
      users: users.nodes.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        displayName: user.displayName,
      })),
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get projects for a team
app.get("/api/linear/projects/:teamId", async (req, res) => {
  try {
    const { teamId } = req.params;
    const apiKey = req.headers.authorization?.replace("Bearer ", "");
    const client = getLinearClient(apiKey);

    const team = await client.team(teamId);
    const projects = await team.projects();

    res.json({
      success: true,
      projects: projects.nodes.map((project) => ({
        id: project.id,
        name: project.name,
        key: project.key,
      })),
    });
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Create Linear issue
app.post("/api/linear/create-issue", async (req, res) => {
  try {
    const {
      title,
      description,
      teamId,
      assigneeEmail,
      assigneeId,
      projectId,
      labelIds,
      priority,
      figmaFileKey,
      figmaNodeId,
    } = req.body;

    if (!title || !teamId) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: title and teamId",
      });
    }

    const apiKey = req.headers.authorization?.replace("Bearer ", "");
    const client = getLinearClient(apiKey);

    // Resolve assignee by email if provided
    let resolvedAssigneeId = assigneeId;
    if (assigneeEmail && !assigneeId) {
      const users = await client.users();
      const user = users.nodes.find((u) => u.email === assigneeEmail);
      if (user) {
        resolvedAssigneeId = user.id;
      }
    }

    // Enhance description with Figma link if provided
    let enhancedDescription = description;
    if (figmaFileKey && figmaNodeId) {
      const figmaLink = `https://www.figma.com/file/${figmaFileKey}?node-id=${figmaNodeId}`;
      enhancedDescription = `${description}\n\n---\n\n🎨 [Open in Figma](${figmaLink})`;
    } else if (figmaFileKey) {
      const figmaLink = `https://www.figma.com/file/${figmaFileKey}`;
      enhancedDescription = `${description}\n\n---\n\n🎨 [Open in Figma](${figmaLink})`;
    }

    // Create the issue
    const issuePayload = {
      title,
      description: enhancedDescription,
      teamId,
      ...(resolvedAssigneeId && { assigneeId: resolvedAssigneeId }),
      ...(projectId && { projectId }),
      ...(labelIds && labelIds.length > 0 && { labelIds }),
      ...(priority && { priority }),
    };

    // Create issue using the correct Linear SDK method
    const issueResult = await client.createIssue(issuePayload);

    if (!issueResult.success) {
      throw new Error("Issue creation failed");
    }

    const issue = await issueResult.issue;

    res.json({
      success: true,
      issue: {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        url: issue.url,
        state: issue.state?.name,
      },
    });
  } catch (err) {
    console.error("Error creating issue:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Verify Linear API key
app.post("/api/linear/verify", async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace("Bearer ", "");

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: "No API key provided",
      });
    }

    const client = getLinearClient(apiKey);
    const viewer = await client.viewer;

    res.json({
      success: true,
      user: {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
      },
    });
  } catch (err) {
    console.error("Error verifying API key:", err);
    res.status(401).json({
      success: false,
      error: "Invalid API key",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Figma-Linear Proxy running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});
