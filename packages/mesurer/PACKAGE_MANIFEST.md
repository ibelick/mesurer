# Measurer Package Manifest

This module is now structured so `Measurer` can be moved into a standalone package with a minimal public API.

## Public API

- `Measurer` component.
- Persistence types and `createLocalStoragePersistence`.
- Text inspector API and color picker types.

## Component Props

`Measurer` accepts a small set of optional props:

```ts
type MeasurerProps = {
  highlightColor?: string
  guideColor?: string
  hoverHighlightEnabled?: boolean
  persistOnReload?: boolean
  persistKey?: string
  persistence?: MesurerPersistence
  onPersistenceError?: (error: unknown) => void
}
```

- `highlightColor`: Base color for selection/hover overlays (defaults to `oklch(0.62 0.18 255)`).
- `guideColor`: Base color for guides (defaults to `oklch(0.63 0.26 29.23)`).
- `hoverHighlightEnabled`: When `false`, hover highlight is disabled and clicking a selected item deselects it.
- `persistOnReload`: When `true`, persists guides, measurements, and tool state through the configured persistence adapter.
- `persistKey`: Workspace `localStorage` key used by the default adapter. Default workspaces are isolated per browser tab, while settings are shared globally.
- `persistence`: Optional custom adapter for extension or application-managed storage.
- `onPersistenceError`: Optional callback for storage read/write failures.

The default adapter stores versioned settings and workspace data. Custom adapters can also call `clearWorkspace()` or `clearSettings()` and subscribe to external changes.

## Commands & Shortcuts

- `M`: Toggle measurer on/off
- `S`: Toggle Select mode
- `G`: Toggle Guides mode
- `H`: Set guide orientation to horizontal
- `V`: Set guide orientation to vertical
- `Alt`: Temporarily enable option/guide measurement overlays
- `Esc`: Clear all measurements and guides
- `Backspace` / `Delete`: Remove selected guides
- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + Shift + Z`: Redo

## Runtime Dependencies

These are imported directly by `app/mesurer/**` and should be present in the target project.

- `react`
- `react-dom`

## Recommended `package.json` (when publishing)

```json
{
  "name": "@your-scope/measurer",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "peerDependencies": {
    "react": "^18.2.0 || ^19.0.0",
    "react-dom": "^18.2.0 || ^19.0.0"
  }
}
```

## Styling Notes

- The component uses utility classes and expects Tailwind CSS.
- It also references `ink` color tokens (`bg-ink-900/90`, `text-ink-50`, `text-ink-700`, `text-ink-500`, `border-ink-200`).
- If the target project does not define these tokens, replace them with neutral classes or provide equivalent theme tokens.

### Tailwind Requirements

- Tailwind CSS configured and running in the consuming app.
- Classes must not be stripped by content scanning. Include the package path in Tailwind content.

Example `tailwind.config.js` content entry when packaged:

```js
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@your-scope/measurer/**/*.{js,ts,jsx,tsx}",
  ],
}
```

## Environment Notes

- `Measurer` is a client component (`"use client"`).
- It uses browser APIs (`window`, `document`, `requestAnimationFrame`, `crypto.randomUUID`).
- Keep it client-rendered in the target project.

## Validation Status (current repo)

- `app/mesurer/**` lint passes.
- Root project typecheck still has unrelated pre-existing errors outside `app/mesurer/**`.

## v0.0.1 Publish Checklist

- [ ] Confirm public API is only `Measurer` (no extra exports).
- [ ] Add README with props, shortcuts, and Tailwind requirement.
- [ ] Add LICENSE file.
- [ ] Ensure `react` and `react-dom` are peer dependencies.
- [ ] Add `exports`, `main`, `module`, `types` fields in `package.json`.
- [ ] Build pipeline outputs `.d.ts`.
- [ ] Run `eslint` for package folder.
- [ ] Run a manual smoke test:
  - [ ] Select mode (`S`), Guides mode (`G`)
  - [ ] Alt overlays
  - [ ] Undo/redo (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`)
  - [ ] Clear all (`Esc`)
- [ ] Verify Tailwind content includes package path.
