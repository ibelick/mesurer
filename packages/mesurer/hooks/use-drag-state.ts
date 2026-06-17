import { useState } from "react"
import type { Point } from "../core/types"

export const useDragState = () => {
  const [start, setStart] = useState<Point | null>(null)
  const [end, setEnd] = useState<Point | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  return { start, setStart, end, setEnd, isDragging, setIsDragging }
}
