# Browser activation contract

The plugin bundles `../assets/launcher.global.js` (relative to this reference).
Resolve the actual installed skill path; never assume the development repo exists.
The adjacent SHA-256 file identifies the built asset. No CDN or remote loader is
required. The script bundles React, Mesurer, and styles.

## Supported host required

Read the current browser tool's documentation. There is deliberately no guessed
Codex browser API in this package. A documented, permitted page-script execution
capability must exist before loading this asset. Follow the host's site-scoped
approval flow. Do not enable developer mode or change permissions automatically.
A read-only `evaluate` API is insufficient, even if it accepts JavaScript strings.

When the host supports executing a supplied script in the selected document, pass
the asset contents through that documented API. Loading it mounts Mesurer once;
reloading the same version does not toggle it off or duplicate it. Wait for the
visible toolbar. Do not use remote debugging or shell browser access as a fallback.

## Launcher API

These are page-side functions, not host APIs. Use them only through permitted
page execution, never through an API restricted to read-only DOM inspection.

- `window.__MESURER_CODEX__.status()` returns mounted state, current URL and version.
- `window.__MESURER_CODEX__.feedback()` returns current-page open comments as text
  with URL and viewport. Workspace persistence is debounced; wait for the saved
  comment to appear in the result before using it.
- `window.__MESURER_CODEX__.stop()` unmounts this launcher's React tree and host.
- `window.__MESURER_CODEX__.start()` remounts it within the same document.

No network upload or backend occurs. The page can observe this launcher and its
in-memory data; it is not an isolated Chrome extension execution world. Feedback
can include sensitive page content. Share only within the user's requested task.

Full navigation requires activation again. Unmounting removes the toolbar and
listeners owned by its React tree; the shared Mesurer core may retain its existing
history instrumentation until document reload. The launcher does not install
Chrome's keyboard-gate prototype patches. Test shortcut conflicts on target sites.

## Host acceptance test

In a supported desktop session: install the plugin, activate on the explicitly
selected page, inspect a known element, add a comment, read the exact feedback,
then stop. Verify one toolbar, correct selector/viewport, and removal. Repeat after
an SPA route change and a full reload. Record browser version and permissions.
Passing standalone Playwright tests does not establish this host acceptance test.
