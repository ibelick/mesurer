"use client";

import { ensureMesurerStyles } from "./runtime/style-inject";
import { MESURER_STYLES } from "./styles.generated";
import { MesurerClient, type MesurerProps } from "./mesurer-client";
import { useHydrated } from "./hooks/use-hydrated";
import {
  DEFAULT_GUIDE_STYLE,
  DEFAULT_RULER_SETTINGS,
} from "./core/persistence";
import { DEFAULT_TEXT_STYLE } from "./core/text-style";

export type { MesurerProps } from "./mesurer-client";

export default function Mesurer({
  highlightColor = "oklch(0.62 0.18 255)",
  guideColor = "oklch(0.63 0.26 29.23)",
  arrowColor = "oklch(0.63 0.26 29.23)",
  guideHighlightEnabled = true,
  hoverHighlightEnabled = true,
  layoutDetailsEnabled = true,
  persistOnReload = false,
  portalTarget,
  persistKey,
  colorPickerFormats = ["hex", "rgb", "oklch"],
  colorPickerClickFormat = "hex",
  snapEnabled = true,
  snapGuidesEnabled = true,
  snapArrowsEnabled = true,
  arrowClickToPlace = false,
  selectNewGuideEnabled = true,
  multiMeasureEnabled = false,
  guideStyle,
  rulerSettings,
  textStyle,
  persistence,
  onPersistenceError,
  captureVisibleTab,
}: MesurerProps) {
  if (typeof document !== "undefined") {
    ensureMesurerStyles(MESURER_STYLES, portalTarget);
  }

  const hydrated = useHydrated();
  if (!hydrated) return null;

  return (
    <MesurerClient
      highlightColor={highlightColor}
      guideColor={guideColor}
      arrowColor={arrowColor}
      guideHighlightEnabled={guideHighlightEnabled}
      hoverHighlightEnabled={hoverHighlightEnabled}
      layoutDetailsEnabled={layoutDetailsEnabled}
      persistOnReload={persistOnReload}
      persistKey={persistKey}
      colorPickerFormats={colorPickerFormats}
      colorPickerClickFormat={colorPickerClickFormat}
      snapEnabled={snapEnabled}
      snapGuidesEnabled={snapGuidesEnabled}
      snapArrowsEnabled={snapArrowsEnabled}
      arrowClickToPlace={arrowClickToPlace}
      selectNewGuideEnabled={selectNewGuideEnabled}
      multiMeasureEnabled={multiMeasureEnabled}
      guideStyle={{ ...DEFAULT_GUIDE_STYLE, ...guideStyle }}
      rulerSettings={{ ...DEFAULT_RULER_SETTINGS, ...rulerSettings }}
      textStyle={{ ...DEFAULT_TEXT_STYLE, ...textStyle }}
      persistence={persistence}
      onPersistenceError={onPersistenceError}
      captureVisibleTab={captureVisibleTab}
      portalTarget={portalTarget ?? document.body}
    />
  );
}
