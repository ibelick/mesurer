import type { ReactNode } from "react";

const props: { name: string; description: ReactNode }[] = [
  {
    name: "highlightColor",
    description: (
      <>
        Base color for selection/hover overlays (defaults to{" "}
        <code className="code">oklch(0.62 0.18 255)</code>)
      </>
    ),
  },
  { name: "colorPickerFormats", description: "Formats shown by the color picker" },
  { name: "colorPickerClickFormat", description: "Format copied when a color value is clicked" },
  {
    name: "guideColor",
    description: (
      <>
        Base color for guides (defaults to <code className="code">oklch(0.63 0.26 29.23)</code>)
      </>
    ),
  },
  { name: "arrowColor", description: "Base color for arrows" },
  { name: "guideHighlightEnabled", description: "Highlights guides when hovered or selected" },
  { name: "hoverHighlightEnabled", description: "Enables hover highlighting in Inspect mode" },
  { name: "layoutDetailsEnabled", description: "Shows gap and padding details under selected dimensions" },
  { name: "persistOnReload", description: "Persists workspace state across reloads" },
  { name: "shortcutsEnabled", description: "Enables global keyboard shortcuts" },
  { name: "persistKey", description: "Optional key for isolating persisted workspaces" },
  { name: "portalTarget", description: "Element or shadow root where the overlay is mounted" },
  { name: "persistence", description: "Custom storage adapter for settings and workspace state" },
  { name: "onPersistenceError", description: "Called when persistence is unavailable or a write fails" },
  { name: "captureVisibleTab", description: "Provides a visible-tab PNG for Screenshot capture" },
  { name: "features", description: "Enable or disable Screenshot, Rulers, and Settings" },
  { name: "initialState", description: "Set initial workspace data and toolbar state; saved state wins" },
  { name: "snapEnabled", description: "Snap selection to nearby elements" },
  { name: "snapGuidesEnabled", description: "Snap guides to other guides" },
  { name: "snapArrowsEnabled", description: "Snap arrow endpoints to nearby elements" },
  { name: "arrowClickToPlace", description: "Place arrows with clicks instead of dragging" },
  { name: "selectNewGuideEnabled", description: "Highlight a guide when it is placed" },
  { name: "multiMeasureEnabled", description: "Keep previous measurements visible" },
  { name: "guideStyle", description: "Guide opacity, width, and pattern" },
  { name: "rulerSettings", description: "Ruler opacity and edge reveal" },
  { name: "textStyle", description: "Default text annotation font and color" },
];

export default function PropList() {
  return (
    <div className="site-props -mx-2 flex flex-col border-t border-border [&>div]:flex-col [&>div]:gap-2 [&>div>div:first-child]:break-words sm:[&>div]:flex-row sm:[&>div]:items-start sm:[&>div]:justify-between sm:[&>div]:gap-8 [&>div>div:last-child]:max-w-none [&>div>div:last-child]:text-left sm:[&>div>div:last-child]:max-w-[60%] sm:[&>div>div:last-child]:text-right">
      {props.map((prop) => (
        <div key={prop.name} className="flex items-start justify-between gap-8 border-b border-border px-2 py-2">
          <div className="font-mono text-strong">
            <code className="code">{prop.name}</code>
          </div>
          <div className="max-w-[60%] text-right text-balance text-muted">{prop.description}</div>
        </div>
      ))}
    </div>
  );
}
