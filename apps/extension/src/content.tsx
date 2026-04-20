import { createRoot, type Root } from "react-dom/client";
import { Measurer, TextInspector } from "mesurer";

const HOST_ID = "mesurer-extension-host";
const ROOT_ID = "mesurer-extension-root";
const STATE_KEY = "__MESURER_EXTENSION_STATE__";

type ExtensionState = {
  root: Root | null;
  mounted: boolean;
};

type ExtensionGlobal = typeof globalThis & {
  [STATE_KEY]?: ExtensionState;
};

const extensionGlobal = globalThis as ExtensionGlobal;

const getState = () => {
  if (!extensionGlobal[STATE_KEY]) {
    extensionGlobal[STATE_KEY] = {
      root: null,
      mounted: false,
    };
  }

  return extensionGlobal[STATE_KEY];
};

const getOrCreateContainer = () => {
  let host = document.getElementById(HOST_ID);

  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";
    host.style.isolation = "isolate";
    document.body.appendChild(host);
  }

  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: "open" });

  let container = shadowRoot.getElementById(ROOT_ID);

  if (!container) {
    container = document.createElement("div");
    container.id = ROOT_ID;
    shadowRoot.appendChild(container);
  }

  return { container, shadowRoot };
};

const mount = () => {
  const state = getState();
  if (state.mounted) return;

  const { container, shadowRoot } = getOrCreateContainer();
  state.root = createRoot(container);
  state.root.render(<Measurer portalTarget={shadowRoot} />);
  state.mounted = true;
};

const unmount = () => {
  const state = getState();
  if (!state.mounted || !state.root) return;

  state.root.unmount();
  state.root = null;
  state.mounted = false;

  // Belt-and-suspenders: the Measurer's own useEffect cleanup calls this
  // on unmount, but calling it again here guarantees nothing leaks if the
  // React tree tears down out of order (SPA re-injection, etc.).
  TextInspector.cleanup();

  const host = document.getElementById(HOST_ID);
  if (host) {
    host.remove();
  }
};

const toggle = () => {
  if (getState().mounted) {
    unmount();
    return;
  }

  mount();
};

toggle();
