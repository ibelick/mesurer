<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://mesurer.dev/logo-dark.svg">
  <img src="https://mesurer.dev/logo.svg" alt="Mesurer" width="200">
</picture>

<br>

# Mesurer

[![npm version](https://img.shields.io/npm/v/mesurer)](https://www.npmjs.com/package/mesurer)
[![downloads](https://img.shields.io/npm/dm/mesurer)](https://www.npmjs.com/package/mesurer)

**Inspect, annotate, and give feedback on any live interface.**

Mesurer runs directly where you build. Share feedback with your agents and your team.

Mesurer is an open-source UI inspector and visual feedback tool for the browser.
Use guides, rulers, measurements, arrows, freehand pen strokes, text annotations,
color inspection, typography tools, X-ray mode, and screenshots to understand interfaces and communicate precise
visual feedback to coding agents.

[Full documentation](https://mesurer.dev/)

## Install

```bash
npm install mesurer
```

## Usage

```tsx
import { Mesurer } from "mesurer";

function App() {
  return (
    <>
      <YourApp />
      <Mesurer />
    </>
  );
}
```

## Props

| Prop                    | Description                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| `highlightColor`        | Base color for selection/hover overlays (defaults to `oklch(0.62 0.18 255)`). |
| `guideColor`            | Base color for guides (defaults to `oklch(0.63 0.26 29.23)`).                 |
| `arrowColor`            | Base color for arrows (defaults to `oklch(0.63 0.26 29.23)`).                 |
| `guideHighlightEnabled` | Highlights guides when they are hovered or selected. Default `true`.          |
| `hoverHighlightEnabled` | Disables hover highlight and deselects on click when `false`.                 |
| `layoutDetailsEnabled`  | Shows gap and padding under selected dimensions. Default `true`.              |
| `persistOnReload`       | Persists workspace state across reloads when `true`.                          |
| `persistKey`            | Optional workspace storage key; default workspaces are isolated per browser tab. |
| `portalTarget`          | Optional element or shadow root used as the overlay portal mount target.      |
| `persistence`           | Optional storage adapter for custom or extension-backed persistence.           |
| `captureVisibleTab`      | Optional function supplying a PNG of the visible tab for Screenshot capture.  |
| `onPersistenceError`    | Called when persistence is unavailable or a storage write fails.              |
| `colorPickerFormats`     | Color formats displayed in the picker popover, in display order.             |
| `colorPickerClickFormat` | Format copied to the clipboard when a color is picked.                       |
| `snapEnabled`            | Snap selection to nearby elements. Default `true`.                           |
| `snapGuidesEnabled`      | Snap guides to other guides. Default `true`.                                 |
| `snapArrowsEnabled`      | Snap arrow endpoints to nearby elements. Default `true`.                     |
| `arrowClickToPlace`      | Place arrows with clicks instead of drag gestures. Default `false`.           |
| `selectNewGuideEnabled`  | Highlight a guide when it is placed. Default `true`.                         |
| `multiMeasureEnabled`    | Keep previous measurements visible. Default `false`.                         |
| `guideStyle`             | Guide opacity, width, pattern, dash length, and gap.                         |
| `rulerSettings`          | Ruler opacity and edge reveal.                                               |
| `textStyle`              | Default text annotation font and color.                                      |

Props are the defaults. Saved settings override them; **Use defaults** restores the props.

## Commands

| Shortcut               | Action                                                |
| ---------------------- | ----------------------------------------------------- |
| `M`                    | Toggle Mesurer on/off.                                |
| `I`                    | Toggle Inspect mode.                                  |
| `S`                    | Toggle Select mode for annotations.                   |
| `A`                    | Toggle Typography mode.                               |
| `D`                    | Toggle Arrows mode.                                   |
| `N`                    | Toggle Pen mode.                                      |
| `T`                    | Toggle Text mode.                                     |
| `1`                    | Switch to the Select & Inspect tools.                 |
| `2`                    | Switch to the Annotate tools.                         |
| `P`                    | Open the native color sampler.                        |
| `C`                    | Drag a region of the visible tab for a screenshot.    |
| `G`                    | Toggle Guides mode.                                   |
| `X`                    | Toggle X-ray mode.                                    |
| `R`                    | Toggle pixel rulers along the top and left edges.     |
| `H`                    | Set guide orientation to horizontal.                  |
| `V`                    | Set guide orientation to vertical.                    |
| `Alt`                  | Temporarily enable option/guide measurement overlays. |
| `Esc`                  | Close an open panel, cancel the current interaction, or deselect the tool; press twice to exit Mesurer completely. |
| `Backspace` / `Delete` | Remove selected guides, arrows, pen strokes, or text. |
| `Cmd/Ctrl + Z`         | Undo.                                                 |
| `Cmd/Ctrl + Shift + Z` | Redo.                                                 |
| `Cmd/Ctrl + A`         | Select all annotations.                               |
| `Cmd/Ctrl + ,`         | Open Settings.                                        |

## Features

- **Inspect mode** - Click elements to measure their bounds
- **Annotation tools** - Draw arrows, freehand pen strokes, and text notes
- **Annotation selection** - Select, move, resize, rotate, delete, and multi-select annotations
- **Guides mode** - Add and drag vertical or horizontal guides
- **Rulers** - Drag guides from pixel rulers along the top and left edges
- **Typography** - Inspect typography styles and pin text details
- **X-ray mode** - Reveal element structure without changing the page
- **Sample color** - Sample rendered colors and copy values in your chosen format
- **Screenshot** - Drag a region of the visible tab and copy or download it. In a React integration without the extension, the browser may show a tab-sharing prompt.
- **Distance overlays** - Hold Alt for quick spacing checks
- **Undo/redo** - Command history for guides, measurements, arrows, pen strokes, and text annotations
- **Settings** - Configure selection, guide, ruler, arrow, text, color, format, and persistence behavior
- **Workspace controls** - Restore defaults or clear guides, measurements, and annotations

## Requirements

- React 18+
- Chromium-based browser. The native screen color picker requires Chromium on Windows or macOS; Linux Chromium builds may not expose the EyeDropper API.

Settings are stored separately from workspace state. The default adapter uses `localStorage`; integrations can provide a `persistence` adapter such as the browser extension's `chrome.storage.local` implementation.

## License

Licensed under the MIT License.
