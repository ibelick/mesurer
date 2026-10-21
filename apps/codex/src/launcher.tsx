import { createRoot, type Root } from "react-dom/client";
import { Mesurer, isPagedWorkspaceStore, type MesurerPersistence, type MesurerPersistenceSnapshot } from "mesurer";
import { formatCommentsForAgent } from "../../../packages/mesurer/comments/export";
import { getPageKey } from "../../../packages/mesurer/core/workspace";

const KEY = "__MESURER_CODEX__";
const HOST_ID = "mesurer-codex-host";
const VERSION = "0.1.0";

type Runtime = {
  version: string;
  start(): void;
  stop(): void;
  status(): { mounted: boolean; url: string; version: string };
  feedback(): { url: string; viewport: { width: number; height: number }; text: string };
};
const scope = window as Window & { [KEY]?: Runtime };

function createRuntime(): Runtime {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  let observer: MutationObserver | null = null;
  let snapshot: MesurerPersistenceSnapshot = { settings: {}, workspace: null };
  // The component already partitions this store by route. Keep feedback in this
  // document's memory; do not mix with an embedded or extension workspace.
  const persistence: MesurerPersistence = {
    load: () => snapshot,
    saveSettings: settings => { snapshot = { ...snapshot, settings }; },
    saveWorkspace: workspace => { snapshot = { ...snapshot, workspace }; },
    clearSettings: () => { snapshot = { ...snapshot, settings: {} }; },
    clearWorkspace: () => { snapshot = { ...snapshot, workspace: null }; },
  };

  const api: Runtime = {
    version: VERSION,
    start() {
      if (root) return;
      if (!document.documentElement || !/^https?:$/.test(location.protocol)) {
        throw new Error("Mesurer requires a loaded HTTP or HTTPS page.");
      }
      if (document.getElementById(HOST_ID)) {
        throw new Error("A different Mesurer host already owns this page.");
      }
      host = document.createElement("div");
      host.id = HOST_ID;
      // Same isolation pattern as the extension, without chrome.runtime APIs.
      const styles: Record<string, string> = {
        all: "initial", position: "fixed", inset: "0", width: "100vw",
        height: "100vh", "pointer-events": "none", "z-index": "2147483647",
        display: "block", isolation: "isolate", visibility: "visible",
        opacity: "1", transform: "none", "color-scheme": "light",
      };
      for (const [key, value] of Object.entries(styles)) host.style.setProperty(key, value, "important");
      const shadow = host.attachShadow({ mode: "open" });
      const container = document.createElement("div");
      shadow.appendChild(container);
      document.documentElement.appendChild(host);
      root = createRoot(container);
      root.render(<Mesurer portalTarget={shadow} persistence={persistence} persistSession
        initialState={{ enabled: true, minimized: false }} />);
      observer = new MutationObserver(() => {
        if (host && !host.isConnected && document.documentElement) {
          document.documentElement.appendChild(host);
          observer?.observe(document.documentElement, { childList: true });
        }
      });
      observer.observe(document, { childList: true });
      observer.observe(document.documentElement, { childList: true });
    },
    stop() {
      observer?.disconnect();
      observer = null;
      root?.unmount();
      root = null;
      host?.remove();
      host = null;
    },
    status: () => ({ mounted: Boolean(host?.isConnected && root), url: location.href, version: VERSION }),
    feedback() {
      const workspace = snapshot.workspace;
      const page = isPagedWorkspaceStore(workspace) ? workspace.pages[getPageKey(window)] : workspace;
      const comments = (page?.comments ?? []).filter(comment => comment.status === "open");
      const viewport = { width: innerWidth, height: innerHeight };
      return { url: location.href, viewport, text: formatCommentsForAgent(comments, location.href, viewport) };
    },
  };
  return api;
}

if (scope[KEY] && scope[KEY]?.version !== VERSION) {
  throw new Error("A different Mesurer launcher version is active. Reload before upgrading.");
}
const runtime = scope[KEY] ?? createRuntime();
scope[KEY] = runtime;
runtime.start();
