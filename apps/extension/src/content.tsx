import { createRoot, type Root } from "react-dom/client";
import { Mesurer } from "mesurer";
import type { MesurerPersistence } from "mesurer";
import {
  destroyHost,
  getOrCreateContainer,
  recoverHost,
  setHostInvalidatedHandler,
} from "./host";
import { BOOT_KEY, RECORDING_ABORT_MESSAGE, RECORDING_PREPARED_MESSAGE, RECORDING_PREPARE_MESSAGE, RECORDING_READY_MESSAGE, RECORDING_STARTED_MESSAGE, RECORDING_START_MESSAGE, RECORDING_STOP_MESSAGE, SESSION_MESSAGE, type ExtensionBoot } from "./messages";
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
  extensionRecording?: ReturnType<typeof createExtensionRecording>;
  recover: () => void;
};

type ExtensionGlobal = typeof globalThis & {
  [STATE_KEY]?: ExtensionState;
  [BOOT_KEY]?: ExtensionBoot;
};

const extensionGlobal = globalThis as ExtensionGlobal;

function createExtensionRecording() {
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
    const unavailable = () => Promise.reject(new Error("Recording is unavailable"));
    return {
      prepare: unavailable,
      start: unavailable,
      stop: unavailable,
      abort: () => {},
      dispose: () => {},
    };
  }
  let ready: ((value: { id: string; duration: number }) => void) | null = null;
  let failed: ((error: Error) => void) | null = null;
  let prepared: (() => void) | null = null;
  let prepareFailed: ((error: Error) => void) | null = null;
  let started: (() => void) | null = null;
  let startFailed: ((error: Error) => void) | null = null;
  const onMessage = (message: { type?: string; error?: string; id?: string; duration?: number }, _sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => {
    if (message?.type === RECORDING_PREPARED_MESSAGE) {
      if (message.error) prepareFailed?.(new Error(message.error));
      else prepared?.();
      prepared = null;
      prepareFailed = null;
      return;
    }
    if (message?.type === RECORDING_STARTED_MESSAGE) {
      if (message.error) startFailed?.(new Error(message.error));
      else started?.();
      started = null;
      startFailed = null;
      return;
    }
    if (message?.type !== RECORDING_READY_MESSAGE) return;
    if (message.error) {
      startFailed?.(new Error(message.error));
      failed?.(new Error(message.error));
    }
    else if (typeof message.id === "string" && typeof message.duration === "number") ready?.({ id: message.id, duration: message.duration });
    else failed?.(new Error("Recording failed"));
    ready = null;
    failed = null;
  };
  chrome.runtime.onMessage.addListener(onMessage);
  return {
    prepare: () => new Promise<void>((resolve, reject) => {
      prepared = resolve;
      prepareFailed = reject;
      chrome.runtime.sendMessage({ type: RECORDING_PREPARE_MESSAGE }, (response) => {
        const error = chrome.runtime.lastError?.message;
        if (error || !response?.ok) {
          prepared = null;
          prepareFailed = null;
          reject(new Error(error ?? response?.error ?? "Tab capture unavailable"));
        }
      });
    }),
    start: async (input: { rect: { left: number; top: number; width: number; height: number }; viewport: { width: number; height: number } }) => {
      await new Promise<void>((resolve, reject) => {
        started = resolve;
        startFailed = reject;
        chrome.runtime.sendMessage({ type: RECORDING_START_MESSAGE, ...input }, (response) => {
          const error = chrome.runtime.lastError?.message;
          if (error || !response?.ok) {
            started = null;
            startFailed = null;
            reject(new Error(error ?? response?.error ?? "Recording failed"));
          }
        });
      });
    },
    stop: () => new Promise<{ id: string; duration: number }>((resolve, reject) => {
      ready = resolve;
      failed = reject;
      void chrome.runtime.sendMessage({ type: RECORDING_STOP_MESSAGE }).catch(() => undefined);
    }),
    abort: () => {
      startFailed?.(new DOMException("Recording was cancelled", "AbortError"));
      prepareFailed?.(new DOMException("Recording was cancelled", "AbortError"));
      ready = null;
      failed = null;
      prepared = null;
      prepareFailed = null;
      started = null;
      startFailed = null;
      void chrome.runtime.sendMessage({ type: RECORDING_ABORT_MESSAGE }).catch(() => undefined);
    },
    dispose: () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    },
  };
}

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
    if (!state.extensionRecording) {
      state.extensionRecording = createExtensionRecording();
    }
    const recordingPlayer = typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("recording-player.html")
      : undefined;
    state.root = createRoot(container);
    state.root.render(
      <Mesurer
        portalTarget={shadowRoot}
        persistence={state.persistence}
        persistSession
        persistOnReload={new URLSearchParams(location.search).has("persist")}
        captureVisibleTab={captureVisibleTabPng}
        extensionRecording={state.extensionRecording}
        extensionRecordingPlayer={recordingPlayer}
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
