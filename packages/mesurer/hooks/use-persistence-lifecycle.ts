import { useEffect, useRef, type MutableRefObject } from "react"
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
  persistWorkspace: boolean
  saveWorkspace: () => void
  applyPersistenceSnapshot: (
    snapshot: MesurerPersistenceSnapshot | null,
    source?: PersistenceChangeSource,
  ) => void
  storedState: MesurerPersistenceSnapshot | null | undefined
  persistenceErrorHandlerRef: MutableRefObject<((error: unknown) => void) | undefined>
  applyingExternalPersistenceRef: { current: boolean }
  workspacePersistTimeoutRef: { current: number | null }
}

export const usePersistenceLifecycle = ({
  ownerWindow,
  activePersistence,
  persistSettings,
  persistState,
  persistWorkspace,
  saveWorkspace,
  applyPersistenceSnapshot,
  storedState,
  persistenceErrorHandlerRef,
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
    if (persistWorkspace) persistState()
  }, [
    applyingExternalPersistenceRef,
    persistSettings,
    persistState,
    persistWorkspace,
  ])

  useEffect(() => {
    activePersistence.setErrorHandler?.((error) => persistenceErrorHandlerRef.current?.(error))
    const unsubscribe = activePersistence.subscribe?.(applyPersistenceSnapshot)
    if (!persistWorkspace) {
      return () => {
        unsubscribe?.()
        activePersistence.setErrorHandler?.(undefined)
      }
    }

    const flushWorkspace = () => {
      if (workspacePersistTimeoutRef.current !== null) {
        ownerWindow.clearTimeout(workspacePersistTimeoutRef.current)
        workspacePersistTimeoutRef.current = null
      }
      saveWorkspace()
    }
    const handleVisibility = () => {
      if (ownerWindow.document.visibilityState === "hidden") flushWorkspace()
    }
    ownerWindow.addEventListener("pagehide", flushWorkspace)
    ownerWindow.addEventListener("beforeunload", flushWorkspace)
    ownerWindow.document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      unsubscribe?.()
      ownerWindow.removeEventListener("pagehide", flushWorkspace)
      ownerWindow.removeEventListener("beforeunload", flushWorkspace)
      ownerWindow.document.removeEventListener("visibilitychange", handleVisibility)
      activePersistence.setErrorHandler?.(undefined)
      flushWorkspace()
    }
  }, [
    activePersistence,
    applyPersistenceSnapshot,
    ownerWindow,
    persistWorkspace,
    persistenceErrorHandlerRef,
    saveWorkspace,
    workspacePersistTimeoutRef,
  ])
}
