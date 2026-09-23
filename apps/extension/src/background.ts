import { CAPTURE_VISIBLE_MESSAGE, SAVE_WORKSPACE_MESSAGE, SESSION_MESSAGE, type ExtensionBoot } from "./messages";

const ACTIVE_TABS_KEY = "mesurer:active-tabs";
const restoreTimers = new Map<number, ReturnType<typeof setTimeout>>();

const isInjectableUrl = (url: string | undefined) => {
  if (!url) return true;
  return (
    !url.startsWith("chrome://") &&
    !url.startsWith("chrome-extension://") &&
    !url.startsWith("edge://") &&
    !url.startsWith("about:") &&
    !url.startsWith("https://chrome.google.com/webstore") &&
    !url.startsWith("https://chromewebstore.google.com/")
  );
};

const readActiveTabs = async () => {
  try {
    const stored = await chrome.storage.session.get(ACTIVE_TABS_KEY);
    const ids = stored[ACTIVE_TABS_KEY];
    return Array.isArray(ids) ? ids.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
};

const writeActiveTabs = async (ids: number[]) => {
  try {
    await chrome.storage.session.set({ [ACTIVE_TABS_KEY]: ids });
  } catch {
    // session storage may be unavailable in older browsers
  }
};

const setTabActive = async (tabId: number, open: boolean) => {
  const ids = await readActiveTabs();
  const next = open ? Array.from(new Set([...ids, tabId])) : ids.filter((id) => id !== tabId);
  await writeActiveTabs(next);
};

const inject = async (tabId: number, boot: ExtensionBoot) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    injectImmediately: true,
    files: ["keyboard-gate.js"],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    injectImmediately: true,
    func: (mode: ExtensionBoot) => {
      (globalThis as typeof globalThis & { __MESURER_BOOT__?: ExtensionBoot }).__MESURER_BOOT__ =
        mode;
    },
    args: [boot],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    injectImmediately: true,
    files: ["content.js"],
  });
};

const pingAlive = async (tabId: number) => {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const state = (
          globalThis as typeof globalThis & {
            __MESURER_EXTENSION_STATE__?: { mounted?: boolean; recover?: () => void };
          }
        ).__MESURER_EXTENSION_STATE__;
        if (!state?.mounted) return false;
        state.recover?.();
        return true;
      },
    });
    return results[0]?.result === true;
  } catch {
    return false;
  }
};

const restoreTab = (tabId: number, url?: string) => {
  if (!isInjectableUrl(url)) return;
  const previous = restoreTimers.get(tabId);
  if (previous) clearTimeout(previous);
  restoreTimers.set(
    tabId,
    setTimeout(() => {
      restoreTimers.delete(tabId);
      void pingAlive(tabId)
        .then(async (alive) => {
          if (alive) {
            await chrome.scripting.executeScript({
              target: { tabId },
              world: "MAIN",
              injectImmediately: true,
              files: ["keyboard-gate.js"],
            });
            return;
          }
          return inject(tabId, "restore");
        })
        .catch((error) => {
        console.error("Mesurer failed to restore", error);
      });
    }, 50),
  );
};

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.id !== "number") return;
  if (!isInjectableUrl(tab.url)) return;
  inject(tab.id, "toggle").catch((error) => {
    console.error("Mesurer failed to inject", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === SESSION_MESSAGE) {
    const tabId = sender.tab?.id;
    if (typeof tabId === "number" && typeof message.open === "boolean") {
      void setTabActive(tabId, message.open);
    }
    return false;
  }

  if (message?.type === SAVE_WORKSPACE_MESSAGE && typeof message.key === "string") {
    const write =
      message.workspace == null
        ? chrome.storage.local.remove(message.key)
        : chrome.storage.local.set({ [message.key]: message.workspace });
    void write.catch((error) => {
      console.error("Mesurer failed to save workspace", error);
    });
    return false;
  }

  if (message?.type !== CAPTURE_VISIBLE_MESSAGE) return false;
  const windowId = sender.tab?.windowId;
  const senderTabId = sender.tab?.id;
  if (windowId === undefined || senderTabId === undefined) {
    sendResponse({ ok: false, error: "No window to capture" });
    return false;
  }

  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    if (chrome.runtime.lastError || tabs[0]?.id !== senderTabId) {
      sendResponse({ ok: false, error: "Capture request came from an inactive tab" });
      return;
    }
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError?.message ?? "Capture failed",
        });
        return;
      }
      sendResponse({ ok: true, dataUrl });
    });
  });
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" && !changeInfo.url) return;
  void readActiveTabs().then((ids) => {
    if (!ids.includes(tabId)) return;
    restoreTab(tabId, changeInfo.url ?? tab.url);
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const timer = restoreTimers.get(tabId);
  if (timer) clearTimeout(timer);
  restoreTimers.delete(tabId);
  void setTabActive(tabId, false);
});
