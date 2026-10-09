import { createPortal } from "react-dom";
import { type ComponentPropsWithoutRef, type RefObject } from "react";
import { RulersOverlay } from "./rulers-overlay";
import { LayoutGuidesOverlay } from "./layout-guides-overlay";
import { RegionDimMask, ScreenshotSelectOverlay } from "./screenshot-select-overlay";
import { Toolbar } from "./toolbar";
import { MesurerOverlay } from "../render/mesurer-overlay";
import type { LayoutGuide } from "../core/layout-guides";
import type { ScreenshotRect } from "../core/screenshot";
import { usePageListener } from "../hooks/use-page-listener";

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
  screenRecording: { recording: boolean; rect: ScreenshotRect | null };
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
  const ownerWindow = portalTarget.ownerDocument.defaultView;
  // Keeps a press on the tool switch inside Mesurer. Base UI dismisses floating surfaces from
  // document capture listeners: the native press is stopped before it reaches those, and the
  // button's later click event still changes the active tool.
  usePageListener({
    view: ownerWindow,
    types: "pointerdown",
    phase: "capture",
    onEvent: (event) => {
      const root = rootRef.current;
      if (!ownerWindow || !root) return;
      const onToolSwitch = event.composedPath().some(
        (node) =>
          node instanceof ownerWindow.Element &&
          root.contains(node) &&
          node.classList.contains("mesurer-toolbar-tool-switch"),
      );
      if (onToolSwitch) event.stopImmediatePropagation();
    },
  });

  return createPortal(
    <div
      ref={rootRef}
      className="mesurer-root msr:pointer-events-none msr:fixed msr:inset-0 msr:z-[70] msr:outline-none"
      data-mesurer-root
      data-recording-panel={screenRecording.recording ? "true" : undefined}
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
        <div className="msr:pointer-events-none msr:absolute msr:inset-0 msr:z-[80]">
          <RegionDimMask rect={screenRecording.rect} />
        </div>
      ) : null}
      <Toolbar ref={toolbarRef} {...toolbar} />
    </div>,
    portalTarget,
  );
}
