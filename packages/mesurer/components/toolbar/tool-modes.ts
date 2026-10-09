import type { ToolMode } from "../../core/types";
import type { ToolGroup } from "../tool-group-switch";

export const getSettingsShortcut = (eventTarget: Window) =>
  /Mac|iPhone|iPad|iPod/.test(eventTarget.navigator.platform)
    ? "⌘ ,"
    : "Ctrl + ,";

export const toolGroupForMode = (
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

export const isAnnotateToolMode = (mode: ToolMode) =>
  mode === "selection" || mode === "arrows" || mode === "pen" || mode === "text" || mode === "comments";

export const exclusiveToolId = (
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
