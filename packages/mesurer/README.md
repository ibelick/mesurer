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
| `persistOnReload`       | Persists state in `localStorage` as `mesurer-state` when `true`.              |
| `portalTarget`          | Optional element or shadow root used as the overlay portal mount target.      |

## Commands

| Shortcut               | Action                                                |
| ---------------------- | ----------------------------------------------------- |
| `M`                    | Toggle measurer on/off.                               |
| `S`                    | Toggle Select mode.                                   |
| `G`                    | Toggle Guides mode.                                   |
| `H`                    | Set guide orientation to horizontal.                  |
| `V`                    | Set guide orientation to vertical.                    |
| `Alt`                  | Temporarily enable option/guide measurement overlays. |
| `Esc`                  | Clear all measurements and guides.                    |
| `Backspace` / `Delete` | Remove selected guides.                               |
| `Cmd/Ctrl + Z`         | Undo.                                                 |
| `Cmd/Ctrl + Shift + Z` | Redo.                                                 |

## Features

- **Toggle on/off** – Enable the overlay with a single shortcut
- **Select mode** – Click elements to measure their bounds
- **Guides mode** – Add vertical or horizontal guides
- **Distance overlays** – Hold Alt for quick spacing checks
- **Undo/redo** – Command history for guide and measurement changes
- **Persist state** – Keep guides and measurements on reload

## Requirements

- React 18+

## License

Licensed under the MIT License.
