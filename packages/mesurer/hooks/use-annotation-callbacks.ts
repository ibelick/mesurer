import { useCallback } from "react"
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react"
import type { InspectMeasurement, PenStroke, TextAnnotation, Point } from "../core/types"
import { createId } from "../core/utils"
import { readEditableText } from "../render/text-layer"

export type TextDraft = Point & {
  id?: string
  key?: string
  caretX?: number
  caretY?: number
}

type UseAnnotationCallbacksOptions = {
  textAnnotations: TextAnnotation[]
  selectedTextIds: string[]
  selectedPenStrokeIds: string[]
  scrollOffset: Point
  textDraftRef: MutableRefObject<TextDraft | null>
  textDraftInputRef: MutableRefObject<HTMLElement | null>
  committedTextEditorsRef: MutableRefObject<WeakSet<HTMLElement>>
  suppressTextCreateRef: MutableRefObject<boolean>
  setSelectedGuideIds: Dispatch<SetStateAction<string[]>>
  setSelectedArrowIds: Dispatch<SetStateAction<string[]>>
  setSelectedTextIds: Dispatch<SetStateAction<string[]>>
  setSelectedPenStrokeIds: Dispatch<SetStateAction<string[]>>
  setSelectedMeasurements: Dispatch<SetStateAction<InspectMeasurement[]>>
  setSelectedMeasurement: Dispatch<SetStateAction<InspectMeasurement | null>>
  setSelectedElement: (element: Element | null) => void
  clearSelectionRect: () => void
  setTextDraft: Dispatch<SetStateAction<TextDraft | null>>
  setPenStrokes: Dispatch<SetStateAction<PenStroke[]>>
  setTextAnnotations: Dispatch<SetStateAction<TextAnnotation[]>>
  moveSelectedAnnotations: (dx: number, dy: number) => void
  setToolMode: (mode: "selection") => void
  recordSnapshot: () => void
}

const clearOtherSelections = ({
  setSelectedGuideIds,
  setSelectedArrowIds,
  setSelectedTextIds,
  setSelectedPenStrokeIds,
  setSelectedMeasurements,
  setSelectedMeasurement,
  setSelectedElement,
  clearSelectionRect,
}: Pick<
  UseAnnotationCallbacksOptions,
  | "setSelectedGuideIds"
  | "setSelectedArrowIds"
  | "setSelectedTextIds"
  | "setSelectedPenStrokeIds"
  | "setSelectedMeasurements"
  | "setSelectedMeasurement"
  | "setSelectedElement"
  | "clearSelectionRect"
>) => {
  setSelectedGuideIds([])
  setSelectedArrowIds([])
  setSelectedTextIds([])
  setSelectedPenStrokeIds([])
  setSelectedMeasurements([])
  setSelectedMeasurement(null)
  setSelectedElement(null)
  clearSelectionRect()
}

export const useAnnotationCallbacks = ({
  textAnnotations,
  selectedTextIds,
  selectedPenStrokeIds,
  scrollOffset,
  textDraftRef,
  textDraftInputRef,
  committedTextEditorsRef,
  suppressTextCreateRef,
  setSelectedGuideIds,
  setSelectedArrowIds,
  setSelectedTextIds,
  setSelectedPenStrokeIds,
  setSelectedMeasurements,
  setSelectedMeasurement,
  setSelectedElement,
  clearSelectionRect,
  setTextDraft,
  setPenStrokes,
  setTextAnnotations,
  setToolMode,
  recordSnapshot,
  moveSelectedAnnotations,
}: UseAnnotationCallbacksOptions) => {
  const selectPenStroke = useCallback((id: string, additive = false) => {
    if (additive) {
      setSelectedPenStrokeIds((previous) =>
        previous.includes(id)
          ? previous.filter((selectedId) => selectedId !== id)
          : [...previous, id],
      )
      return
    }

    if (!selectedPenStrokeIds.includes(id)) {
      clearOtherSelections({
        setSelectedGuideIds,
        setSelectedArrowIds,
        setSelectedTextIds,
        setSelectedPenStrokeIds,
        setSelectedMeasurements,
        setSelectedMeasurement,
        setSelectedElement,
        clearSelectionRect,
      })
      setSelectedPenStrokeIds([id])
    }
  }, [
    clearSelectionRect,
    selectedPenStrokeIds,
    setSelectedArrowIds,
    setSelectedElement,
    setSelectedGuideIds,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
  ])

  const changePenStroke = useCallback((next: PenStroke) => {
    setPenStrokes((previous) =>
      previous.map((stroke) => (stroke.id === next.id ? next : stroke)),
    )
  }, [setPenStrokes])

  const finishTextDraft = useCallback((selectAfterCommit = false, switchToSelect = false) => {
    const draft = textDraftRef.current
    if (!draft) return

    const editor = textDraftInputRef.current
    if (editor && committedTextEditorsRef.current.has(editor)) return
    const value = readEditableText(editor)

    textDraftRef.current = null
    if (editor) committedTextEditorsRef.current.add(editor)
    setTextDraft(null)
    suppressTextCreateRef.current = true
    queueMicrotask(() => {
      suppressTextCreateRef.current = false
    })

    if (value.trim()) {
      recordSnapshot()
      const id = draft.id ?? createId()
      if (draft.id) {
        setTextAnnotations((previous) =>
          previous.map((item) => (item.id === draft.id ? { ...item, text: value } : item)),
        )
      } else {
        setTextAnnotations((previous) => [
          ...previous,
          { id, x: draft.x, y: draft.y, text: value },
        ])
      }
      setSelectedTextIds(selectAfterCommit ? [id] : [])
    }
    if (switchToSelect) setToolMode("selection")
  }, [
    committedTextEditorsRef,
    recordSnapshot,
    setSelectedTextIds,
    setTextAnnotations,
    setTextDraft,
    setToolMode,
    textDraftInputRef,
    textDraftRef,
    suppressTextCreateRef,
  ])

  const activateTextEditor = useCallback((element: HTMLElement) => {
    committedTextEditorsRef.current.delete(element)
  }, [committedTextEditorsRef])

  const selectTextAnnotation = useCallback((id: string, additive = false) => {
    if (textDraftRef.current) finishTextDraft()
    if (additive) {
      setSelectedTextIds((previous) =>
        previous.includes(id)
          ? previous.filter((selectedId) => selectedId !== id)
          : [...previous, id],
      )
      return
    }

    if (!selectedTextIds.includes(id)) {
      clearOtherSelections({
        setSelectedGuideIds,
        setSelectedArrowIds,
        setSelectedTextIds,
        setSelectedPenStrokeIds,
        setSelectedMeasurements,
        setSelectedMeasurement,
        setSelectedElement,
        clearSelectionRect,
      })
      setSelectedTextIds([id])
    }
  }, [
    clearSelectionRect,
    finishTextDraft,
    selectedTextIds,
    setSelectedArrowIds,
    setSelectedElement,
    setSelectedGuideIds,
    setSelectedMeasurement,
    setSelectedMeasurements,
    setSelectedPenStrokeIds,
    setSelectedTextIds,
    textDraftRef,
  ])

  const moveTextAnnotation = useCallback((id: string, x: number, y: number) => {
    const item = textAnnotations.find((candidate) => candidate.id === id)
    if (!item) return
    moveSelectedAnnotations(x - item.x, y - item.y)
  }, [moveSelectedAnnotations, textAnnotations])

  const transformTextAnnotation = useCallback((
    id: string,
    next: Pick<TextAnnotation, "x" | "y" | "scale" | "rotation" | "boxWidth">,
  ) => {
    setTextAnnotations((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...next } : item)),
    )
  }, [setTextAnnotations])

  const editTextAnnotation = useCallback((id: string, caretX: number, caretY: number) => {
    if (textDraftRef.current?.id === id) return
    if (textDraftRef.current) finishTextDraft()
    const item = textAnnotations.find((annotation) => annotation.id === id)
    if (!item) return

    setSelectedTextIds([])
    const next: TextDraft = { id, x: item.x, y: item.y, caretX, caretY }
    textDraftRef.current = next
    setTextDraft(next)
  }, [finishTextDraft, setSelectedTextIds, setTextDraft, textAnnotations, textDraftRef])

  const handleTextPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    event.preventDefault()

    const suppressCreate = suppressTextCreateRef.current
    suppressTextCreateRef.current = false
    if (textDraftRef.current) {
      finishTextDraft(false, true)
      return
    }
    if (suppressCreate) return

    setSelectedTextIds([])
    const next: TextDraft = {
      key: createId(),
      x: event.clientX + scrollOffset.x,
      y: event.clientY + scrollOffset.y,
    }
    textDraftRef.current = next
    setTextDraft(next)
  }, [finishTextDraft, scrollOffset.x, scrollOffset.y, setSelectedTextIds, setTextDraft, suppressTextCreateRef, textDraftRef])

  const handleTextKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      event.stopPropagation()
      finishTextDraft()
    }
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      finishTextDraft(textDraftRef.current ? !textDraftRef.current.id : false)
      setToolMode("selection")
    }
  }, [finishTextDraft, setToolMode, textDraftRef])

  return {
    selectPenStroke,
    changePenStroke,
    finishTextDraft,
    activateTextEditor,
    selectTextAnnotation,
    moveTextAnnotation,
    transformTextAnnotation,
    editTextAnnotation,
    handleTextPointerDown,
    handleTextKeyDown,
  }
}
