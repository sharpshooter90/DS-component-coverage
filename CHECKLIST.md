# Installation & Testing Checklist

## 📋 Pre-Installation Checklist

- [ ] Node.js installed (v16 or higher recommended)
- [ ] npm or yarn available
- [ ] Figma Desktop App installed (required for plugin development)
- [ ] Code editor installed (VS Code recommended)

## 🔧 Installation Steps

### 1. Install Dependencies

```bash
cd /Users/sudeepmp/projects/figma-dev/DS-component-coverage
npm install
```

**Expected Result**:

- No errors
- `node_modules/` directory created
- Dependencies installed successfully

### 2. Build the Plugin

```bash
npm run build
```

**Expected Result**:

- `code.js` file created in root directory
- `dist/` directory created
- `dist/index.html` file exists
- No build errors

**Verify**:

```bash
ls -la code.js dist/index.html
```

### 3. Import Plugin into Figma

1. Open **Figma Desktop App**
2. Click `Plugins` → `Development` → `Import plugin from manifest...`
3. Navigate to this directory
4. Select `manifest.json`
5. Click "Open"

**Expected Result**:

- Plugin appears in Figma's plugin menu
- Named "DS Coverage Analyzer"

## ✅ Testing Checklist

### Test 1: Plugin Loads

- [ ] Open any Figma file
- [ ] Go to `Plugins` → `Development` → `DS Coverage Analyzer`
- [ ] Plugin window opens (480x720px)
- [ ] Shows empty state with "No Analysis Yet"
- [ ] Displays three feature cards

### Test 2: Error Handling

- [ ] With nothing selected, click "Analyze Selection"
- [ ] Error message appears: "Please select a frame to analyze"
- [ ] Can dismiss error message

### Test 3: Frame Selection Error

- [ ] Select a non-frame element (e.g., a rectangle)
- [ ] Click "Analyze Selection"
- [ ] Error message: "Please select a frame, component, or instance"

### Test 4: Basic Analysis

- [ ] Create a simple frame with a few elements
- [ ] Select the frame
- [ ] Click "Analyze Selection"
- [ ] Progress indicator appears
- [ ] Analysis completes
- [ ] Summary tab shows results
- [ ] Overall score displayed
- [ ] Component/Token/Style coverage shown

### Test 5: Summary View

- [ ] Score has appropriate color (green/yellow/red)
- [ ] Frame name displayed correctly
- [ ] Layer counts shown (total and compliant)
- [ ] Type breakdown visible
- [ ] Export buttons present

### Test 6: Detailed View

- [ ] Click "Detailed Report" tab
- [ ] Non-compliant layers listed (if any)
- [ ] Each layer shows name, type, path, issues
- [ ] Search box functional
- [ ] Type filter works
- [ ] "Select" button highlights layer in Figma

### Test 7: Settings View

- [ ] Click "Settings" tab
- [ ] Toggle switches visible
- [ ] Can toggle Component Coverage on/off
- [ ] Can toggle Token Coverage on/off
- [ ] Can toggle Style Coverage on/off
- [ ] Can toggle Allow Local Styles
- [ ] About section displays

### Test 8: Re-run Analysis

- [ ] Button text changes to "Re-run Analysis"
- [ ] Click "Re-run Analysis"
- [ ] Analysis runs again
- [ ] Results update

### Test 9: Export JSON

- [ ] Click "Export JSON"
- [ ] File downloads with timestamp
- [ ] JSON is valid and contains all data
- [ ] Can open in text editor

### Test 10: Export CSV

- [ ] Click "Export CSV"
- [ ] File downloads with timestamp
- [ ] CSV is valid
- [ ] Can open in spreadsheet app
- [ ] Contains: Layer Name, Type, Path, Issues

### Test 11: Layer Selection

- [ ] In Detailed view, click "Select" on a layer
- [ ] Figma selects that layer
- [ ] Viewport scrolls to layer
- [ ] Layer is highlighted in Figma

### Test 12: Settings Persistence

- [ ] Change a setting (e.g., disable Token Coverage)
- [ ] Re-run analysis
- [ ] Results reflect setting change
- [ ] Settings persist during plugin session

### Test 13: Complex Frame

- [ ] Create a frame with:
  - Library component instances
  - Local elements
  - Text with/without text styles
  - Shapes with/without color styles
  - Auto-layout with spacing
- [ ] Run analysis
- [ ] Verify coverage calculations are reasonable
- [ ] Check detailed report for accuracy

### Test 14: Tab Navigation

- [ ] Click between Summary, Detailed, and Settings tabs
- [ ] Each tab renders correctly
- [ ] Active tab highlighted
- [ ] Content switches appropriately

### Test 15: Responsive UI

- [ ] All text readable
- [ ] No layout overflow
- [ ] Buttons accessible
- [ ] Scrolling works in Detailed view

## 🐛 Common Issues & Solutions

### Issue: Plugin won't load

**Solution**:

- Ensure `npm run build` completed successfully
- Check that `code.js` and `dist/index.html` exist
- Try re-importing the plugin
- Restart Figma Desktop App

### Issue: Build errors

**Solution**:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: UI doesn't update

**Solution**:

- Close plugin in Figma
- Run `npm run build` again
- Reopen plugin

### Issue: TypeScript errors

**Solution**:

```bash
npm run lint:fix
```

### Issue: "Cannot find module" errors

**Solution**:

- Ensure all dependencies installed: `npm install`
- Check `node_modules/@figma/plugin-typings` exists

## 🔄 Development Mode Testing

### Using Watch Mode

```bash
npm run dev
```

This runs both plugin and UI in watch mode.

**Testing Flow**:

1. Start watch mode: `npm run dev`
2. Make code changes
3. In Figma, close and reopen plugin to see changes
4. Repeat

**Tips**:

- UI changes require plugin restart in Figma
- Plugin code changes also require restart
- Watch mode auto-rebuilds on save

## 📊 Performance Testing

### Large Frame Test

- [ ] Create frame with 100+ layers
- [ ] Run analysis
- [ ] Progress indicator updates
- [ ] Analysis completes in reasonable time (< 5 seconds)
- [ ] No browser crashes
- [ ] Results are accurate

### Deeply Nested Test

- [ ] Create deeply nested structure (10+ levels)
- [ ] Run analysis
- [ ] All layers analyzed
- [ ] Paths shown correctly in detailed view

## 🎯 Feature Verification Matrix

| User Story | Feature            | Status |
| ---------- | ------------------ | ------ |
| 1          | Frame Selection    | ✅     |
| 2          | Component Coverage | ✅     |
| 3          | Token Coverage     | ✅     |
| 4          | Style Coverage     | ✅     |
| 5          | Type Breakdown     | ✅     |
| 6          | Summary Report     | ✅     |
| 7          | Detailed Report    | ✅     |
| 8          | Export Results     | ✅     |
| 9          | Progress Feedback  | ✅     |
| 10         | Re-run Analysis    | ✅     |
| 11         | Settings & Filters | ✅     |

## ✨ Final Verification

After completing all tests:

- [ ] All 15 basic tests pass
- [ ] All 11 user stories verified
- [ ] No console errors in Figma
- [ ] No linting errors: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Documentation reviewed
- [ ] Ready for production use

## 📝 Notes

**Expected Warnings** (safe to ignore):

- None - plugin should have zero warnings

**Known Limitations**:

- Requires Figma Desktop App (not browser version)
- Only analyzes selected frame (not entire document)
- Variable bindings detection requires Figma API support

## 🎉 Success Criteria

Plugin is ready when:

1. ✅ All installation steps complete without errors
2. ✅ All 15 tests pass
3. ✅ All 11 user stories work as expected
4. ✅ No linting or build errors
5. ✅ Export functionality works
6. ✅ Settings persist correctly
7. ✅ Layer selection works in Figma

---

**Status**: Ready for testing! 🚀

Run the installation steps and work through the testing checklist to verify everything works correctly.
