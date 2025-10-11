# ⚡ Quick Start: Linear Integration

Get Linear integration working in **5 minutes**.

## 🎯 What You'll Need

- [ ] Node.js 18+ installed
- [ ] Linear account
- [ ] Vercel account (free tier works)

---

## 🚀 Setup Steps

### 1. Get Linear API Key (2 min)

1. Visit [linear.app/settings/api](https://linear.app/settings/api)
2. Click "Create key"
3. Copy the key (starts with `lin_api_`)

### 2. Deploy Backend (2 min)

```bash
# Navigate to backend folder
cd linear-backend

# Install dependencies
npm install

# Deploy to Vercel
npx vercel

# Set environment variables
npx vercel env add LINEAR_API_KEY
# Paste your API key when prompted

npx vercel env add LINEAR_TEAM_ID
# Leave empty for now, we'll get it from the UI

# Deploy to production
npx vercel --prod
```

Copy your production URL: `https://your-project.vercel.app`

### 3. Configure Plugin (1 min)

1. Open DS Coverage Analyzer in Figma
2. Go to Settings → Linear Integration
3. Toggle "Enable Linear Integration" ON
4. Paste your Vercel URL in "API Endpoint"
5. Paste your Linear API key
6. Click "Verify Connection"
7. Select your team from dropdown
8. Click "Save Configuration"

---

## ✅ Test It

1. Select a frame in Figma
2. Click "Analyze Selection"
3. Wait for analysis to complete
4. Click "Send to Linear" button
5. Check Linear - you should see a new issue! 🎉

---

## 🐛 Issues?

**"Invalid API Key"**
- Double-check you copied the full key from Linear
- Make sure there are no extra spaces

**"Network Error"**
- Verify your Vercel deployment is live
- Check `manifest.json` includes your Vercel domain in `allowedDomains`

**Still stuck?**
- See full guide: [LINEAR_INTEGRATION.md](./LINEAR_INTEGRATION.md)

---

## 🎨 What's Next?

- **Customize reports:** Edit `linearService.ts` formatting
- **Add assignees:** Set default assignee in plugin settings
- **Add labels:** Configure project and labels
- **Auto-assign:** Use assignee email to auto-assign issues

---

That's it! You're ready to streamline your design system workflow. 🚀

