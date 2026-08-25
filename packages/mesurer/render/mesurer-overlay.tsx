import type {
  RefObject,
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
  pointers: OverlayPointers
  selection: OverlaySelection
  distances: OverlayDistances
  guides: OverlayGuides
  arrows: {
    items: Arrow[]
    selectedIds: string[]
    preview: { start: { x: number; y: number }; end: { x: number; y: number }; control?: { x: number; y: number } } | null
    scrollOffset: { x: number; y: number }
  }
  text: {
    items: TextAnnotation[]
    draft: { x: number; y: number } | null
    draftValue: string
    draftInputRef: RefObject<HTMLTextAreaElement | null>
    interactive: boolean
    onSelect: (id: string) => void
    onMoveStart: () => void
    onMove: (id: string, x: number, y: number) => void
    onEdit: (id: string) => void
    scrollOffset: { x: number; y: number }
    onDraftChange: (value: string) => void
    onDraftKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
    onDraftBlur: () => void
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
  pointers,
  selection,
  distances,
  guides,
  arrows,
  text,
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
      />

      <ArrowsLayer
        arrows={arrows.items}
        selectedIds={arrows.selectedIds}
        preview={arrows.preview}
        scrollOffset={arrows.scrollOffset}
      />

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
