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
import type { ToolMode } from "../types";
import { cn } from "../utils";
import {
  CaretDownIcon,
  CheckIcon,
  CursorIcon,
  MinusIcon,
  RulerIcon,
  TextInspectorIcon,
} from "./icons";

type Point = {
  x: number;
  y: number;
};

type ToolbarProps = {
  toolMode: ToolMode;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  setToolMode: Dispatch<SetStateAction<ToolMode>>;
  guideOrientation: "vertical" | "horizontal";
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>;
  onInteract: () => void;
};

const TOOLBAR_TOOLTIP_DELAY_MS = 800;
const TOOLBAR_DRAG_SLOP = 6;
const GUIDE_MENU_WIDTH = 176;
const VIEWPORT_PADDING = 8;

type ToolbarButtonProps = {
  id: string;
  active: boolean;
  label: string;
  shortcut: string;
  onClick: () => void;
  tooltipVisible: boolean;
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
        aria-label={`${label} (${shortcut})`}
        title={`${label} (${shortcut})`}
        className={cn(
          "msr:flex msr:size-8 msr:items-center msr:justify-center msr:rounded-[8px] msr:outline-none",
          active
            ? "msr:bg-[#0d99ff] msr:text-white"
            : "msr:bg-transparent msr:text-black msr:hover:bg-black/4",
        )}
        onClick={onClick}
      >
        {children}
      </button>
      <span
        className={cn(
          "msr:pointer-events-none msr:absolute msr:left-1/2 msr:-translate-x-1/2 msr:whitespace-nowrap msr:rounded msr:bg-black msr:px-2 msr:py-1 msr:text-[11px] msr:text-white msr:transition-opacity msr:duration-150 msr:select-none",
          tooltipSide === "top"
            ? "msr:bottom-full msr:mb-2"
            : "msr:top-full msr:mt-2",
          tooltipVisible ? "msr:opacity-100" : "msr:opacity-0",
        )}
      >
        {label} <kbd className="msr:text-white/60">{shortcut}</kbd>
      </span>
    </div>
  );
}

function useToolbarTooltip() {
  const [visibleTooltipId, setVisibleTooltipId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const instantRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const onTooltipEnter = useCallback(
    (id: string) => {
      clearTimer();
      if (instantRef.current) {
        setVisibleTooltipId(id);
        return;
      }

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
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { visibleTooltipId, onTooltipEnter, onTooltipLeave, onToolbarLeave };
}

function useToolbarDrag(initialPosition: Point) {
  const [position, setPosition] = useState(initialPosition);
  const suppressClickRef = useRef(false);
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

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;

      if (detachListenersRef.current) {
        detachListenersRef.current();
        detachListenersRef.current = null;
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
        const maxX = Math.max(8, window.innerWidth - current.width - 8);
        const maxY = Math.max(8, window.innerHeight - current.height - 8);
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
        current.active = false;
        current.didDrag = false;
        current.pointerId = -1;

        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerEnd);
        detachListenersRef.current = null;
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerEnd);
      window.addEventListener("pointercancel", handlePointerEnd);
      detachListenersRef.current = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerEnd);
        window.removeEventListener("pointercancel", handlePointerEnd);
      };
    },
    [position.x, position.y],
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
    guideOrientation,
    setGuideOrientation,
    onInteract,
  }: ToolbarProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const { position, onPointerDown, onClickCapture } = useToolbarDrag({
    x: 16,
    y: 16,
  });
  const { visibleTooltipId, onTooltipEnter, onTooltipLeave, onToolbarLeave } =
    useToolbarTooltip();
  const [guideMenuOpen, setGuideMenuOpen] = useState(false);
  const guideMenuRef = useRef<HTMLDivElement | null>(null);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [menuAlign, setMenuAlign] = useState<"left" | "right">("right");

  const updateMenuAlign = useCallback(() => {
    const anchorRect = guideMenuRef.current?.getBoundingClientRect();
    if (!anchorRect) return;

    const rightAlignedLeft = anchorRect.right - GUIDE_MENU_WIDTH;
    const leftAlignedRight = anchorRect.left + GUIDE_MENU_WIDTH;

    if (rightAlignedLeft < VIEWPORT_PADDING) {
      setMenuAlign("left");
      return;
    }

    if (leftAlignedRight > window.innerWidth - VIEWPORT_PADDING) {
      setMenuAlign("right");
      return;
    }

    setMenuAlign("right");
  }, []);

  const viewportHeight =
    typeof window === "undefined" ? 0 : window.innerHeight || 0;
  const nearTop = position.y < 56;
  const nearBottom = viewportHeight > 0 && position.y > viewportHeight - 56;
  const tooltipSide: "top" | "bottom" =
    nearTop && !nearBottom ? "bottom" : "top";
  const menuSide: "top" | "bottom" = nearBottom ? "top" : "bottom";

  const selectMode = useCallback(() => {
    setEnabled(true);
    setToolMode((prev) => (prev === "select" ? "none" : "select"));
    onInteract();
  }, [onInteract, setEnabled, setToolMode]);

  const guidesMode = useCallback(() => {
    setEnabled(true);
    setToolMode((prev) => (prev === "guides" ? "none" : "guides"));
    onInteract();
  }, [onInteract, setEnabled, setToolMode]);

  const textInspectorMode = useCallback(() => {
    setEnabled(true);
    setToolMode((prev) =>
      prev === "text-inspector" ? "none" : "text-inspector",
    );
    onInteract();
  }, [onInteract, setEnabled, setToolMode]);

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

    const frame = requestAnimationFrame(() => {
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

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [guideMenuOpen, guideOrientation, updateMenuAlign]);

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
        tooltipVisible={visibleTooltipId === "select"}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <CursorIcon size={20} />
      </ToolbarButton>
      <ToolbarButton
        id="text-inspector"
        active={toolMode === "text-inspector"}
        label="Text inspector"
        shortcut="A"
        onClick={textInspectorMode}
        tooltipVisible={visibleTooltipId === "text-inspector"}
        tooltipSide={tooltipSide}
        onTooltipEnter={onTooltipEnter}
        onTooltipLeave={onTooltipLeave}
      >
        <span
          className={cn(
            "msr:flex msr:items-center msr:justify-center msr:transition-opacity",
            toolMode === "text-inspector"
              ? "msr:opacity-100"
              : "msr:opacity-40",
          )}
          aria-hidden="true"
        >
          <TextInspectorIcon size={20} />
        </span>
      </ToolbarButton>
      <ToolbarButton
        id="guides"
        active={toolMode === "guides"}
        label="Guides"
        shortcut="G"
        onClick={guidesMode}
        tooltipVisible={visibleTooltipId === "guides"}
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
          title="Guide orientation"
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
            visibleTooltipId === "guide-menu" && !guideMenuOpen
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
    </div>
  );
}

export const Toolbar = memo(forwardRef(ToolbarComponent));
