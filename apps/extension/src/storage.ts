import {
  isPagedWorkspaceStore,
  normalizeStoredSettings,
  normalizeStoredWorkspace,
} from "mesurer";
import type {
  MesurerPersistence,
  MesurerPersistenceSnapshot,
  MesurerStoredWorkspace,
  PagedWorkspaceStore,
} from "mesurer";

const SETTINGS_KEY = "mesurer:settings";

const workspaceKey = (origin: string, tabId: string) =>
  `mesurer:workspace:${encodeURIComponent(origin)}:${tabId}`;

const readWorkspaceValue = (
  value: unknown,
): MesurerStoredWorkspace | PagedWorkspaceStore | null =>
  isPagedWorkspaceStore(value) ? value : normalizeStoredWorkspace(value);

export const createExtensionPersistence = async (
  origin: string,
  tabId: string,
): Promise<MesurerPersistence> => {
  const key = workspaceKey(origin, tabId);
  const stored = await chrome.storage.local.get([SETTINGS_KEY, key]);
  let settings = normalizeStoredSettings(stored[SETTINGS_KEY]);
  let workspace = readWorkspaceValue(stored[key]);
  let errorHandler: ((error: unknown) => void) | undefined;
  let settingsTimer: ReturnType<typeof setTimeout> | null = null;

  const flushSettings = () => {
    settingsTimer = null;
    void chrome.storage.local.set({ [SETTINGS_KEY]: settings }).catch((error) => {
      errorHandler?.(error);
    });
  };

  const scheduleSettingsSave = () => {
    if (settingsTimer !== null) clearTimeout(settingsTimer);
    settingsTimer = setTimeout(flushSettings, 100);
  };

  const snapshot = (): MesurerPersistenceSnapshot => ({ settings, workspace });

  return {
    load: snapshot,
    saveSettings: (next) => {
      settings = normalizeStoredSettings(next);
      scheduleSettingsSave();
    },
    saveWorkspace: (next) => {
      workspace = isPagedWorkspaceStore(next) ? next : normalizeStoredWorkspace(next);
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
      if (settingsTimer !== null) clearTimeout(settingsTimer);
      settingsTimer = null;
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
        const settingsChanged = Boolean(changes[SETTINGS_KEY]);
        const workspaceChanged = Boolean(changes[key]);
        if (changes[SETTINGS_KEY]) settings = normalizeStoredSettings(changes[SETTINGS_KEY].newValue);
        if (changes[key]) workspace = readWorkspaceValue(changes[key].newValue);
        if (settingsChanged || workspaceChanged) {
          listener(snapshot(), {
            settings: settingsChanged,
            workspace: workspaceChanged,
          });
        }
      };
      chrome.storage.onChanged.addListener(handleChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleChange);
      };
    },
  };
};
