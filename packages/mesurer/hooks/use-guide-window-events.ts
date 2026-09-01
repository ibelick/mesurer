import { useLayoutEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react"
import { GUIDE_HITBOX_SIZE } from "../core/constants"
import { getSnapGuidePosition } from "../core/guides"
import { isPointerDragActive } from "../core/pointer-drag"
import type { Guide, ToolMode } from "../core/types"

type GuideDrag = {
  id: string
  orientation: "vertical" | "horizontal"
  pointerId: number
  commit: () => void
  committed: boolean
  group: boolean
  lastX: number
  lastY: number
}

type UseGuideWindowEventsOptions = {
  ownerDocument: Document
  ownerWindow: Window
  enabled: boolean
  settingsOpen: boolean
  toolMode: ToolMode
  toolbarActive: boolean
  snapGuidesEnabled: boolean
  guides: Guide[]
  toolbarRef: RefObject<HTMLDivElement | null>
  overlayRef: RefObject<HTMLDivElement | null>
  createActionCommit: () => () => void
  setGuides: Dispatch<SetStateAction<Guide[]>>
  setSelectedGuideIds: Dispatch<SetStateAction<string[]>>
  setToolbarActive: (active: boolean) => void
  selectedGuideIds: string[]
  selectionCount: number
  moveSelectedAnnotations: (dx: number, dy: number) => void
}

export const useGuideWindowEvents = ({
  ownerDocument,
  ownerWindow,
  enabled,
  settingsOpen,
  toolMode,
  toolbarActive,
  snapGuidesEnabled,
  guides,
  toolbarRef,
  overlayRef,
  createActionCommit,
  setGuides,
  setSelectedGuideIds,
  setToolbarActive,
  selectedGuideIds,
  selectionCount,
  moveSelectedAnnotations,
}: UseGuideWindowEventsOptions) => {
  const guideScrollRef = useRef({
    x: ownerWindow.scrollX,
    y: ownerWindow.scrollY,
  })
  const guideDragRef = useRef<GuideDrag | null>(null)
  const guideUserSelectRef = useRef<string | null>(null)
  const optionsRef = useRef({
    enabled,
    settingsOpen,
    toolMode,
    toolbarActive,
    snapGuidesEnabled,
    guides,
    createActionCommit,
    setGuides,
    setSelectedGuideIds,
    setToolbarActive,
    toolbarRef,
    overlayRef,
    selectedGuideIds,
    selectionCount,
    moveSelectedAnnotations,
  })
  optionsRef.current = {
    enabled,
    settingsOpen,
    toolMode,
    toolbarActive,
    snapGuidesEnabled,
    guides,
    createActionCommit,
    setGuides,
    setSelectedGuideIds,
    setToolbarActive,
    toolbarRef,
    overlayRef,
    selectedGuideIds,
    selectionCount,
    moveSelectedAnnotations,
  }

  useLayoutEffect(() => {
    if (!enabled) {
      guideDragRef.current = null
      if (guideUserSelectRef.current !== null) {
        ownerDocument.documentElement.style.userSelect = guideUserSelectRef.current
        guideUserSelectRef.current = null
        guideDragRef.current = null
      }
      return
    }
    const handleScroll = () => {
      const next = {
        x: ownerWindow.scrollX,
        y: ownerWindow.scrollY,
      }
      const deltaX = next.x - guideScrollRef.current.x
      const deltaY = next.y - guideScrollRef.current.y
      guideScrollRef.current = next
      if (deltaX === 0 && deltaY === 0) return

      optionsRef.current.setGuides((prev) =>
        prev.map((guide) => ({
          ...guide,
          position:
            guide.position -
            (guide.orientation === "vertical" ? deltaX : deltaY),
        })),
      )
    }

    const handleGuidePointerDown = (event: PointerEvent) => {
      const current = optionsRef.current
      if (current.toolbarActive && current.toolMode === "none") {
        if (!current.toolbarRef.current?.contains(event.target as Node)) {
          current.setToolbarActive(false)
        }
      }
      if (!current.enabled) return
      if (current.settingsOpen) return
      if (current.toolbarRef.current?.contains(event.target as Node)) return
      if (isPointerDragActive()) return
      const OwnerElement = (ownerWindow as Window & { Element: typeof Element })
        .Element
      if (
        event.composedPath().some((target) => {
          if (!(target instanceof OwnerElement)) return false
          return (
            target.hasAttribute("data-mesurer-group-frame") ||
            target.hasAttribute("data-mesurer-group-handle") ||
            target.hasAttribute("data-mesurer-group-controls") ||
            target.hasAttribute("data-mesurer-pen-id") ||
            target.hasAttribute("data-mesurer-pen-frame") ||
            target.hasAttribute("data-mesurer-pen-handle") ||
            target.hasAttribute("data-mesurer-arrow-id") ||
            target.hasAttribute("data-mesurer-text-id") ||
            target.hasAttribute("data-mesurer-text-frame") ||
            target.hasAttribute("data-mesurer-text-handle")
          )
        })
      ) {
        return
      }
      const guideTarget = event.composedPath().some(
        (target) =>
          target instanceof OwnerElement &&
          target.hasAttribute("data-mesurer-guide"),
      )
      if (guideTarget && current.toolMode !== "none" && event.shiftKey) return

      const point = { x: event.clientX, y: event.clientY }
      const guide = current.guides.find((candidate) => {
        const distance =
          candidate.orientation === "vertical"
            ? Math.abs(candidate.position - point.x)
            : Math.abs(candidate.position - point.y)
        return distance <= GUIDE_HITBOX_SIZE / 2
      })
      if (!guide) return

      const alreadySelected = current.selectedGuideIds.includes(guide.id)
      const groupMove = alreadySelected && current.selectionCount > 1

      if (event.button === 0 && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        guideDragRef.current = {
          id: guide.id,
          orientation: guide.orientation,
          pointerId: event.pointerId,
          commit: current.createActionCommit(),
          committed: false,
          group: groupMove,
          lastX: event.clientX,
          lastY: event.clientY,
        }
      }

      if (groupMove) return

      current.setSelectedGuideIds((prev) =>
        event.shiftKey
          ? prev.includes(guide.id)
            ? prev.filter((id) => id !== guide.id)
            : [...prev, guide.id]
          : [guide.id],
      )
    }

    const handleGuidePointerMove = (event: PointerEvent) => {
      if (isPointerDragActive()) return
      const drag = guideDragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      if (!optionsRef.current.enabled) return
      const current = optionsRef.current
      if (!drag.committed) {
        event.preventDefault()
        if (guideUserSelectRef.current === null) {
          guideUserSelectRef.current =
            ownerDocument.documentElement.style.userSelect
          ownerDocument.documentElement.style.userSelect = "none"
        }
        ownerWindow.getSelection()?.removeAllRanges()
        drag.commit()
        drag.committed = true
      }
      if (drag.group) {
        current.moveSelectedAnnotations(
          event.clientX - drag.lastX,
          event.clientY - drag.lastY,
        )
        drag.lastX = event.clientX
        drag.lastY = event.clientY
        return
      }
      const position = getSnapGuidePosition({
        orientation: drag.orientation,
        point: { x: event.clientX, y: event.clientY },
        snapGuidesEnabled: current.snapGuidesEnabled,
        overlayNode: current.overlayRef.current,
        guides: current.guides,
        draggingGuideId: drag.id,
        document: ownerDocument,
      })
      optionsRef.current.setGuides((prev) =>
        prev.map((guide) =>
          guide.id === drag.id ? { ...guide, position } : guide,
        ),
      )
    }

    const handleGuidePointerEnd = (event: PointerEvent) => {
      if (guideDragRef.current?.pointerId === event.pointerId) {
        guideDragRef.current = null
        if (guideUserSelectRef.current !== null) {
          ownerDocument.documentElement.style.userSelect =
            guideUserSelectRef.current
          guideUserSelectRef.current = null
        }
      }
    }

    ownerWindow.addEventListener("scroll", handleScroll, true)
    ownerWindow.addEventListener("pointerdown", handleGuidePointerDown, true)
    ownerWindow.addEventListener("pointermove", handleGuidePointerMove, true)
    ownerWindow.addEventListener("pointerup", handleGuidePointerEnd, true)
    ownerWindow.addEventListener("pointercancel", handleGuidePointerEnd, true)
    return () => {
      ownerWindow.removeEventListener("scroll", handleScroll, true)
      ownerWindow.removeEventListener(
        "pointerdown",
        handleGuidePointerDown,
        true,
      )
      ownerWindow.removeEventListener(
        "pointermove",
        handleGuidePointerMove,
        true,
      )
      ownerWindow.removeEventListener("pointerup", handleGuidePointerEnd, true)
      ownerWindow.removeEventListener(
        "pointercancel",
        handleGuidePointerEnd,
        true,
      )
      if (guideUserSelectRef.current !== null) {
        ownerDocument.documentElement.style.userSelect =
          guideUserSelectRef.current
        guideUserSelectRef.current = null
      }
      guideDragRef.current = null
    }
  }, [enabled, ownerDocument, ownerWindow])
}
