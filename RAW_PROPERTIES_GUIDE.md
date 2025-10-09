# Raw Properties & Analysis Logic Guide

## Overview

The Detailed View now includes complete raw properties and analysis logic for every non-compliant layer, making it easy to understand exactly what the plugin detected and why a layer was flagged.

## What's Included

### 1. **Raw Properties** 🔍

Every non-compliant layer now includes a collapsible "View Raw Properties" section showing:

#### Basic Properties

```json
{
  "id": "1234:5678",
  "name": "Button Primary",
  "type": "RECTANGLE",
  "visible": true,
  "locked": false
}
```

#### Fill Properties

```json
{
  "fills": [
    {
      "type": "SOLID",
      "visible": true,
      "opacity": 1,
      "color": {
        "r": 0.094,
        "g": 0.627,
        "b": 0.984
      },
      "boundVariables": {
        "color": {
          "type": "VARIABLE_ALIAS",
          "id": "VariableID:123/456:789"
        }
      }
    }
  ]
}
```

#### Stroke Properties

```json
{
  "strokes": [
    {
      "type": "SOLID",
      "visible": true,
      "opacity": 1,
      "color": {
        "r": 0,
        "g": 0,
        "b": 0
      },
      "boundVariables": null
    }
  ]
}
```

#### Text Properties (for TEXT nodes)

```json
{
  "fontSize": 16,
  "fontName": {
    "family": "Inter",
    "style": "Regular"
  },
  "textStyleId": "S:abc123...",
  "characters": "Click me"
}
```

#### Layout Properties (for frames with auto-layout)

```json
{
  "layoutMode": "HORIZONTAL",
  "paddingLeft": 16,
  "paddingRight": 16,
  "paddingTop": 8,
  "paddingBottom": 8
}
```

#### Effects Properties

```json
{
  "effects": [
    {
      "type": "DROP_SHADOW",
      "visible": true,
      "radius": 4,
      "boundVariables": null
    }
  ]
}
```

#### Style IDs

```json
{
  "fillStyleId": "S:abc123...",
  "strokeStyleId": "",
  "effectStyleId": "S:def456...",
  "textStyleId": "S:ghi789..."
}
```

#### Bound Variables

```json
{
  "boundVariables": {
    "topLeftRadius": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:123/456:789"
    },
    "topRightRadius": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:123/456:789"
    },
    "bottomLeftRadius": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:123/456:789"
    },
    "bottomRightRadius": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:123/456:789"
    },
    "paddingLeft": {
      "type": "VARIABLE_ALIAS",
      "id": "VariableID:123/456:790"
    }
  }
}
```

### 2. **Analysis Logic** 📊

Every non-compliant layer includes a "View Analysis Results" section showing the complete rule evaluation:

#### Component Check

```json
{
  "componentCheck": {
    "enabled": true,
    "issue": "Uses local component instead of library component",
    "passed": false
  }
}
```

#### Token Checks

```json
{
  "tokenChecks": [
    {
      "issue": "Uses local color instead of design token",
      "category": "token"
    }
  ]
}
```

#### Style Checks (Detailed)

```json
{
  "styleChecks": [
    {
      "issue": "🔴 Uses 2 local fill colors instead of design tokens",
      "type": "critical"
    },
    {
      "issue": "✅ 1 fill properly bound to variable",
      "type": "success"
    },
    {
      "issue": "⚠️ 1 non-solid fill (gradient/image) - needs manual review",
      "type": "warning"
    },
    {
      "issue": "🔴 Uses local corner radius (8px) instead of spacing token",
      "type": "critical"
    },
    {
      "issue": "✅ Uses shared text style",
      "type": "success"
    }
  ]
}
```

## How to Use

### Viewing Raw Properties

1. **Run analysis** on a frame
2. **Switch to Detailed tab**
3. **Find a non-compliant layer**
4. **Click "🔍 View Raw Properties"** to expand
5. **Inspect the JSON** to see exact Figma properties

#### Use Cases:

- **Debug variable bindings**: Check if `boundVariables` exists
- **Verify colors**: See exact RGB values
- **Check style IDs**: Confirm if styles are applied
- **Inspect effects**: See shadow properties
- **Review layout**: Check padding and spacing values

### Viewing Analysis Results

1. **In the same layer card**
2. **Click "📊 View Analysis Results"** to expand
3. **See the rule evaluation** breakdown

#### Use Cases:

- **Understand why flagged**: See which specific rules failed
- **Check rule categories**: Identify if it's component/token/style issue
- **Verify success items**: See what's already compliant
- **Prioritize fixes**: Critical (🔴) vs Warning (⚠️) vs Success (✅)

## Example: Complete Layer Data

### In the UI

```
┌─────────────────────────────────────────────────────────┐
│ [✓] Button Primary  [❌ NON-COMPLIANT]  [📍 Select] [🔧 Fix]│
│     [RECTANGLE] Frame > Components > Button              │
│                                                          │
│     Issues:                                              │
│     🔴 Uses local fill color instead of design token    │
│     🔴 Uses local corner radius (8px) instead of token  │
│     ✅ Uses shared text style                            │
│                                                          │
│     ▶ 🔍 View Raw Properties                             │
│     ▼ 📊 View Analysis Results                           │
│       {                                                  │
│         "componentCheck": { ... },                       │
│         "tokenChecks": [ ... ],                          │
│         "styleChecks": [                                 │
│           {                                              │
│             "issue": "🔴 Uses local fill color...",      │
│             "type": "critical"                           │
│           },                                             │
│           ...                                            │
│         ]                                                │
│       }                                                  │
└─────────────────────────────────────────────────────────┘
```

## Technical Details

### Data Collection (Backend - code.ts)

The plugin collects this data in the `analyzeLayer` function:

1. **Extract Raw Properties** using `extractRawProperties()`

   - Safely extracts all relevant Figma node properties
   - Handles different node types (TEXT, FRAME, RECTANGLE, etc.)
   - Captures fills, strokes, effects, text, layout properties
   - Includes bound variables and style IDs

2. **Track Analysis Details** during rule evaluation

   - Records component check results
   - Collects token check issues
   - Categorizes style check results by severity

3. **Attach to Layer Data** when non-compliant
   - Adds `rawProperties` object
   - Adds `analysis` object with rule results

### Data Display (Frontend - DetailedView.tsx)

The UI displays this data using:

1. **Collapsible Details Sections**

   - `<details>` HTML elements for expandable content
   - Click-to-expand interaction
   - Formatted JSON display

2. **Syntax-Highlighted JSON**

   - Monospace font for readability
   - Proper indentation (2 spaces)
   - Scrollable containers for long content

3. **Smart Styling**
   - Max height with scroll for long data
   - Border and background for distinction
   - Hover states for interactivity

## Benefits

### 1. **Complete Transparency**

- See exactly what Figma API returns
- Understand how rules are evaluated
- No "black box" analysis

### 2. **Better Debugging**

- Quickly identify missing variable bindings
- Verify if style IDs are present
- Check exact color values

### 3. **Learning Tool**

- Understand Figma's data structure
- Learn about variable bindings
- See how design tokens work

### 4. **External Analysis**

- Export data for AI analysis
- Share with team for review
- Use in custom scripts

### 5. **Trust & Verification**

- Verify plugin's analysis logic
- Confirm issues are real
- Validate fixes worked

## Common Patterns

### Pattern 1: Variable Not Bound

**Raw Properties:**

```json
{
  "fills": [
    {
      "color": { "r": 0.1, "g": 0.6, "b": 0.9 },
      "boundVariables": null // ❌ Not bound
    }
  ]
}
```

**Analysis:**

```json
{
  "styleChecks": [
    {
      "issue": "🔴 Uses local fill color instead of design token",
      "type": "critical"
    }
  ]
}
```

### Pattern 2: Variable Properly Bound

**Raw Properties:**

```json
{
  "fills": [
    {
      "color": { "r": 0.1, "g": 0.6, "b": 0.9 },
      "boundVariables": {
        "color": {
          "type": "VARIABLE_ALIAS",
          "id": "VariableID:123/456:789"
        }
      }
    }
  ]
}
```

**Analysis:**

```json
{
  "styleChecks": [
    {
      "issue": "✅ 1 fill properly bound to variable",
      "type": "success"
    }
  ]
}
```

### Pattern 3: Style Applied

**Raw Properties:**

```json
{
  "fillStyleId": "S:abc123def456",
  "textStyleId": "S:xyz789ghi012"
}
```

**Analysis:**

```json
{
  "styleChecks": [
    {
      "issue": "✅ Uses shared fill style",
      "type": "success"
    },
    {
      "issue": "✅ Uses shared text style",
      "type": "success"
    }
  ]
}
```

## File Size Impact

Adding raw properties and analysis increases data per layer:

- **Before**: ~200 bytes per layer
- **After**: ~800-1500 bytes per layer (depending on complexity)

This is acceptable because:

- Only non-compliant layers include this data
- Data compresses well (gzip)
- Provides immense debugging value
- Can be used for external analysis

## Future Enhancements

Possible future improvements:

1. **Filtering by property** - Search for layers with specific property values
2. **Diff view** - Compare before/after properties when fixes are applied
3. **Export options** - Download raw properties as separate JSON file
4. **Property editor** - Edit properties directly from the UI
5. **Rule testing** - Test custom rules against raw properties

---

**Status**: ✅ Implemented and ready to use
**Build**: Included in latest build
**Documentation**: Complete

Simply reload the plugin in Figma and expand the collapsible sections to see all the detailed data!
