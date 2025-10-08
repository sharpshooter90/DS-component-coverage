# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Plugin

```bash
npm run build
```

This will:

- Compile the TypeScript plugin code (`code.ts` → `code.js`)
- Build the React UI (`src/ui/` → `dist/index.html`)

### 3. Load in Figma

1. Open Figma Desktop App
2. Go to `Plugins` → `Development` → `Import plugin from manifest...`
3. Select the `manifest.json` file from this directory
4. Done! The plugin is now available in your plugins menu

## 🎯 Using the Plugin

1. **Select a Frame** in your Figma file
2. **Run the Plugin** from `Plugins` → `Development` → `DS Coverage Analyzer`
3. **Click "Analyze Selection"** button
4. **Review Results** in the Summary, Detailed, or Settings tabs

## 🔄 Development Workflow

### Watch Mode (Recommended for Development)

```bash
npm run dev
```

This runs both the plugin and UI in watch mode. Any changes you make will automatically rebuild.

### Manual Build

```bash
# Build everything
npm run build

# Or build individually
npm run build:plugin  # Just the plugin code
npm run build:ui      # Just the React UI
```

### After Making Changes

1. Make your code changes
2. If in watch mode, changes rebuild automatically
3. In Figma, go to `Plugins` → `Development` → `DS Coverage Analyzer`
4. If the plugin was already open, close and reopen it to see changes

## 📊 Features Quick Reference

### Summary Tab

- Overall compliance score
- Component, token, and style coverage percentages
- Breakdown by element type
- Export buttons (JSON/CSV)

### Detailed Tab

- List of all non-compliant layers
- Search and filter functionality
- Click "Select" to jump to layer in Figma
- See specific issues for each layer

### Settings Tab

- Toggle coverage checks on/off
- Configure analysis options
- Customize what counts as "compliant"

## 🎨 What Gets Analyzed

✅ **Component Coverage** - Are library components being used?
✅ **Token Coverage** - Are design tokens being used for colors, typography, spacing?
✅ **Style Coverage** - Are shared Figma styles being used?

## 💡 Tips

- **Start Small**: Test on a simple frame first to understand the results
- **Configure Settings**: Adjust settings to match your team's design system rules
- **Use Re-run**: After fixing issues, click "Re-run Analysis" to see improvements
- **Export Reports**: Share JSON/CSV exports in design reviews

## 🐛 Troubleshooting

**Plugin won't load?**

- Make sure `npm run build` completed successfully
- Check that `code.js` and `dist/index.html` files exist
- Try restarting Figma

**No analysis results?**

- Make sure you've selected a Frame, Component, or Instance
- Check the error message if one appears
- Try selecting a different frame

**Inaccurate results?**

- Review your settings - you may need to adjust thresholds
- Some checks are intentionally conservative (e.g., detecting potential components)

## 📚 Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Customize settings for your team's workflow
- Export and share coverage reports with your team
- Integrate into your design system governance process

---

Happy analyzing! 🎉
