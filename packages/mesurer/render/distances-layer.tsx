import { MEASURE_LABEL_OFFSET } from "../core/constants"
import { ownFrameScale } from "../core/document-tree"
import type { DistanceOverlay } from "../core/types"
import { DistanceOverlayItem } from "./distance-overlay-item"
import {
  OptionContainerLinesOverlay,
  type OptionContainerLines,
} from "./option-container-lines"

type DistancesLayerProps = {
  held: DistanceOverlay[]
  onRemoveHeld: (id: string) => void
  optionPair: DistanceOverlay | null
  guideDistance: DistanceOverlay | null
  containerLines: OptionContainerLines | null
  /** The element the container lines are measured from. */
  containerElement?: Element | null
  showOption: boolean
  showGuideDistance: boolean
  showContainer: boolean
}

export function DistancesLayer({
  held,
  onRemoveHeld,
  optionPair,
  guideDistance,
  containerLines,
  containerElement,
  showOption,
  showGuideDistance,
  showContainer,
}: DistancesLayerProps) {
  return (
    <>
      {held.map((distance) => (
        <DistanceOverlayItem
          key={`held-${distance.id}`}
          distance={distance}
          labelOffset={MEASURE_LABEL_OFFSET}
          onRemove={onRemoveHeld}
        />
      ))}

      {showOption && optionPair ? (
        <DistanceOverlayItem
          key={`option-${optionPair.id}`}
          distance={optionPair}
          labelOffset={MEASURE_LABEL_OFFSET}
        />
      ) : null}

      {showGuideDistance && guideDistance ? (
        <DistanceOverlayItem
          key={`guide-preview-${guideDistance.id}`}
          distance={guideDistance}
          labelOffset={MEASURE_LABEL_OFFSET}
        />
      ) : null}

      {showContainer && containerLines ? (
        <OptionContainerLinesOverlay lines={containerLines} drawn={ownFrameScale(containerElement)} />
      ) : null}
    </>
  )
}
