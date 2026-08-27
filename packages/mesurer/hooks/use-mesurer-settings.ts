import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { ColorPickerFormat } from "../core/colors";
import type {
  GuideStyle,
  MesurerPersistence,
  MesurerStoredSettings,
  RulerSettings,
  ScreenshotSettings,
} from "../core/persistence";
import { DEFAULT_SCREENSHOT_SETTINGS } from "../core/persistence";
import { type TextStyleSettings } from "../core/text-style";

type ToggleState = {
  snapEnabled: boolean;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  snapGuidesEnabled: boolean;
  setSnapGuidesEnabled: Dispatch<SetStateAction<boolean>>;
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
    guideHighlightEnabled: boolean;
    hoverHighlightEnabled: boolean;
    persistOnReload: boolean;
    colorPickerFormats: ColorPickerFormat[];
    colorPickerClickFormat: ColorPickerFormat;
    guideStyle: GuideStyle;
    rulerSettings: RulerSettings;
    textStyle: TextStyleSettings;
    snapEnabled: boolean;
    snapGuidesEnabled: boolean;
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
  const [guideHighlightEnabled, setGuideHighlightEnabled] = useState(
    persistedSettings.guideHighlightEnabled ?? defaults.guideHighlightEnabled,
  );
  const [hoverHighlightEnabled, setHoverHighlightEnabled] = useState(
    persistedSettings.hoverHighlightEnabled ?? defaults.hoverHighlightEnabled,
  );
  const [persistOnReload, setPersistOnReload] = useState(
    persistedSettings.persistOnReload ?? defaults.persistOnReload,
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
    setGuideHighlightEnabled(defaults.guideHighlightEnabled);
    setHoverHighlightEnabled(defaults.hoverHighlightEnabled);
    setPersistOnReload(defaults.persistOnReload);
    setColorPickerFormats([...defaults.colorPickerFormats]);
    setColorPickerClickFormat(defaults.colorPickerClickFormat);
    toggles.setSnapEnabled(defaults.snapEnabled);
    toggles.setSnapGuidesEnabled(defaults.snapGuidesEnabled);
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
      guideHighlightEnabled,
      hoverHighlightEnabled,
      colorPickerFormats,
      colorPickerClickFormat,
      snapEnabled: toggles.snapEnabled,
      snapGuidesEnabled: toggles.snapGuidesEnabled,
      selectNewGuideEnabled: toggles.selectNewGuideEnabled,
      multiMeasureEnabled: toggles.multiMeasureEnabled,
      persistOnReload,
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
    guideHighlightEnabled,
    guideStyle,
    highlightColor,
    hoverHighlightEnabled,
    toggles.multiMeasureEnabled,
    persistOnReload,
    rulerSettings,
    screenshotSettings,
    textStyle,
    toggles.selectNewGuideEnabled,
    toggles.snapEnabled,
    toggles.snapGuidesEnabled,
  ]);

  const applyPersistedSettings = useCallback((settings: MesurerStoredSettings) => {
    if (settings.highlightColor !== undefined) setHighlightColor(settings.highlightColor);
    if (settings.guideColor !== undefined) setGuideColor(settings.guideColor);
    if (settings.guideHighlightEnabled !== undefined) {
      setGuideHighlightEnabled(settings.guideHighlightEnabled);
    }
    if (settings.hoverHighlightEnabled !== undefined) {
      setHoverHighlightEnabled(settings.hoverHighlightEnabled);
    }
    if (settings.colorPickerFormats !== undefined) {
      setColorPickerFormats(settings.colorPickerFormats);
    }
    if (settings.colorPickerClickFormat !== undefined) {
      setColorPickerClickFormat(settings.colorPickerClickFormat);
    }
    if (settings.persistOnReload !== undefined) setPersistOnReload(settings.persistOnReload);
    if (settings.snapEnabled !== undefined) toggles.setSnapEnabled(settings.snapEnabled);
    if (settings.snapGuidesEnabled !== undefined) {
      toggles.setSnapGuidesEnabled(settings.snapGuidesEnabled);
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
    guideHighlightEnabled,
    setGuideHighlightEnabled,
    hoverHighlightEnabled,
    setHoverHighlightEnabled,
    persistOnReload,
    setPersistOnReload,
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
