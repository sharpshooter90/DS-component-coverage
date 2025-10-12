# Local Testing Guide

This guide will help you test the AI Rename feature locally before deploying to production.

## Prerequisites

- Node.js 18 or higher
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))
- The Figma plugin built and running

## Step 1: Setup Backend

1. **Navigate to the backend directory:**

   ```bash
   cd ai-rename-backend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Gemini API key:

   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ALLOWED_ORIGINS=*
   PORT=3001
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

   You should see:

   ```
   AI rename backend listening on http://localhost:3001
   ```

## Step 2: Verify Backend is Running

Test the health endpoint:

```bash
curl http://localhost:3001/api/health
```

Expected response:

```json
{
  "status": "ok",
  "uptime": 5.123,
  "timestamp": "2025-10-12T00:00:00.000Z"
}
```

## Step 3: Test with Sample Data

```bash
curl -X POST http://localhost:3001/api/rename-layers \
  -H "Content-Type: application/json" \
  -d '{
    "layers": [
      {"id": "1", "name": "Rectangle 1", "type": "RECTANGLE"},
      {"id": "2", "name": "Text 1", "type": "TEXT"}
    ],
    "context": {
      "frameName": "Login Screen",
      "totalLayers": 2,
      "chunkIndex": 0,
      "totalChunks": 1
    }
  }'
```

Expected response:

```json
{
  "success": true,
  "renamedLayers": [
    { "id": "1", "newName": "LoginButton/Background" },
    { "id": "2", "newName": "LoginButton/Label" }
  ],
  "tokensUsed": {
    "promptTokens": 123,
    "responseTokens": 45,
    "totalTokens": 168
  }
}
```

## Step 4: Update Frontend Configuration

The frontend has been configured to use `http://localhost:3001` by default for local testing.

Files already updated:

- `src/ui/App.tsx` - `DEFAULT_BACKEND_URL` set to `http://localhost:3001`
- `src/ui/components/ApiKeyModal.tsx` - Same configuration

## Step 5: Build and Test the Plugin

1. **Build the plugin:**

   ```bash
   npm run build
   ```

2. **Open Figma Desktop:**

   - Go to `Plugins` → `Development` → `Import plugin from manifest...`
   - Select the `manifest.json` file from this project
   - Run the plugin

3. **Test AI Rename:**
   - Select some layers in your Figma file
   - Open the plugin
   - Go to Settings
   - Click "Configure AI Rename"
   - The Backend URL should be pre-filled with `http://localhost:3001`
   - Add your Gemini API key (optional if already in .env)
   - Save and try renaming layers

## Step 6: Troubleshooting

### Backend Not Starting

**Error:** `Port 3001 already in use`

- Kill the existing process: `lsof -ti:3001 | xargs kill -9`
- Or use a different port in `.env`: `PORT=3002`

**Error:** `GEMINI_API_KEY is not configured`

- Make sure `.env` file exists and contains your API key
- Restart the server after editing `.env`

### CORS Errors

**Error:** `Access-Control-Allow-Origin header is present`

- Verify backend is running on `http://localhost:3001`
- Check that `ALLOWED_ORIGINS=*` in `.env`
- Restart the backend server

### Plugin Can't Connect

**Error:** `Failed to fetch` or `net::ERR_CONNECTION_REFUSED`

- Verify backend is running: `curl http://localhost:3001/api/health`
- Check the Backend URL in plugin settings matches `http://localhost:3001`
- Make sure you're using Figma Desktop app (not browser)

### API Key Issues

**Error:** `Gemini API key is not configured`

- Add API key in `.env` file: `GEMINI_API_KEY=your_key`
- Or provide it through the plugin UI when configuring

## Step 7: Ready for Production

Once local testing works:

1. **Deploy to Vercel:**

   ```bash
   vercel
   ```

2. **Add environment variable:**

   ```bash
   vercel env add GEMINI_API_KEY
   ```

3. **Deploy to production:**

   ```bash
   vercel --prod
   ```

4. **Update frontend URLs:**
   - In `src/ui/App.tsx` change `DEFAULT_BACKEND_URL` to your Vercel URL
   - In `src/ui/components/ApiKeyModal.tsx` change `DEFAULT_BACKEND_URL` to your Vercel URL
   - Rebuild the plugin

## Architecture

```
┌─────────────────┐
│  Figma Plugin   │
│  (UI React)     │
└────────┬────────┘
         │
         │ HTTP POST
         │ /api/rename-layers
         ▼
┌─────────────────┐
│  Express API    │
│  (localhost:3001)│
└────────┬────────┘
         │
         │ API Call
         ▼
┌─────────────────┐
│  Google Gemini  │
│  API (Cloud)    │
└─────────────────┘
```

## Next Steps

- Test with real layer data from your design files
- Experiment with different prompt strategies
- Monitor token usage and costs
- Set up error tracking for production
