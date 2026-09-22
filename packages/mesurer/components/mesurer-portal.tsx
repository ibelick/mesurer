import { createPortal } from "react-dom";
import { useEffect, type ComponentPropsWithoutRef, type RefObject } from "react";
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
  theme: "system" | "light" | "dark";
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
  theme,
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
