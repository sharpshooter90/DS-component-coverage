# Figma AI Rename Backend

Lightweight Express backend that proxies rename requests to Google's **Gemini 2.5 Flash API**. It keeps API keys secure, centralizes prompt engineering logic, and is deployable on Vercel.

**Status:** ✅ Fully operational with Gemini 2.5 Flash

## Prerequisites

- Node.js 18+
- Google Gemini API key ([request one](https://aistudio.google.com/apikey))

## Local Setup

```bash
cd ai-rename-backend
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
npm install
npm start
```

The server listens on `http://localhost:3001` by default.

### Quick Test

```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Test rename endpoint (requires GEMINI_API_KEY in .env)
curl -X POST http://localhost:3001/api/rename-layers \
  -H "Content-Type: application/json" \
  -d '{
    "layers": [{"id": "1", "name": "Rectangle 1", "type": "RECTANGLE"}],
    "context": {"frameName": "Test", "totalLayers": 1, "chunkIndex": 0, "totalChunks": 1}
  }'
```

### Environment Variables

- `GEMINI_API_KEY` – required, used if the request does not supply a key.
- `ALLOWED_ORIGINS` – optional comma separated list for CORS (default `*`).
- `PORT` – optional port override for local runs.

## API

### `GET /api/health`

Simple health probe returning server status.

### `POST /api/rename-layers`

```json
{
  "layers": [{ "id": "12", "name": "Rectangle 1", "type": "RECTANGLE" }],
  "context": {
    "frameName": "Login Screen",
    "totalLayers": 120,
    "chunkIndex": 0,
    "totalChunks": 4
  },
  "config": {
    "model": "gemini-1.5-flash",
    "temperature": 0.7,
    "apiKey": "optional override"
  }
}
```

Response:

```json
{
  "success": true,
  "renamedLayers": [{ "id": "12", "newName": "Button/Background" }],
  "tokensUsed": {
    "promptTokens": 123,
    "responseTokens": 45,
    "totalTokens": 168
  }
}
```

Errors return `{ "success": false, "message": "reason" }` with appropriate HTTP status codes.

## Deployment (Vercel)

1. Create a new Vercel project pointing to this directory.
2. Add the `GEMINI_API_KEY` secret: `vercel env add GEMINI_API_KEY`.
3. Deploy. Vercel uses `vercel.json` to route `/api/*` to the Express handler.

## Prompt Strategy

The backend sends detailed context (frame, chunk index, dominant layer type) along with the serialized layer payload. Gemini is instructed to return a JSON array containing `id` and `newName` pairs only, ensuring the UI can safely apply renames.

## CORS Configuration

The server is configured to accept requests from Figma plugins (origin: `null`) and other origins:

- By default, allows all origins (`ALLOWED_ORIGINS="*"`)
- Explicitly handles `null` origin for Figma plugins
- Properly responds to OPTIONS preflight requests
- Includes explicit CORS headers for Vercel compatibility

### Troubleshooting CORS Issues

If you encounter CORS errors after deployment:

1. **Verify deployment**: Check that your Vercel deployment was successful
2. **Check environment variables**: Ensure `GEMINI_API_KEY` is set in Vercel dashboard
3. **Test health endpoint**: `curl https://your-domain.vercel.app/api/health`
4. **Clear cache**: Redeploy with `vercel --prod --force` to clear any cached functions
5. **Check logs**: View Vercel function logs in the dashboard for error details

If issues persist, you can restrict origins by setting `ALLOWED_ORIGINS`:

```bash
vercel env add ALLOWED_ORIGINS
# Enter: https://www.figma.com,null
```
