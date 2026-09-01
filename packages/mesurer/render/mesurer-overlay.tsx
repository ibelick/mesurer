import type {
  MutableRefObject,
  PointerEventHandler,
  PointerEvent as ReactPointerEvent,
} from "react"
import { memo } from "react"
import type { EdgeVisibility } from "../core/edge-visibility"
import type {
  DistanceOverlay,
  Arrow,
  Guide,
  InspectMeasurement,
  Measurement,
  Rect,
  ToolMode,
  TextAnnotation,
} from "../core/types"
import type { ResizeHandle } from "../core/text-transform"
import type { GuideStyle } from "../core/persistence"
import { DistancesLayer } from "./distances-layer"
import { GuidesLayer } from "./guides-layer"
import type { OptionContainerLines } from "./option-container-lines"
import { SelectionLayer } from "./selection-layer"
import { ArrowsLayer } from "./arrows-layer"
import { TextLayer } from "./text-layer"
import { PenLayer } from "./pen-layer"
import { MarqueeRect } from "./marquee-rect"
import { GroupSelectionFrame } from "./group-selection-frame"

type OverlayPointers = {
  onPointerDown: PointerEventHandler<HTMLDivElement>
  onPointerMove: PointerEventHandler<HTMLDivElement>
  onPointerUp: PointerEventHandler<HTMLDivElement>
  onPointerCancel: PointerEventHandler<HTMLDivElement>
  onPointerLeave: PointerEventHandler<HTMLDivElement>
}

type OverlaySelection = {
  measurements: Measurement[]
  measurementEdges: EdgeVisibility[]
  activeRect: Rect | null
  activeWidth: number
  activeHeight: number
  hoverRect: Rect | null
  hoverEdges: EdgeVisibility | null
  selected: InspectMeasurement[]
  selectedEdges: EdgeVisibility[]
}

type OverlayDistances = {
  held: DistanceOverlay[]
  optionPair: DistanceOverlay | null
  guideDistance: DistanceOverlay | null
  containerLines: OptionContainerLines | null
  onRemoveHeld: (id: string) => void
}

type OverlayGuides = {
  items: Guide[]
  selectedIds: string[]
  moveOffset?: { x: number; y: number }
  hover: Guide | null
  draggingId: string | null
  style: GuideStyle
  pointerEvents: boolean
  colors: {
    active: string
    hover: string
    default: string
    preview: string
    previewEmphasized: boolean
  }
  preview: { orientation: "vertical" | "horizontal"; position: number } | null
  onPointerDown: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (guide: Guide, event: ReactPointerEvent<HTMLDivElement>) => void
}

type MesurerOverlayProps = {
  enabled: boolean
  interactive?: boolean
  toolMode: ToolMode
  guidesEnabled: boolean
  altPressed: boolean
  isDragging: boolean
  marqueeRect: Rect | null
  groupBounds: Rect | null
  groupFrameRotation: number
  selectionCount: number
   onResizeSelection: (handle: ResizeHandle, event: ReactPointerEvent<HTMLElement>) => void
   onMoveSelection: (dx: number, dy: number) => void
   onMoveSelectionStart: () => void
   onMoveSelectionEnd: () => void
  onStartGroupResize: (handle: ResizeHandle, rect: Rect, rotation: number) => void
  onEndGroupResize: () => void
  onStartGroupRotate: (center: { x: number; y: number }, startAngle: number, rect: Rect) => void
  onUpdateGroupRotate: (pointerAngle: number) => void
  onEndGroupRotate: () => void
  fillColor: string
  outlineColor: string
  layoutDetailsEnabled: boolean
  pointers: OverlayPointers
  selection: OverlaySelection
  distances: OverlayDistances
  guides: OverlayGuides
  arrows: {
    items: Arrow[]
    selectedIds: string[]
    moveOffset?: { x: number; y: number }
    preview: { start: { x: number; y: number }; end: { x: number; y: number }; control?: { x: number; y: number } } | null
    scrollOffset: { x: number; y: number }
    color: string
    onSelect: (id: string, additive?: boolean) => void
    onChange: (arrow: Arrow) => void
    onChangeStart: () => void
    editingArrowId: string | null
  }
  pen: {
    strokes: import("../core/types").PenStroke[]
    preview: { x: number; y: number }[]
    scrollOffset: { x: number; y: number }
    selectionMode: boolean
    selectedIds: string[]
    moveOffset?: { x: number; y: number }
    onSelect: (id: string, additive?: boolean) => void
    onChange: (stroke: import("../core/types").PenStroke) => void
    onChangeStart: () => void
    onMove: (id: string, dx: number, dy: number) => void
    onMoveStart?: (id: string) => void
    onMoveEnd?: () => void
  }
  text: {
    items: TextAnnotation[]
    draft: { id?: string; key?: string; x: number; y: number; caretX?: number; caretY?: number } | null
    draftInputRef: MutableRefObject<HTMLElement | null>
    interactive: boolean
    editable: boolean
    selectedIds: string[]
    moveOffset?: { x: number; y: number }
    onSelect: (id: string, additive?: boolean) => void
    onMoveStart: (id: string) => void
    onMove: (id: string, dx: number, dy: number) => void
    onMoveEnd?: () => void
    onChangeStart?: () => void
    onTransform: (
      id: string,
      next: { x: number; y: number; scale?: number; rotation?: number; boxWidth?: number },
    ) => void
    onEdit: (id: string, x: number, y: number) => void
    scrollOffset: { x: number; y: number }
    onDraftKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
    onDraftBlur: () => void
    onActivateEditor: (element: HTMLElement) => void
    fontFamily: string
    color: string
  }
}

export const MesurerOverlay = memo(function MesurerOverlay({
  enabled,
  interactive = true,
  toolMode,
  guidesEnabled,
  altPressed,
  isDragging,
  marqueeRect,
  groupBounds,
  groupFrameRotation,
  selectionCount,
   onResizeSelection,
   onMoveSelection,
   onMoveSelectionStart,
   onMoveSelectionEnd,
  onStartGroupResize,
  onEndGroupResize,
  onStartGroupRotate,
  onUpdateGroupRotate,
  onEndGroupRotate,
  fillColor,
  outlineColor,
  layoutDetailsEnabled,
  pointers,
  selection,
  distances,
  guides,
  arrows,
  text,
  pen,
}: MesurerOverlayProps) {
  const overlayVisible = enabled
  const overlayInteractive =
    interactive &&
    overlayVisible &&
    toolMode !== "none" &&
    toolMode !== "text-inspector" &&
    toolMode !== "xray" &&
    toolMode !== "rulers"
  const selectionVisible = toolMode === "select"
  const showGuidePreview = interactive && guidesEnabled && Boolean(guides.preview)

  return (
    <div
      className={`msr:absolute msr:inset-0 msr:select-none msr:outline-none ${
        overlayVisible
          ? `msr:pointer-events-auto ${
              guidesEnabled
                ? guides.hover || guides.draggingId
                  ? "msr:cursor-default"
                  : "msr:cursor-crosshair"
                : "msr:cursor-default"
            } msr:opacity-100`
          : "msr:pointer-events-none msr:opacity-0"
      }`}
      style={{ pointerEvents: overlayInteractive ? "auto" : "none" }}
      tabIndex={overlayInteractive ? -1 : undefined}
      onPointerDown={(event) => {
        event.currentTarget.focus({ preventScroll: true })
        pointers.onPointerDown(event)
      }}
      onPointerMove={pointers.onPointerMove}
      onPointerUp={pointers.onPointerUp}
      onPointerCancel={pointers.onPointerCancel}
      onPointerLeave={pointers.onPointerLeave}
    >
      <SelectionLayer
        visible={selectionVisible}
        dragging={isDragging}
        fillColor={fillColor}
        outlineColor={outlineColor}
        measurements={selection.measurements}
        measurementEdges={selection.measurementEdges}
        active={{
          rect: selection.activeRect,
          width: selection.activeWidth,
          height: selection.activeHeight,
        }}
        hoverRect={selection.hoverRect}
        hoverEdges={selection.hoverEdges}
        selected={selection.selected}
        selectedEdges={selection.selectedEdges}
        layoutDetailsEnabled={layoutDetailsEnabled}
      />

      {toolMode === "selection" && marqueeRect ? (
        <MarqueeRect rect={marqueeRect} color={outlineColor} />
      ) : null}

      <PenLayer {...pen} selectionCount={selectionCount} />

      <ArrowsLayer
        arrows={arrows.items}
        selectedIds={arrows.selectedIds}
        moveOffset={arrows.moveOffset}
        preview={arrows.preview}
        scrollOffset={arrows.scrollOffset}
        color={arrows.color}
        onSelect={arrows.onSelect}
        onChange={arrows.onChange}
        onChangeStart={arrows.onChangeStart}
        editingArrowId={arrows.editingArrowId}
        selectionCount={selectionCount}
      />

      <TextLayer {...text} selectionCount={selectionCount} />

      {showGuidePreview || guides.items.length > 0 ? (
        <GuidesLayer
          guides={guides.items}
          selectedIds={guides.selectedIds}
          moveOffset={guides.moveOffset}
          hoverId={guides.hover?.id ?? null}
          draggingId={guides.draggingId}
          style={guides.style}
          pointerEvents={guides.pointerEvents}
          colors={guides.colors}
          preview={showGuidePreview ? guides.preview : null}
          onPointerDown={guides.onPointerDown}
          onPointerUp={guides.onPointerUp}
          onPointerCancel={guides.onPointerCancel}
        />
      ) : null}

      {toolMode === "selection" && groupBounds ? (
        <GroupSelectionFrame
          rect={groupBounds}
          rotation={groupFrameRotation}
          scrollOffset={arrows.scrollOffset}
           onResize={onResizeSelection}
           onMove={onMoveSelection}
           onMoveStart={onMoveSelectionStart}
           onMoveEnd={onMoveSelectionEnd}
          onResizeStart={onStartGroupResize}
          onResizeEnd={onEndGroupResize}
          onRotateStart={onStartGroupRotate}
          onRotate={onUpdateGroupRotate}
          onRotateEnd={onEndGroupRotate}
        />
      ) : null}

      <DistancesLayer
        held={distances.held}
        onRemoveHeld={distances.onRemoveHeld}
        optionPair={distances.optionPair}
        guideDistance={distances.guideDistance}
        containerLines={distances.containerLines}
        showOption={selectionVisible && altPressed}
        showGuideDistance={interactive && guidesEnabled && altPressed}
        showContainer={selectionVisible && altPressed}
      />
    </div>
  )
})
