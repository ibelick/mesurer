import { useEffect, useMemo, useSyncExternalStore } from "react"
import { PlatformAuthClient } from "../platform/auth-client"
import type { CommentThread } from "../core/types"
import type { PlatformEnvironment } from "../platform/types"

const disconnected = { status: "disconnected" } as const
const noopSubscribe = () => () => undefined
const getDisconnected = () => disconnected

export const usePlatformAuth = (ownerWindow: Window, environment: PlatformEnvironment | null) => {
  const client = useMemo(
    () => environment ? new PlatformAuthClient(ownerWindow, environment) : null,
    [environment, ownerWindow],
  )
  const state = useSyncExternalStore(
    client?.subscribe ?? noopSubscribe,
    client?.getState ?? getDisconnected,
    client?.getState ?? getDisconnected,
  )

  useEffect(() => () => client?.dispose(), [client])

  return {
    state,
    connect: client?.connect ?? (async () => null),
    createTestReviewLink: client?.createTestReviewLink ?? (async (_comments: CommentThread[] = []) => null),
    prepareReview: client?.prepareReview ?? (async (_reviewWindow?: Window) => false),
    publishReview: client?.publishReview,
    canCreateTestReviewLink: state.status === "connected" && state.share.status !== "creating",
    hasSavedGrant: client?.hasSavedGrant() ?? false,
    disconnect: client?.disconnect ?? (() => undefined),
  }
}
