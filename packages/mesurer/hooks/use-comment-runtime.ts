import { useEffect, useMemo } from "react"
import { CommentRuntimeStore } from "../comments"
import type { CommentThread } from "../core/types"

// The live side of the comments: which element each one is attached to and where it is on
// screen. Kept in step with the list of comments, and resolved again when a frame loads.
export const useCommentRuntime = (
  comments: CommentThread[],
  ownerDocument: Document,
  ownerWindow: Window,
) => {
  const runtime = useMemo(
    () => new CommentRuntimeStore(ownerDocument, ownerWindow),
    [ownerDocument, ownerWindow],
  )
  useEffect(() => () => runtime.dispose(), [runtime])
  const snapshot = runtime.useSnapshot()
  useEffect(() => {
    const commentIds = new Set(comments.map((comment) => comment.id))
    for (const id of runtime.getIds()) {
      if (!commentIds.has(id)) runtime.detach(id)
    }
    for (const comment of comments) {
      if (!runtime.getElement(comment.id)?.isConnected) {
        runtime.resolve(comment.id, comment.target)
      }
    }
    const resolveAfterFrameLoad = () => {
      for (const comment of comments) runtime.resolve(comment.id, comment.target)
    }
    ownerDocument.addEventListener("load", resolveAfterFrameLoad, true)
    return () => {
      ownerDocument.removeEventListener("load", resolveAfterFrameLoad, true)
    }
  }, [runtime, comments, ownerDocument])
  return { runtime, snapshot }
}
