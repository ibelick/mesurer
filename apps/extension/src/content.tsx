import { createRoot, type Root } from "react-dom/client";
import { Measurer } from "mesurer";
import { destroyHost, getOrCreateContainer } from "./host";
import { createExtensionPersistence } from "./storage";

const STATE_KEY = "__MESURER_EXTENSION_STATE__";

type ExtensionState = {
  root: Root | null;
  mounted: boolean;
  mounting: boolean;
};

type ExtensionGlobal = typeof globalThis & {
  [STATE_KEY]?: ExtensionState;
};

const extensionGlobal = globalThis as ExtensionGlobal;
const TAB_ID_KEY = "mesurer:tab-id";

const getTabId = () => {
  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_KEY, id);
    return id;
  } catch {
    return "session";
  }
};

const getState = () => {
  if (!extensionGlobal[STATE_KEY]) {
    extensionGlobal[STATE_KEY] = {
      root: null,
      mounted: false,
      mounting: false,
    };
  }

  return extensionGlobal[STATE_KEY];
};

const mount = async () => {
  const state = getState();
  if (state.mounted || state.mounting) return;
  state.mounting = true;

  try {
    const { container, shadowRoot } = getOrCreateContainer();
    let persistence: Awaited<ReturnType<typeof createExtensionPersistence>> | undefined;
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      try {
        persistence = await createExtensionPersistence(location.origin, getTabId());
      } catch {
        persistence = undefined;
      }
    }
    state.root = createRoot(container);
    state.root.render(
      <Measurer
        portalTarget={shadowRoot}
        persistence={persistence}
        persistOnReload={new URLSearchParams(location.search).has("persist")}
      />,
    );
    state.mounted = true;
  } catch {
    state.root = null;
    state.mounted = false;
  } finally {
    state.mounting = false;
  }
};

const unmount = () => {
  const state = getState();
  if (!state.mounted || !state.root) return;

  state.root.unmount();
  state.root = null;
  state.mounted = false;
  state.mounting = false;
  destroyHost();
};

const toggle = () => {
  if (getState().mounted) {
    unmount();
    return;
  }

  void mount();
};

toggle();
