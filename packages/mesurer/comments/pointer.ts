import { useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent, type RefObject } from "react"
import { captureCommentTarget, getCommentTargetAtPoint } from "./dom"
import type { CommentRuntimeStore } from "./runtime-store"
import type { CommentDraft } from "./state"

type CommentState = {
  draft: CommentDraft | null
  createDraft: (draft: CommentDraft) => void
  cancelDraft: () => void
  commitDraft: (text: string) => unknown
  updateTarget: (id: string, target: ReturnType<typeof captureCommentTarget>) => void
}

export const useCommentPointer = ({
  overlayRef,
  ownerDocument,
  ownerWindow,
  runtime,
  state,
}: {
  overlayRef: RefObject<HTMLDivElement | null>
  ownerDocument: Document
  ownerWindow: Window
  runtime: CommentRuntimeStore
  state: CommentState
}) => {
  const draftTextRef = useRef("")
  const [draftText, setDraftText] = useState("")
  const [movingId, setMovingId] = useState<string | null>(null)
  const pendingMoveRef = useRef<{ id: string; pointerId: number; x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)

  const targetAtEvent = (event: { clientX: number; clientY: number }) =>
    getCommentTargetAtPoint(
      { x: event.clientX, y: event.clientY },
      overlayRef.current,
      ownerDocument,
    )
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (state.draft) return
    const element = targetAtEvent(event)
    runtime.setHoverElement(element, { x: event.clientX, y: event.clientY })
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("[data-mesurer-comment-ui]")) return
    if (state.draft) return
    const point = { x: event.clientX, y: event.clientY }
    const element = getCommentTargetAtPoint(point, overlayRef.current, ownerDocument)
    if (!element) return
    event.preventDefault()
    state.createDraft({
      element,
      target: captureCommentTarget(element, point, ownerWindow),
      point,
    })
    runtime.setHoverElement(null)
  }

  const onPointerLeave = () => {
    if (!state.draft) runtime.setHoverElement(null)
  }

  const onStartMove = (id: string, event: PointerEvent<HTMLElement>) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pendingMoveRef.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    suppressClickRef.current = false
  }

  const onMoveComment = (event: PointerEvent<HTMLElement>) => {
    if (!movingId) {
      const pending = pendingMoveRef.current
      if (!pending) return
      const distance = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
      if (distance < 4) return
      event.preventDefault()
      pendingMoveRef.current = null
      suppressClickRef.current = true
      setMovingId(pending.id)
      runtime.setHoverElement(targetAtEvent(event), { x: event.clientX, y: event.clientY })
      return
    }
    event.preventDefault()
    runtime.setHoverElement(targetAtEvent(event), { x: event.clientX, y: event.clientY })
  }

  const onEndMove = (event: PointerEvent<HTMLElement>) => {
    if (!movingId) {
      pendingMoveRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const element = targetAtEvent(event)
    if (element) {
      const target = captureCommentTarget(element, { x: event.clientX, y: event.clientY }, ownerWindow)
      state.updateTarget(movingId, target)
      runtime.attach(movingId, target, element)
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    runtime.setHoverElement(null)
    setMovingId(null)
  }

  const onClickComment = (id: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    return id
  }

  const onDraftTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    draftTextRef.current = event.currentTarget.value
    setDraftText(event.currentTarget.value)
  }

  const onDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      state.cancelDraft()
      draftTextRef.current = ""
      setDraftText("")
      return
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      state.commitDraft(draftTextRef.current)
      draftTextRef.current = ""
      setDraftText("")
    }
  }

  const onDraftSubmit = () => {
    state.commitDraft(draftTextRef.current)
    draftTextRef.current = ""
    setDraftText("")
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: () => {},
    onPointerLeave,
    onPointerCancel: onPointerLeave,
    draftText,
    onDraftTextChange,
    onDraftKeyDown,
    onDraftSubmit,
    movingId,
    onStartMove,
    onMoveComment,
    onEndMove,
    onClickComment,
  }
}
