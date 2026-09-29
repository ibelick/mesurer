import { createPortal } from "react-dom";
import { useEffect, type ComponentPropsWithoutRef, type ReactNode, type RefObject } from "react";
import { RulersOverlay } from "./rulers-overlay";
import { LayoutGuidesOverlay } from "./layout-guides-overlay";
import { RegionDimMask, ScreenshotSelectOverlay } from "./screenshot-select-overlay";
import { Toolbar } from "./toolbar";
import { MesurerOverlay } from "../render/mesurer-overlay";
import type { LayoutGuide } from "../core/layout-guides";
import type { ScreenshotRect } from "../core/screenshot";

type MesurerPortalProps = {
  portalTarget: HTMLElement | ShadowRoot;
  rootRef: RefObject<HTMLDivElement | null>;
  toolbarRef: RefObject<HTMLDivElement | null>;
  screenshotOverlayRef: RefObject<HTMLDivElement | null>;
  rulers: {
    ownerWindow: Window;
    visible: boolean;
    settings: ComponentPropsWithoutRef<typeof RulersOverlay>["settings"];
    interactive: boolean;
    forceVisible: boolean;
    onStartGuide: ComponentPropsWithoutRef<typeof RulersOverlay>["onStartGuide"];
    onMoveGuide: ComponentPropsWithoutRef<typeof RulersOverlay>["onMoveGuide"];
    onFinishGuide: ComponentPropsWithoutRef<typeof RulersOverlay>["onFinishGuide"];
    onCancelGuide: ComponentPropsWithoutRef<typeof RulersOverlay>["onCancelGuide"];
    guides: ComponentPropsWithoutRef<typeof RulersOverlay>["guides"];
    selectedGuideIds: ComponentPropsWithoutRef<typeof RulersOverlay>["selectedGuideIds"];
  };
  overlay: ComponentPropsWithoutRef<typeof MesurerOverlay>;
  screenshot: ComponentPropsWithoutRef<typeof ScreenshotSelectOverlay>;
  screenRecording: { recording: boolean; rect: ScreenshotRect | null; panel: ReactNode };
  toolbar: ComponentPropsWithoutRef<typeof Toolbar>;
  theme: "system" | "light" | "dark";
  enabled: boolean;
  layoutGuides: LayoutGuide[];
  layoutGuidesVisible?: boolean;
};

export function MesurerPortal({
  portalTarget,
  rootRef,
  toolbarRef,
  screenshotOverlayRef,
  rulers,
  overlay,
  screenshot,
  screenRecording,
  toolbar,
  theme,
  enabled,
  layoutGuides,
  layoutGuidesVisible = false,
}: MesurerPortalProps) {
  useEffect(() => {
    const ownerWindow = portalTarget.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const root = rootRef.current;

    const keepToolSwitchPressInsideMesurer = (event: PointerEvent) => {
      const ElementConstructor = ownerWindow.Element;
      if (!root || !event.composedPath().some((node) => node instanceof ElementConstructor && root.contains(node) && node.classList.contains("mesurer-toolbar-tool-switch"))) {
        return;
      }

      // Base UI dismisses floating surfaces from document capture listeners.
      // Stop the native press before it reaches those listeners; the button's
      // later click event still changes the active Mesurer tool.
      event.stopImmediatePropagation();
    };

    ownerWindow.addEventListener("pointerdown", keepToolSwitchPressInsideMesurer, true);
    return () => {
      ownerWindow.removeEventListener("pointerdown", keepToolSwitchPressInsideMesurer, true);
    };
  }, [portalTarget, rootRef]);

  return createPortal(
    <div
      ref={rootRef}
      className="mesurer-root msr:pointer-events-none msr:fixed msr:inset-0 msr:z-[70] msr:outline-none"
      data-mesurer-root
      data-theme={theme}
      tabIndex={-1}
    >
      <LayoutGuidesOverlay enabled={enabled && layoutGuidesVisible} guides={layoutGuides} />
      {rulers.visible ? (
        <RulersOverlay
          ownerWindow={rulers.ownerWindow}
          settings={rulers.settings}
          interactive={rulers.interactive}
          forceVisible={rulers.forceVisible}
          onStartGuide={rulers.onStartGuide}
          onMoveGuide={rulers.onMoveGuide}
          onFinishGuide={rulers.onFinishGuide}
          onCancelGuide={rulers.onCancelGuide}
          guides={rulers.guides}
          selectedGuideIds={rulers.selectedGuideIds}
        />
      ) : null}
      <MesurerOverlay {...overlay} />
      <ScreenshotSelectOverlay ref={screenshotOverlayRef} {...screenshot} />
      {screenRecording.recording && screenRecording.rect ? (
        <div className="msr:pointer-events-none msr:absolute msr:inset-0 msr:z-[86]">
          <RegionDimMask rect={screenRecording.rect} />
          <div
            className="msr:absolute msr:outline msr:outline-2 msr:outline-[var(--msr-danger-text)]"
            style={{
              left: screenRecording.rect.left,
              top: screenRecording.rect.top,
              width: screenRecording.rect.width,
              height: screenRecording.rect.height,
            }}
          >
            <span className="msr:absolute msr:-top-6 msr:left-0 msr:rounded-control msr:bg-[var(--msr-danger-solid-bg)] msr:px-1.5 msr:py-0.5 msr:text-[10px] msr:font-medium msr:text-[var(--msr-danger-solid-text)]">
              REC
            </span>
          </div>
        </div>
      ) : null}
      {screenRecording.panel}
      <Toolbar ref={toolbarRef} {...toolbar} />
    </div>,
    portalTarget,
  );
}
