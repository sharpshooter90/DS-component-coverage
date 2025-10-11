# 🔗 Linear Integration Guide

This document explains how to set up and use the Linear integration with the DS Coverage Analyzer Figma plugin.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Backend Setup](#backend-setup)
- [Plugin Configuration](#plugin-configuration)
- [Usage](#usage)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The Linear integration allows you to automatically create Linear issues from your design system coverage reports. When analysis is complete, you can send the results directly to Linear with a single click.

### Features

- ✅ Automatic issue creation from coverage reports
- 📊 Formatted reports with coverage metrics
- 🔗 Direct links to Figma files
- 👤 Assignee support
- 🏷️ Project and label assignment
- 🔒 Secure API key storage

---

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────┐
│  Figma Plugin   │────────▶│  Backend Proxy   │────────▶│   Linear    │
│     (UI)        │         │  (Node.js/       │         │     API     │
│                 │         │   Vercel)        │         │             │
└─────────────────┘         └──────────────────┘         └─────────────┘
      ▲                              │
      │                              │
      └──────────── API Key ─────────┘
```

**Why a backend proxy?**

- Figma plugins run in a sandboxed iframe without direct network access to external APIs
- The proxy handles authentication and Linear SDK calls
- Keeps your Linear API key secure

---

## 🚀 Backend Setup

### Prerequisites

- Node.js 18+ installed
- Linear account with API access
- Vercel account (or similar hosting)

### Step 1: Install Dependencies

Navigate to the `linear-backend` directory:

```bash
cd linear-backend
npm install
```

### Step 2: Get Your Linear API Key

1. Go to [Linear Settings → API](https://linear.app/settings/api)
2. Click "Personal API keys"
3. Create a new key with these scopes:
   - `read` - Read data from Linear
   - `write` - Create and update issues
4. Copy the API key (starts with `lin_api_...`)

### Step 3: Configure Environment

Create a `.env` file in the `linear-backend` directory:

```bash
# Linear API Configuration
LINEAR_API_KEY=lin_api_your_key_here
LINEAR_TEAM_ID=your_team_id_here

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://www.figma.com
```

### Step 4: Get Your Team ID

**Option 1: Use the API**

Start the server locally:

```bash
npm run dev
```

Then query the teams endpoint:

```bash
curl http://localhost:3000/api/linear/teams \
  -H "Authorization: Bearer YOUR_LINEAR_API_KEY"
```

**Option 2: From Linear URL**

Your team URL looks like: `https://linear.app/yourteam/...`

The team key is `yourteam` - you can use this to find your team ID in the plugin settings.

### Step 5: Test Locally

With the server running, test creating an issue:

```bash
curl -X POST http://localhost:3000/api/linear/create-issue \
  -H "Authorization: Bearer YOUR_LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Issue from Figma Plugin",
    "description": "This is a test",
    "teamId": "YOUR_TEAM_ID"
  }'
```

You should see a success response with the created issue details.

---

## ⚙️ Plugin Configuration

### Step 1: Open Plugin Settings

1. Open the DS Coverage Analyzer plugin in Figma
2. Click the "Settings" tab
3. Scroll to "Linear Integration"

### Step 2: Enable Integration

Toggle "Enable Linear Integration" to ON.

### Step 3: Configure API Endpoint

- **Local Development:** `http://localhost:3000`
- **Production:** `https://your-proxy.vercel.app`

### Step 4: Add API Key

1. Paste your Linear API key
2. Click "Verify Connection"
3. If successful, you'll see your teams listed

### Step 5: Select Team

Choose the team where issues should be created.

### Step 6: Optional Settings

- **Assignee Email:** Auto-assign issues to a specific user
- **Project ID:** Place issues in a specific project
- **Labels:** Tag issues with specific labels

### Step 7: Save Configuration

Click "Save Configuration" to persist your settings.

---

## 📝 Usage

### Creating a Linear Issue from a Report

1. Run an analysis on a frame/component
2. Wait for the analysis to complete
3. In the Summary view, you'll see "Send to Linear" button
4. Click the button to create a Linear issue
5. A success message will appear with a link to the issue

### Issue Format

Linear issues created by the plugin include:

**Title:**

```
[DS Coverage] FrameName
```

**Description:**

```markdown
## 📊 Coverage Summary

**Overall Score:** 75%
**Total Layers:** 120
**Compliant Layers:** 90

### Coverage Breakdown

- **Component Coverage:** 80%
- **Token Coverage:** 70%
- **Style Coverage:** 75%

### By Layer Type

- **FRAME:** 45/50 (90%)
- **TEXT:** 30/40 (75%)
- **RECTANGLE:** 15/30 (50%)

### ⚠️ Non-Compliant Layers (30)

**RECTANGLE** (15)

- `Background Card`
  - Uses local fill instead of color token or style
- `Divider Line`
  - Uses local stroke instead of color token or style
    ...

### 📝 Next Steps

1. Review non-compliant layers in Figma
2. Replace with design system components/tokens where possible
3. Apply shared styles for consistent appearance
4. Re-run analysis to verify improvements

---

🎨 [Open in Figma](https://www.figma.com/file/ABC123?node-id=1:2)
```

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)

1. **Install Vercel CLI:**

   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel:**

   ```bash
   vercel login
   ```

3. **Deploy:**

   ```bash
   cd linear-backend
   vercel
   ```

4. **Set Environment Variables:**

   ```bash
   vercel env add LINEAR_API_KEY
   vercel env add LINEAR_TEAM_ID
   ```

5. **Deploy to Production:**

   ```bash
   vercel --prod
   ```

6. **Update Plugin Settings:**
   - Copy your production URL: `https://your-project.vercel.app`
   - Update the API Endpoint in plugin settings
   - Verify connection

### Deploy to Other Platforms

**Railway:**

1. Connect your GitHub repo
2. Add environment variables
3. Deploy

**Render:**

1. Create a new Web Service
2. Connect your repo
3. Add environment variables
4. Deploy

**AWS Lambda:**

1. Package the app
2. Create a Lambda function
3. Set up API Gateway
4. Configure environment variables

---

## 🔒 Security Best Practices

### API Key Management

✅ **DO:**

- Store API keys in environment variables
- Use different keys for development and production
- Rotate API keys regularly
- Limit API key scopes to only what's needed

❌ **DON'T:**

- Commit API keys to Git
- Share API keys in Slack/email
- Use the same key across multiple environments
- Give API keys unnecessary permissions

### CORS Configuration

Update `ALLOWED_ORIGINS` in your `.env` to only allow requests from:

- Your local development environment
- `https://www.figma.com` (for the plugin)

### Rate Limiting

Consider adding rate limiting to your proxy:

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use("/api/", limiter);
```

---

## 🐛 Troubleshooting

### "Invalid API Key" Error

**Cause:** API key is incorrect or expired

**Solution:**

1. Verify your API key in Linear Settings
2. Check it's copied correctly (no extra spaces)
3. Regenerate a new API key if needed

### "Team not found" Error

**Cause:** Team ID doesn't match or you don't have access

**Solution:**

1. Use the `/api/linear/teams` endpoint to list available teams
2. Verify you have access to the team in Linear
3. Update the team ID in plugin settings

### "Network Error" or "Connection Failed"

**Cause:** Backend proxy not running or incorrect endpoint

**Solution:**

1. Verify backend is running: `curl https://your-endpoint/api/health`
2. Check `manifest.json` has correct domain in `allowedDomains`
3. Check CORS settings in backend

### "No team selected" in Plugin

**Cause:** Configuration not saved or API key not verified

**Solution:**

1. Click "Verify Connection" first
2. Wait for teams to load
3. Select a team from the dropdown
4. Click "Save Configuration"

### Issue Created But No Link to Figma

**Cause:** Plugin couldn't get file info or you're in a dev file

**Solution:**

- Make sure you're working in a saved Figma file (not local)
- Check browser console for errors
- File key should be in the URL: `figma.com/file/FILE_KEY/...`

### localStorage Error in Console

**Cause:** Figma plugins run in a sandboxed iframe that doesn't support localStorage

**Solution:**

- This has been fixed in the latest version using `figma.clientStorage`
- Make sure you're using the latest plugin code
- Settings are now stored in Figma's persistent storage
- If you see this error, rebuild the plugin: `npm run build`

---

## 📚 API Reference

### Backend Endpoints

#### `GET /api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "service": "figma-linear-proxy"
}
```

#### `POST /api/linear/verify`

Verify Linear API key.

**Headers:**

```
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

#### `GET /api/linear/teams`

Get available teams.

**Headers:**

```
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "teams": [
    {
      "id": "team_id",
      "name": "Design Team",
      "key": "DES"
    }
  ]
}
```

#### `GET /api/linear/users`

Get users in organization.

**Headers:**

```
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "users": [
    {
      "id": "user_id",
      "name": "John Doe",
      "email": "john@example.com",
      "displayName": "John"
    }
  ]
}
```

#### `POST /api/linear/create-issue`

Create a Linear issue.

**Headers:**

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Body:**

```json
{
  "title": "Issue Title",
  "description": "Issue description",
  "teamId": "team_id",
  "assigneeEmail": "user@example.com", // optional
  "projectId": "project_id", // optional
  "labelIds": ["label_id"], // optional
  "priority": 2, // optional (1-4)
  "figmaFileKey": "file_key", // optional
  "figmaNodeId": "node_id" // optional
}
```

**Response:**

```json
{
  "success": true,
  "issue": {
    "id": "issue_id",
    "identifier": "DES-123",
    "title": "Issue Title",
    "url": "https://linear.app/team/issue/DES-123",
    "state": "Todo"
  }
}
```

---

## 🆘 Support

- **Plugin Issues:** Create an issue in the GitHub repo
- **Linear API:** [Linear API Docs](https://developers.linear.app/)
- **Backend Issues:** Check logs in your hosting platform

---

## 📄 License

This integration is part of the DS Coverage Analyzer plugin.
