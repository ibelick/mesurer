import { useLayoutEffect, useRef, useState, type RefObject } from "react"

const DEFAULT_HEIGHT = 500
const MENU_GAP = 8
const VIEWPORT_PADDING = 8

type SettingsMenuPlacement = {
  side: "top" | "bottom"
  height: number
  right: number
  top?: number
  bottom?: number
}

type UseSettingsMenuPlacementOptions = {
  anchorRef: RefObject<HTMLElement | null>
  eventTarget: Window
  open: boolean
  refreshKey?: string | number
  fixed?: boolean
}

export const useSettingsMenuPlacement = ({
  anchorRef,
  eventTarget,
  open,
  refreshKey,
  fixed = false,
}: UseSettingsMenuPlacementOptions) => {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [placement, setPlacement] = useState<SettingsMenuPlacement>({
    side: "bottom",
    height: DEFAULT_HEIGHT,
    right: -4,
  })

  useLayoutEffect(() => {
    if (!open) return

    const measure = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const menu = menuRef.current
      if (!anchor || !menu) return

      const availableTop = Math.max(0, anchor.top - MENU_GAP)
      const availableBottom = Math.max(
        0,
        eventTarget.innerHeight - anchor.bottom - MENU_GAP,
      )
      const side =
        availableBottom >= DEFAULT_HEIGHT || availableBottom >= availableTop
          ? "bottom"
          : "top"
      const availableHeight = side === "bottom" ? availableBottom : availableTop
      const menuWidth = menu.getBoundingClientRect().width
      const desiredLeft = anchor.right + 4 - menuWidth
      const minLeft = VIEWPORT_PADDING
      const maxLeft = Math.max(
        minLeft,
        eventTarget.innerWidth - VIEWPORT_PADDING - menuWidth,
      )
      const menuLeft = Math.min(maxLeft, Math.max(minLeft, desiredLeft))
      const containingRight = fixed
        ? eventTarget.innerWidth
        : anchorRef.current?.parentElement?.getBoundingClientRect().right ?? anchor.right

      setPlacement({
        side,
        height: Math.min(DEFAULT_HEIGHT, availableHeight),
        right: containingRight - menuLeft - menuWidth,
        ...(fixed
          ? side === "bottom"
            ? { top: anchor.bottom + MENU_GAP }
            : { bottom: eventTarget.innerHeight - anchor.top + MENU_GAP }
          : {}),
      })
    }

    measure()
    eventTarget.addEventListener("resize", measure)
    eventTarget.addEventListener("scroll", measure, true)
    return () => {
      eventTarget.removeEventListener("resize", measure)
      eventTarget.removeEventListener("scroll", measure, true)
    }
  }, [anchorRef, eventTarget, fixed, open, refreshKey])

  return { menuRef, placement }
}
