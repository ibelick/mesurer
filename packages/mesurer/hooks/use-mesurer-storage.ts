import { useMemo, useRef } from "react"
import {
  createLocalStoragePersistence,
  createPageScopedPersistence,
  isPagedWorkspaceStore,
  type MesurerPageArtifacts,
  type MesurerPersistence,
} from "../core/persistence"
import {
  getTabId,
  LEGACY_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  sanitizeStoredSettings,
} from "../core/workspace"
import { usePageKey } from "./use-page-key"

// Each instance on a page gets its own number, so a second one does not share the first's storage.
let mesurerInstanceCount = 0

// Where this instance saves and what it starts from: the persistence it writes through, scoped
// to the page being shown, and the settings and workspace that were saved last time.
export const useMesurerStorage = ({
  ownerWindow,
  persistKey,
  persistence,
  persistOnReload,
  persistSession,
}: {
  ownerWindow: Window & typeof globalThis
  persistKey?: string
  persistence?: MesurerPersistence
  persistOnReload: boolean
  persistSession: boolean
}) => {
  const instanceIdRef = useRef<number | null>(null)
  if (instanceIdRef.current === null) {
    instanceIdRef.current = ++mesurerInstanceCount
  }
  const tabIdRef = useRef<string | null>(null)
  if (tabIdRef.current === null) tabIdRef.current = getTabId(ownerWindow)
  const storageKey =
    persistKey ??
    (instanceIdRef.current === 1
      ? `mesurer-state:${tabIdRef.current}`
      : `mesurer-state:${tabIdRef.current}:${instanceIdRef.current}`)
  const legacyStorageKey = persistKey ? undefined : LEGACY_STORAGE_KEY
  const pageKey = usePageKey(ownerWindow)
  const appliedPageKeyRef = useRef(pageKey)
  const pageWorkspacesRef = useRef(new Map<string, MesurerPageArtifacts>())
  const activePersistence = useMemo(() => {
    const next =
      persistence ??
      createLocalStoragePersistence(
        ownerWindow,
        storageKey,
        SETTINGS_STORAGE_KEY,
        legacyStorageKey,
      )
    return createPageScopedPersistence(next, () => appliedPageKeyRef.current)
  }, [legacyStorageKey, ownerWindow, persistence, storageKey])
  const storedState = useMemo(
    () => activePersistence.load(),
    [activePersistence],
  )
  const persistedState =
    persistOnReload || persistSession || storedState?.settings.persistOnReload
      ? (isPagedWorkspaceStore(storedState?.workspace)
          ? null
          : storedState?.workspace ?? null)
      : null
  const persistedSettings = sanitizeStoredSettings(
    ownerWindow,
    storedState?.settings ?? {},
  )
  return {
    pageKey,
    appliedPageKeyRef,
    pageWorkspacesRef,
    activePersistence,
    storedState,
    persistedState,
    persistedSettings,
  }
}
