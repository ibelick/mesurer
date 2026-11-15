# Mesurer for Codex — developer preview

This package contains the real Mesurer toolbar as a standalone browser bundle,
a Codex skill, plugin metadata, and build/package tooling. It reuses
`packages/mesurer`; it does not fork the inspection or annotation UI.

**Host activation is not yet verified.** Installation is not equivalent to a
Chrome extension: the selected browser must provide an explicitly authorized
page-script execution API, or the website must already embed Mesurer. The default
read-only browser evaluation API cannot load this launcher. This preview must not
be advertised as one-click Mesurer on arbitrary Codex browser pages.

## Build and test

From the repository root:

```sh
pnpm install
pnpm build:codex
pnpm --filter mesurer-codex typecheck
pnpm test:codex
pnpm package:codex
```

The build produces `apps/codex/dist/mesurer/` as a self-contained plugin and a local
marketplace under `apps/codex/dist/.agents/plugins/marketplace.json`. The package
command produces `apps/codex/dist/mesurer-codex-0.1.0.zip`. Built files are ignored;
rebuild before installing or distributing. No install hooks, cloud service, API
key, or MCP server is required for this preview.

## Install for local testing

```sh
codex plugin marketplace add /absolute/path/to/mesurer/apps/codex/dist
```

Restart the desktop app if needed, select **Mesurer development** in the Plugins
Directory, and install Mesurer. Test in a new chat. Marketplace installation uses
a cached copy: refresh/reinstall after rebuilding. The skill reports a specific
capability limitation if the host cannot execute the bundle. It must not bypass
browser restrictions or silently change the user's project.

## Features and boundaries

- Shared toolbar: inspect, spacing, typography, guides, rulers, X-ray, drawing,
  text and element-linked comments.
- Shadow DOM isolates styles. A single document-scoped runtime prevents duplicate
  mounts and supports explicit stop/start.
- In-memory, page-scoped workspace avoids writing annotations to website storage.
  Annotations are lost on full reload. The shared core may write its normal tab ID
  to sessionStorage. Page scripts can observe the launcher and its data.
- Screenshots and video use Mesurer's browser screen-sharing fallback, subject to
  availability and user permissions. EyeDropper and clipboard support vary by host.
- Full navigation needs a fresh authorized activation. SPA routes reuse core
  scoping. The Chrome extension's background lifecycle and keyboard isolation are
  not included; host/site compatibility still needs acceptance testing.
- No automatic transmission of feedback, site data, screenshots, or recordings.

## Before public submission

Complete the host acceptance test in `skills/mesurer/references/browser.md`, verify
capture and keyboard behavior, and update the capability claims accordingly.
Review the existing publisher privacy/terms pages for this distribution. Submit
the ZIP at https://platform.openai.com/plugins using a verified publisher account,
address review findings, then publish the approved version. Nothing in these
scripts installs, submits, or publishes the plugin automatically.

References: https://developers.openai.com/plugins/build/plugins and
https://learn.chatgpt.com/docs/browser#developer-mode.
