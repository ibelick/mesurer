"use client";

import type { Dispatch, ReactNode, Ref, SetStateAction } from "react";
import {
  forwardRef,
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ToolMode } from "../core/types";
import { cn } from "../core/utils";
import { useToolbarDrag } from "../hooks/use-toolbar-drag";
import { useToolbarTooltip } from "../hooks/use-toolbar-tooltip";
import { useSettingsMenuPlacement } from "../hooks/use-settings-menu-placement";
import { ScreenshotPreview } from "./screenshot-preview";
import { Tooltip, TooltipLayerContext } from "./tooltip";
import { ToolGroupSwitch, type ToolGroup } from "./tool-group-switch";
import {
  CaretDownIcon,
  ArrowIcon,
  PenIcon,
  BoxSelectIcon,
  CheckIcon,
  CameraIcon,
  ColorPickerIcon,
  CursorIcon,
  GearIcon,
  MinusIcon,
  RulerIcon,
  RulersIcon,
  TextInspectorIcon,
  TextIcon,
  XrayIcon,
} from "./icons";

type ToolbarTools = {
  mode: ToolMode;
  setMode: Dispatch<SetStateAction<ToolMode>>;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  xrayVisible: boolean;
  setXrayVisible: Dispatch<SetStateAction<boolean>>;
  rulersVisible: boolean;
  setRulersVisible: Dispatch<SetStateAction<boolean>>;
  guideOrientation: "vertical" | "horizontal";
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>;
};

type ToolbarColorPicker = {
  active: boolean;
  setActive: Dispatch<SetStateAction<boolean>>;
  onClick: () => void;
  panel: ReactNode;
};

type ToolbarScreenshot = {
  active: boolean;
  error: boolean;
  previewUrl: string | null;
  copy: boolean;
  download: boolean;
  onClick: () => void;
  onCancel: () => void;
  onPreviewExited: () => void;
};

type ToolbarSettings = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onToggle: () => void;
  panel: ReactNode;
};

type ToolbarProps = {
  eventTarget: Window;
  onInteract: () => void;
  onCancelTransient: () => void;
  tools: ToolbarTools;
  colorPicker: ToolbarColorPicker;
  screenshot: ToolbarScreenshot;
  settings: ToolbarSettings;
};
const GUIDE_MENU_WIDTH = 176;
const VIEWPORT_PADDING = 8;
const TOOLBAR_HEIGHT = 40;
const TOOLTIP_HEIGHT_WITH_GAP = 34;
const TOOLBAR_MOTION_FALLBACK_MS = 200;

const toolbarMotionMs = (motion: string) => {
  const value = Number.parseFloat(motion);
  if (!Number.isFinite(value)) return TOOLBAR_MOTION_FALLBACK_MS;
  const unit = motion.trim().match(/[\d.]+(m?s)/i)?.[1];
  return unit?.toLowerCase() === "s" ? value * 1000 : value;
};
const getSettingsShortcut = (eventTarget: Window) =>
  /Mac|iPhone|iPad|iPod/.test(eventTarget.navigator.platform)
    ? "⌘ ,"
    : "Ctrl + ,";

const toolGroupForMode = (
  mode: ToolMode,
  colorPickerActive: boolean,
): ToolGroup | null => {
  if (colorPickerActive) return "inspect";
  if (
    mode === "select" ||
    mode === "text-inspector" ||
    mode === "guides" ||
    mode === "xray" ||
    mode === "rulers"
  ) {
    return "inspect";
  }
  if (
    mode === "selection" ||
    mode === "arrows" ||
    mode === "pen" ||
    mode === "text"
  ) {
    return "annotate";
  }
  return null;
};

const isAnnotateToolMode = (mode: ToolMode) =>
  mode === "selection" || mode === "arrows" || mode === "pen" || mode === "text";

const exclusiveToolId = (
  mode: ToolMode,
  colorPickerActive: boolean,
): string | null => {
  if (colorPickerActive) return "color-picker";
  switch (mode) {
    case "select":
    case "text-inspector":
    case "guides":
    case "selection":
    case "arrows":
    case "pen":
    case "text":
      return mode;
    default:
      return null;
  }
};

type ToolbarTooltipProps = {
  tooltipInstant: boolean;
  tooltipSide: "top" | "bottom";
  onTooltipEnter: (id: string) => void;
  onTooltipLeave: (id: string) => void;
};

type ToolbarButtonProps = {
  id: string;
  active: boolean;
  label: string;
  shortcut?: string;
  onClick: () => void;
  tooltipVisible: boolean;
  tooltip: ToolbarTooltipProps;
  children: ReactNode;
};

function ToolbarButton({
  id,
  active,
  label,
  shortcut,
  onClick,
  tooltipVisible,
  tooltip,
  children,
}: ToolbarButtonProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  return (
    <div
      ref={anchorRef}
      className="msr:relative"
      data-tool-id={id}
      onMouseEnter={() => tooltip.onTooltipEnter(id)}
      onMouseLeave={() => tooltip.onTooltipLeave(id)}
    >
      <button
        type="button"
        aria-pressed={active}
        aria-label={`${label} (${shortcut})`}
        className={cn(
          "msr:flex msr:size-8 msr:select-none msr:items-center msr:justify-center msr:rounded-[8px] msr:outline-none",
          active
            ? "msr:bg-[#0d99ff] msr:text-white"
            : "msr:bg-transparent msr:text-black msr:hover:bg-black/4",
        )}
        onClick={onClick}
      >
        {children}
      </button>
      <Tooltip
        label={label}
        shortcut={shortcut}
        visible={tooltipVisible}
        instant={tooltip.tooltipInstant}
        side={tooltip.tooltipSide}
        anchorRef={anchorRef}
      />
    </div>
  );
}

function ToolbarGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("msr:flex msr:items-center msr:gap-1", className)}
    >
      {children}
    </div>
  );
}

function ToolbarDivider() {
  return (
    <div
      aria-hidden="true"
      className="msr:-my-1 msr:w-px msr:self-stretch msr:bg-ink-200"
    />
  );
}

function ToolbarComponent(
  {
    eventTarget,
    onInteract,
    onCancelTransient,
    tools,
    colorPicker,
    screenshot,
    settings,
  }: ToolbarProps,
  ref: Ref<HTMLDivElement>,
) {
  const {
    mode: toolMode,
    setMode: setToolMode,
    setEnabled,
    xrayVisible,
    setXrayVisible,
    rulersVisible,
    setRulersVisible,
    guideOrientation,
    setGuideOrientation,
  } = tools;
  const {
    active: colorPickerActive,
    setActive: setColorPickerActive,
    onClick: onColorPickerClick,
  } = colorPicker;
  const {
    active: screenshotActive,
    error: screenshotError,
    previewUrl: screenshotPreviewUrl,
    copy: screenshotCopy,
    download: screenshotDownload,
    onClick: onScreenshotClick,
    onCancel: onCancelScreenshot,
    onPreviewExited: onScreenshotPreviewExited,
  } = screenshot;
  const {
    open: settingsOpen,
    setOpen: setSettingsOpen,
    onToggle: onToggleSettings,
    panel: settingsPanel,
  } = settings;

  const { position, onPointerDown, onClickCapture } = useToolbarDrag({
    x: 16,
    y: 16,
  }, eventTarget);
  const {
    visibleTooltipId,
    tooltipInstant,
    onTooltipEnter,
    onTooltipLeave,
    onToolbarLeave,
  } =
    useToolbarTooltip();
  const [guideMenuOpen, setGuideMenuOpen] = useState(false);
  const [toolGroup, setToolGroup] = useState<ToolGroup>(
    () => toolGroupForMode(toolMode, colorPickerActive) ?? "inspect",
  );
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const guideMenuRef = useRef<HTMLDivElement | null>(null);
  const toolStageRef = useRef<HTMLDivElement | null>(null);
  const inspectPanelRef = useRef<HTMLDivElement | null>(null);
  const annotatePanelRef = useRef<HTMLDivElement | null>(null);
  const motionRef = useRef<HTMLDivElement | null>(null);
  const trailingRef = useRef<HTMLDivElement | null>(null);
  const barWidthRef = useRef(0);
  const motionReadyRef = useRef(false);
  const motionGroupRef = useRef(toolGroup);
  const previousToolGroupRef = useRef(toolGroup);
  const previousExclusiveToolIdRef = useRef<string | null>(
    exclusiveToolId(toolMode, colorPickerActive),
  );
  const xrayWasVisibleRef = useRef(xrayVisible);
  const rulersWereVisibleRef = useRef(rulersVisible);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [menuAlign, setMenuAlign] = useState<"left" | "right">("right");
  const [tooltipLayer, setTooltipLayer] = useState<HTMLElement | null>(null);
  const tooltipsEnabled = !guideMenuOpen && !settingsOpen;
  const settingsShortcut = getSettingsShortcut(eventTarget);

  const selectToolGroup = useCallback(
    (group: "inspect" | "annotate") => {
      if (group === toolGroup) return;
      onCancelTransient();
      setEnabled(true);
      onInteract();
      setColorPickerActive(false);
      onCancelScreenshot();
      setXrayVisible(false);
      setRulersVisible(false);
      setToolMode(group === "inspect" ? "select" : "selection");
      setToolGroup(group);
      setGuideMenuOpen(false);
    },
    [
      onCancelScreenshot,
      onCancelTransient,
      onInteract,
      setColorPickerActive,
      setEnabled,
      setRulersVisible,
      setToolMode,
      setXrayVisible,
      toolGroup,
    ],
  );

  useLayoutEffect(() => {
    const turnedXrayOn = xrayVisible && !xrayWasVisibleRef.current;
    const turnedRulersOn = rulersVisible && !rulersWereVisibleRef.current;
    xrayWasVisibleRef.current = xrayVisible;
    rulersWereVisibleRef.current = rulersVisible;
    if (turnedXrayOn || turnedRulersOn) {
      setToolGroup("inspect");
      return;
    }
    const fromMode = toolGroupForMode(toolMode, colorPickerActive);
    if (fromMode) {
      setToolGroup(fromMode);
    }
  }, [colorPickerActive, rulersVisible, toolMode, xrayVisible]);

  useLayoutEffect(() => {
    const motion = motionRef.current;
    const chrome = motion?.querySelector(".mesurer-toolbar-chrome");
    const surface = motion?.querySelector(".mesurer-toolbar-surface");
    const stage = toolStageRef.current;
    const track = stage?.querySelector(".mesurer-toolbar-tool-track");
    const trailing = trailingRef.current;
    if (
      !motion ||
      !(chrome instanceof HTMLElement) ||
      !(surface instanceof HTMLElement) ||
      !stage ||
      !(track instanceof HTMLElement) ||
      !trailing
    ) {
      return;
    }

    const toWidth = motion.offsetWidth;
    const fromWidth = barWidthRef.current;
    const fromGroup = motionGroupRef.current;

    if (!motionReadyRef.current || fromGroup === toolGroup) {
      barWidthRef.current = toWidth;
      motionGroupRef.current = toolGroup;
      return;
    }
    if (eventTarget.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      barWidthRef.current = toWidth;
      motionGroupRef.current = toolGroup;
      return;
    }
    if (fromWidth < 1 || toWidth < 1) {
      barWidthRef.current = toWidth;
      motionGroupRef.current = toolGroup;
      return;
    }

    const inspectWidth =
      parseFloat(stage.style.getPropertyValue("--msr-inspect-w")) || 0;
    const fromX = fromGroup === "annotate" ? -inspectWidth : 0;
    const toX = toolGroup === "annotate" ? -inspectWidth : 0;
    const scale = fromWidth / toWidth;
    const trailX = fromWidth - toWidth;
    const growBy = Math.max(0, toWidth - fromWidth);
    const motionTiming =
      getComputedStyle(motion).getPropertyValue("--msr-toolbar-motion").trim() ||
      `${TOOLBAR_MOTION_FALLBACK_MS}ms ease`;
    const transformMotion = `transform ${motionTiming}`;
    const widthChanged = Math.abs(fromWidth - toWidth) > 0.5;
    const clipFrom = `inset(0 ${growBy}px 0 0)`;
    const clipTo = "inset(0)";

    const nodes = [chrome, track, trailing];
    for (const node of nodes) {
      node.style.transition = "none";
    }
    surface.style.transition = "none";
    if (widthChanged) {
      motion.dataset.resizing = "true";
      chrome.style.transform = `scaleX(${scale})`;
      trailing.style.transform = `translateX(${trailX}px)`;
      if (growBy > 0) {
        surface.style.clipPath = clipFrom;
      }
    }
    track.style.transform = `translateX(${fromX}px)`;
    void motion.offsetWidth;

    for (const node of nodes) {
      node.style.transition = transformMotion;
    }
    chrome.style.transform = "scaleX(1)";
    trailing.style.transform = "translateX(0)";
    track.style.transform = `translateX(${toX}px)`;
    if (growBy > 0) {
      surface.style.transition = `clip-path ${motionTiming}`;
      surface.style.clipPath = clipTo;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      barWidthRef.current = toWidth;
      motionGroupRef.current = toolGroup;
      delete motion.dataset.resizing;
      for (const node of nodes) {
        node.style.transition = "";
        node.style.transform = "";
      }
      surface.style.transition = "";
      surface.style.clipPath = "";
    };
    const timeout = eventTarget.setTimeout(
      finish,
      toolbarMotionMs(motionTiming) + 32,
    );
    return () => {
      eventTarget.clearTimeout(timeout);
      if (!motion.isConnected) finish();
    };
  }, [eventTarget, toolGroup]);

  useLayoutEffect(() => {
    const exclusiveId = exclusiveToolId(toolMode, colorPickerActive);
    const expectedGroup = toolGroupForMode(toolMode, colorPickerActive);
    if (expectedGroup && expectedGroup !== toolGroup) return;

    const groupChanged = previousToolGroupRef.current !== toolGroup;
    const previousExclusiveId = previousExclusiveToolIdRef.current;
    previousToolGroupRef.current = toolGroup;
    previousExclusiveToolIdRef.current = exclusiveId;

    if (
      !groupChanged ||
      !previousExclusiveId ||
      previousExclusiveId === exclusiveId
    ) {
      return;
    }
    const stage = toolStageRef.current;
    if (!stage || stage.dataset.ready !== "true") return;
    if (eventTarget.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const button = stage.querySelector(
      `[data-tool-id="${previousExclusiveId}"] button`,
    );
    if (!(button instanceof HTMLElement)) return;

    const motion =
      getComputedStyle(stage).getPropertyValue("--msr-toolbar-motion").trim() ||
      "200ms ease";
    button.style.transition = "none";
    button.style.backgroundColor = "#0d99ff";
    button.style.color = "#fff";
    void button.offsetWidth;
    button.style.transition = `background-color ${motion}, color ${motion}`;
    button.style.backgroundColor = "transparent";
    button.style.color = "#000";

    const timeout = eventTarget.setTimeout(() => {
      button.style.transition = "";
      button.style.backgroundColor = "";
      button.style.color = "";
    }, toolbarMotionMs(motion));
    return () => {
      eventTarget.clearTimeout(timeout);
      button.style.transition = "";
      button.style.backgroundColor = "";
      button.style.color = "";
    };
  }, [colorPickerActive, eventTarget, toolGroup, toolMode]);

  const updateMenuAlign = useCallback(() => {
    const anchorRect = guideMenuRef.current?.getBoundingClientRect();
    if (!anchorRect) return;

    const rightAlignedLeft = anchorRect.right - GUIDE_MENU_WIDTH;
    const leftAlignedRight = anchorRect.left + GUIDE_MENU_WIDTH;

    if (rightAlignedLeft < VIEWPORT_PADDING) {
      setMenuAlign("left");
      return;
    }

    if (leftAlignedRight > eventTarget.innerWidth - VIEWPORT_PADDING) {
      setMenuAlign("right");
      return;
    }

    setMenuAlign("right");
  }, [eventTarget]);

  const viewportHeight =
    eventTarget.innerHeight || 0;
  const nearBottom = viewportHeight > 0 && position.y > viewportHeight - 56;
  const tooltipSide: "top" | "bottom" =
    viewportHeight > 0 &&
    position.y + TOOLBAR_HEIGHT + TOOLTIP_HEIGHT_WITH_GAP > viewportHeight
      ? "top"
      : "bottom";
  const toolbarTooltip = {
    tooltipInstant,
    tooltipSide,
    onTooltipEnter,
    onTooltipLeave,
  };
  const menuSide: "top" | "bottom" = nearBottom ? "top" : "bottom";
  const { menuRef: settingsMenuRef, placement: settingsPlacement } =
    useSettingsMenuPlacement({
      anchorRef: settingsRef,
      eventTarget,
      open: settingsOpen,
      refreshKey: `${position.x}:${position.y}`,
    });

  const selectMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) => (prev === "select" ? "none" : "select"));
    onInteract();
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const selectionMode = useCallback(() => {
    onCancelTransient()
    setEnabled(true)
    setColorPickerActive(false)
    onCancelScreenshot()
    setToolMode((prev) => (prev === "selection" ? "none" : "selection"))
    onInteract()
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode])

  const guidesMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) => (prev === "guides" ? "none" : "guides"));
    onInteract();
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const arrowsMode = useCallback(() => {
    onCancelTransient()
    setEnabled(true)
    setColorPickerActive(false)
    onCancelScreenshot()
    setToolMode((prev) => (prev === "arrows" ? "none" : "arrows"))
    onInteract()
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode])

  const penMode = useCallback(() => {
    onCancelTransient()
    setEnabled(true)
    setColorPickerActive(false)
    onCancelScreenshot()
    setToolMode((prev) => (prev === "pen" ? "none" : "pen"))
    onInteract()
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode])

  const textInspectorMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) =>
      prev === "text-inspector" ? "none" : "text-inspector",
    );
    onInteract();
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const textMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) => (prev === "text" ? "none" : "text"));
    onInteract();
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const xrayMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setXrayVisible((prev) => {
      const next = !prev;
      if (next && isAnnotateToolMode(toolMode)) {
        setToolMode("select");
      }
      return next;
    });
    onInteract();
  }, [
    onCancelScreenshot,
    onCancelTransient,
    onInteract,
    setColorPickerActive,
    setEnabled,
    setToolMode,
    setXrayVisible,
    toolMode,
  ]);

  const colorPickerMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setToolMode("none");
    onCancelScreenshot();
    if (colorPickerActive) {
      setColorPickerActive(false);
    } else {
      setColorPickerActive(true);
      onColorPickerClick();
    }
    onInteract();
  }, [colorPickerActive, onCancelScreenshot, onCancelTransient, onColorPickerClick, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const screenshotMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onScreenshotClick();
    onInteract();
  }, [onCancelTransient, onInteract, onScreenshotClick, setColorPickerActive, setEnabled]);

  const rulersMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setRulersVisible((prev) => {
      const next = !prev;
      if (next && isAnnotateToolMode(toolMode)) {
        setToolMode("select");
      }
      return next;
    });
    onInteract();
  }, [
    onCancelScreenshot,
    onCancelTransient,
    onInteract,
    setColorPickerActive,
    setEnabled,
    setRulersVisible,
    setToolMode,
    toolMode,
  ]);

  const selectGuideOrientation = useCallback(
    (orientation: "vertical" | "horizontal") => {
      onCancelTransient();
      setEnabled(true);
      onCancelScreenshot();
      setToolMode("guides");
      setGuideOrientation(orientation);
      onInteract();
      setGuideMenuOpen(false);
    },
    [onCancelScreenshot, onCancelTransient, onInteract, setEnabled, setGuideOrientation, setToolMode],
  );

  useLayoutEffect(() => {
    const stage = toolStageRef.current;
    const inspectPanel = inspectPanelRef.current;
    const annotatePanel = annotatePanelRef.current;
    if (!stage || !inspectPanel || !annotatePanel) return;

    const widthOf = (panel: HTMLElement) => panel.offsetWidth;

    const syncToolWidths = () => {
      const inspectWidth = widthOf(inspectPanel);
      const annotateWidth = widthOf(annotatePanel);
      if (inspectWidth > 0) {
        stage.style.setProperty("--msr-inspect-w", `${inspectWidth}px`);
      }
      if (annotateWidth > 0) {
        stage.style.setProperty("--msr-annotate-w", `${annotateWidth}px`);
      }
    };

    syncToolWidths();
    const frame = requestAnimationFrame(() => {
      stage.dataset.ready = "true";
      motionReadyRef.current = true;
      const motion = motionRef.current;
      if (motion) {
        motion.dataset.ready = "true";
        barWidthRef.current = motion.offsetWidth;
      }
    });
    const observer = new ResizeObserver(syncToolWidths);
    observer.observe(inspectPanel);
    observer.observe(annotatePanel);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!guideMenuOpen && !settingsOpen) return;

    const frame = guideMenuOpen
      ? eventTarget.requestAnimationFrame(() => {
          guideMenuRef.current
            ?.querySelector<HTMLElement>("[role='menu']")
            ?.focus();
        })
      : 0;

    const handlePointerDown = (event: PointerEvent) => {
      const path = event.composedPath();
      if (guideMenuOpen) {
        const menu = guideMenuRef.current;
        if (menu && !path.includes(menu)) setGuideMenuOpen(false);
      }
      if (settingsOpen) {
        const settings = settingsRef.current;
        if (settings && !path.includes(settings)) setSettingsOpen(false);
      }
    };

    const handleResize = () => {
      if (guideMenuOpen) updateMenuAlign();
    };

    eventTarget.addEventListener("pointerdown", handlePointerDown);
    if (guideMenuOpen) eventTarget.addEventListener("resize", handleResize);
    return () => {
      if (frame) eventTarget.cancelAnimationFrame(frame);
      eventTarget.removeEventListener("pointerdown", handlePointerDown);
      eventTarget.removeEventListener("resize", handleResize);
    };
  }, [eventTarget, guideMenuOpen, guideOrientation, settingsOpen, updateMenuAlign]);

  const toolbarWidth = settingsRef.current?.parentElement?.offsetWidth ?? 0;
  const toastAlignment =
    position.x <= 8
      ? "msr:left-0"
      : position.x + toolbarWidth >= eventTarget.innerWidth - 8
        ? "msr:right-0"
        : "msr:left-1/2 msr:-translate-x-1/2";

  return (
    <div
      className="msr:absolute msr:z-[90]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
    <div className="msr:relative">
    <TooltipLayerContext.Provider value={tooltipLayer}>
    <div
      ref={(node) => {
        motionRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      className="mesurer-toolbar-motion msr:pointer-events-auto"
      style={{ visibility: screenshotActive ? "hidden" : undefined }}
      onPointerDown={(event) => {
        onInteract();
        onPointerDown(event);
      }}
      onClickCapture={onClickCapture}
      onMouseLeave={onToolbarLeave}
    >
    <div className="mesurer-toolbar-chrome" aria-hidden="true" />
    <div className="mesurer-toolbar-surface msr:flex msr:items-center msr:gap-1">
       <ToolGroupSwitch
         value={toolGroup}
         onChange={selectToolGroup}
         tooltip={toolbarTooltip}
         tooltipVisibleId={visibleTooltipId}
         tooltipsEnabled={tooltipsEnabled}
       />
       <div className="msr:flex msr:items-center msr:self-stretch">
       <ToolbarDivider />
       <div
         ref={toolStageRef}
         className="mesurer-toolbar-tool-stage"
         data-group={toolGroup}
       >
       <div className="mesurer-toolbar-tool-track">
       <div
         className="mesurer-toolbar-tool-slot"
         data-group="inspect"
         data-open={toolGroup === "inspect"}
         aria-hidden={toolGroup !== "inspect"}
         inert={toolGroup !== "inspect" ? true : undefined}
       >
       <div ref={inspectPanelRef} className="mesurer-toolbar-tool-panel msr:px-1">
       <ToolbarGroup label="Select and inspect">
      <ToolbarButton
        id="select"
        active={toolMode === "select"}
        label="Inspect"
        shortcut="I"
        onClick={selectMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "select"}
      >
        <BoxSelectIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="xray"
        active={xrayVisible}
        label="X-ray"
        shortcut="X"
        onClick={xrayMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "xray"}
      >
        <XrayIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="rulers"
        active={rulersVisible}
        label="Rulers"
        shortcut="R"
        onClick={rulersMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "rulers"}
      >
        <RulersIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="guides"
        active={toolMode === "guides"}
        label="Guides"
        shortcut="G"
        onClick={guidesMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "guides"}
      >
        <RulerIcon size={20} />
      </ToolbarButton>
      <div
        className="msr:group msr:relative msr:-ml-1 msr:flex msr:items-stretch"
        ref={guideMenuRef}
        onMouseEnter={() => onTooltipEnter("guide-menu")}
        onMouseLeave={() => onTooltipLeave("guide-menu")}
      >
        <button
          type="button"
          aria-label="Guide orientation menu"
          className={cn(
            "msr:flex msr:h-8 msr:w-4 msr:items-center msr:justify-center msr:rounded-[6px] msr:outline-none msr:hover:bg-black/10",
            guideMenuOpen
              ? "msr:bg-black/10 msr:text-black"
              : "msr:text-black",
          )}
          onClick={() => {
            onInteract();
            setGuideMenuOpen((prev) => {
              if (!prev) {
                setActiveMenuIndex(guideOrientation === "horizontal" ? 0 : 1);
                updateMenuAlign();
              }
              return !prev;
            });
          }}
        >
          <CaretDownIcon size={8} />
        </button>
        <Tooltip
          label="Orientation Guide"
          visible={tooltipsEnabled && visibleTooltipId === "guide-menu"}
          instant={tooltipInstant}
          side={tooltipSide}
          anchorRef={guideMenuRef}
        />
        {guideMenuOpen ? (
          <div
            className={cn(
               "mesurer-menu-surface msr:absolute msr:z-[70] msr:w-44 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-1 msr:shadow-lg msr:outline-none msr:focus:outline-none",
              "msr:flex msr:flex-col msr:gap-px",
              menuSide === "bottom"
                ? "msr:top-full msr:mt-2"
                : "msr:bottom-full msr:mb-2",
              menuAlign === "left" ? "msr:left-0" : "msr:right-0",
            )}
            role="menu"
            tabIndex={0}
            onKeyDown={(event) => {
              const key = event.key.toLowerCase();
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveMenuIndex((prev) => (prev + 1) % 2);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveMenuIndex((prev) => (prev - 1 + 2) % 2);
              }
              if (event.key === "Enter") {
                event.preventDefault();
                selectGuideOrientation(
                  activeMenuIndex === 0 ? "horizontal" : "vertical",
                );
              }
              if (key === "h") {
                event.preventDefault();
                selectGuideOrientation("horizontal");
              }
              if (key === "v") {
                event.preventDefault();
                selectGuideOrientation("vertical");
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setGuideMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              className={cn(
                "msr:group msr:flex msr:w-full msr:items-center msr:gap-2 msr:rounded-md msr:px-2 msr:py-1.5 msr:text-left msr:text-[12px]",
                activeMenuIndex === 0 || guideOrientation === "horizontal"
                  ? "msr:bg-[#0d99ff] msr:text-white"
                  : "msr:text-ink-700 msr:hover:bg-[#0d99ff] msr:hover:text-white",
              )}
              onClick={() => selectGuideOrientation("horizontal")}
            >
              <CheckIcon
                size={12}
                className={cn(
                  guideOrientation === "horizontal"
                    ? "msr:opacity-100"
                    : "msr:opacity-0",
                )}
              />
              <MinusIcon size={12} />
              <span className="msr:flex-1">Horizontal</span>
              <span>H</span>
            </button>
            <button
              type="button"
              className={cn(
                "msr:group msr:flex msr:w-full msr:items-center msr:gap-2 msr:rounded-md msr:px-2 msr:py-1.5 msr:text-left msr:text-[12px]",
                activeMenuIndex === 1 || guideOrientation === "vertical"
                  ? "msr:bg-[#0d99ff] msr:text-white"
                  : "msr:text-ink-700 msr:hover:bg-[#0d99ff] msr:hover:text-white",
              )}
              onClick={() => selectGuideOrientation("vertical")}
            >
              <CheckIcon
                size={12}
                className={cn(
                  guideOrientation === "vertical"
                    ? "msr:opacity-100"
                    : "msr:opacity-0",
                )}
              />
              <MinusIcon size={12} className="msr:rotate-90" />
              <span className="msr:flex-1">Vertical</span>
              <span>V</span>
            </button>
          </div>
        ) : null}
      </div>
      <ToolbarButton
        id="text-inspector"
        active={toolMode === "text-inspector"}
        label="Typography"
        shortcut="A"
        onClick={textInspectorMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "text-inspector"}
      >
        <TextInspectorIcon size={20} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        id="color-picker"
        active={colorPickerActive}
        label="Sample color"
        shortcut="P"
        onClick={colorPickerMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "color-picker"}
      >
        <ColorPickerIcon size={20} aria-hidden="true" />
      </ToolbarButton>
       </ToolbarGroup>
       </div>
       </div>
       <div
         className="mesurer-toolbar-tool-slot"
         data-group="annotate"
         data-open={toolGroup === "annotate"}
         aria-hidden={toolGroup !== "annotate"}
         inert={toolGroup !== "annotate" ? true : undefined}
       >
       <div ref={annotatePanelRef} className="mesurer-toolbar-tool-panel msr:px-1">
       <ToolbarGroup label="Annotate">
      <ToolbarButton
        id="selection"
        active={toolMode === "selection"}
        label="Select"
        shortcut="S"
        onClick={selectionMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "selection"}
      >
        <CursorIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="arrows"
        active={toolMode === "arrows"}
        label="Arrows"
        shortcut="D"
        onClick={arrowsMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "arrows"}
      >
        <ArrowIcon size={20} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        id="pen"
        active={toolMode === "pen"}
        label="Pen"
        shortcut="N"
        onClick={penMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "pen"}
      >
        <PenIcon size={20} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        id="text"
        active={toolMode === "text"}
        label="Text"
        shortcut="T"
        onClick={textMode}
        tooltip={toolbarTooltip}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "text"}
      >
        <TextIcon size={20} aria-hidden="true" />
      </ToolbarButton>
       </ToolbarGroup>
       </div>
       </div>
       </div>
       </div>
       <div ref={trailingRef} className="mesurer-toolbar-trailing msr:flex msr:items-center">
       <ToolbarDivider />
       <ToolbarGroup label="Capture and settings" className="msr:px-1">
      <div className="msr:relative">
      <ToolbarButton
        id="screenshot"
        active={screenshotActive}
        label="Screenshot"
        shortcut="C"
        onClick={screenshotMode}
        tooltip={toolbarTooltip}
        tooltipVisible={
          tooltipsEnabled &&
          !screenshotPreviewUrl &&
          visibleTooltipId === "screenshot"
        }
      >
        <CameraIcon size={20} aria-hidden="true" />
      </ToolbarButton>
      {screenshotPreviewUrl ? (
        <ScreenshotPreview
          url={screenshotPreviewUrl}
          side={tooltipSide}
          label={
            screenshotCopy && !screenshotDownload
              ? "Screenshot copied"
              : screenshotDownload && !screenshotCopy
                ? "Screenshot downloaded"
                : "Screenshot saved"
          }
          onExited={onScreenshotPreviewExited}
        />
      ) : null}
      </div>
      <div ref={settingsRef} className="msr:relative msr:flex">
        <ToolbarButton
          id="settings"
          active={settingsOpen}
          label="Settings"
          shortcut={settingsShortcut}
          onClick={() => {
            onCancelScreenshot();
            onInteract();
            onToggleSettings();
          }}
          tooltip={toolbarTooltip}
          tooltipVisible={tooltipsEnabled && visibleTooltipId === "settings"}
        >
          <GearIcon size={20} aria-hidden="true" />
        </ToolbarButton>
        {settingsOpen ? (
          <div
            ref={settingsMenuRef}
            className={cn(
              "mesurer-menu-surface msr:absolute msr:z-[70] msr:flex msr:w-auto msr:max-w-[calc(100vw-16px)] msr:flex-col msr:overflow-hidden msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-0 msr:shadow-lg",
              settingsPlacement.side === "bottom"
                ? "msr:top-full msr:mt-2"
                : "msr:bottom-full msr:mb-2",
            )}
            style={{
              right: settingsPlacement.right,
              height: settingsPlacement.height,
              maxHeight: settingsPlacement.height,
            }}
            data-mesurer-inspector-ui="true"
            role="dialog"
            aria-label="Settings"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {settingsPanel}
          </div>
        ) : null}
      </div>
      </ToolbarGroup>
       </div>
    </div>
    </div>
    </div>
    <div
      ref={setTooltipLayer}
      className="mesurer-toolbar-tooltips"
      style={{ visibility: screenshotActive ? "hidden" : undefined }}
    />
    </TooltipLayerContext.Provider>
      {colorPicker.panel}
      {screenshotError ? (
        <div
          role="status"
          aria-live="polite"
           className={`mesurer-toast-surface msr:pointer-events-none msr:absolute msr:top-full msr:z-10 msr:mt-2 msr:box-border msr:w-max msr:max-w-[min(240px,calc(100vw-16px))] msr:overflow-hidden msr:rounded-[10px] msr:bg-white msr:px-3 msr:py-2 msr:text-center msr:text-[12px] msr:leading-4 msr:text-black msr:whitespace-normal msr:text-pretty msr:line-clamp-2 ${toastAlignment}`}
        >
          Screenshot failed.
          <br />
          Check permissions and try again.
        </div>
      ) : null}
    </div>
    </div>
  );
}

export const Toolbar = memo(forwardRef(ToolbarComponent));
