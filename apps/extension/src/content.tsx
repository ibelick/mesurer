import { createRoot, type Root } from "react-dom/client";
import { MesurerUnstyled } from "../../../packages/mesurer/mesurer";
import { ensureMesurerStyles } from "../../../packages/mesurer/runtime/style-inject";
import type { MesurerPersistence } from "mesurer";
import {
  destroyHost,
  getOrCreateContainer,
  recoverHost,
  setHostInvalidatedHandler,
} from "./host";
import { BOOT_KEY, PERSIST_DEFAULT_KEY, STYLES_KEY, RECORDING_ABORT_MESSAGE, RECORDING_PREPARED_MESSAGE, RECORDING_PREPARE_MESSAGE, RECORDING_READY_MESSAGE, RECORDING_STARTED_MESSAGE, RECORDING_START_MESSAGE, RECORDING_STOP_MESSAGE, SESSION_MESSAGE, FETCH_IMAGE_MESSAGE, PUBLISH_REVIEW_MESSAGE, type ExtensionBoot } from "./messages";
import { createExtensionPersistence } from "./storage";
import { captureVisibleTabPng } from "./capture-visible-tab";

declare const __MESURER_REVIEW__: boolean;

type ReviewCaptureModule = typeof import("./review-capture");

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
  [STYLES_KEY]?: string;
  [PERSIST_DEFAULT_KEY]?: boolean;
};

const extensionGlobal = globalThis as ExtensionGlobal;
let reviewCaptureModule: Promise<ReviewCaptureModule> | null = null;

// Images the page cannot read itself (another origin's, without CORS headers) come through the
// background, which the host permissions let fetch them.
const loadImageViaBackground = async (url: string) => {
  const response = await chrome.runtime.sendMessage({ type: FETCH_IMAGE_MESSAGE, url });
  return response?.ok && typeof response.dataUrl === "string" ? response.dataUrl : undefined;
};

// What only saving a review needs (the capture engine, the viewer's page) stays out of the
// content script and loads the first time one is saved.
const loadReviewCapture = () => {
  if (!reviewCaptureModule) {
    reviewCaptureModule = import(/* @vite-ignore */ chrome.runtime.getURL("review-capture.js"));
  }
  return reviewCaptureModule;
};

const captureDocumentWithSnapdom = async (ownerDocument: Document, ownerWindow: Window) =>
  (await loadReviewCapture()).captureDocumentWithSnapdom(ownerDocument, ownerWindow, { loadImage: loadImageViaBackground });

const createReviewViewer: ReviewCaptureModule["createEphemeralReviewUrl"] = async (...args) =>
  (await loadReviewCapture()).createEphemeralReviewUrl(...args);

// The page Mesurer is on is any site, which cannot keep a review or show one: the background
// hands it to where reviews are kept, and says where it opens.
const publishReview = async ({ id, html }: { id: string; html: string }) => {
  const response = await chrome.runtime.sendMessage({ type: PUBLISH_REVIEW_MESSAGE, id, html });
  if (!response?.ok || typeof response.url !== "string") throw new Error("Review not saved");
  return response.url as string;
};

// The tab is open by now, and filled as soon as the code that fills it has loaded.
const showReviewLoading = (view: Window) => {
  void loadReviewCapture().then((capture) => capture.showReviewLoading(view));
};

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
    if (typeof chrome !== "undefined" && !state.extensionRecording) {
      state.extensionRecording = createExtensionRecording();
    }
    const recordingPlayer = typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("recording-player.html")
      : undefined;
    // The stylesheet ships once, as mesurer.css: the background reads it and hands it over
    // before this script runs, rather than it being built into the script as well.
    ensureMesurerStyles(extensionGlobal[STYLES_KEY] ?? "", shadowRoot);
    state.root = createRoot(container);
    state.root.render(
      <MesurerUnstyled
        platform={false}
        portalTarget={shadowRoot}
        persistence={state.persistence}
        persistSession
        // On by default, as in the package: "Use defaults" in Settings leaves Persist on.
        persistOnReload={(extensionGlobal[PERSIST_DEFAULT_KEY] ?? true) || new URLSearchParams(location.search).has("persist")}
        captureVisibleTab={captureVisibleTabPng}
        features={{ review: __MESURER_REVIEW__ }}
        // What saving a review needs, in a build that offers it.
        {...(__MESURER_REVIEW__ && typeof chrome !== "undefined"
          ? { captureDom: captureDocumentWithSnapdom, createReviewViewer, publishReview, showReviewLoading }
          : null)}
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
