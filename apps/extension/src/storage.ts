import {
  normalizeStoredSettings,
  normalizeStoredWorkspace,
} from "mesurer";
import type {
  MesurerPersistence,
  MesurerPersistenceSnapshot,
} from "mesurer";

const SETTINGS_KEY = "mesurer:settings";

const workspaceKey = (origin: string) =>
  `mesurer:workspace:${encodeURIComponent(origin)}`;

export const createExtensionPersistence = async (
  origin: string,
): Promise<MesurerPersistence> => {
  const key = workspaceKey(origin);
  const stored = await chrome.storage.local.get([SETTINGS_KEY, key]);
  let settings = normalizeStoredSettings(stored[SETTINGS_KEY]);
  let workspace = normalizeStoredWorkspace(stored[key]);
  let errorHandler: ((error: unknown) => void) | undefined;

  const snapshot = (): MesurerPersistenceSnapshot => ({ settings, workspace });

  return {
    load: snapshot,
    saveSettings: (next) => {
      settings = normalizeStoredSettings(next);
      void chrome.storage.local.set({ [SETTINGS_KEY]: settings }).catch((error) => {
        errorHandler?.(error);
      });
    },
    saveWorkspace: (next) => {
      workspace = normalizeStoredWorkspace(next);
      void chrome.storage.local.set({ [key]: workspace }).catch((error) => {
        errorHandler?.(error);
      });
    },
    clearWorkspace: () => {
      workspace = null;
      void chrome.storage.local.remove(key).catch((error) => {
        errorHandler?.(error);
      });
    },
    clearSettings: () => {
      settings = {};
      void chrome.storage.local.remove(SETTINGS_KEY).catch((error) => {
        errorHandler?.(error);
      });
    },
    setErrorHandler: (handler) => {
      errorHandler = handler;
    },
    subscribe: (listener) => {
      const handleChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area !== "local") return;
        if (changes[SETTINGS_KEY]) settings = normalizeStoredSettings(changes[SETTINGS_KEY].newValue);
        if (changes[key]) workspace = normalizeStoredWorkspace(changes[key].newValue);
        if (changes[SETTINGS_KEY] || changes[key]) listener(snapshot());
      };
      chrome.storage.onChanged.addListener(handleChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleChange);
      };
    },
  };
};
