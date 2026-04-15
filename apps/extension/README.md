# Mesurer Chrome Extension

This extension toggles the Mesurer toolbar on the current page when you click the extension icon.

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
- Chrome internal pages (like `chrome://`) are not supported by extensions.
