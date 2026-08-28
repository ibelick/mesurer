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
import type { GuideStyle } from "../core/persistence"
import { DistancesLayer } from "./distances-layer"
import { GuidesLayer } from "./guides-layer"
import type { OptionContainerLines } from "./option-container-lines"
import { SelectionLayer } from "./selection-layer"
import { ArrowsLayer } from "./arrows-layer"
import { TextLayer } from "./text-layer"
import { PenLayer } from "./pen-layer"

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
    preview: { start: { x: number; y: number }; end: { x: number; y: number }; control?: { x: number; y: number } } | null
    scrollOffset: { x: number; y: number }
    color: string
  }
  pen: {
    strokes: import("../core/types").PenStroke[]
    preview: { x: number; y: number }[]
    scrollOffset: { x: number; y: number }
    selectionMode: boolean
    selectedIds: string[]
    onSelect: (id: string) => void
    onChange: (stroke: import("../core/types").PenStroke) => void
    onChangeStart: () => void
  }
  text: {
    items: TextAnnotation[]
    draft: { id?: string; key?: string; x: number; y: number; caretX?: number; caretY?: number } | null
    draftInputRef: MutableRefObject<HTMLElement | null>
    interactive: boolean
    editable: boolean
    selectedIds: string[]
    onSelect: (id: string) => void
    onMoveStart: () => void
    onMove: (id: string, x: number, y: number) => void
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
      className={`msr:absolute msr:inset-0 msr:select-none ${
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
      onPointerDown={pointers.onPointerDown}
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

      <ArrowsLayer
        arrows={arrows.items}
        selectedIds={arrows.selectedIds}
        preview={arrows.preview}
        scrollOffset={arrows.scrollOffset}
        color={arrows.color}
      />

      <PenLayer {...pen} />

      <TextLayer {...text} />

      {showGuidePreview || guides.items.length > 0 ? (
        <GuidesLayer
          guides={guides.items}
          selectedIds={guides.selectedIds}
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
