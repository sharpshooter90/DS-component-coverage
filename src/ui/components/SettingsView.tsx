import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";

interface Settings {
  checkComponents: boolean;
  checkTokens: boolean;
  checkStyles: boolean;
  allowLocalStyles: boolean;
  ignoredTypes: string[];
}

interface SettingsViewProps {
  settings: Settings;
  onUpdateSettings: (settings: Partial<Settings>) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
}) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Coverage Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Component Coverage</Label>
              <CardDescription className="text-xs">
                Check if layers use library components instead of local elements
              </CardDescription>
            </div>
            <Switch
              checked={settings.checkComponents}
              onCheckedChange={(checked) =>
                onUpdateSettings({ checkComponents: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Token Coverage</Label>
              <CardDescription className="text-xs">
                Check if layers use design tokens for colors, typography, and
                spacing
              </CardDescription>
            </div>
            <Switch
              checked={settings.checkTokens}
              onCheckedChange={(checked) =>
                onUpdateSettings({ checkTokens: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Style Coverage</Label>
              <CardDescription className="text-xs">
                Check if layers use shared Figma styles
              </CardDescription>
            </div>
            <Switch
              checked={settings.checkStyles}
              onCheckedChange={(checked) =>
                onUpdateSettings({ checkStyles: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Analysis Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Allow Local Styles</Label>
              <CardDescription className="text-xs">
                Don't flag layers using local styles as non-compliant
              </CardDescription>
            </div>
            <Switch
              checked={settings.allowLocalStyles}
              onCheckedChange={(checked) =>
                onUpdateSettings({ allowLocalStyles: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            This plugin analyzes your designs for design system compliance. It
            checks component usage, design token adoption, and shared style
            usage to help maintain consistency across your designs.
          </p>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong>How to use:</strong>
            <br />
            1. Select a frame, component, or instance
            <br />
            2. Click "Analyze Selection"
            <br />
            3. Review the summary and detailed report
            <br />
            4. Fix non-compliant layers and re-run the analysis
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsView;
