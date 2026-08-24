"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
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
import { Tooltip } from "./tooltip";
import {
  CaretDownIcon,
  ArrowIcon,
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
  tools: ToolbarTools;
  colorPicker: ToolbarColorPicker;
  screenshot: ToolbarScreenshot;
  settings: ToolbarSettings;
};
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

function ToolbarComponent(
  {
    eventTarget,
    onInteract,
    tools,
    colorPicker,
    screenshot,
    settings,
  }: ToolbarProps,
  ref: React.Ref<HTMLDivElement>,
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
  const { menuRef: settingsMenuRef, placement: settingsPlacement } =
    useSettingsMenuPlacement({
      anchorRef: settingsRef,
      eventTarget,
      open: settingsOpen,
      refreshKey: `${position.x}:${position.y}`,
    });

  const selectMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) => (prev === "select" ? "none" : "select"));
    onInteract();
  }, [onCancelScreenshot, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const selectionMode = useCallback(() => {
    setEnabled(true)
    setColorPickerActive(false)
    onCancelScreenshot()
    setToolMode((prev) => (prev === "selection" ? "none" : "selection"))
    onInteract()
  }, [onCancelScreenshot, onInteract, setColorPickerActive, setEnabled, setToolMode])

  const guidesMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) => (prev === "guides" ? "none" : "guides"));
    onInteract();
  }, [onCancelScreenshot, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const arrowsMode = useCallback(() => {
    setEnabled(true)
    setColorPickerActive(false)
    onCancelScreenshot()
    setToolMode((prev) => (prev === "arrows" ? "none" : "arrows"))
    onInteract()
  }, [onCancelScreenshot, onInteract, setColorPickerActive, setEnabled, setToolMode])

  const textInspectorMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) =>
      prev === "text-inspector" ? "none" : "text-inspector",
    );
    onInteract();
  }, [onCancelScreenshot, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const textMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setToolMode((prev) => (prev === "text" ? "none" : "text"));
    onInteract();
  }, [onCancelScreenshot, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const xrayMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setXrayVisible((prev) => !prev);
    onInteract();
  }, [onCancelScreenshot, onInteract, setColorPickerActive, setEnabled, setXrayVisible]);

  const colorPickerMode = useCallback(() => {
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
  }, [colorPickerActive, onCancelScreenshot, onColorPickerClick, onInteract, setColorPickerActive, setEnabled, setToolMode]);

  const screenshotMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    onScreenshotClick();
    onInteract();
  }, [onInteract, onScreenshotClick, setColorPickerActive, setEnabled]);

  const rulersMode = useCallback(() => {
    setEnabled(true);
    setColorPickerActive(false);
    onCancelScreenshot();
    setRulersVisible((prev) => !prev);
    onInteract();
  }, [onCancelScreenshot, onInteract, setColorPickerActive, setEnabled, setRulersVisible]);

  const selectGuideOrientation = useCallback(
    (orientation: "vertical" | "horizontal") => {
      setEnabled(true);
      onCancelScreenshot();
      setToolMode("guides");
      setGuideOrientation(orientation);
      onInteract();
      setGuideMenuOpen(false);
    },
    [onCancelScreenshot, onInteract, setEnabled, setGuideOrientation, setToolMode],
  );

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
    <div
      ref={ref}
      className="mesurer-toolbar-surface msr:pointer-events-auto msr:flex msr:items-center msr:gap-1 msr:rounded-[12px] msr:bg-[#fff] msr:p-1 msr:outline msr:outline-transparent"
      style={{ visibility: screenshotActive ? "hidden" : undefined }}
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
        <BoxSelectIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="selection"
        active={toolMode === "selection"}
        label="Selection"
        shortcut="O"
        onClick={selectionMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "selection"}
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
      <ToolbarButton
        id="arrows"
        active={toolMode === "arrows"}
        label="Arrows"
        shortcut="D"
        onClick={arrowsMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "arrows"}
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <ArrowIcon size={20} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton
        id="text"
        active={toolMode === "text"}
        label="Text"
        shortcut="T"
        onClick={textMode}
        tooltipVisible={tooltipsEnabled && visibleTooltipId === "text"}
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <TextIcon size={20} aria-hidden="true" />
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
      <div className="msr:relative">
      <ToolbarButton
        id="screenshot"
        active={screenshotActive}
        label="Screenshot"
        shortcut="C"
        onClick={screenshotMode}
        tooltipVisible={
          tooltipsEnabled &&
          !screenshotPreviewUrl &&
          visibleTooltipId === "screenshot"
        }
        tooltipInstant={tooltipInstant}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
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
          shortcut="⌘/Ctrl+,"
          onClick={() => {
            onCancelScreenshot();
            onInteract();
            onToggleSettings();
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
            ref={settingsMenuRef}
            className={cn(
              "mesurer-menu-surface msr:absolute msr:z-[70] msr:w-auto msr:max-w-[calc(100vw-16px)] msr:overflow-hidden msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-0",
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
    </div>
      {screenshotError ? (
        <div
          role="status"
          aria-live="polite"
          className={`mesurer-toast-surface msr:pointer-events-none msr:absolute msr:top-full msr:z-10 msr:mt-2 msr:box-border msr:rounded-[10px] msr:bg-white msr:px-3 msr:py-2 msr:text-center msr:text-[12px] msr:leading-4 msr:text-black msr:whitespace-normal msr:text-pretty ${toastAlignment}`}
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
