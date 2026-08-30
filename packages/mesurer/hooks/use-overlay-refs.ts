import { useRef } from "react"

export const useOverlayRefs = () => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const selectedElementRef = useRef<Element | null>(null)
  const hoverElementRef = useRef<Element | null>(null)
  return { overlayRef, selectedElementRef, hoverElementRef }
}
