import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { ColorPickerFormat } from "../core/colors";
import type {
  GuideStyle,
  MesurerPersistence,
  MesurerStoredSettings,
  RulerSettings,
  ScreenshotSettings,
} from "../core/persistence";
import type { PersistentToolMode } from "../core/types";
import { DEFAULT_SCREENSHOT_SETTINGS } from "../core/persistence";
import { type TextStyleSettings } from "../core/text-style";

type ToggleState = {
  snapEnabled: boolean;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  snapGuidesEnabled: boolean;
  setSnapGuidesEnabled: Dispatch<SetStateAction<boolean>>;
  snapArrowsEnabled: boolean;
  setSnapArrowsEnabled: Dispatch<SetStateAction<boolean>>;
  arrowClickToPlace: boolean;
  setArrowClickToPlace: Dispatch<SetStateAction<boolean>>;
  selectNewGuideEnabled: boolean;
  setSelectNewGuideEnabled: Dispatch<SetStateAction<boolean>>;
  multiMeasureEnabled: boolean;
  setMultiMeasureEnabled: Dispatch<SetStateAction<boolean>>;
};

type UseMesurerSettingsOptions = {
  activePersistence: MesurerPersistence;
  persistedSettings: MesurerStoredSettings;
  defaults: {
    highlightColor: string;
    guideColor: string;
    arrowColor: string;
    guideHighlightEnabled: boolean;
    hoverHighlightEnabled: boolean;
    layoutDetailsEnabled: boolean;
    persistOnReload: boolean;
    colorPickerFormats: ColorPickerFormat[];
    colorPickerClickFormat: ColorPickerFormat;
    guideStyle: GuideStyle;
    rulerSettings: RulerSettings;
    textStyle: TextStyleSettings;
    snapEnabled: boolean;
    snapGuidesEnabled: boolean;
    snapArrowsEnabled: boolean;
    arrowClickToPlace: boolean;
    selectNewGuideEnabled: boolean;
    multiMeasureEnabled: boolean;
  };
  toggles: ToggleState;
};

export const useMesurerSettings = ({
  activePersistence,
  persistedSettings,
  defaults,
  toggles,
}: UseMesurerSettingsOptions) => {
  const [highlightColor, setHighlightColor] = useState(
    persistedSettings.highlightColor ?? defaults.highlightColor,
  );
  const [guideColor, setGuideColor] = useState(
    persistedSettings.guideColor ?? defaults.guideColor,
  );
  const [arrowColor, setArrowColor] = useState(
    persistedSettings.arrowColor ?? defaults.arrowColor,
  );
  const [guideHighlightEnabled, setGuideHighlightEnabled] = useState(
    persistedSettings.guideHighlightEnabled ?? defaults.guideHighlightEnabled,
  );
  const [hoverHighlightEnabled, setHoverHighlightEnabled] = useState(
    persistedSettings.hoverHighlightEnabled ?? defaults.hoverHighlightEnabled,
  );
  const [layoutDetailsEnabled, setLayoutDetailsEnabled] = useState(
    persistedSettings.layoutDetailsEnabled ?? defaults.layoutDetailsEnabled,
  );
  const [persistOnReload, setPersistOnReload] = useState(
    persistedSettings.persistOnReload ?? defaults.persistOnReload,
  );
  const [lastToolMode, setLastToolMode] = useState<PersistentToolMode>(
    persistedSettings.lastToolMode ?? "select",
  );
  const [colorPickerFormats, setColorPickerFormats] = useState(
    persistedSettings.colorPickerFormats ?? defaults.colorPickerFormats,
  );
  const [colorPickerClickFormat, setColorPickerClickFormat] = useState(
    persistedSettings.colorPickerClickFormat ?? defaults.colorPickerClickFormat,
  );
  const [guideStyle, setGuideStyle] = useState<GuideStyle>({
    ...defaults.guideStyle,
    ...persistedSettings.guideStyle,
  });
  const [rulerSettings, setRulerSettings] = useState<RulerSettings>({
    ...defaults.rulerSettings,
    ...persistedSettings.rulerSettings,
  });
  const [screenshotSettings, setScreenshotSettings] = useState<ScreenshotSettings>({
    ...DEFAULT_SCREENSHOT_SETTINGS,
    ...persistedSettings.screenshotSettings,
  });
  const [textStyle, setTextStyle] = useState<TextStyleSettings>({
    ...defaults.textStyle,
    ...persistedSettings.textStyle,
  });

  const resetSettings = useCallback(() => {
    setHighlightColor(defaults.highlightColor);
    setGuideColor(defaults.guideColor);
    setArrowColor(defaults.arrowColor);
    setGuideHighlightEnabled(defaults.guideHighlightEnabled);
    setHoverHighlightEnabled(defaults.hoverHighlightEnabled);
    setLayoutDetailsEnabled(defaults.layoutDetailsEnabled);
    setPersistOnReload(defaults.persistOnReload);
    setColorPickerFormats([...defaults.colorPickerFormats]);
    setColorPickerClickFormat(defaults.colorPickerClickFormat);
    toggles.setSnapEnabled(defaults.snapEnabled);
    toggles.setSnapGuidesEnabled(defaults.snapGuidesEnabled);
    toggles.setSnapArrowsEnabled(defaults.snapArrowsEnabled);
    toggles.setArrowClickToPlace(defaults.arrowClickToPlace);
    toggles.setSelectNewGuideEnabled(defaults.selectNewGuideEnabled);
    toggles.setMultiMeasureEnabled(defaults.multiMeasureEnabled);
    setGuideStyle({ ...defaults.guideStyle });
    setRulerSettings({ ...defaults.rulerSettings });
    setScreenshotSettings({ ...DEFAULT_SCREENSHOT_SETTINGS });
    setTextStyle({ ...defaults.textStyle });
  }, [defaults, toggles]);

  const persistSettings = useCallback(() => {
    activePersistence.saveSettings({
      highlightColor,
      guideColor,
      arrowColor,
      guideHighlightEnabled,
      hoverHighlightEnabled,
      layoutDetailsEnabled,
      colorPickerFormats,
      colorPickerClickFormat,
      snapEnabled: toggles.snapEnabled,
      snapGuidesEnabled: toggles.snapGuidesEnabled,
      snapArrowsEnabled: toggles.snapArrowsEnabled,
      arrowClickToPlace: toggles.arrowClickToPlace,
      selectNewGuideEnabled: toggles.selectNewGuideEnabled,
      multiMeasureEnabled: toggles.multiMeasureEnabled,
      persistOnReload,
      lastToolMode,
      guideStyle,
      rulerSettings,
      screenshotSettings,
      textStyle,
    });
  }, [
    activePersistence,
    colorPickerClickFormat,
    colorPickerFormats,
    guideColor,
    arrowColor,
    guideHighlightEnabled,
    guideStyle,
    highlightColor,
    hoverHighlightEnabled,
    layoutDetailsEnabled,
    toggles.multiMeasureEnabled,
    persistOnReload,
    lastToolMode,
    rulerSettings,
    screenshotSettings,
    textStyle,
    toggles.selectNewGuideEnabled,
    toggles.snapEnabled,
    toggles.snapGuidesEnabled,
    toggles.snapArrowsEnabled,
    toggles.arrowClickToPlace,
  ]);

  const applyPersistedSettings = useCallback((settings: MesurerStoredSettings) => {
    if (settings.highlightColor !== undefined) setHighlightColor(settings.highlightColor);
    if (settings.guideColor !== undefined) setGuideColor(settings.guideColor);
    if (settings.arrowColor !== undefined) setArrowColor(settings.arrowColor);
    if (settings.guideHighlightEnabled !== undefined) {
      setGuideHighlightEnabled(settings.guideHighlightEnabled);
    }
    if (settings.hoverHighlightEnabled !== undefined) {
      setHoverHighlightEnabled(settings.hoverHighlightEnabled);
    }
    if (settings.layoutDetailsEnabled !== undefined) {
      setLayoutDetailsEnabled(settings.layoutDetailsEnabled);
    }
    if (settings.colorPickerFormats !== undefined) {
      setColorPickerFormats(settings.colorPickerFormats);
    }
    if (settings.colorPickerClickFormat !== undefined) {
      setColorPickerClickFormat(settings.colorPickerClickFormat);
    }
    if (settings.persistOnReload !== undefined) setPersistOnReload(settings.persistOnReload);
    if (settings.lastToolMode !== undefined) setLastToolMode(settings.lastToolMode);
    if (settings.snapEnabled !== undefined) toggles.setSnapEnabled(settings.snapEnabled);
    if (settings.snapGuidesEnabled !== undefined) {
      toggles.setSnapGuidesEnabled(settings.snapGuidesEnabled);
    }
    if (settings.snapArrowsEnabled !== undefined) {
      toggles.setSnapArrowsEnabled(settings.snapArrowsEnabled);
    }
    if (settings.arrowClickToPlace !== undefined) {
      toggles.setArrowClickToPlace(settings.arrowClickToPlace);
    }
    if (settings.selectNewGuideEnabled !== undefined) {
      toggles.setSelectNewGuideEnabled(settings.selectNewGuideEnabled);
    }
    if (settings.multiMeasureEnabled !== undefined) {
      toggles.setMultiMeasureEnabled(settings.multiMeasureEnabled);
    }
    if (settings.guideStyle !== undefined) {
      setGuideStyle({ ...defaults.guideStyle, ...settings.guideStyle });
    }
    if (settings.rulerSettings !== undefined) {
      setRulerSettings({ ...defaults.rulerSettings, ...settings.rulerSettings });
    }
    if (settings.screenshotSettings !== undefined) {
      setScreenshotSettings({ ...DEFAULT_SCREENSHOT_SETTINGS, ...settings.screenshotSettings });
    }
    if (settings.textStyle !== undefined) {
      setTextStyle({ ...defaults.textStyle, ...settings.textStyle });
    }
  }, [defaults.guideStyle, defaults.rulerSettings, defaults.textStyle, toggles]);

  return {
    highlightColor,
    setHighlightColor,
    guideColor,
    setGuideColor,
    arrowColor,
    setArrowColor,
    guideHighlightEnabled,
    setGuideHighlightEnabled,
    hoverHighlightEnabled,
    setHoverHighlightEnabled,
    layoutDetailsEnabled,
    setLayoutDetailsEnabled,
    persistOnReload,
    setPersistOnReload,
    lastToolMode,
    setLastToolMode,
    colorPickerFormats,
    setColorPickerFormats,
    colorPickerClickFormat,
    setColorPickerClickFormat,
    guideStyle,
    setGuideStyle,
    rulerSettings,
    setRulerSettings,
    screenshotSettings,
    setScreenshotSettings,
    textStyle,
    setTextStyle,
    resetSettings,
    persistSettings,
    applyPersistedSettings,
  };
};
