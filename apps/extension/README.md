# Mesurer Chrome Extension

UI Inspector & Visual Feedback

Visual precision for building with coding agents.

Measure, inspect, and capture exactly what you see in the browser.

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
- Use Select, Guides, Rulers, Text Inspector, X-ray, Color picker, and Screenshot from the toolbar.
- Open Settings to configure colors, guide styles, ruler behavior, formats, and persistence.
- Use Clear workspace in Settings to remove guides and measurements for the current tab.
- Chrome internal pages (like `chrome://`) are not supported by extensions.
