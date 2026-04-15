chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    })
    .catch(() => undefined);
});
