# DS Coverage Analyzer

A comprehensive Figma plugin that analyzes your designs for design system compliance. Track component usage, design token adoption, and shared style usage to maintain consistency across your designs.

## Features

### 📊 Core Analysis

1. **Frame Selection** - Select any frame, component, or instance to analyze
2. **Component Coverage** - Measure library component adoption vs local elements
3. **Token Coverage** - Check design token usage for colors, typography, and spacing
4. **Style Coverage** - Monitor shared Figma style usage
5. **Type Breakdown** - View coverage metrics broken down by element type

### 📈 Reporting & Visualization

6. **Summary Report** - Get an overall compliance score at a glance
7. **Detailed Report** - View all non-compliant layers with specific issues
8. **Export Results** - Export reports in JSON or CSV format for documentation

### ⚡ User Experience

9. **Progress Feedback** - Real-time progress indicator during analysis
10. **Re-run Analysis** - Quickly validate improvements after making fixes
11. **Configurable Settings** - Customize what counts as "covered" for your team

## Installation

### Development

1. Clone this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the plugin:

   ```bash
   npm run build
   ```

4. In Figma, go to `Plugins > Development > Import plugin from manifest...`
5. Select the `manifest.json` file from this directory

### Development Mode

For active development with hot reload:

```bash
npm run dev
```

This will watch both the plugin code and UI for changes.

## Usage

### Basic Workflow

1. **Select a Frame** - Choose the frame, component, or instance you want to analyze
2. **Run Analysis** - Click "Analyze Selection" button
3. **Review Results** - Check the summary score and detailed breakdown
4. **Fix Issues** - Use the detailed report to identify and fix non-compliant layers
5. **Re-run** - Click "Re-run Analysis" to validate your improvements

### Understanding the Reports

#### Summary View

- **Overall Score**: Percentage of layers compliant with design system guidelines
- **Component Coverage**: How many elements use library components
- **Token Coverage**: Design token usage for colors, typography, and spacing
- **Style Coverage**: Shared Figma style adoption
- **Type Breakdown**: Coverage metrics by element type (Frame, Text, Rectangle, etc.)

#### Detailed View

Lists all non-compliant layers with:

- Layer name and type
- Full path in the design hierarchy
- Specific issues (e.g., "Uses local fill instead of color token")
- Quick "Select" button to jump to the layer

#### Settings

Configure the analysis:

- **Component Coverage**: Toggle component usage checking
- **Token Coverage**: Toggle design token checking
- **Style Coverage**: Toggle shared style checking
- **Allow Local Styles**: Optionally allow local styles without flagging

### Exporting Results

Click the "Export JSON" or "Export CSV" button to save the analysis results:

- **JSON**: Full analysis data including all metadata
- **CSV**: Simplified report of non-compliant layers for spreadsheet review

## What Gets Checked

### Component Coverage

- ✅ Instances of library components (from external libraries)
- ⚠️ Local components (should be published to library)
- ❌ Raw frames/shapes that could be components (buttons, inputs, cards, icons)

### Token Coverage

- **Colors**: Checks if fills and strokes use color tokens or styles
- **Typography**: Verifies text layers use text styles
- **Spacing**: Checks if auto-layout spacing uses spacing tokens

### Style Coverage

- **Fill Styles**: Color fills using shared styles
- **Stroke Styles**: Strokes using shared styles
- **Text Styles**: Typography using shared styles
- **Effect Styles**: Shadows and effects using shared styles

## Scoring

- **80-100%**: Excellent design system compliance (green)
- **50-79%**: Moderate compliance, room for improvement (yellow)
- **0-49%**: Poor compliance, needs attention (red)

## Best Practices

1. **Establish Guidelines**: Configure settings to match your team's design system rules
2. **Run Early and Often**: Check compliance throughout the design process
3. **Fix as You Go**: Use the "Select" button to quickly jump to and fix issues
4. **Export for Reviews**: Share CSV reports in design reviews or PRs
5. **Track Progress**: Re-run analysis to validate improvements over time

## Development

### Project Structure

```
DS-component-coverage/
├── code.ts                 # Plugin backend (Figma API)
├── src/
│   └── ui/
│       ├── App.tsx         # Main React app
│       ├── components/     # React components
│       │   ├── SummaryView.tsx
│       │   ├── DetailedView.tsx
│       │   ├── SettingsView.tsx
│       │   ├── ErrorMessage.tsx
│       │   └── ProgressIndicator.tsx
│       ├── styles.css      # Global styles
│       └── index.html      # HTML entry point
├── manifest.json           # Figma plugin manifest
├── package.json
└── vite.config.ts         # Vite build config
```

### Scripts

- `npm run build` - Build both plugin and UI
- `npm run build:plugin` - Build plugin code only
- `npm run build:ui` - Build UI only
- `npm run dev` - Watch mode for development
- `npm run watch:plugin` - Watch plugin code
- `npm run watch:ui` - Watch UI code
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues

### Technologies

- **Figma Plugin API** - Core plugin functionality
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS Variables** - Theming (light theme default)

## Troubleshooting

### Plugin doesn't load

- Make sure you've run `npm run build`
- Check that `code.js` and `dist/index.html` exist
- Try re-importing the plugin in Figma

### Analysis seems inaccurate

- Check your settings - you may need to adjust what counts as "covered"
- Some heuristics (like detecting potential components) are intentionally conservative
- Local components vs library components requires components to be published

### UI doesn't update

- In development mode, try restarting `npm run dev`
- Clear your browser cache (for UI)vendor-core-2fc9e29e9993e8a3.min.js.br:15 Error: Unable to load code: Error: Error invoking remote method 'web:getLocalFileExtensionSource': Error: ENOENT: no such file or directory, lstat '/Users/sudeepmp/projects/figma-dev/DS-component-coverage/dist/index.html'
  at eE (figma_app\_\_rspack-316206f5533935c8.min.js.br:83:357928)
  at async 9071-4bf00b202e7efbb0.min.js.br:657:6212
  at async Promise.all (/design/SAMFf2KM0GuV6hfVUGXw3C/index 0)
  at async ec (9071-4bf00b202e7efbb0.min.js.br:657:6183)
  at async 9071-4bf00b202e7efbb0.min.js.br:657:3724
- Reload the plugin in Figma

## Contributing

This plugin is built with extensibility in mind. Contributions are welcome!

## License

MIT

## Support

For issues or feature requests, please file an issue on the repository.
