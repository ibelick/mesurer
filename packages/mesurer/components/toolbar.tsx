"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ToolMode } from "../core/types";
import type { ColorPickerFormat } from "../core/colors";
import type { GuideStyle, RulerSettings } from "../core/persistence";
import { cn } from "../core/utils";
import { SettingsPanel, type SettingsTab } from "./settings-panel";
import { Tooltip } from "./tooltip";
import {
  CaretDownIcon,
  CheckIcon,
  ColorPickerIcon,
  CursorIcon,
  GearIcon,
  MinusIcon,
  RulerIcon,
  RulersIcon,
  TextInspectorIcon,
  XrayIcon,
} from "./icons";

type Point = {
  x: number;
  y: number;
};

type ToolbarProps = {
  eventTarget: Window;
  toolMode: ToolMode;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  setToolMode: Dispatch<SetStateAction<ToolMode>>;
  xrayVisible: boolean;
  setXrayVisible: Dispatch<SetStateAction<boolean>>;
  rulersVisible: boolean;
  setRulersVisible: Dispatch<SetStateAction<boolean>>;
  guideOrientation: "vertical" | "horizontal";
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>;
  onInteract: () => void;
  colorPickerActive: boolean;
  setColorPickerActive: Dispatch<SetStateAction<boolean>>;
  onColorPickerClick: () => void;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  highlightColor: string;
  setHighlightColor: Dispatch<SetStateAction<string>>;
  guideColor: string;
  setGuideColor: Dispatch<SetStateAction<string>>;
  hoverHighlight: boolean;
  setHoverHighlight: Dispatch<SetStateAction<boolean>>;
  persistOnReload: boolean;
  setPersistOnReload: Dispatch<SetStateAction<boolean>>;
  colorPickerFormats: ColorPickerFormat[];
  setColorPickerFormats: Dispatch<SetStateAction<ColorPickerFormat[]>>;
  colorPickerClickFormat: ColorPickerFormat;
  setColorPickerClickFormat: Dispatch<SetStateAction<ColorPickerFormat>>;
  snapEnabled: boolean;
  setSnapEnabled: Dispatch<SetStateAction<boolean>>;
  snapGuidesEnabled: boolean;
  setSnapGuidesEnabled: Dispatch<SetStateAction<boolean>>;
  selectNewGuideEnabled: boolean;
  setSelectNewGuideEnabled: Dispatch<SetStateAction<boolean>>;
  multiMeasureEnabled: boolean;
  setMultiMeasureEnabled: Dispatch<SetStateAction<boolean>>;
  guideStyle: GuideStyle;
  setGuideStyle: Dispatch<SetStateAction<GuideStyle>>;
  rulerSettings: RulerSettings;
  setRulerSettings: Dispatch<SetStateAction<RulerSettings>>;
  initialSettingsTab: SettingsTab;
  onResetSettings: () => void;
  onClearWorkspace: () => void;
};

const TOOLBAR_TOOLTIP_DELAY_MS = 800;
const TOOLBAR_DRAG_SLOP = 6;
const GUIDE_MENU_WIDTH = 176;
const VIEWPORT_PADDING = 8;

type ToolbarButtonProps = {
  id: string;
  active: boolean;
  label: string;
  shortcut?: string;
  onClick: () => void;
  tooltipVisible: boolean;
  tooltipInstant: boolean;
  tooltipSide: "top" | "bottom";
  onTooltipEnter: (id: string) => void;
  onTooltipLeave: (id: string) => void;
  children: ReactNode;
};

function ToolbarButton({
  id,
  active,
  label,
  shortcut,
  onClick,
  tooltipVisible,
  tooltipInstant,
  tooltipSide,
  onTooltipEnter,
  onTooltipLeave,
  children,
}: ToolbarButtonProps) {
  return (
    <div
      className="msr:relative"
      onMouseEnter={() => onTooltipEnter(id)}
      onMouseLeave={() => onTooltipLeave(id)}
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
      <Tooltip label={label} shortcut={shortcut} visible={tooltipVisible} instant={tooltipInstant} side={tooltipSide} />
    </div>
  );
}

function useToolbarTooltip() {
  const [visibleTooltipId, setVisibleTooltipId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const instantRef = useRef(false);
  const [tooltipInstant, setTooltipInstant] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const onTooltipEnter = useCallback(
    (id: string) => {
      clearTimer();
      if (instantRef.current) {
        setTooltipInstant(true);
        setVisibleTooltipId(id);
        return;
      }

      setTooltipInstant(false);
      timerRef.current = window.setTimeout(() => {
        setVisibleTooltipId(id);
        instantRef.current = true;
        timerRef.current = null;
      }, TOOLBAR_TOOLTIP_DELAY_MS);
    },
    [clearTimer],
  );

  const onTooltipLeave = useCallback(
    (id: string) => {
      clearTimer();
      setVisibleTooltipId((prev) => (prev === id ? null : prev));
    },
    [clearTimer],
  );

  const onToolbarLeave = useCallback(() => {
    clearTimer();
    setVisibleTooltipId(null);
    instantRef.current = false;
    setTooltipInstant(false);
  }, [clearTimer]);

  return {
    visibleTooltipId,
    tooltipInstant,
    onTooltipEnter,
    onTooltipLeave,
    onToolbarLeave,
  };
}

function useToolbarDrag(initialPosition: Point, eventTarget: Window) {
  const [position, setPosition] = useState(initialPosition);
  const suppressClickRef = useRef(false);
  const previousUserSelectRef = useRef<string | null>(null);
  const detachListenersRef = useRef<(() => void) | null>(null);
  const dragRef = useRef({
    active: false,
    didDrag: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    width: 0,
    height: 0,
  });

  const disableTextSelection = useCallback(() => {
    if (previousUserSelectRef.current !== null) return;
    const root = eventTarget.document.documentElement;
    previousUserSelectRef.current = root.style.userSelect;
    root.style.setProperty("user-select", "none", "important");
  }, [eventTarget]);

  const restoreTextSelection = useCallback(() => {
    const previous = previousUserSelectRef.current;
    if (previous === null) return;
    const root = eventTarget.document.documentElement;
    root.style.userSelect = previous;
    previousUserSelectRef.current = null;
  }, [eventTarget]);

  useEffect(() => restoreTextSelection, [restoreTextSelection]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      disableTextSelection();

      if (detachListenersRef.current) {
        detachListenersRef.current();
        detachListenersRef.current = null;
        restoreTextSelection();
      }

      const state = dragRef.current;
      state.active = false;
      state.didDrag = false;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.originX = position.x;
      state.originY = position.y;
      const rect = event.currentTarget.getBoundingClientRect();
      state.width = rect.width;
      state.height = rect.height;

      const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
        const current = dragRef.current;
        if (current.pointerId !== moveEvent.pointerId) return;

        const dx = moveEvent.clientX - current.startX;
        const dy = moveEvent.clientY - current.startY;

        if (!current.active) {
          current.active =
            Math.abs(dx) > TOOLBAR_DRAG_SLOP ||
            Math.abs(dy) > TOOLBAR_DRAG_SLOP;
        }

        if (!current.active) return;

        current.didDrag = true;
        const maxX = Math.max(8, eventTarget.innerWidth - current.width - 8);
        const maxY = Math.max(8, eventTarget.innerHeight - current.height - 8);
        setPosition({
          x: Math.min(maxX, Math.max(8, current.originX + dx)),
          y: Math.min(maxY, Math.max(8, current.originY + dy)),
        });
      };

      const handlePointerEnd = (endEvent: globalThis.PointerEvent) => {
        const current = dragRef.current;
        if (
          current.pointerId !== endEvent.pointerId &&
          current.pointerId !== -1
        )
          return;
        suppressClickRef.current = current.didDrag;
        restoreTextSelection();
        current.active = false;
        current.didDrag = false;
        current.pointerId = -1;

        eventTarget.removeEventListener("pointermove", handlePointerMove);
        eventTarget.removeEventListener("pointerup", handlePointerEnd);
        eventTarget.removeEventListener("pointercancel", handlePointerEnd);
        detachListenersRef.current = null;
      };

      eventTarget.addEventListener("pointermove", handlePointerMove);
      eventTarget.addEventListener("pointerup", handlePointerEnd);
      eventTarget.addEventListener("pointercancel", handlePointerEnd);
      detachListenersRef.current = () => {
        eventTarget.removeEventListener("pointermove", handlePointerMove);
        eventTarget.removeEventListener("pointerup", handlePointerEnd);
        eventTarget.removeEventListener("pointercancel", handlePointerEnd);
      };
    },
    [disableTextSelection, eventTarget, position.x, position.y, restoreTextSelection],
  );

  const onClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!suppressClickRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
    },
    [],
  );

  return { position, onPointerDown, onClickCapture };
}

function ToolbarComponent(
  {
    toolMode,
    setEnabled,
    setToolMode,
    xrayVisible,
    setXrayVisible,
    rulersVisible,
    setRulersVisible,
    guideOrientation,
    setGuideOrientation,
    onInteract,
    eventTarget,
    colorPickerActive,
    setColorPickerActive,
    onColorPickerClick,
    settingsOpen,
    setSettingsOpen,
    highlightColor,
    setHighlightColor,
    guideColor,
    setGuideColor,
    hoverHighlight,
    setHoverHighlight,
    persistOnReload,
    setPersistOnReload,
    colorPickerFormats,
    setColorPickerFormats,
    colorPickerClickFormat,
    setColorPickerClickFormat,
    snapEnabled,
    setSnapEnabled,
    snapGuidesEnabled,
    setSnapGuidesEnabled,
    selectNewGuideEnabled,
    setSelectNewGuideEnabled,
    multiMeasureEnabled,
    setMultiMeasureEnabled,
    guideStyle,
    setGuideStyle,
    rulerSettings,
    setRulerSettings,
    initialSettingsTab,
    onResetSettings,
    onClearWorkspace,
  }: ToolbarProps,
  ref: React.Ref<HTMLDivElement>,
) {
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
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const guideMenuRef = useRef<HTMLDivElement | null>(null);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [menuAlign, setMenuAlign] = useState<"left" | "right">("right");
  const tooltipsEnabled = !guideMenuOpen && !settingsOpen;

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
  const nearTop = position.y < 56;
  const nearBottom = viewportHeight > 0 && position.y > viewportHeight - 56;
  const tooltipSide: "top" | "bottom" =
    nearTop && !nearBottom ? "bottom" : "top";
  const menuSide: "top" | "bottom" = nearBottom ? "top" : "bottom";

  const selectMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    setToolMode((prev) => (prev === "select" ? "none" : "select"));
    onInteract();
  }, [onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const guidesMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    setToolMode((prev) => (prev === "guides" ? "none" : "guides"));
    onInteract();
  }, [onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const textInspectorMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    setToolMode((prev) =>
      prev === "text-inspector" ? "none" : "text-inspector",
    );
    onInteract();
  }, [onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const xrayMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    setXrayVisible((prev) => !prev);
    onInteract();
  }, [onInteract, setColorPickerActive, setEnabled, setXrayVisible]);

  const colorPickerMode = useCallback(() => {
    setEnabled(true);
    setToolMode("none");
    if (colorPickerActive) {
      setColorPickerActive(false);
    } else {
      setColorPickerActive(true);
      onColorPickerClick();
    }
    onInteract();
  }, [colorPickerActive, onColorPickerClick, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const rulersMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    setRulersVisible((prev) => !prev);
    onInteract();
  }, [onInteract, setColorPickerActive, setEnabled, setRulersVisible]);

  const selectGuideOrientation = useCallback(
    (orientation: "vertical" | "horizontal") => {
      setEnabled(true);
      setToolMode("guides");
      setGuideOrientation(orientation);
      onInteract();
      setGuideMenuOpen(false);
    },
    [onInteract, setEnabled, setGuideOrientation, setToolMode],
  );

  useLayoutEffect(() => {
    if (!guideMenuOpen) return;

    const frame = eventTarget.requestAnimationFrame(() => {
      guideMenuRef.current
        ?.querySelector<HTMLElement>("[role='menu']")
        ?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      const menu = guideMenuRef.current;
      if (!menu) return;

      const path = event.composedPath();
      if (path.includes(menu)) return;

      setGuideMenuOpen(false);
    };

    const handleResize = () => {
      updateMenuAlign();
    };

    eventTarget.addEventListener("pointerdown", handlePointerDown);
    eventTarget.addEventListener("resize", handleResize);
    return () => {
      eventTarget.cancelAnimationFrame(frame);
      eventTarget.removeEventListener("pointerdown", handlePointerDown);
      eventTarget.removeEventListener("resize", handleResize);
    };
  }, [eventTarget, guideMenuOpen, guideOrientation, updateMenuAlign]);

  useEffect(() => {
    if (!settingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const settings = settingsRef.current;
      if (settings && event.composedPath().includes(settings)) return;
      setSettingsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };

    eventTarget.addEventListener("pointerdown", handlePointerDown);
    eventTarget.addEventListener("keydown", handleKeyDown);
    return () => {
      eventTarget.removeEventListener("pointerdown", handlePointerDown);
      eventTarget.removeEventListener("keydown", handleKeyDown);
    };
  }, [eventTarget, settingsOpen]);

  return (
    <div
      ref={ref}
      className="mesurer-toolbar-surface msr:pointer-events-auto msr:absolute msr:z-[90] msr:flex msr:items-center msr:gap-1 msr:rounded-[12px] msr:bg-[#fff] msr:p-1 msr:outline msr:outline-transparent"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => {
        onInteract();
        onPointerDown(event);
      }}
      onClickCapture={onClickCapture}
      onMouseLeave={onToolbarLeave}
    >
      <ToolbarButton
        id="select"
        active={toolMode === "select"}
        label="Select"
        shortcut="S"
        onClick={selectMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "select"}
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <CursorIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="xray"
        active={xrayVisible}
        label="X-ray"
        shortcut="X"
        onClick={xrayMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "xray"}
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <XrayIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="color-picker"
        active={colorPickerActive}
        label="Color picker"
        shortcut="P"
        onClick={colorPickerMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "color-picker"}
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <ColorPickerIcon size={20} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        id="rulers"
        active={rulersVisible}
        label="Rulers"
        shortcut="R"
        onClick={rulersMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "rulers"}
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <RulersIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="text-inspector"
        active={toolMode === "text-inspector"}
        label="Text inspector"
        shortcut="A"
        onClick={textInspectorMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "text-inspector"}
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <TextInspectorIcon size={20} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        id="guides"
        active={toolMode === "guides"}
        label="Guides"
        shortcut="G"
        onClick={guidesMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "guides"}
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <RulerIcon
          size={20}
          className={cn(
            guideOrientation === "vertical"
              ? "msr:rotate-[135deg]"
              : "msr:rotate-[45deg]",
          )}
        />
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
        <span
          className={cn(
            "msr:pointer-events-none msr:absolute msr:left-1/2 msr:-translate-x-1/2 msr:whitespace-nowrap msr:rounded msr:bg-black msr:px-2 msr:py-1 msr:text-[11px] msr:text-white msr:transition-opacity msr:duration-150 msr:select-none",
            tooltipSide === "top"
              ? "msr:bottom-full msr:mb-2"
              : "msr:top-full msr:mt-2",
            visibleTooltipId === "guide-menu" && tooltipsEnabled
              ? "msr:opacity-100"
              : "msr:opacity-0",
          )}
        >
          Orientation Guide
        </span>
        {guideMenuOpen ? (
          <div
            className={cn(
              "mesurer-menu-surface msr:absolute msr:z-[70] msr:w-44 msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-1 msr:outline-none msr:focus:outline-none",
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
                setActiveMenuIndex((prev) => (prev + 1) % 2);
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
      <div ref={settingsRef} className="msr:relative msr:flex">
        <ToolbarButton
          id="settings"
          active={settingsOpen}
          label="Settings"
          shortcut="⌘/Ctrl+,"
          onClick={() => {
            onInteract();
            setSettingsOpen((previous) => !previous);
          }}
          tooltipVisible={tooltipsEnabled && visibleTooltipId === "settings"}
          tooltipInstant={tooltipInstant}
          tooltipSide={tooltipSide}
          onTooltipEnter={onTooltipEnter}
          onTooltipLeave={onTooltipLeave}
        >
          <GearIcon size={20} aria-hidden="true" />
        </ToolbarButton>
        {settingsOpen ? (
          <div
            className={cn(
              "mesurer-menu-surface msr:absolute msr:-right-1 msr:z-[70] msr:box-border msr:w-[272px] msr:max-w-[calc(100vw-16px)] msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-3",
              menuSide === "bottom"
                ? "msr:top-full msr:mt-2"
                : "msr:bottom-full msr:mb-2",
            )}
            data-mesurer-inspector-ui="true"
            role="dialog"
            aria-label="Settings"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <SettingsPanel
              ownerWindow={eventTarget}
              highlightColor={highlightColor}
              setHighlightColor={setHighlightColor}
              guideColor={guideColor}
              setGuideColor={setGuideColor}
              hoverHighlight={hoverHighlight}
              setHoverHighlight={setHoverHighlight}
              persistOnReload={persistOnReload}
              setPersistOnReload={setPersistOnReload}
              colorFormats={colorPickerFormats}
              setColorFormats={setColorPickerFormats}
              colorClickFormat={colorPickerClickFormat}
              setColorClickFormat={setColorPickerClickFormat}
              snapEnabled={snapEnabled}
              setSnapEnabled={setSnapEnabled}
              snapGuidesEnabled={snapGuidesEnabled}
              setSnapGuidesEnabled={setSnapGuidesEnabled}
              selectNewGuideEnabled={selectNewGuideEnabled}
              setSelectNewGuideEnabled={setSelectNewGuideEnabled}
              multiMeasureEnabled={multiMeasureEnabled}
              setMultiMeasureEnabled={setMultiMeasureEnabled}
              guideStyle={guideStyle}
              setGuideStyle={setGuideStyle}
              rulerSettings={rulerSettings}
              setRulerSettings={setRulerSettings}
              initialTab={initialSettingsTab}
              onResetSettings={onResetSettings}
              onClearWorkspace={onClearWorkspace}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const Toolbar = memo(forwardRef(ToolbarComponent));
