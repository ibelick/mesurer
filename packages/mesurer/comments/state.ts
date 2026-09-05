import { useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { createCommentId } from "./dom"
import type { CommentMessage, CommentTarget, CommentThread } from "./types"

export type CommentDraft = {
  target: CommentTarget
  element: Element
  point: { x: number; y: number }
}

export const useCommentState = (
  initialComments: CommentThread[] = [],
  onChange?: (comments: CommentThread[]) => void,
) => {
  const [comments, setComments] = useState(initialComments)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CommentDraft | null>(null)
  const commentsRef = useRef(comments)
  commentsRef.current = comments
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const updateComments = (updater: (comments: CommentThread[]) => CommentThread[]) => {
    const next = updater(commentsRef.current)
    commentsRef.current = next
    setComments(next)
    onChangeRef.current?.(next)
  }

  const createDraft = (nextDraft: CommentDraft) => {
    setSelectedId(null)
    setDraft(nextDraft)
  }

  const cancelDraft = () => setDraft(null)

  const addMessage = (id: string, text: string) => {
    const value = text.trim()
    if (!value) return false
    const message: CommentMessage = {
      id: createCommentId(),
      role: "user",
      text: value,
      createdAt: Date.now(),
    }
    updateComments((previous) =>
      previous.map((comment) =>
        comment.id === id
          ? { ...comment, messages: [...comment.messages, message], updatedAt: Date.now() }
          : comment,
      ),
    )
    return true
  }

  const commitDraft = (text: string) => {
    if (!draft) return null
    const value = text.trim()
    if (!value) return null
    const now = Date.now()
    const comment: CommentThread = {
      id: createCommentId(),
      target: draft.target,
      messages: [{ id: createCommentId(), role: "user", text: value, createdAt: now }],
      status: "open",
      createdAt: now,
      updatedAt: now,
    }
    updateComments((previous) => [...previous, comment])
    setDraft(null)
    setSelectedId(comment.id)
    return comment
  }

  const deleteComment = (id: string) => {
    updateComments((previous) => previous.filter((comment) => comment.id !== id))
    setSelectedId((previous) => (previous === id ? null : previous))
  }

  const toggleResolved = (id: string) => {
    updateComments((previous) =>
      previous.map((comment) =>
        comment.id === id
          ? {
              ...comment,
              status: comment.status === "open" ? "resolved" : "open",
              updatedAt: Date.now(),
            }
          : comment,
      ),
    )
  }

  const updateTarget = (id: string, target: CommentTarget) => {
    updateComments((previous) =>
      previous.map((comment) =>
        comment.id === id ? { ...comment, target, updatedAt: Date.now() } : comment,
      ),
    )
  }

  const updateMessage = (commentId: string, messageId: string, text: string) => {
    const value = text.trim()
    if (!value) return false
    updateComments((previous) =>
      previous.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              messages: comment.messages.map((message) =>
                message.id === messageId ? { ...message, text: value } : message,
              ),
              updatedAt: Date.now(),
            }
          : comment,
      ),
    )
    return true
  }

  return {
    comments,
    commentsRef,
    setComments: setComments as Dispatch<SetStateAction<CommentThread[]>>,
    selectedId,
    setSelectedId,
    draft,
    createDraft,
    cancelDraft,
    commitDraft,
    addMessage,
    deleteComment,
    toggleResolved,
    updateTarget,
    updateMessage,
  }
}
