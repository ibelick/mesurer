<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://mesurer.dev/logo-dark.svg">
  <img src="https://mesurer.dev/logo.svg" alt="Mesurer" width="200">
</picture>

<br>

[![npm version](https://img.shields.io/npm/v/mesurer)](https://www.npmjs.com/package/mesurer)
[![downloads](https://img.shields.io/npm/dm/mesurer)](https://www.npmjs.com/package/mesurer)

**[Mesurer](https://mesurer.dev)** is a lightweight measurement and alignment overlay for React apps. Toggle it on, select elements, and measure distances directly in the browser.

[Full documentation](https://mesurer.dev/)

## Install

```bash
npm install mesurer
```

## Usage

```tsx
import { Measurer } from "mesurer";

function App() {
  return (
    <>
      <YourApp />
      <Measurer />
    </>
  );
}
```

## Props

| Prop                    | Description                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| `highlightColor`        | Base color for selection/hover overlays (defaults to `oklch(0.62 0.18 255)`). |
| `guideColor`            | Base color for guides (defaults to `oklch(0.63 0.26 29.23)`).                 |
| `hoverHighlightEnabled` | Disables hover highlight and deselects on click when `false`.                 |
| `persistOnReload`       | Persists workspace state across reloads when `true`.                          |
| `persistKey`            | Optional workspace storage key; default workspaces are isolated per browser tab. |
| `portalTarget`          | Optional element or shadow root used as the overlay portal mount target.      |
| `persistence`           | Optional storage adapter for custom or extension-backed persistence.           |
| `onPersistenceError`    | Called when persistence is unavailable or a storage write fails.              |
| `colorPickerFormats`     | Color formats displayed in the picker popover, in display order.             |
| `colorPickerClickFormat` | Format copied to the clipboard when a color is picked.                       |

## Commands

| Shortcut               | Action                                                |
| ---------------------- | ----------------------------------------------------- |
| `M`                    | Toggle measurer on/off.                               |
| `S`                    | Toggle Select mode.                                   |
| `P`                    | Open the native Color picker.                         |
| `G`                    | Toggle Guides mode.                                   |
| `X`                    | Toggle X-ray mode.                                    |
| `R`                    | Toggle pixel rulers along the top and left edges.     |
| `H`                    | Set guide orientation to horizontal.                  |
| `V`                    | Set guide orientation to vertical.                    |
| `Alt`                  | Temporarily enable option/guide measurement overlays. |
| `Esc`                  | Clear all measurements and guides.                    |
| `Backspace` / `Delete` | Remove selected guides.                               |
| `Cmd/Ctrl + Z`         | Undo.                                                 |
| `Cmd/Ctrl + Shift + Z` | Redo.                                                 |
| `Cmd/Ctrl + ,`         | Open Settings.                                        |

## Features

- **Toggle on/off** – Enable the overlay with a single shortcut
- **Select mode** – Click elements to measure their bounds
- **Guides mode** – Add vertical or horizontal guides
- **Rulers** – Show pixel rulers along the top and left edges
- **Distance overlays** – Hold Alt for quick spacing checks
- **Undo/redo** – Command history for guide and measurement changes
- **Persist state** – Keep guides and measurements on reload
- **Color picker** – Use the browser eyedropper to inspect rendered colors
- **Settings** – Configure picker, appearance, measurement, and workspace preferences

## Requirements

- React 18+
- Chromium-based browser for the native color picker

Settings are stored separately from workspace state. The default adapter uses `localStorage`; integrations can provide a `persistence` adapter such as the browser extension's `chrome.storage.local` implementation.

## License

Licensed under the MIT License.
