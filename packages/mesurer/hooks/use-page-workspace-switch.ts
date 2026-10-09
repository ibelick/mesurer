import { useLayoutEffect, type MutableRefObject } from "react"
import {
  isPagedWorkspaceStore,
  toPageArtifacts,
  type MesurerPageArtifacts,
  type MesurerPersistence,
} from "../core/persistence"

// Guides, drawings and measurements belong to the page they were made on. When the page changes,
// the ones on screen are put away and the new page's are brought back: from this session if it
// was visited, from what was saved otherwise.
export const usePageWorkspaceSwitch = ({
  pageKey,
  appliedPageKeyRef,
  pageWorkspacesRef,
  activePersistence,
  persistWorkspace,
  readPageArtifacts,
  applyPageArtifacts,
  clearPageArtifacts,
  saveWorkspace,
}: {
  pageKey: string
  appliedPageKeyRef: MutableRefObject<string>
  pageWorkspacesRef: MutableRefObject<Map<string, MesurerPageArtifacts>>
  activePersistence: MesurerPersistence
  persistWorkspace: boolean
  readPageArtifacts: () => MesurerPageArtifacts
  applyPageArtifacts: (artifacts: MesurerPageArtifacts) => void
  clearPageArtifacts: () => void
  saveWorkspace: () => void
}) => {
  useLayoutEffect(() => {
    if (appliedPageKeyRef.current === pageKey) return
    pageWorkspacesRef.current.set(appliedPageKeyRef.current, readPageArtifacts())
    saveWorkspace()
    appliedPageKeyRef.current = pageKey
    const cached = pageWorkspacesRef.current.get(pageKey)
    if (cached) {
      applyPageArtifacts(cached)
      return
    }
    const stored = persistWorkspace ? activePersistence.load()?.workspace ?? null : null
    if (stored && !isPagedWorkspaceStore(stored)) {
      const artifacts = toPageArtifacts(stored)
      pageWorkspacesRef.current.set(pageKey, artifacts)
      applyPageArtifacts(artifacts)
      return
    }
    clearPageArtifacts()
  }, [
    activePersistence,
    appliedPageKeyRef,
    applyPageArtifacts,
    clearPageArtifacts,
    pageKey,
    pageWorkspacesRef,
    persistWorkspace,
    readPageArtifacts,
    saveWorkspace,
  ])
}
