import { useState } from "react"
import type { PenStroke, Point } from "../core/types"

export const usePenState = (initialStrokes?: PenStroke[], initialSelectedIds: string[] = []) => {
  const [penStrokes, setPenStrokes] = useState<PenStroke[]>(initialStrokes ?? [])
  const [selectedPenStrokeIds, setSelectedPenStrokeIds] = useState<string[]>(initialSelectedIds)
  const [penPreview, setPenPreview] = useState<Point[]>([])

  return { penStrokes, setPenStrokes, selectedPenStrokeIds, setSelectedPenStrokeIds, penPreview, setPenPreview }
}
