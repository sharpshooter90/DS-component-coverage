# Figma-Linear Proxy Backend

Backend proxy service for integrating the Figma Design System Component Coverage plugin with Linear API.

## 🚀 Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Linear API key and team ID.

3. **Run the server:**
   ```bash
   npm run dev
   ```

   Server will be running at `http://localhost:3000`

### Get Your Linear API Key

1. Go to [Linear Settings → API](https://linear.app/settings/api)
2. Click "Personal API keys"
3. Create a new key with appropriate scopes:
   - `read` - Read data from Linear
   - `write` - Create and update issues
4. Copy the key and add it to `.env`

### Get Your Team ID

Option 1: Use the API endpoint
```bash
curl http://localhost:3000/api/linear/teams \
  -H "Authorization: Bearer YOUR_LINEAR_API_KEY"
```

Option 2: From Linear URL
- Your team URL: `https://linear.app/yourteam/...`
- The team key is `yourteam`

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Verify API Key
```
POST /api/linear/verify
Headers: Authorization: Bearer YOUR_API_KEY
```

### Get Teams
```
GET /api/linear/teams
Headers: Authorization: Bearer YOUR_API_KEY
```

### Get Users
```
GET /api/linear/users
Headers: Authorization: Bearer YOUR_API_KEY
```

### Get Projects
```
GET /api/linear/projects/:teamId
Headers: Authorization: Bearer YOUR_API_KEY
```

### Create Issue
```
POST /api/linear/create-issue
Headers: 
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "title": "Token Coverage Report - MyComponent",
  "description": "## Summary\n\n...",
  "teamId": "TEAM_ID",
  "assigneeEmail": "designer@company.com", // optional
  "assigneeId": "USER_ID", // optional
  "projectId": "PROJECT_ID", // optional
  "labelIds": ["LABEL_ID"], // optional
  "priority": 2, // optional (1-4)
  "figmaFileKey": "FILE_KEY", // optional
  "figmaNodeId": "NODE_ID" // optional
}
```

## 🌐 Deployment

### Vercel (Recommended)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set environment variables:**
   ```bash
   vercel env add LINEAR_API_KEY
   vercel env add LINEAR_TEAM_ID
   ```

4. **Deploy to production:**
   ```bash
   vercel --prod
   ```

Your API will be available at: `https://your-project.vercel.app`

### Other Platforms

- **Railway**: Connect GitHub repo, add environment variables
- **Render**: Create Web Service, add environment variables
- **Fly.io**: Use `fly launch` and configure secrets
- **AWS Lambda**: Package and deploy as serverless function

## 🔒 Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Use environment variables** for all sensitive data
3. **Enable CORS** only for trusted origins
4. **Rate limiting** - Consider adding rate limiting for production
5. **API key rotation** - Regularly rotate your Linear API key

## 🧪 Testing

### Test with curl

```bash
# Health check
curl http://localhost:3000/api/health

# Create test issue
curl -X POST http://localhost:3000/api/linear/create-issue \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Issue from Figma Plugin",
    "description": "This is a test",
    "teamId": "YOUR_TEAM_ID"
  }'
```

### Test with Postman

Import the following request:
- Method: POST
- URL: `http://localhost:3000/api/linear/create-issue`
- Headers:
  - `Authorization: Bearer YOUR_API_KEY`
  - `Content-Type: application/json`
- Body (raw JSON): See example above

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LINEAR_API_KEY` | Yes | Your Linear personal API key |
| `LINEAR_TEAM_ID` | No | Default team ID |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (development/production) |
| `ALLOWED_ORIGINS` | No | CORS allowed origins |

## 🐛 Troubleshooting

### "Invalid API key" error
- Verify your API key in Linear settings
- Check the `Authorization` header format: `Bearer YOUR_KEY`

### "Team not found" error
- Verify team ID is correct
- Ensure API key has access to the team

### CORS errors
- Add Figma domain to `ALLOWED_ORIGINS`
- Check `manifest.json` has correct domain in `networkAccess`

## 📚 Resources

- [Linear API Documentation](https://developers.linear.app/)
- [@linear/sdk NPM Package](https://www.npmjs.com/package/@linear/sdk)
- [Figma Plugin API](https://www.figma.com/plugin-docs/)

