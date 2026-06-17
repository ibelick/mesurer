import { useState } from "react"
import type { Guide } from "../core/types"

type GuideStateOptions = {
  initialGuides?: Guide[]
  initialSelectedGuideIds?: string[]
}

export const useGuideState = (options: GuideStateOptions = {}) => {
  const [guides, setGuides] = useState<Guide[]>(options.initialGuides ?? [])
  const [draggingGuideId, setDraggingGuideId] = useState<string | null>(null)
  const [selectedGuideIds, setSelectedGuideIds] = useState<string[]>(
    options.initialSelectedGuideIds ?? []
  )
  return {
    guides,
    setGuides,
    draggingGuideId,
    setDraggingGuideId,
    selectedGuideIds,
    setSelectedGuideIds,
  }
}
