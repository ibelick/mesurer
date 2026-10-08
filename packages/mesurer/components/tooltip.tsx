import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { cn } from "../core/utils"
import { clampOverlayPosition } from "../core/overlay-position"

const TOOLTIP_DELAY_MS = 800

export const TooltipLayerContext = createContext<HTMLElement | null>(null)

export function OverlayPortal({ children }: { children: ReactNode }) {
  const layer = useContext(TooltipLayerContext)
  if (!layer) return null
  return createPortal(children, layer)
}

type TooltipSide = "top" | "bottom" | "left" | "right"

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
  side?: TooltipSide
  className?: string
  anchorRef?: RefObject<HTMLElement | null>
}) {
  const layer = useContext(TooltipLayerContext)
  const horizontal = side === "left" || side === "right"
  const nodeRef = useRef<HTMLSpanElement | null>(null)
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(
    null,
  )
  const pinned = visible === true && layer !== null

  useLayoutEffect(() => {
    if (!pinned) return
    const anchor = anchorRef?.current
    if (!anchor) return

    const update = () => {
      const rect = anchor.getBoundingClientRect()
      const origin = layer.getBoundingClientRect()
      setCoords({
        left: (side === "left" ? rect.left : side === "right" ? rect.right : rect.left + rect.width / 2) - origin.left,
        top: (side === "top" ? rect.top : side === "bottom" ? rect.bottom : rect.top + rect.height / 2) - origin.top,
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

  useLayoutEffect(() => {
    if (!pinned || !coords) return
    const node = nodeRef.current
    const owner = layer?.ownerDocument.defaultView
    if (!node || !owner) return

    const rect = node.getBoundingClientRect()
    const next = clampOverlayPosition({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: owner.innerWidth,
      viewportHeight: owner.innerHeight,
    })
    const shiftX = next.left - rect.left
    const shiftY = next.top - rect.top
    if (Math.abs(shiftX) < 0.5 && Math.abs(shiftY) < 0.5) return

    setCoords((current) =>
      current ? { left: current.left + shiftX, top: current.top + shiftY } : current,
    )
  }, [coords, layer, pinned])

  if (visible === false) return null

  const node = (
    <span
      ref={nodeRef}
      role="tooltip"
      className={cn(
        "msr:pointer-events-none msr:z-[100] msr:whitespace-nowrap msr:rounded msr:bg-black msr:px-2 msr:py-1 msr:text-[11px] msr:text-white msr:transition-opacity msr:duration-150 msr:select-none",
        !(pinned && coords) && (horizontal ? "msr:absolute msr:top-1/2 msr:-translate-y-1/2" : "msr:absolute msr:left-1/2 msr:-translate-x-1/2"),
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
                  : side === "left"
                    ? "translate(calc(-100% - 0.5rem), -50%)"
                    : side === "right"
                      ? "translate(0.5rem, -50%)"
                      : "translate(-50%, 0.5rem)",
            }
          : side === "top"
            ? { bottom: "100%", marginBottom: "0.5rem" }
            : side === "bottom"
              ? { top: "100%", marginTop: "0.5rem" }
              : side === "left"
                ? { right: "100%", top: "50%", marginRight: "0.5rem", transform: "translateY(-50%)" }
                : { left: "100%", top: "50%", marginLeft: "0.5rem", transform: "translateY(-50%)" }
      }
    >
      {label}{shortcut ? <> <span className="msr:font-normal msr:text-white/60">{shortcut}</span></> : null}
    </span>
  )

  if (pinned && layer) {
    return createPortal(node, layer)
  }
  return node
}

export function useTooltip() {
  const [visibleTooltipId, setVisibleTooltipId] = useState<string | null>(null)
  const [copiedTooltipId, setCopiedTooltipId] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const copiedTimerRef = useRef<number | null>(null)
  const instantRef = useRef(false)
  const [tooltipInstant, setTooltipInstant] = useState(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const clearCopiedTimer = useCallback(() => {
    if (copiedTimerRef.current === null) return
    window.clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = null
  }, [])

  const clearCopiedTooltip = useCallback(() => {
    clearCopiedTimer()
    setCopiedTooltipId(null)
  }, [clearCopiedTimer])

  useEffect(() => () => {
    clearTimer()
    clearCopiedTimer()
  }, [clearCopiedTimer, clearTimer])

  const onTooltipEnter = useCallback((id: string, instant = false) => {
    clearTimer()
    if (copiedTooltipId && copiedTooltipId !== id) clearCopiedTooltip()
    if (copiedTooltipId === id) return
    if (instant || instantRef.current) {
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
  }, [clearCopiedTooltip, clearTimer, copiedTooltipId])

  const onTooltipCopied = useCallback((id: string) => {
    clearTimer()
    clearCopiedTimer()
    setVisibleTooltipId(null)
    setCopiedTooltipId(id)
    copiedTimerRef.current = window.setTimeout(() => {
      copiedTimerRef.current = null
      setCopiedTooltipId(null)
    }, 1200)
  }, [clearCopiedTimer, clearTimer])

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
    copiedTooltipId,
    tooltipInstant,
    onTooltipEnter,
    onTooltipCopied,
    onTooltipLeave,
    onTooltipContainerLeave,
  }
}
