import { useRef, useState } from "react"
import type { TextAnnotation } from "../core/types"

export const useTextAnnotationState = (initial: TextAnnotation[] = []) => {
  const [textAnnotations, setTextAnnotations] = useState(initial)
  const textAnnotationsRef = useRef(initial)
  const [textDraft, setTextDraft] = useState<{ id?: string; x: number; y: number } | null>(null)
  const [textDraftValue, setTextDraftValue] = useState("")
  const [selectedTextIds, setSelectedTextIds] = useState<string[]>([])

  return {
    textAnnotations,
    setTextAnnotations,
    textAnnotationsRef,
    textDraft,
    setTextDraft,
    textDraftValue,
    setTextDraftValue,
    selectedTextIds,
    setSelectedTextIds,
  }
}
