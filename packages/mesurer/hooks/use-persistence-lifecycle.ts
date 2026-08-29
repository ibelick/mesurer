import { useEffect, useRef } from "react"
import type {
  MesurerPersistence,
  MesurerPersistenceSnapshot,
  PersistenceChangeSource,
} from "../core/persistence"

type PersistenceLifecycleOptions = {
  ownerWindow: Window
  activePersistence: MesurerPersistence
  persistSettings: () => void
  persistState: () => void
  settingsPersistOnReload: boolean
  saveWorkspace: () => void
  applyPersistenceSnapshot: (
    snapshot: MesurerPersistenceSnapshot | null,
    source?: PersistenceChangeSource,
  ) => void
  storedState: MesurerPersistenceSnapshot | null | undefined
  applyingExternalPersistenceRef: { current: boolean }
  workspacePersistTimeoutRef: { current: number | null }
}

export const usePersistenceLifecycle = ({
  ownerWindow,
  activePersistence,
  persistSettings,
  persistState,
  settingsPersistOnReload,
  saveWorkspace,
  applyPersistenceSnapshot,
  storedState,
  applyingExternalPersistenceRef,
  workspacePersistTimeoutRef,
}: PersistenceLifecycleOptions) => {
  const previousPersistenceRef = useRef(activePersistence)
  useEffect(() => {
    if (previousPersistenceRef.current === activePersistence) return
    previousPersistenceRef.current = activePersistence
    applyPersistenceSnapshot(storedState ?? null)
  }, [activePersistence, applyPersistenceSnapshot, storedState])

  const persistSettingsRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (persistSettingsRef.current === persistSettings) return
    persistSettingsRef.current = persistSettings
    if (applyingExternalPersistenceRef.current) {
      applyingExternalPersistenceRef.current = false
      return
    }
    persistSettings()
    if (settingsPersistOnReload) persistState()
  }, [
    applyingExternalPersistenceRef,
    persistSettings,
    persistState,
    settingsPersistOnReload,
  ])

  useEffect(() => {
    const unsubscribe = activePersistence.subscribe?.(applyPersistenceSnapshot)
    if (!settingsPersistOnReload) {
      return () => {
        unsubscribe?.()
        activePersistence.setErrorHandler?.(undefined)
      }
    }

    const handleBeforeUnload = () => saveWorkspace()
    ownerWindow.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      unsubscribe?.()
      ownerWindow.removeEventListener("beforeunload", handleBeforeUnload)
      activePersistence.setErrorHandler?.(undefined)
      if (workspacePersistTimeoutRef.current !== null) {
        ownerWindow.clearTimeout(workspacePersistTimeoutRef.current)
        workspacePersistTimeoutRef.current = null
        saveWorkspace()
      }
    }
  }, [
    activePersistence,
    applyPersistenceSnapshot,
    ownerWindow,
    saveWorkspace,
    settingsPersistOnReload,
    workspacePersistTimeoutRef,
  ])
}
