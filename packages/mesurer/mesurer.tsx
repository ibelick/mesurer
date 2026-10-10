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
import { resolveMesurerFeatures } from "./core/features";
import { isResponsivePreview } from "./core/responsive";
import { holdPreviewSideEffects } from "./core/preview-guard";

export type { MesurerProps } from "./mesurer-client";

// Mesurer without its stylesheet, for a host that brings it another way: the extension ships it
// as a file, and would otherwise carry it a second time inside its script.
export function MesurerUnstyled({
  highlightColor = "oklch(0.62 0.18 255)",
  guideColor = "oklch(0.63 0.26 29.23)",
  arrowColor = "oklch(0.63 0.26 29.23)",
  guideHighlightEnabled = true,
  hoverHighlightEnabled = true,
  layoutDetailsEnabled = true,
  persistOnReload = false,
  persistSession = false,
  shortcutsEnabled = true,
  theme = "system",
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
  extensionRecording,
  extensionRecordingPlayer,
  features,
  initialState,
}: MesurerProps) {
  const resolvedPortalTarget =
    portalTarget ?? (typeof document !== "undefined" ? document.body : undefined);

  const hydrated = useHydrated();
  if (!hydrated) return null;
  // A page loaded in the responsive preview is there to be looked at: Mesurer stays out of it,
  // or it would open a preview of its own.
  if (isResponsivePreview(window)) {
    // What it reports about the visit is held from here as well, which is as early as this page
    // can do it itself.
    holdPreviewSideEffects(window);
    return null;
  }

  return (
    <MesurerClient
      highlightColor={highlightColor}
      guideColor={guideColor}
      arrowColor={arrowColor}
      guideHighlightEnabled={guideHighlightEnabled}
      hoverHighlightEnabled={hoverHighlightEnabled}
      layoutDetailsEnabled={layoutDetailsEnabled}
      persistOnReload={persistOnReload}
      persistSession={persistSession}
      shortcutsEnabled={shortcutsEnabled}
      theme={theme}
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
      extensionRecording={extensionRecording}
      extensionRecordingPlayer={extensionRecordingPlayer}
      features={resolveMesurerFeatures(features)}
      initialState={initialState}
      portalTarget={resolvedPortalTarget ?? document.body}
    />
  );
}

export default function Mesurer(props: MesurerProps) {
  if (typeof document !== "undefined") {
    ensureMesurerStyles(MESURER_STYLES, props.portalTarget ?? document.body);
  }
  return <MesurerUnstyled {...props} />;
}
