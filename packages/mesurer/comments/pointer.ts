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
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setMovingId(id)
    runtime.setHoverElement(null)
  }

  const onMoveComment = (event: PointerEvent<HTMLElement>) => {
    if (!movingId) return
    runtime.setHoverElement(targetAtEvent(event), { x: event.clientX, y: event.clientY })
  }

  const onEndMove = (event: PointerEvent<HTMLElement>) => {
    if (!movingId) return
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

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: () => {},
    onPointerLeave,
    onPointerCancel: onPointerLeave,
    draftText,
    onDraftTextChange,
    onDraftKeyDown,
    onDraftPointerDown: (event: PointerEvent<HTMLTextAreaElement>) => event.stopPropagation(),
    movingId,
    onStartMove,
    onMoveComment,
    onEndMove,
  }
}
