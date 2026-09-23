import { createRoot, type Root } from "react-dom/client";
import { Mesurer } from "mesurer";
import type { MesurerPersistence } from "mesurer";
import {
  destroyHost,
  getOrCreateContainer,
  recoverHost,
  setHostInvalidatedHandler,
} from "./host";
import { BOOT_KEY, SESSION_MESSAGE, type ExtensionBoot } from "./messages";
import { createExtensionPersistence } from "./storage";
import { captureVisibleTabPng } from "./capture-visible-tab";

const STATE_KEY = "__MESURER_EXTENSION_STATE__";
const OPEN_KEY = "mesurer:open";
const TAB_ID_KEY = "mesurer:tab-id";

type ExtensionState = {
  booted: boolean;
  root: Root | null;
  mounted: boolean;
  mounting: boolean;
  persistence?: MesurerPersistence;
  recover: () => void;
};

type ExtensionGlobal = typeof globalThis & {
  [STATE_KEY]?: ExtensionState;
  [BOOT_KEY]?: ExtensionBoot;
};

const extensionGlobal = globalThis as ExtensionGlobal;

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

const recoverMountedHost = () => {
  recoverHost();
};

const getState = () => {
  if (!extensionGlobal[STATE_KEY]) {
    extensionGlobal[STATE_KEY] = {
      booted: false,
      root: null,
      mounted: false,
      mounting: false,
      recover: recoverMountedHost,
    };
  } else {
    extensionGlobal[STATE_KEY].recover = recoverMountedHost;
  }

  return extensionGlobal[STATE_KEY];
};

const shouldStayOpen = () => {
  try {
    return sessionStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
};

const readBoot = (): ExtensionBoot | null => {
  const boot = extensionGlobal[BOOT_KEY];
  delete extensionGlobal[BOOT_KEY];
  if (boot === "toggle" || boot === "restore") return boot;
  return null;
};

const setOpen = (open: boolean) => {
  try {
    if (open) sessionStorage.setItem(OPEN_KEY, "1");
    else sessionStorage.removeItem(OPEN_KEY);
  } catch {
    // sessionStorage can be blocked
  }
  try {
    chrome.runtime?.sendMessage?.({ type: SESSION_MESSAGE, open });
  } catch {
    // background is optional while injecting
  }
};

let remounting = false;

const remountFromScratch = () => {
  if (remounting) return;
  remounting = true;
  const state = getState();
  if (state.root) {
    try {
      state.root.unmount();
    } catch {
      // the previous tree may already be gone with the host
    }
    state.root = null;
  }
  state.mounted = false;
  state.mounting = false;
  void mount().finally(() => {
    remounting = false;
  });
};

const mount = async () => {
  const state = getState();
  if (state.mounted || state.mounting) {
    recoverHost();
    return;
  }
  state.mounting = true;

  try {
    setHostInvalidatedHandler(remountFromScratch);
    const { container, shadowRoot } = getOrCreateContainer();
    if (typeof chrome !== "undefined" && chrome.storage?.local && !state.persistence) {
      try {
        state.persistence = await createExtensionPersistence(location.origin, getTabId());
      } catch {
        state.persistence = undefined;
      }
    }
    state.root = createRoot(container);
    state.root.render(
      <Mesurer
        portalTarget={shadowRoot}
        persistence={state.persistence}
        persistSession
        persistOnReload={new URLSearchParams(location.search).has("persist")}
        captureVisibleTab={captureVisibleTabPng}
      />,
    );
    state.mounted = true;
    setOpen(true);
  } catch (error) {
    console.error("Mesurer failed to mount", error);
    state.root = null;
    state.mounted = false;
    setOpen(false);
  } finally {
    state.mounting = false;
  }
};

const unmount = () => {
  const state = getState();
  setHostInvalidatedHandler(null);
  if (state.root) {
    try {
      state.root.unmount();
    } catch {
      // host may already have been replaced
    }
  }
  state.root = null;
  state.mounted = false;
  state.mounting = false;
  if (!state.persistence?.load()?.settings.persistOnReload) {
    state.persistence?.clearWorkspace();
  }
  destroyHost();
  setOpen(false);
};

const toggle = () => {
  if (getState().mounted) {
    unmount();
    return;
  }

  void mount();
};

const boot = readBoot();
const state = getState();
if (!state.booted) {
  state.booted = true;
  if (boot === "restore") void mount();
  else toggle();
} else if (boot === "toggle") {
  toggle();
} else if (state.mounted) {
  recoverHost();
} else if (boot === "restore" || shouldStayOpen()) {
  void mount();
}
