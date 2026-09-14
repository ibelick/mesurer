import { CAPTURE_VISIBLE_MESSAGE } from "./messages";

chrome.action.onClicked.addListener((tab) => {
  if (typeof tab.id !== "number") return
  const tabId: number = tab.id

  chrome.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      injectImmediately: true,
      files: ["keyboard-gate.js"],
    })
    .then(() =>
      chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      }),
    )
    .catch((error) => {
      console.error("Mesurer failed to inject", error);
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
