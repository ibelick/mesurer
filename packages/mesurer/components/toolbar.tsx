"use client";

import type { Dispatch, ReactNode, Ref, SetStateAction } from "react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { OpenMenu, ToolMode } from "../core/types";
import type { CommentFilter, CommentThread } from "../comments/types";
import { cn } from "../core/utils";
import type { ToolbarDock } from "../core/persistence";
import type { ToolbarPlacement } from "../core/toolbar-dock";
import { surfaceAlignFor } from "../core/toolbar-dock";
import { toolbarAxis, toolbarMotionMs, syncToolbarLayoutSizes } from "../core/toolbar-motion";
import { useToolbarDock } from "../hooks/use-toolbar-dock";
import { useToolbarGroupMotion } from "../hooks/use-toolbar-group-motion";
import { surfaceStyle, useFloatingSurfacePlacement, type FloatingSurfacePlacement } from "../hooks/use-floating-surface-placement";
import { useToolbarTooltip } from "../hooks/use-toolbar-tooltip";
import { useCommentsCopied } from "../hooks/use-comments-copied";
import { usePageListener } from "../hooks/use-page-listener";
import { TOOLBAR_SIDE_ATTRIBUTE } from "./screen-recording-editor";
import { MotionPlayer } from "./motion-player";
import { CaptureToast } from "./capture-toast";
import { ScreenshotPreview } from "./screenshot-preview";
import { Tooltip, TooltipLayerContext } from "./tooltip";
import { ToolGroupSwitch, type ToolGroup } from "./tool-group-switch";
import { CommentsPanel } from "./comments-panel";
import { LayoutGuidesPanel } from "./layout-guides-panel";
import { findDeleteConfirmation } from "../comments/comment-delete-confirmation";
import { MenuItem, MenuSurface, ToolbarFloatingSurface, ToolbarMenu, ToolbarMenuItem } from "./menu";
import type { ResolvedMesurerFeatures } from "../core/features";
import type { LayoutGuide } from "../core/layout-guides";
import {
  CaretDownIcon,
  ArrowIcon,
  PenIcon,
  BoxSelectIcon,
  CheckIcon,
  CameraIcon,
  RecordIcon,
  ColorPickerIcon,
  CursorIcon,
  GearIcon,
  MesurerMarkIcon,
  MinusIcon,
  RulerIcon,
  RulersIcon,
  TextIcon,
  XrayIcon,
  CommentIcon,
  LayoutGridIcon,
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
  clearSelection: () => void;
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
  shareMode: "screenshot" | "record";
  onClick: () => void;
  onCancel: () => void;
  onPreviewExited: () => void;
};

type ToolbarScreenRecording = {
  selecting: boolean;
  recording: boolean;
  elapsed: number;
  error: boolean;
  panel: ReactNode;
  onClick: () => void;
  onCancel: () => void;
  onStop: () => void;
};

type ToolbarSettings = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onToggle: () => void;
  panel: ReactNode;
};

type ToolbarComments = {
  count: number;
  onCopy: () => void | Promise<void>;
  comments: CommentThread[];
  unresolvedIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onResolveAll: () => void;
  onToggleResolved: (id: string) => void;
  statusFilter: CommentFilter;
  onStatusFilterChange: (filter: CommentFilter) => void;
};

type ToolbarLayoutGuides = {
  items: LayoutGuide[];
  onChange: Dispatch<SetStateAction<LayoutGuide[]>>;
  onToggle: () => void;
  visible: boolean;
};

type ToolbarProps = {
  eventTarget: Window;
  initialPosition: ToolbarPlacement;
  onPositionChange?: (placement: ToolbarPlacement) => void;
  dock?: ToolbarDock;
  autoHide?: boolean;
  minimized: boolean;
  onInteract: () => void;
  onRestore: () => void;
  onCancelTransient: () => void;
  tools: ToolbarTools;
  colorPicker: ToolbarColorPicker;
  screenshot: ToolbarScreenshot;
  screenRecording: ToolbarScreenRecording;
  motion: {
    element: Element | null;
    ownerWindow: Window;
    playable: boolean;
    observedProperties: string[];
    observedTargets: import("../core/observed-motion").ObservedMotionTarget[];
    inspectDetails: (motionDetails: ReactNode) => ReactNode;
  };
  comments: ToolbarComments;
  layoutGuides: ToolbarLayoutGuides;
  settings: ToolbarSettings;
  features: ResolvedMesurerFeatures;
  openMenu: OpenMenu;
  setOpenMenu: Dispatch<SetStateAction<OpenMenu>>;
};
const TOOLBAR_HEIGHT = 40;
// How long an auto-hidden bar stays out once the pointer has left it.
const TUCK_DELAY_MS = 600;
// A little longer than the slide in and out of view takes (260ms in styles.css).
const TUCK_SLIDE_MS = 320;
const TOOLTIP_HEIGHT_WITH_GAP = 34;

// Menus sit above the toolbar's other surfaces.
const floatingMenuStyle = (placement: FloatingSurfacePlacement) => ({
  zIndex: 120,
  ...surfaceStyle(placement),
});

const getSettingsShortcut = (eventTarget: Window) =>
  /Mac|iPhone|iPad|iPod/.test(eventTarget.navigator.platform)
    ? "⌘ ,"
    : "Ctrl + ,";

const toolGroupForMode = (
  mode: ToolMode,
  colorPickerActive: boolean,
): ToolGroup | null => {
  if (colorPickerActive) return "inspect";
  // Comments sit in the trailing cluster; keep whichever inspect/annotate group is open.
  if (mode === "comments") return null;
  if (
    mode === "select" ||
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
  mode === "selection" || mode === "arrows" || mode === "pen" || mode === "text" || mode === "comments";

const exclusiveToolId = (
  mode: ToolMode,
  colorPickerActive: boolean,
): string | null => {
  if (colorPickerActive) return "color-picker";
  switch (mode) {
    case "select":
    case "guides":
    case "selection":
    case "arrows":
    case "pen":
    case "text":
    case "comments":
      return mode;
    default:
      return null;
  }
};

type ToolbarTooltipProps = {
  tooltipInstant: boolean;
  tooltipSide: "top" | "bottom" | "left" | "right";
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
  className?: string;
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
  className,
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
          "msr:flex msr:size-8 msr:select-none msr:items-center msr:justify-center msr:rounded-control msr:outline-none",
          active
            ? "msr:bg-[#0d99ff] msr:text-white"
            : "msr:bg-transparent msr:text-ink-900 msr:hover:bg-black/4",
          className,
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
      className={cn("mesurer-toolbar-flow msr:flex msr:items-center msr:gap-1 msr:py-1", className)}
    >
      {children}
    </div>
  );
}

function ToolbarDivider() {
  return (
    <div
      aria-hidden="true"
      className="mesurer-toolbar-divider"
    />
  );
}

function ToolbarComponent(
  {
    eventTarget,
    initialPosition,
    onPositionChange,
    dock = "free",
    autoHide = false,
    minimized,
    onInteract,
    onRestore,
    onCancelTransient,
    tools,
    colorPicker,
    screenshot,
    screenRecording,
    motion,
    comments,
    layoutGuides,
    settings,
    features,
    openMenu,
    setOpenMenu,
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
    clearSelection,
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
    shareMode,
    onClick: onScreenshotClick,
    onCancel: onCancelScreenshot,
    onPreviewExited: onScreenshotPreviewExited,
  } = screenshot;
  const { selecting: recordingSelecting, recording, error: recordingError, onClick: onScreenRecordingClick, onCancel: onScreenRecordingCancel, onStop: onScreenRecordingStop } = screenRecording;
  const {
    count: commentCount,
    onCopy: onCopyComments,
    comments: commentThreads,
    unresolvedIds,
    selectedId,
    onSelect: onSelectComment,
    onDelete: onDeleteComment,
    onDeleteAll: onDeleteAllComments,
    onResolveAll: onResolveAllComments,
    onToggleResolved,
    statusFilter,
    onStatusFilterChange,
  } = comments;
  const {
    open: settingsOpen,
    setOpen: setSettingsOpen,
    onToggle: onToggleSettings,
    panel: settingsPanel,
  } = settings;

  const motionRef = useRef<HTMLDivElement | null>(null);
  // The bar's box as laid out. Unlike the bar itself it is never rotated by a turn, so the
  // surfaces placed against it do not wander while the bar swings.
  const barBoxRef = useRef<HTMLDivElement | null>(null);
  // Whether an auto-hidden bar is sliding in or out of view. It slides with a transform, which
  // nothing that watches its layout sees, so its surfaces are placed again on every frame of it.
  const [tuckSliding, setTuckSliding] = useState(false);
  const {
    visibleTooltipId,
    tooltipInstant,
    onTooltipEnter,
    onTooltipLeave,
    onToolbarLeave,
  } =
    useToolbarTooltip();
  const dismissCaptureToasts = useCallback(() => {
    onCancelScreenshot();
    if (!recording) onScreenRecordingCancel();
  }, [onCancelScreenshot, onScreenRecordingCancel, recording]);
  // Closes every menu and card the toolbar has open. The recording and motion cards stay:
  // they belong to work in progress, and follow the bar instead.
  const closeSurfaces = useCallback(() => {
    setOpenMenu(null);
    setSettingsOpen(false);
    setColorPickerActive(false);
    dismissCaptureToasts();
  }, [dismissCaptureToasts, setColorPickerActive, setOpenMenu, setSettingsOpen]);
  const {
    position,
    edge,
    vertical,
    columnSide,
    growOrigin,
    dragging,
    dropZones,
    transition: positionTransition,
    settleTurn,
    onPointerDown: onDragPointerDown,
    onClickCapture,
    consumeDragClick,
  } = useToolbarDock({
    eventTarget,
    motionRef,
    dock,
    minimized,
    initialPosition,
    onPositionChange,
    // Nothing stays open over a toolbar on the move, and tooltips wait for a fresh hover after it.
    onDragStart: closeSurfaces,
    onDragEnd: onToolbarLeave,
  });
  // Every anchored surface (menus and cards) opens toward the same side.
  const surfaceAlign = surfaceAlignFor(position.x, eventTarget.innerWidth);
  const guideMenuOpen = openMenu?.type === "guide-orientation";
  const commentMenuOpen = openMenu?.type === "comments";
  const captureMenuOpen = openMenu?.type === "capture";
  const [guideControl, setGuideControl] = useState<"guides" | "rulers">(
    rulersVisible ? "rulers" : "guides",
  );
  const commentsPanelOpen = openMenu?.type === "comments" && openMenu.panel;
  const toggleToolbarMenu = useCallback(
    (menu: Exclude<OpenMenu, null>) => {
      if (openMenu?.type === menu.type) {
        setOpenMenu(null);
        return;
      }
      closeSurfaces();
      setOpenMenu(menu);
    },
    [closeSurfaces, openMenu, setOpenMenu],
  );
  const { copied: commentsCopied } = useCommentsCopied(eventTarget);
  const [toolGroup, setToolGroup] = useState<ToolGroup>(
    () => toolGroupForMode(toolMode, colorPickerActive) ?? "inspect",
  );
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const guideMenuRef = useRef<HTMLDivElement | null>(null);
  const commentMenuRef = useRef<HTMLDivElement | null>(null);
  const commentButtonRef = useRef<HTMLButtonElement | null>(null);
  const guideMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const layoutGuidesAnchorRef = useRef<HTMLDivElement | null>(null);
  const commentPanelPortalTarget =
    commentMenuRef.current?.closest("[data-mesurer-root]") ?? eventTarget.document.body;
  const toolStageRef = useRef<HTMLDivElement | null>(null);
  const inspectPanelRef = useRef<HTMLDivElement | null>(null);
  const annotatePanelRef = useRef<HTMLDivElement | null>(null);
  const trailingRef = useRef<HTMLDivElement | null>(null);
  const collapseStageRef = useRef<HTMLDivElement | null>(null);
  const expandedPanelRef = useRef<HTMLDivElement | null>(null);
  const iconSlotRef = useRef<HTMLDivElement | null>(null);
  const { markReady: markToolbarMotionReady } = useToolbarGroupMotion({
    eventTarget,
    toolGroup,
    minimized,
    motionRef,
    stageRef: toolStageRef,
    trailingRef,
    collapseRef: collapseStageRef,
    inspectPanelRef,
    annotatePanelRef,
    expandedPanelRef,
    iconSlotRef,
    vertical,
    origin: growOrigin,
  });
  // Runs after the group motion above has settled a turned bar's sizes.
  useLayoutEffect(settleTurn);
  const previousToolGroupRef = useRef(toolGroup);
  const preserveToolGroupRef = useRef(false);
  const previousExclusiveToolIdRef = useRef<string | null>(
    exclusiveToolId(toolMode, colorPickerActive),
  );
  const xrayWasVisibleRef = useRef(xrayVisible);
  const rulersWereVisibleRef = useRef(rulersVisible);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [tooltipLayer, setTooltipLayer] = useState<HTMLElement | null>(null);
  const layoutGuidesOpen = openMenu?.type === "layout-guides";
  const tooltipsEnabled = !dragging && !guideMenuOpen && !commentMenuOpen && !captureMenuOpen && !settingsOpen && !layoutGuidesOpen && !colorPickerActive;
  const settingsShortcut = getSettingsShortcut(eventTarget);
  const copyCommentsShortcut = /Mac|iPhone|iPad|iPod/.test(eventTarget.navigator.platform) ? "⌘ K" : "Ctrl + K";

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
      if (group === "inspect") clearSelection();
      setToolMode(group === "inspect" ? "select" : "selection");
      setToolGroup(group);
      setOpenMenu(null);
    },
    [
      clearSelection,
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
      if (preserveToolGroupRef.current) {
        preserveToolGroupRef.current = false;
        return;
      }
      setToolGroup(fromMode);
    }
  }, [colorPickerActive, rulersVisible, toolMode, xrayVisible]);

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
    const buttonStyles = getComputedStyle(button);
    const activeText = buttonStyles.getPropertyValue("--msr-color-white").trim() || "#fff";
    const inactiveText = buttonStyles.getPropertyValue("--msr-color-black").trim() || "#000";
    button.style.transition = "none";
    button.style.backgroundColor = getComputedStyle(button).getPropertyValue("--msr-accent").trim() || "#0d99ff";
    button.style.color = activeText;
    void button.offsetWidth;
    button.style.transition = `background-color ${motion}, color ${motion}`;
    button.style.backgroundColor = "transparent";
    button.style.color = inactiveText;

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


  const viewportHeight =
    eventTarget.innerHeight || 0;
  const nearBottom = viewportHeight > 0 && (position.y > viewportHeight - 56 || edge === "bottom");
  const edgeSide: "top" | "bottom" =
    viewportHeight > 0 &&
      position.y + TOOLBAR_HEIGHT + TOOLTIP_HEIGHT_WITH_GAP > viewportHeight
      ? "top"
      : "bottom";
  // Floating surfaces and tooltips open toward the page: beside a vertical toolbar, and below
  // or above a horizontal one.
  const surfaceSide: "left" | "right" | undefined = columnSide ? (columnSide === "left" ? "right" : "left") : undefined;
  const tooltipSide = surfaceSide ?? edgeSide;
  const toolbarTooltip = {
    tooltipInstant,
    tooltipSide,
    onTooltipEnter,
    onTooltipLeave,
  };
  const menuSide: "top" | "bottom" = nearBottom ? "top" : "bottom";
  const recordingPanelOpen = Boolean(screenRecording.panel);
  const motionPlayerOpen = motion.playable && !recordingPanelOpen;
  const floatingCardOpen = recordingPanelOpen || motionPlayerOpen;
  const captureAnchorRef = useRef<HTMLDivElement | null>(null);
  const colorPickerAnchorRef = useRef<HTMLDivElement | null>(null);
  // Every menu and card is placed against the bar the same way: below or above a horizontal
  // one, beside a vertical one, and within the bar's own span. They are placed again whenever
  // the bar moves, turns or switches side, and frame by frame while it glides into place.
  // A control's surface hangs off the control that opened it; a bar surface hangs off the
  // whole bar.
  const controlSurface = {
    eventTarget,
    barRef: barBoxRef,
    sideOfAnchor: surfaceSide,
    refreshKey: `${position.x}:${position.y}:${surfaceAlign}:${edge}:${columnSide}`,
    align: surfaceAlign,
    follow: positionTransition !== undefined || tuckSliding,
  };
  const barSurface = { ...controlSurface, anchorRef: barBoxRef, gap: 4, rightOffset: 0 };
  const { surfaceRef: settingsMenuRef, placement: settingsPlacement } =
    useFloatingSurfacePlacement({ ...barSurface, open: settingsOpen, align: "right" });
  const { surfaceRef: recordingPanelRef, placement: recordingPanelPlacement } =
    useFloatingSurfacePlacement({ ...barSurface, open: floatingCardOpen, align: "left" });
  // The side of the recording card that faces the bar, for content that has to keep clear of it.
  const cardToolbarSide = columnSide ?? (recordingPanelPlacement.side === "bottom" ? "top" : "bottom");
  const { surfaceRef: guideMenuPortalRef, placement: guideMenuPortalPlacement } =
    useFloatingSurfacePlacement({ ...controlSurface, anchorRef: guideMenuButtonRef, open: guideMenuOpen });
  const { surfaceRef: layoutGuidesMenuRef, placement: layoutGuidesPlacement } =
    useFloatingSurfacePlacement({ ...controlSurface, anchorRef: layoutGuidesAnchorRef, open: layoutGuidesOpen });
  const { surfaceRef: colorPickerPortalRef, placement: colorPickerPortalPlacement } =
    useFloatingSurfacePlacement({ ...controlSurface, anchorRef: colorPickerAnchorRef, open: colorPickerActive });
  const { surfaceRef: captureMenuPortalRef, placement: captureMenuPortalPlacement } =
    useFloatingSurfacePlacement({ ...controlSurface, anchorRef: captureAnchorRef, open: captureMenuOpen });
  const { surfaceRef: screenshotCardRef, placement: screenshotCardPlacement } =
    useFloatingSurfacePlacement({
      ...controlSurface,
      anchorRef: captureAnchorRef,
      open: screenshotPreviewUrl !== null,
      side: edgeSide,
    });
  const { surfaceRef: commentDropdownPortalRef, placement: commentDropdownPlacement } =
    useFloatingSurfacePlacement({
      ...controlSurface,
      anchorRef: commentButtonRef,
      open: commentMenuOpen && !commentsPanelOpen,
    });
  const { surfaceRef: commentsPanelRef, placement: commentsPlacement } =
    useFloatingSurfacePlacement({ ...controlSurface, anchorRef: commentButtonRef, open: commentsPanelOpen });

  const selectMode = useCallback(() => {
    onCancelTransient();
    clearSelection();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) => (prev === "select" ? "none" : "select"));
    onInteract();
  }, [clearSelection, onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode]);

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
    setOpenMenu(null);
    onInteract();
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setOpenMenu, setToolMode]);

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

  const textMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) => (prev === "text" ? "none" : "text"));
    onInteract();
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const commentsMode = useCallback(() => {
    onCancelTransient()
    setEnabled(true)
    setColorPickerActive(false)
    onCancelScreenshot()
    preserveToolGroupRef.current = true
    setToolGroup("annotate")
    setToolMode((prev) => (prev === "comments" ? "none" : "comments"))
    setOpenMenu(null)
    onInteract()
  }, [onCancelScreenshot, onCancelTransient, onInteract, setColorPickerActive, setEnabled, setOpenMenu, setToolMode])

  const openCommentsPanel = useCallback(() => {
    onCancelTransient()
    setEnabled(true)
    setColorPickerActive(false)
    onCancelScreenshot()
    if (toolMode !== "comments") {
      preserveToolGroupRef.current = true
      setToolGroup("annotate")
      setToolMode("comments")
    }
    setOpenMenu({ type: "comments", panel: true })
  }, [onCancelScreenshot, onCancelTransient, setColorPickerActive, setEnabled, setOpenMenu, setToolMode, toolMode])

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
    onInteract();
    setEnabled(true);
    setToolMode("none");
    dismissCaptureToasts();
    if (colorPickerActive) {
      setColorPickerActive(false);
    } else {
      setColorPickerActive(true);
      onColorPickerClick();
    }
  }, [colorPickerActive, dismissCaptureToasts, onCancelTransient, onColorPickerClick, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const screenshotMode = useCallback(() => {
    onCancelTransient();
    onInteract();
    setEnabled(true);
    setColorPickerActive(false);
    onScreenRecordingCancel();
    onScreenshotClick();
  }, [onCancelTransient, onInteract, onScreenRecordingCancel, onScreenshotClick, setColorPickerActive, setEnabled]);

  const recordMode = useCallback(() => {
    onCancelTransient();
    onInteract();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    onScreenRecordingClick();
  }, [onCancelScreenshot, onCancelTransient, onInteract, onScreenRecordingClick, setColorPickerActive, setEnabled]);

  const preferredCapture = useCallback(() => {
    if (recording) {
      onScreenRecordingStop();
      return;
    }
    if (shareMode === "record") recordMode();
    else screenshotMode();
  }, [recordMode, recording, onScreenRecordingStop, screenshotMode, shareMode]);

  const rulersMode = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setRulersVisible((prev) => {
      const next = !prev;
      if (next) setGuideControl("rulers");
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
      setGuideControl("guides");
      setToolMode("guides");
      setGuideOrientation(orientation);
      onInteract();
      setOpenMenu(null);
    },
    [onCancelScreenshot, onCancelTransient, onInteract, setEnabled, setGuideOrientation, setOpenMenu, setToolMode],
  );

  const selectRulers = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setGuideControl("rulers");
    setRulersVisible(true);
    if (isAnnotateToolMode(toolMode)) setToolMode("select");
    onInteract();
    setOpenMenu(null);
  }, [
    onCancelScreenshot,
    onCancelTransient,
    onInteract,
    setColorPickerActive,
    setEnabled,
    setOpenMenu,
    setRulersVisible,
    setToolMode,
    toolMode,
  ]);

  const openMenuRef = useRef(openMenu);
  openMenuRef.current = openMenu;
  useEffect(() => {
    if (openMenuRef.current?.type === "layout-guides") {
      setOpenMenu(null);
    }
  }, [toolMode, colorPickerActive, xrayVisible, rulersVisible, screenshotActive, setOpenMenu]);

  useLayoutEffect(() => {
    const stage = toolStageRef.current;
    const inspectPanel = inspectPanelRef.current;
    const annotatePanel = annotatePanelRef.current;
    const collapseStage = collapseStageRef.current;
    const expandedPanel = expandedPanelRef.current;
    const iconSlot = iconSlotRef.current;
    if (
      !stage ||
      !inspectPanel ||
      !annotatePanel ||
      !collapseStage ||
      !expandedPanel ||
      !iconSlot
    ) {
      return;
    }

    const syncSizes = () => {
      syncToolbarLayoutSizes({
        stage,
        collapseStage,
        inspectPanel,
        annotatePanel,
        expandedPanel,
        iconSlot,
        axis: toolbarAxis(vertical),
      });
    };

    syncSizes();
    const frame = requestAnimationFrame(() => {
      stage.dataset.ready = "true";
      markToolbarMotionReady();
    });
    const observer = new ResizeObserver(syncSizes);
    observer.observe(inspectPanel);
    observer.observe(annotatePanel);
    observer.observe(iconSlot);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [markToolbarMotionReady, vertical]);

  useLayoutEffect(() => {
    if (!guideMenuOpen) return;

    const frame = eventTarget.requestAnimationFrame(() => {
      guideMenuRef.current
        ?.querySelector<HTMLElement>("[role='menu']")
        ?.focus();
    });
    return () => {
      eventTarget.cancelAnimationFrame(frame);
    };
  }, [eventTarget, guideMenuOpen]);

  // A press outside an open menu closes it, unless it lands on something that belongs to it.
  usePageListener({
    active: openMenu !== null && openMenu.type !== "settings",
    view: eventTarget,
    types: "pointerdown",
    onEvent: (event) => {
      const menu = openMenu
      if (!menu) return
      const path = event.composedPath()
      const pathHas = (selector: string) =>
        path.some((target) => {
          const candidate = target as { closest?: (value: string) => Element | null }
          return Boolean(candidate.closest?.(selector))
        })
      if (pathHas("[data-mesurer-comment-delete-confirmation]")) return
      if (findDeleteConfirmation(eventTarget)) return
      if (menu.type === "comments" && menu.panel) {
        if (pathHas("[data-mesurer-comment-ui]")) return
        const roots: ParentNode[] = [eventTarget.document]
        const host = eventTarget.document.getElementById("mesurer-extension-host")
        if (host?.shadowRoot) roots.push(host.shadowRoot)
        const nestedCommentMenu = roots.some((root) =>
          root.querySelector("[data-mesurer-comment-actions][role='menu']"),
        )
        if (nestedCommentMenu) return
      }
      if (
        (commentButtonRef.current && path.includes(commentButtonRef.current)) ||
        (guideMenuButtonRef.current && path.includes(guideMenuButtonRef.current)) ||
        pathHas("[data-mesurer-menu-trigger]") ||
        pathHas("[role='menu']") ||
        pathHas("[data-mesurer-layout-guides-panel]") ||
        pathHas("[data-tool-id='layout-guides']")
      ) {
        return
      }
      setOpenMenu(null)
    },
  });

  const toolbarWidth = settingsRef.current?.parentElement?.offsetWidth ?? 0;
  const toastAlignment =
    position.x <= 8
      ? "msr:left-0"
      : position.x + toolbarWidth >= eventTarget.innerWidth - 8
        ? "msr:right-0"
        : "msr:left-1/2 msr:-translate-x-1/2";

  // Auto-hide: a bar glued to an edge slides mostly out of view until the pointer comes back.
  // It stays out while anything hangs off it: a menu, the settings, a card or the color picker.
  const busy =
    dragging ||
    settingsOpen ||
    openMenu !== null ||
    floatingCardOpen ||
    colorPickerActive ||
    screenshotPreviewUrl !== null;
  const idle = autoHide && edge !== null && !busy;
  // The bar comes out as soon as the pointer is within reach of its edge, not only over the tab,
  // or the keyboard reaches it, and only goes back a moment after they have left. Just dropped
  // or just used, it starts out and waits that same moment, so it is seen landing before it hides.
  const [revealed, setRevealed] = useState(false);
  // A press that began off the bar (a guide, a stroke, a region being drawn) keeps it hidden
  // until it ends, however close to the bar's edge it goes.
  const [pressedOff, setPressedOff] = useState(false);
  // New on the page or just opened from its closed state, it stays out until the pointer has
  // reached it: it shows that it is there, and the pointer may be anywhere when a page loads or
  // a shortcut opens it. Kept in a ref, so it outlives the effect below being run again.
  const awaitedRef = useRef(true);
  const wasMinimizedRef = useRef(minimized);
  useLayoutEffect(() => {
    if (wasMinimizedRef.current && !minimized) awaitedRef.current = true;
    wasMinimizedRef.current = minimized;
    if (!idle) {
      // Only a bar that would otherwise be hiding is waited on.
      awaitedRef.current = false;
      setRevealed(busy);
      setPressedOff(false);
      return;
    }
    let timer: number | undefined;
    const bar = barBoxRef.current;
    const hideSoon = () => {
      // Not before the pointer has been to it, nor while the keyboard is on it.
      if (awaitedRef.current || bar?.querySelector(":focus-visible")) return;
      timer ??= eventTarget.setTimeout(() => {
        timer = undefined;
        setRevealed(false);
      }, TUCK_DELAY_MS);
    };
    const reach = 48;
    const onPointerMove = (event: PointerEvent) => {
      const rect = barBoxRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { innerWidth: width, innerHeight: height } = eventTarget;
      const alongX = event.clientX >= rect.left - 16 && event.clientX <= rect.right + 16;
      const alongY = event.clientY >= rect.top - 16 && event.clientY <= rect.bottom + 16;
      const near = {
        top: event.clientY <= reach && alongX,
        bottom: event.clientY >= height - reach && alongX,
        left: event.clientX <= reach && alongY,
        right: event.clientX >= width - reach && alongY,
      }[edge!];
      if (!near) hideSoon();
      else if (event.buttons === 0) {
        awaitedRef.current = false;
        stay();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      // The path is read through the shadow root the toolbar lives in.
      setPressedOff(bar !== null && !event.composedPath().includes(bar));
    };
    const onPointerEnd = () => setPressedOff(false);
    const stay = () => {
      eventTarget.clearTimeout(timer);
      timer = undefined;
      setRevealed(true);
    };
    // Focus that came from the keyboard: a click on the bar leaves focus behind without it.
    const onFocusIn = (event: FocusEvent) => {
      if ((event.target as Element).matches(":focus-visible")) stay();
    };
    if (awaitedRef.current) stay();
    else hideSoon();
    eventTarget.addEventListener("pointermove", onPointerMove);
    eventTarget.addEventListener("pointerdown", onPointerDown, true);
    eventTarget.addEventListener("pointerup", onPointerEnd, true);
    eventTarget.addEventListener("pointercancel", onPointerEnd, true);
    bar?.addEventListener("focusin", onFocusIn);
    bar?.addEventListener("focusout", hideSoon);
    return () => {
      eventTarget.clearTimeout(timer);
      eventTarget.removeEventListener("pointermove", onPointerMove);
      eventTarget.removeEventListener("pointerdown", onPointerDown, true);
      eventTarget.removeEventListener("pointerup", onPointerEnd, true);
      eventTarget.removeEventListener("pointercancel", onPointerEnd, true);
      bar?.removeEventListener("focusin", onFocusIn);
      bar?.removeEventListener("focusout", hideSoon);
    };
  }, [busy, edge, eventTarget, idle, minimized]);
  const tucked = idle && !revealed;
  // A surface opened while the bar is tucked (a shortcut, a capture that just finished) would
  // otherwise be placed against where the bar was hiding, and end up on top of it.
  useLayoutEffect(() => {
    setTuckSliding(true);
    const timer = eventTarget.setTimeout(() => setTuckSliding(false), TUCK_SLIDE_MS);
    return () => eventTarget.clearTimeout(timer);
  }, [eventTarget, tucked]);
  // The tuck only animates once the bar has been painted, so nothing slides as the page loads.
  const [tuckAnimated, setTuckAnimated] = useState(false);
  useEffect(() => {
    // Two frames: the first one places the bar on its edge.
    let frame = eventTarget.requestAnimationFrame(() => {
      frame = eventTarget.requestAnimationFrame(() => setTuckAnimated(true));
    });
    return () => eventTarget.cancelAnimationFrame(frame);
  }, [eventTarget]);
  return (
    <div
      className="mesurer-toolbar-container msr:absolute msr:z-[100]"
      data-tucked={tucked ? "true" : undefined}
      data-tuck-locked={pressedOff ? "true" : undefined}
      data-tuck-animated={tuckAnimated ? "true" : undefined}
      data-tuck-edge={edge ?? undefined}
      style={{
        left: position.x,
        top: position.y,
        transition: positionTransition,
      }}
    >
      {dropZones.map((zone, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="mesurer-toolbar-zone"
          data-active={zone.active ? "true" : undefined}
          style={{ left: zone.x, top: zone.y, width: zone.width, height: zone.height }}
        />
      ))}
      <div ref={barBoxRef} className="msr:relative msr:flex">
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
            data-orientation={vertical ? "vertical" : "horizontal"}
            data-edge={edge ?? undefined}
            data-column-side={columnSide ?? undefined}
            style={{ visibility: screenshotActive || recordingSelecting ? "hidden" : undefined }}
            onPointerDown={onDragPointerDown}
            onMouseDown={(event) => {
              if (event.button !== 0) return
              const target = event.target
              if (
                target instanceof Element &&
                target.closest("input, textarea, select, [contenteditable]")
              ) {
                return
              }
              event.preventDefault()
            }}
            onClickCapture={onClickCapture}
            onMouseLeave={onToolbarLeave}
          >
            <div className="mesurer-toolbar-chrome" aria-hidden="true" />
            <div className="mesurer-toolbar-clip">
              <div className="mesurer-toolbar-surface mesurer-toolbar-flow msr:flex msr:items-center">
                <div
                  ref={collapseStageRef}
                  className="mesurer-toolbar-minimize-stage"
                  data-minimized={minimized ? "true" : undefined}
                >
                  <div className="mesurer-toolbar-minimize-track mesurer-toolbar-flow">
                    <div
                      className="mesurer-toolbar-minimize-slot"
                      data-slot="expanded"
                      data-open={!minimized}
                      aria-hidden={minimized}
                      inert={minimized ? true : undefined}
                    >
                      <div ref={expandedPanelRef} className="mesurer-toolbar-expanded mesurer-toolbar-flow msr:flex msr:w-max msr:items-stretch msr:gap-1 msr:pl-1">
                        <ToolGroupSwitch
                          value={toolGroup}
                          onChange={selectToolGroup}
                          tooltip={toolbarTooltip}
                          tooltipVisibleId={visibleTooltipId}
                          tooltipsEnabled={tooltipsEnabled}
                        />
                        <div className="mesurer-toolbar-flow msr:flex msr:items-stretch">
                          <ToolbarDivider />
                          <div
                            ref={toolStageRef}
                            className="mesurer-toolbar-tool-stage"
                            data-group={toolGroup}
                          >
                            <div className="mesurer-toolbar-tool-track mesurer-toolbar-flow">
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
                                      id="guides"
                                      active={guideControl === "rulers" ? rulersVisible : toolMode === "guides"}
                                      label={guideControl === "rulers" ? "Rulers" : "Guides"}
                                      shortcut={guideControl === "rulers" ? "R" : "G"}
                                      onClick={guideControl === "rulers" ? rulersMode : guidesMode}
                                      tooltip={toolbarTooltip}
                                      tooltipVisible={tooltipsEnabled && visibleTooltipId === "guides"}
                                    >
                                      {guideControl === "rulers" ? (
                                        <RulersIcon size={20} />
                                      ) : (
                                        <RulerIcon
                                          size={20}
                                          className={guideOrientation === "vertical" ? "msr:rotate-90" : undefined}
                                        />
                                      )}
                                    </ToolbarButton>
                                    <div
                                      className="mesurer-toolbar-flow mesurer-toolbar-caret-anchor msr:group msr:relative msr:-ml-1 msr:flex msr:items-stretch"
                                      ref={guideMenuRef}
                                      onMouseEnter={() => onTooltipEnter("guide-menu")}
                                      onMouseLeave={() => onTooltipLeave("guide-menu")}
                                    >
                                      <button
                                        type="button"
                                        ref={guideMenuButtonRef}
                                        aria-label="Guide orientation menu"
                                        aria-haspopup="menu"
                                        aria-expanded={guideMenuOpen}
                                        data-mesurer-menu-trigger
                                        className={cn(
                                          "mesurer-toolbar-caret-btn msr:relative msr:z-80 msr:flex msr:h-8 msr:w-4 msr:items-center msr:justify-center msr:rounded-control msr:outline-none msr:hover:bg-black/4",
                                          guideMenuOpen
                                            ? "msr:bg-black/4 msr:text-ink-900"
                                            : "msr:text-ink-900",
                                        )}
                                        onClick={() => {
                                          if (!guideMenuOpen) {
                                            setActiveMenuIndex(
                                              features.rulers && guideControl === "rulers"
                                                ? 0
                                                : guideOrientation === "horizontal"
                                                  ? features.rulers ? 1 : 0
                                                  : features.rulers ? 2 : 1,
                                            );
                                          }
                                          toggleToolbarMenu({ type: "guide-orientation" });
                                        }}
                                      >
                                        <CaretDownIcon size={8} className="mesurer-toolbar-caret" />
                                      </button>
                                      <Tooltip
                                        label="Orientation Guide"
                                        visible={tooltipsEnabled && visibleTooltipId === "guide-menu"}
                                        instant={tooltipInstant}
                                        side={tooltipSide}
                                        anchorRef={guideMenuRef}
                                      />
                                      {guideMenuOpen ? (() => {
                                        const menu = (
                                          <ToolbarMenu
                                            ref={guideMenuPortalRef}
                                            floating
                                            floatingStyle={floatingMenuStyle(guideMenuPortalPlacement)}
                                            side={menuSide}
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                              const key = event.key.toLowerCase();
                                              const itemCount = features.rulers ? 3 : 2;
                                              const horizontalIndex = features.rulers ? 1 : 0;
                                              const verticalIndex = features.rulers ? 2 : 1;
                                              if (event.key === "ArrowDown") {
                                                event.preventDefault();
                                                setActiveMenuIndex((prev) => (prev + 1) % itemCount);
                                              }
                                              if (event.key === "ArrowUp") {
                                                event.preventDefault();
                                                setActiveMenuIndex((prev) => (prev - 1 + itemCount) % itemCount);
                                              }
                                              if (event.key === "Enter") {
                                                event.preventDefault();
                                                if (features.rulers && activeMenuIndex === 0) selectRulers();
                                                else if (activeMenuIndex === horizontalIndex) selectGuideOrientation("horizontal");
                                                else if (activeMenuIndex === verticalIndex) selectGuideOrientation("vertical");
                                              }
                                              if (features.rulers && key === "r") {
                                                event.preventDefault();
                                                selectRulers();
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
                                                setOpenMenu(null);
                                              }
                                            }}
                                          >
                                            {features.rulers ? (
                                              <MenuItem
                                                className={cn(
                                                  "msr:group msr:flex msr:w-full msr:items-center msr:gap-2 msr:rounded-[4px] msr:px-2 msr:py-1 msr:text-left msr:text-[11px] msr:leading-4",
                                                  activeMenuIndex === 0 || guideControl === "rulers"
                                                    ? "msr:bg-[#0d99ff] msr:text-white"
                                                    : "msr:text-ink-700 msr:hover:bg-[#0d99ff] msr:hover:text-white",
                                                )}
                                                onClick={() => selectRulers()}
                                              >
                                                <CheckIcon
                                                  size={12}
                                                  className={cn(guideControl === "rulers" ? "msr:opacity-100" : "msr:opacity-0")}
                                                />
                                                <RulersIcon size={12} />
                                                <span className="msr:flex-1">Rulers</span>
                                                <span>R</span>
                                              </MenuItem>
                                            ) : null}
                                            <MenuItem
                                              className={cn(
                                                "msr:group msr:flex msr:w-full msr:items-center msr:gap-2 msr:rounded-[4px] msr:px-2 msr:py-1 msr:text-left msr:text-[11px] msr:leading-4",
                                                activeMenuIndex === (features.rulers ? 1 : 0) || (guideControl === "guides" && guideOrientation === "horizontal")
                                                  ? "msr:bg-[#0d99ff] msr:text-white"
                                                  : "msr:text-ink-700 msr:hover:bg-[#0d99ff] msr:hover:text-white",
                                              )}
                                              onClick={() => selectGuideOrientation("horizontal")}
                                            >
                                              <CheckIcon
                                                size={12}
                                                className={cn(
                                                  guideControl === "guides" && guideOrientation === "horizontal"
                                                    ? "msr:opacity-100"
                                                    : "msr:opacity-0",
                                                )}
                                              />
                                              <MinusIcon size={12} />
                                              <span className="msr:flex-1">Horizontal</span>
                                              <span>H</span>
                                            </MenuItem>
                                            <MenuItem
                                              className={cn(
                                                "msr:group msr:flex msr:w-full msr:items-center msr:gap-2 msr:rounded-[4px] msr:px-2 msr:py-1 msr:text-left msr:text-[11px] msr:leading-4",
                                                activeMenuIndex === (features.rulers ? 2 : 1) || (guideControl === "guides" && guideOrientation === "vertical")
                                                  ? "msr:bg-[#0d99ff] msr:text-white"
                                                  : "msr:text-ink-700 msr:hover:bg-[#0d99ff] msr:hover:text-white",
                                              )}
                                              onClick={() => selectGuideOrientation("vertical")}
                                            >
                                              <CheckIcon
                                                size={12}
                                                className={cn(
                                                  guideControl === "guides" && guideOrientation === "vertical"
                                                    ? "msr:opacity-100"
                                                    : "msr:opacity-0",
                                                )}
                                              />
                                              <MinusIcon size={12} className="msr:rotate-90" />
                                              <span className="msr:flex-1">Vertical</span>
                                              <span>V</span>
                                            </MenuItem>
                                          </ToolbarMenu>
                                        );
                                        return createPortal(menu, commentPanelPortalTarget);
                                      })() : null}
                                    </div>
                                    <div ref={layoutGuidesAnchorRef} className="msr:relative msr:flex">
                                      <ToolbarButton
                                        id="layout-guides"
                                        active={layoutGuides.visible}
                                        label="Layout guides"
                                        shortcut="L"
                                        onClick={() => {
                                          dismissCaptureToasts();
                                          layoutGuides.onToggle();
                                        }}
                                        tooltip={toolbarTooltip}
                                        tooltipVisible={tooltipsEnabled && visibleTooltipId === "layout-guides"}
                                      >
                                        <LayoutGridIcon size={20} />
                                      </ToolbarButton>
                                      {layoutGuidesOpen
                                        ? createPortal(
                                          <div
                                            ref={layoutGuidesMenuRef}
                                            className="mesurer-menu-surface msr:pointer-events-auto msr:fixed msr:z-[100] msr:flex msr:w-60 msr:flex-col msr:overflow-hidden msr:rounded-lg msr:bg-white msr:p-0 msr:shadow-floating"
                                            style={{
                                              zIndex: 120,
                                              ...surfaceStyle(layoutGuidesPlacement),
                                              maxHeight: Math.min(320, layoutGuidesPlacement.height),
                                            }}
                                            data-mesurer-layout-guides-panel
                                            role="dialog"
                                            aria-label="Layout guides"
                                            onPointerDown={(event) => event.stopPropagation()}
                                            onPointerMove={(event) => event.stopPropagation()}
                                            onPointerUp={(event) => event.stopPropagation()}
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            <LayoutGuidesPanel
                                              guides={layoutGuides.items}
                                              ownerWindow={eventTarget}
                                              onChange={layoutGuides.onChange}
                                            />
                                          </div>,
                                          commentPanelPortalTarget,
                                        )
                                        : null}
                                    </div>
                                    <div ref={colorPickerAnchorRef} className="msr:relative msr:flex">
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
                                      {colorPickerActive
                                        ? createPortal(
                                          <div
                                            ref={colorPickerPortalRef}
                                            className="msr:pointer-events-auto msr:fixed"
                                            style={floatingMenuStyle(colorPickerPortalPlacement)}
                                          >
                                            {colorPicker.panel}
                                          </div>,
                                          commentPanelPortalTarget,
                                        )
                                        : null}
                                    </div>
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
                          <div ref={trailingRef} className="mesurer-toolbar-trailing mesurer-toolbar-flow msr:flex msr:items-stretch">
                            <ToolbarDivider />
                            <ToolbarGroup label="Capture and settings" className="msr:px-1">
                              <div ref={captureAnchorRef} className="mesurer-toolbar-flow mesurer-toolbar-caret-anchor msr:relative msr:flex msr:flex-none">
                                {features.screenshot ? (
                                  <>
                                    <ToolbarButton
                                      id="screenshot"
                                      active={screenshotActive || recording}
                                      label={recording ? "Stop recording" : shareMode === "record" ? "Screen record" : "Screenshot"}
                                      shortcut={recording ? undefined : shareMode === "record" ? "V" : "C"}
                                      onClick={() => {
                                        if (openMenu?.type === "capture") setOpenMenu(null)
                                        preferredCapture()
                                      }}
                                      tooltip={toolbarTooltip}
                                      tooltipVisible={
                                        tooltipsEnabled &&
                                        !screenshotPreviewUrl &&
                                        visibleTooltipId === "screenshot"
                                      }
                                    >
                                      {recording ? <span aria-hidden="true" className="msr:size-3 msr:rounded-[2px] msr:bg-[var(--msr-danger-solid-bg)]" /> : shareMode === "record" ? <RecordIcon size={20} aria-hidden="true" /> : <CameraIcon size={20} aria-hidden="true" />}
                                    </ToolbarButton>
                                    {screenshotPreviewUrl ? createPortal(
                                      <ScreenshotPreview
                                        ref={screenshotCardRef}
                                        url={screenshotPreviewUrl}
                                        style={floatingMenuStyle(screenshotCardPlacement)}
                                        side={screenshotCardPlacement.side}
                                        label={
                                          screenshotCopy && !screenshotDownload
                                            ? "Screenshot copied"
                                            : screenshotDownload && !screenshotCopy
                                              ? "Screenshot downloaded"
                                              : "Screenshot saved"
                                        }
                                        onExited={onScreenshotPreviewExited}
                                      />,
                                      commentPanelPortalTarget,
                                    ) : null}
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  aria-label="Capture menu"
                                  aria-haspopup="menu"
                                  aria-expanded={captureMenuOpen}
                                  data-mesurer-menu-trigger
                                  className={cn(
                                    "mesurer-toolbar-caret-btn msr:relative msr:z-80 msr:flex msr:h-8 msr:w-4 msr:items-center msr:justify-center msr:rounded-control msr:outline-none msr:hover:bg-black/4",
                                    captureMenuOpen ? "msr:bg-black/4 msr:text-ink-900" : "msr:text-ink-900",
                                  )}
                                  onClick={() => toggleToolbarMenu({ type: "capture" })}
                                >
                                  <CaretDownIcon size={8} aria-hidden="true" className="mesurer-toolbar-caret" />
                                </button>
                                {captureMenuOpen ? (() => {
                                  const menu = (
                                    <ToolbarMenu
                                      ref={captureMenuPortalRef}
                                      floating
                                      floatingStyle={floatingMenuStyle(captureMenuPortalPlacement)}
                                      side={menuSide}
                                      align="right"
                                      onKeyDown={(event) => {
                                        if (event.key !== "Escape") return
                                        event.preventDefault()
                                        event.stopPropagation()
                                        setOpenMenu(null)
                                      }}
                                    >
                                      <ToolbarMenuItem
                                        onClick={() => {
                                          setOpenMenu(null)
                                          screenshotMode()
                                        }}
                                      >
                                        <CameraIcon size={12} />
                                        <span className="msr:flex-1">Screenshot</span>
                                        <span>C</span>
                                      </ToolbarMenuItem>
                                      <ToolbarMenuItem
                                        onClick={() => {
                                          setOpenMenu(null)
                                          if (recording) onScreenRecordingStop()
                                          else recordMode()
                                        }}
                                      >
                                        <RecordIcon size={12} />
                                        <span className="msr:flex-1">{recording ? "Stop recording" : "Screen record"}</span>
                                        <span>V</span>
                                      </ToolbarMenuItem>
                                    </ToolbarMenu>
                                  );
                                  return createPortal(menu, commentPanelPortalTarget);
                                })() : null}
                              </div>
                              <div ref={commentMenuRef} className="mesurer-toolbar-caret-anchor msr:relative msr:flex msr:flex-none" data-mesurer-comment-ui>
                                <ToolbarButton
                                  id="comments"
                                  active={toolMode === "comments"}
                                  label="Comments"
                                  shortcut="M"
                                  onClick={commentsMode}
                                  tooltip={toolbarTooltip}
                                  tooltipVisible={tooltipsEnabled && visibleTooltipId === "comments"}
                                >
                                  <CommentIcon size={20} />
                                </ToolbarButton>
                                <button
                                  type="button"
                                  ref={commentButtonRef}
                                  aria-label="Comment menu"
                                  aria-haspopup="menu"
                                  aria-expanded={commentMenuOpen}
                                  data-mesurer-menu-trigger
                                  className={cn(
                                    "mesurer-toolbar-caret-btn msr:relative msr:z-80 msr:flex msr:h-8 msr:w-4 msr:items-center msr:justify-center msr:rounded-control msr:outline-none msr:hover:bg-black/4",
                                    commentMenuOpen ? "msr:bg-black/4 msr:text-ink-900" : "msr:text-ink-900",
                                  )}
                                  onClick={() => {
                                    toggleToolbarMenu({ type: "comments", panel: false })
                                  }}
                                >
                                  <CaretDownIcon size={8} className="mesurer-toolbar-caret" />
                                </button>
                                {commentMenuOpen ? (
                                  commentsPanelOpen ? (
                                    createPortal(<CommentsPanel
                                      comments={commentThreads}
                                      unresolvedIds={unresolvedIds}
                                      selectedId={selectedId}
                                      panelRef={commentsPanelRef}
                                      placement={commentsPlacement}
                                      onDelete={onDeleteComment}
                                      onToggleResolved={onToggleResolved}
                                      onDeleteAll={onDeleteAllComments}
                                      onResolveAll={onResolveAllComments}
                                      onCopy={onCopyComments}
                                      statusFilter={statusFilter}
                                      onStatusFilterChange={onStatusFilterChange}
                                      ownerWindow={eventTarget}
                                      copyShortcut={copyCommentsShortcut}
                                      onSelect={(id) => {
                                        if (toolMode !== "comments") preserveToolGroupRef.current = true;
                                        onSelectComment(id)
                                      }}
                                      fixed
                                      fixedZIndex={floatingCardOpen ? 120 : 100}
                                    />, commentPanelPortalTarget)
                                  ) : (
                                    createPortal(
                                      <MenuSurface
                                        ref={commentDropdownPortalRef}
                                        className="msr:pointer-events-auto msr:fixed msr:flex msr:w-44 msr:flex-col msr:gap-px"
                                        style={floatingMenuStyle(commentDropdownPlacement)}
                                        data-mesurer-comment-ui
                                      >
                                        <>
                                          <MenuItem disabled={commentCount === 0} onClick={openCommentsPanel}>
                                            <span className="msr:flex-1">Show all comments</span>
                                          </MenuItem>
                                          <MenuItem
                                            disabled={commentCount === 0}
                                            onClick={() => {
                                              void onCopyComments()
                                              setOpenMenu(null)
                                            }}
                                          >
                                            <span className="msr:flex-1">Copy comments</span>
                                            {commentsCopied ? <CheckIcon size={12} /> : <span>{copyCommentsShortcut}</span>}
                                          </MenuItem>
                                        </>
                                      </MenuSurface>,
                                      commentPanelPortalTarget,
                                    )
                                  )
                                ) : null}
                              </div>
                              {features.settings ? <div ref={settingsRef} className="msr:relative msr:flex">
                                <ToolbarButton
                                  id="settings"
                                  className="msr:relative msr:z-[71]"
                                  active={settingsOpen}
                                  label="Settings"
                                  shortcut={settingsShortcut}
                                  onClick={() => {
                                    dismissCaptureToasts();
                                    onToggleSettings();
                                  }}
                                  tooltip={toolbarTooltip}
                                  tooltipVisible={tooltipsEnabled && visibleTooltipId === "settings"}
                                >
                                  <GearIcon size={20} aria-hidden="true" />
                                </ToolbarButton>
                                {settingsOpen
                                  ? createPortal(
                                    <ToolbarFloatingSurface
                                      ref={settingsMenuRef}
                                      className="msr:flex msr:w-auto msr:max-w-[calc(100vw-16px)] msr:flex-col msr:overflow-hidden msr:p-0"
                                      style={{
                                        ...surfaceStyle(settingsPlacement),
                                        height: settingsPlacement.height,
                                        maxHeight: settingsPlacement.height,
                                      }}
                                      data-mesurer-inspector-ui="true"
                                      data-mesurer-settings-panel
                                      role="dialog"
                                      aria-label="Settings"
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onPointerMove={(event) => event.stopPropagation()}
                                      onPointerUp={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {settingsPanel}
                                    </ToolbarFloatingSurface>,
                                    commentPanelPortalTarget,
                                  )
                                  : null}
                              </div> : null}
                            </ToolbarGroup>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      ref={iconSlotRef}
                      className="mesurer-toolbar-minimize-slot msr:px-1 msr:py-1"
                      data-slot="icon"
                      data-open={minimized}
                      aria-hidden={!minimized}
                      inert={!minimized ? true : undefined}
                    >
                      <button
                        type="button"
                        aria-label="Show Mesurer toolbar"
                        className="mesurer-toolbar-restore msr:flex msr:size-8 msr:select-none msr:items-center msr:justify-center msr:rounded-control msr:bg-transparent msr:text-ink-900 msr:outline-none msr:hover:bg-black/4"
                        onClick={(event) => {
                          if (event.defaultPrevented || consumeDragClick()) return;
                          onRestore();
                        }}
                      >
                        <MesurerMarkIcon size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {createPortal(
            <div
              ref={setTooltipLayer}
              className="mesurer-toolbar-tooltips"
              style={{ visibility: screenshotActive || recordingSelecting ? "hidden" : undefined }}
            />,
            commentPanelPortalTarget,
          )}
          {floatingCardOpen
            ? createPortal(
              <div
                ref={recordingPanelRef}
                className="msr:pointer-events-auto msr:fixed msr:z-[101] msr:w-max msr:max-w-[calc(100vw-16px)]"
                style={{
                  ...surfaceStyle(recordingPanelPlacement),
                  zIndex: 101,
                }}
                data-mesurer-capture-ui
                {...{ [TOOLBAR_SIDE_ATTRIBUTE]: cardToolbarSide }}
              >
                 {recordingPanelOpen ? screenRecording.panel : (
                   <div className="msr:w-[22rem] msr:max-w-[calc(100vw-24px)]" data-mesurer-motion-surface>
                      <MotionPlayer element={motion.element} ownerWindow={motion.ownerWindow} observedProperties={motion.observedProperties} observedTargets={motion.observedTargets} inspectDetails={motion.inspectDetails} />
                   </div>
                 )}
              </div>,
              commentPanelPortalTarget,
            )
            : null}
        </TooltipLayerContext.Provider>
        {screenshotError ? (
          <CaptureToast align={toastAlignment} title="Screenshot failed." />
        ) : recordingError ? (
          <CaptureToast align={toastAlignment} title="Recording failed." />
        ) : null}
      </div>
    </div>
  );
}

export const Toolbar = memo(forwardRef(ToolbarComponent));
