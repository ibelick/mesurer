import type { PointerEvent as ReactPointerEvent } from "react";

type Handler = (event: ReactPointerEvent<HTMLDivElement>) => void;
type SelectionHandler = (event: ReactPointerEvent<HTMLDivElement>) => boolean;

export const useOverlayPointerHandlers = (options: {
  toolMode: string;
  arrows: {
    handlePointerDown: Handler;
    handlePointerMove: Handler;
    handlePointerUp: Handler;
    handlePointerLeave: Handler;
    handlePointerCancel: Handler;
    handleSelectionPointerDown: SelectionHandler;
    handleSelectionPointerMove: SelectionHandler;
    handleSelectionPointerUp: SelectionHandler;
  };
  pen: {
    handlePointerDown: Handler;
    handlePointerMove: Handler;
    handlePointerUp: Handler;
    handlePointerLeave: Handler;
    handlePointerCancel: Handler;
  };
  text: { handlePointerDown: Handler };
  measure: {
    handlePointerDown: Handler;
    handlePointerMove: Handler;
    handlePointerUp: Handler;
    handlePointerLeave: Handler;
  };
}) => {
  const { toolMode, arrows, pen, text, measure } = options;
  if (toolMode === "arrows") {
    return {
      onPointerDown: arrows.handlePointerDown,
      onPointerMove: arrows.handlePointerMove,
      onPointerUp: arrows.handlePointerUp,
      onPointerLeave: arrows.handlePointerLeave,
      onPointerCancel: arrows.handlePointerCancel,
    };
  }
  if (toolMode === "pen") {
    return {
      onPointerDown: pen.handlePointerDown,
      onPointerMove: pen.handlePointerMove,
      onPointerUp: pen.handlePointerUp,
      onPointerLeave: pen.handlePointerLeave,
      onPointerCancel: pen.handlePointerCancel,
    };
  }
  if (toolMode === "text") {
    return {
      onPointerDown: text.handlePointerDown,
      onPointerMove: measure.handlePointerMove,
      onPointerUp: measure.handlePointerUp,
      onPointerLeave: measure.handlePointerLeave,
      onPointerCancel: measure.handlePointerUp,
    };
  }
  if (toolMode !== "selection") {
    return {
      onPointerDown: measure.handlePointerDown,
      onPointerMove: measure.handlePointerMove,
      onPointerUp: measure.handlePointerUp,
      onPointerLeave: measure.handlePointerLeave,
      onPointerCancel: measure.handlePointerUp,
    };
  }

  const guard = (event: ReactPointerEvent<HTMLDivElement>, action: () => void) => {
    if (event.target instanceof Element && event.target.closest("[data-mesurer-group-frame]")) {
      return;
    }
    action();
  };

  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) =>
      guard(event, () => {
        if (!arrows.handleSelectionPointerDown(event)) measure.handlePointerDown(event);
      }),
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) =>
      guard(event, () => {
        if (!arrows.handleSelectionPointerMove(event)) measure.handlePointerMove(event);
      }),
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) =>
      guard(event, () => {
        if (!arrows.handleSelectionPointerUp(event)) measure.handlePointerUp(event);
      }),
    onPointerLeave: measure.handlePointerLeave,
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) =>
      guard(event, () => {
        if (!arrows.handleSelectionPointerUp(event)) measure.handlePointerUp(event);
      }),
  };
};
