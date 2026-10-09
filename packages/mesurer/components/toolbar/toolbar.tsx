"use client";

import type { Ref } from "react";
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
import type { OpenMenu, ToolMode } from "../../core/types";
import { surfaceAlignFor } from "../../core/toolbar-dock";
import { toolbarAxis, toolbarMotionMs, syncToolbarLayoutSizes } from "../../core/toolbar-motion";
import { useToolbarAutoHide } from "../../hooks/use-toolbar-auto-hide";
import { useToolbarDock } from "../../hooks/use-toolbar-dock";
import { useToolbarGroupMotion } from "../../hooks/use-toolbar-group-motion";
import { surfaceStyle, useFloatingSurfacePlacement, type FloatingSurfacePlacement } from "../../hooks/use-floating-surface-placement";
import { useToolbarTooltip } from "../../hooks/use-toolbar-tooltip";
import { useCommentsFeedback } from "../../hooks/use-comments-feedback";
import { usePageListener } from "../../hooks/use-page-listener";
import { TOOLBAR_SIDE_ATTRIBUTE } from "../screen-recording";
import { MotionPlayer } from "../motion-player";
import { CaptureToast } from "../capture-toast";
import { ScreenshotPreview } from "../screenshot-preview";
import { Tooltip, TooltipLayerContext } from "../tooltip";
import { ToolGroupSwitch, type ToolGroup } from "../tool-group-switch";
import { CommentsPanel } from "../comments-panel";
import { LayoutGuidesPanel } from "../layout-guides-panel";
import { findDeleteConfirmation } from "../../comments/comment-delete-confirmation";
import { ToolbarFloatingSurface } from "../menu";
import {
  ArrowIcon,
  PenIcon,
  BoxSelectIcon,
  CameraIcon,
  RecordIcon,
  ColorPickerIcon,
  CursorIcon,
  GearIcon,
  MesurerMarkIcon,
  RulerIcon,
  RulersIcon,
  TextIcon,
  XrayIcon,
  CommentIcon,
  LayoutGridIcon,
} from "../icons";
import { CaptureMenu, CommentsMenu } from "./toolbar-menus";
import { GuideOrientationMenu } from "./guide-orientation-menu";
import { ToolbarButton, ToolbarCaretButton, ToolbarDivider, ToolbarGroup } from "./toolbar-button";
import { exclusiveToolId, getSettingsShortcut, isAnnotateToolMode, toolGroupForMode } from "./tool-modes";
import type { ToolbarProps } from "./types";

const TOOLBAR_HEIGHT = 40;

// The annotate tools, in the order they sit on the bar.
const ANNOTATE_TOOLS = [
  { mode: "selection", label: "Select", shortcut: "S", Icon: CursorIcon },
  { mode: "arrows", label: "Arrows", shortcut: "D", Icon: ArrowIcon },
  { mode: "pen", label: "Pen", shortcut: "N", Icon: PenIcon },
  { mode: "text", label: "Text", shortcut: "T", Icon: TextIcon },
] as const;
const TOOLTIP_HEIGHT_WITH_GAP = 34;

// Menus sit above the toolbar's other surfaces.
const floatingMenuStyle = (placement: FloatingSurfacePlacement) => ({
  zIndex: 120,
  ...surfaceStyle(placement),
});

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
  const commentsCopied = useCommentsFeedback(eventTarget, "copied");
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
  const previousExclusiveToolIdRef = useRef<string | null>(
    exclusiveToolId(toolMode, colorPickerActive),
  );
  const xrayWasVisibleRef = useRef(xrayVisible);
  const rulersWereVisibleRef = useRef(rulersVisible);
  const [tooltipLayer, setTooltipLayer] = useState<HTMLElement | null>(null);
  const layoutGuidesOpen = openMenu?.type === "layout-guides";
  const tooltipsEnabled = !dragging && !guideMenuOpen && !commentMenuOpen && !captureMenuOpen && !settingsOpen && !layoutGuidesOpen && !colorPickerActive;
  const settingsShortcut = getSettingsShortcut(eventTarget);
  const macShortcuts = /Mac|iPhone|iPad|iPod/.test(eventTarget.navigator.platform);
  const copyCommentsShortcut = macShortcuts ? "⌘ K" : "Ctrl + K";
  const resolveCommentsShortcut = macShortcuts ? "⌘ ⇧ K" : "Ctrl + Shift + K";

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
  // What every tool button needs for its tooltip.
  const tool = (id: string) => ({
    id,
    tooltip: toolbarTooltip,
    tooltipVisible: tooltipsEnabled && visibleTooltipId === id,
  });
  const menuSide: "top" | "bottom" = nearBottom ? "top" : "bottom";
  const recordingPanelOpen = Boolean(screenRecording.panel);
  const motionPlayerOpen = motion.playable && !recordingPanelOpen;
  const floatingCardOpen = recordingPanelOpen || motionPlayerOpen;
  const captureAnchorRef = useRef<HTMLDivElement | null>(null);
  const colorPickerAnchorRef = useRef<HTMLDivElement | null>(null);
  // Auto-hide: a bar glued to an edge slides mostly out of view until the pointer comes back.
  // It stays out while anything hangs off it: a menu, the settings, a card or the color picker.
  const { tucked, pressedOff, tuckAnimated, tuckSliding } = useToolbarAutoHide({
    eventTarget,
    barRef: barBoxRef,
    enabled: autoHide,
    edge,
    minimized,
    busy:
      dragging ||
      settingsOpen ||
      openMenu !== null ||
      floatingCardOpen ||
      colorPickerActive ||
      screenshotPreviewUrl !== null,
  });
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

  // What every tool does first: drop whatever was half done and close what would be in its way.
  const startTool = useCallback(() => {
    onCancelTransient();
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
  }, [onCancelScreenshot, onCancelTransient, setColorPickerActive, setEnabled]);
  // Switches a tool on, or off when it is already the one in use.
  const toggleTool = useCallback(
    (mode: ToolMode) => {
      startTool();
      setToolMode((prev) => (prev === mode ? "none" : mode));
      onInteract();
    },
    [onInteract, setToolMode, startTool],
  );

  const selectMode = () => {
    // Cleared in this order: what was half done first, then what was selected.
    onCancelTransient();
    clearSelection();
    toggleTool("select");
  };

  const guidesMode = () => {
    toggleTool("guides");
    setOpenMenu(null);
  };

  // Comments sit in the trailing cluster, so they keep whichever tool group is open.
  const commentsMode = () => {
    toggleTool("comments");
    setOpenMenu(null);
  };

  const openCommentsPanel = () => {
    startTool();
    if (toolMode !== "comments") {
      setToolMode("comments");
    }
    setOpenMenu({ type: "comments", panel: true });
  };

  const xrayMode = useCallback(() => {
    startTool();
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
    startTool();
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
                                      {...tool("select")}
                                      active={toolMode === "select"}
                                      label="Inspect"
                                      shortcut="I"
                                      onClick={selectMode}
                                    >
                                      <BoxSelectIcon size={20} />
                                    </ToolbarButton>
                                    <ToolbarButton
                                      {...tool("xray")}
                                      active={xrayVisible}
                                      label="X-ray"
                                      shortcut="X"
                                      onClick={xrayMode}
                                    >
                                      <XrayIcon size={20} />
                                    </ToolbarButton>
                                    <ToolbarButton
                                      {...tool("guides")}
                                      active={guideControl === "rulers" ? rulersVisible : toolMode === "guides"}
                                      label={guideControl === "rulers" ? "Rulers" : "Guides"}
                                      shortcut={guideControl === "rulers" ? "R" : "G"}
                                      onClick={guideControl === "rulers" ? rulersMode : guidesMode}
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
                                      <ToolbarCaretButton
                                        ref={guideMenuButtonRef}
                                        label="Guide orientation menu"
                                        open={guideMenuOpen}
                                        onClick={() => toggleToolbarMenu({ type: "guide-orientation" })}
                                      />
                                      <Tooltip
                                        label="Orientation Guide"
                                        visible={tooltipsEnabled && visibleTooltipId === "guide-menu"}
                                        instant={tooltipInstant}
                                        side={tooltipSide}
                                        anchorRef={guideMenuRef}
                                      />
                                      {guideMenuOpen
                                        ? createPortal(
                                          <GuideOrientationMenu
                                            ref={guideMenuPortalRef}
                                            style={floatingMenuStyle(guideMenuPortalPlacement)}
                                            side={menuSide}
                                            rulers={features.rulers}
                                            control={guideControl}
                                            orientation={guideOrientation}
                                            onSelect={(choice) =>
                                              choice === "rulers" ? selectRulers() : selectGuideOrientation(choice)
                                            }
                                            onClose={() => setOpenMenu(null)}
                                          />,
                                          commentPanelPortalTarget,
                                        )
                                        : null}
                                    </div>
                                    <div ref={layoutGuidesAnchorRef} className="msr:relative msr:flex">
                                      <ToolbarButton
                                        {...tool("layout-guides")}
                                        active={layoutGuides.visible}
                                        label="Layout guides"
                                        shortcut="L"
                                        onClick={() => {
                                          dismissCaptureToasts();
                                          layoutGuides.onToggle();
                                        }}
                                      >
                                        <LayoutGridIcon size={20} />
                                      </ToolbarButton>
                                      {layoutGuidesOpen
                                        ? createPortal(
                                          <div
                                            ref={layoutGuidesMenuRef}
                                            className="mesurer-menu-surface msr:pointer-events-auto msr:fixed msr:z-[100] msr:flex msr:w-60 msr:flex-col msr:overflow-hidden msr:rounded-lg msr:bg-surface msr:p-0 msr:shadow-floating"
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
                                        {...tool("color-picker")}
                                        active={colorPickerActive}
                                        label="Sample color"
                                        shortcut="P"
                                        onClick={colorPickerMode}
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
                                    {ANNOTATE_TOOLS.map(({ mode, label, shortcut, Icon }) => (
                                      <ToolbarButton
                                        key={mode}
                                        {...tool(mode)}
                                        active={toolMode === mode}
                                        label={label}
                                        shortcut={shortcut}
                                        onClick={() => toggleTool(mode)}
                                      >
                                        <Icon size={20} aria-hidden="true" />
                                      </ToolbarButton>
                                    ))}
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
                                <ToolbarCaretButton
                                  label="Capture menu"
                                  open={captureMenuOpen}
                                  onClick={() => toggleToolbarMenu({ type: "capture" })}
                                />
                                {captureMenuOpen
                                  ? createPortal(
                                    <CaptureMenu
                                      ref={captureMenuPortalRef}
                                      style={floatingMenuStyle(captureMenuPortalPlacement)}
                                      side={menuSide}
                                      recording={recording}
                                      onScreenshot={screenshotMode}
                                      onRecord={recording ? onScreenRecordingStop : recordMode}
                                      onClose={() => setOpenMenu(null)}
                                    />,
                                    commentPanelPortalTarget,
                                  )
                                  : null}
                              </div>
                              <div ref={commentMenuRef} className="mesurer-toolbar-caret-anchor msr:relative msr:flex msr:flex-none" data-mesurer-comment-ui>
                                <ToolbarButton
                                  {...tool("comments")}
                                  active={toolMode === "comments"}
                                  label="Comments"
                                  shortcut="M"
                                  onClick={commentsMode}
                                >
                                  <CommentIcon size={20} />
                                </ToolbarButton>
                                <ToolbarCaretButton
                                  ref={commentButtonRef}
                                  label="Comment menu"
                                  open={commentMenuOpen}
                                  onClick={() => toggleToolbarMenu({ type: "comments", panel: false })}
                                />
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
                                      resolveShortcut={resolveCommentsShortcut}
                                      onSelect={onSelectComment}
                                      fixed
                                      fixedZIndex={floatingCardOpen ? 120 : 100}
                                    />, commentPanelPortalTarget)
                                  ) : (
                                    createPortal(
                                      <CommentsMenu
                                        ref={commentDropdownPortalRef}
                                        style={floatingMenuStyle(commentDropdownPlacement)}
                                        empty={commentCount === 0}
                                        copied={commentsCopied}
                                        copyShortcut={copyCommentsShortcut}
                                        onShowAll={openCommentsPanel}
                                        onCopy={() => {
                                          void onCopyComments()
                                          setOpenMenu(null)
                                        }}
                                      />,
                                      commentPanelPortalTarget,
                                    )
                                  )
                                ) : null}
                              </div>
                              {features.settings ? <div ref={settingsRef} className="msr:relative msr:flex">
                                <ToolbarButton
                                  {...tool("settings")}
                                  className="msr:relative msr:z-[71]"
                                  active={settingsOpen}
                                  label="Settings"
                                  shortcut={settingsShortcut}
                                  onClick={() => {
                                    dismissCaptureToasts();
                                    onToggleSettings();
                                  }}
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
                        className="mesurer-toolbar-restore msr:flex msr:size-8 msr:select-none msr:items-center msr:justify-center msr:rounded-control msr:bg-transparent msr:text-ink-900 msr:outline-none msr:hover:bg-content/6"
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
