import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "../core/utils"

const TOOLTIP_DELAY_MS = 800

export const TooltipLayerContext = createContext<HTMLElement | null>(null)

export function Tooltip({
  label,
  shortcut,
  visible,
  instant = false,
  side = "top",
  className,
  anchorRef,
}: {
  label: string
  shortcut?: string
  visible?: boolean
  instant?: boolean
  side?: "top" | "bottom"
  className?: string
  anchorRef?: RefObject<HTMLElement | null>
}) {
  const layer = useContext(TooltipLayerContext)
  const nodeRef = useRef<HTMLSpanElement | null>(null)
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(
    null,
  )
  const pinned = visible === true && layer !== null

  useLayoutEffect(() => {
    if (!pinned) {
      setCoords(null)
      return
    }
    const anchor = anchorRef?.current
    if (!anchor) return

    const update = () => {
      const rect = anchor.getBoundingClientRect()
      const origin = layer.getBoundingClientRect()
      setCoords({
        left: rect.left - origin.left + rect.width / 2,
        top: (side === "top" ? rect.top : rect.bottom) - origin.top,
      })
    }
    update()
    const owner = anchor.ownerDocument.defaultView
    owner?.addEventListener("scroll", update, true)
    owner?.addEventListener("resize", update)
    return () => {
      owner?.removeEventListener("scroll", update, true)
      owner?.removeEventListener("resize", update)
    }
  }, [anchorRef, label, layer, pinned, side])

  const node = (
    <span
      ref={nodeRef}
      role="tooltip"
      className={cn(
        "msr:pointer-events-none msr:z-[100] msr:whitespace-nowrap msr:rounded msr:bg-black msr:px-2 msr:py-1 msr:text-[11px] msr:text-white msr:transition-opacity msr:duration-150 msr:select-none",
        !(pinned && coords) && "msr:absolute msr:left-1/2 msr:-translate-x-1/2",
        instant && "msr:transition-none",
        visible === undefined ? null : visible ? "msr:opacity-100" : "msr:opacity-0",
        className,
      )}
      style={
        pinned && coords
          ? {
              position: "absolute",
              left: coords.left,
              top: coords.top,
              right: "auto",
              bottom: "auto",
              margin: 0,
              transform:
                side === "top"
                  ? "translate(-50%, calc(-100% - 0.5rem))"
                  : "translate(-50%, 0.5rem)",
            }
          : side === "top"
            ? { bottom: "100%", marginBottom: "0.5rem" }
            : { top: "100%", marginTop: "0.5rem" }
      }
    >
      {label}{shortcut ? <> <kbd className="msr:text-white/60">{shortcut}</kbd></> : null}
    </span>
  )

  if (pinned && layer) {
    return createPortal(node, layer)
  }
  return node
}

export function useTooltip() {
  const [visibleTooltipId, setVisibleTooltipId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const instantRef = useRef(false)
  const [tooltipInstant, setTooltipInstant] = useState(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const onTooltipEnter = useCallback((id: string) => {
    clearTimer()
    if (instantRef.current) {
      setTooltipInstant(true)
      setVisibleTooltipId(id)
      return
    }

    setTooltipInstant(false)
    timerRef.current = window.setTimeout(() => {
      setVisibleTooltipId(id)
      instantRef.current = true
      timerRef.current = null
    }, TOOLTIP_DELAY_MS)
  }, [clearTimer])

  const onTooltipLeave = useCallback(() => {
    clearTimer()
    setVisibleTooltipId(null)
  }, [clearTimer])

  const onTooltipContainerLeave = useCallback(() => {
    clearTimer()
    setVisibleTooltipId(null)
    instantRef.current = false
    setTooltipInstant(false)
  }, [clearTimer])

  return {
    visibleTooltipId,
    tooltipInstant,
    onTooltipEnter,
    onTooltipLeave,
    onTooltipContainerLeave,
  }
}
