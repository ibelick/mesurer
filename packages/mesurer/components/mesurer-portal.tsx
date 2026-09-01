import { createPortal } from "react-dom";
import type { ComponentPropsWithoutRef, RefObject } from "react";
import { RulersOverlay } from "./rulers-overlay";
import { ScreenshotSelectOverlay } from "./screenshot-select-overlay";
import { Toolbar } from "./toolbar";
import { MesurerOverlay } from "../render/mesurer-overlay";

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
  toolbar: ComponentPropsWithoutRef<typeof Toolbar>;
};

export function MesurerPortal({
  portalTarget,
  rootRef,
  toolbarRef,
  screenshotOverlayRef,
  rulers,
  overlay,
  screenshot,
  toolbar,
}: MesurerPortalProps) {
  return createPortal(
    <div
      ref={rootRef}
      className="mesurer-root msr:pointer-events-none msr:fixed msr:inset-0 msr:z-50 msr:outline-none"
      tabIndex={-1}
    >
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
      <Toolbar ref={toolbarRef} {...toolbar} />
    </div>,
    portalTarget,
  );
}
