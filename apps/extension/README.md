# Mesurer Chrome Extension

Inspect, annotate, and give feedback on any live interface

Mesurer runs directly where you build. Share feedback with your agents and your team.

Click the extension icon to toggle the Mesurer toolbar on the current page.

Settings are shared across sites with `chrome.storage.local`; guides and measurements are stored separately per page origin and browser tab.

The generated `manifest.json` syncs `name`, `description`, and `version` from `packages/mesurer/package.json`.

## Build

```bash
pnpm build:extension
```

This generates the extension files in `apps/extension/dist`.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `apps/extension/dist`.

## Usage

- Open any regular website page.
- Click the Mesurer extension icon to toggle the toolbar on/off.
- Screenshot on mesurer.dev or localhost uses the extension when it is installed, so Chrome will not ask to share the tab.
- Screenshot on other pages uses the extension's visible-tab capture API after the extension is activated for that tab.
- Use the grouped Select &amp; Inspect and Annotate toolbars to access Inspect, Select, Guides, Rulers, Arrows, Pen, Text, Typography, X-ray, Sample color, and Screenshot.
- Select annotations to move, resize, rotate, delete, or edit them. Use Undo and Redo to review annotation changes.
- Open Settings to configure selection, guide, ruler, arrow, text, color, format, and persistence behavior.
- Keyboard commands include `M` to toggle Mesurer, `I` to Inspect, `S` to select annotations, `A` for Typography, `D` for Arrows, `N` for Pen, `T` for Text, `1` and `2` to switch tool groups, `P` for the color sampler, `C` for Screenshot, `G` for Guides, `X` for X-ray, `R` for rulers, and `H`/`V` for guide orientation.
- Hold `Alt` for distance overlays. Press `Esc` to close panels, cancel interactions, or deselect the active tool; press it twice to exit Mesurer. Use Backspace/Delete to remove selected annotations, `Cmd/Ctrl + A` to select all annotations, `Cmd/Ctrl + Z` to undo, `Cmd/Ctrl + Shift + Z` to redo, and `Cmd/Ctrl + ,` to open Settings.
- Use Clear workspace in Settings to remove guides, measurements, arrows, pen strokes, and text annotations for the current tab.
- Chrome internal pages (like `chrome://`) are not supported by extensions.
