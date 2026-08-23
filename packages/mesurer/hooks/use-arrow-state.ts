import { useState } from "react"
import type { Arrow, Point } from "../core/types"

type ArrowStateOptions = {
  initialArrows?: Arrow[]
  initialSelectedArrowIds?: string[]
}

export const useArrowState = (options: ArrowStateOptions = {}) => {
  const [arrows, setArrows] = useState<Arrow[]>(options.initialArrows ?? [])
  const [selectedArrowIds, setSelectedArrowIds] = useState<string[]>(
    options.initialSelectedArrowIds ?? [],
  )
  const [arrowStart, setArrowStart] = useState<Point | null>(null)
  const [arrowMiddle, setArrowMiddle] = useState<Point | null>(null)
  const [arrowPreviewEnd, setArrowPreviewEnd] = useState<Point | null>(null)

  return {
    arrows,
    setArrows,
    selectedArrowIds,
    setSelectedArrowIds,
    arrowStart,
    setArrowStart,
    arrowMiddle,
    setArrowMiddle,
    arrowPreviewEnd,
    setArrowPreviewEnd,
  }
}
