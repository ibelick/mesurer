import { useRef, useState } from "react"
import type { TextAnnotation } from "../core/types"

export const useTextAnnotationState = (initial: TextAnnotation[] = []) => {
  const [textAnnotations, setTextAnnotations] = useState(initial)
  const textAnnotationsRef = useRef(initial)
  const [textDraft, setTextDraft] = useState<{
    id?: string
    key?: string
    x: number
    y: number
    caretX?: number
    caretY?: number
  } | null>(null)
  const [selectedTextIds, setSelectedTextIds] = useState<string[]>([])

  return {
    textAnnotations,
    setTextAnnotations,
    textAnnotationsRef,
    textDraft,
    setTextDraft,
    selectedTextIds,
    setSelectedTextIds,
  }
}
