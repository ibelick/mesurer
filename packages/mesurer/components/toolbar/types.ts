import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { CommentFilter, CommentThread } from "../../comments/types";
import type { ResolvedMesurerFeatures } from "../../core/features";
import type { LayoutGuide } from "../../core/layout-guides";
import type { ObservedMotionTarget } from "../../core/observed-motion";
import type { ToolbarDock } from "../../core/persistence";
import type { ToolbarPlacement } from "../../core/toolbar-dock";
import type { OpenMenu, ToolMode } from "../../core/types";

export type ToolbarTools = {
  mode: ToolMode;
  setMode: Dispatch<SetStateAction<ToolMode>>;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  xrayVisible: boolean;
  setXrayVisible: Dispatch<SetStateAction<boolean>>;
  rulersVisible: boolean;
  setRulersVisible: Dispatch<SetStateAction<boolean>>;
  guideOrientation: "vertical" | "horizontal";
  setGuideOrientation: Dispatch<SetStateAction<"vertical" | "horizontal">>;
  clearSelection: () => void;
};

export type ToolbarColorPicker = {
  active: boolean;
  setActive: Dispatch<SetStateAction<boolean>>;
  onClick: () => void;
  panel: ReactNode;
};

export type ToolbarScreenshot = {
  active: boolean;
  error: boolean;
  previewUrl: string | null;
  copy: boolean;
  download: boolean;
  shareMode: "screenshot" | "record";
  onClick: () => void;
  onCancel: () => void;
  onPreviewExited: () => void;
};

export type ToolbarScreenRecording = {
  selecting: boolean;
  recording: boolean;
  elapsed: number;
  error: boolean;
  panel: ReactNode;
  onClick: () => void;
  onCancel: () => void;
  onStop: () => void;
};

export type ToolbarSettings = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  onToggle: () => void;
  panel: ReactNode;
};

export type ToolbarComments = {
  count: number;
  onCopy: () => void | Promise<void>;
  comments: CommentThread[];
  unresolvedIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onResolveAll: () => void;
  onToggleResolved: (id: string) => void;
  statusFilter: CommentFilter;
  onStatusFilterChange: (filter: CommentFilter) => void;
};

export type ToolbarLayoutGuides = {
  items: LayoutGuide[];
  onChange: Dispatch<SetStateAction<LayoutGuide[]>>;
  onToggle: () => void;
  visible: boolean;
};

export type ToolbarProps = {
  eventTarget: Window;
  initialPosition: ToolbarPlacement;
  onPositionChange?: (placement: ToolbarPlacement) => void;
  dock?: ToolbarDock;
  autoHide?: boolean;
  minimized: boolean;
  onInteract: () => void;
  onRestore: () => void;
  onCancelTransient: () => void;
  tools: ToolbarTools;
  colorPicker: ToolbarColorPicker;
  screenshot: ToolbarScreenshot;
  screenRecording: ToolbarScreenRecording;
  motion: {
    element: Element | null;
    ownerWindow: Window;
    playable: boolean;
    observedProperties: string[];
    observedTargets: ObservedMotionTarget[];
    inspectDetails: (motionDetails: ReactNode) => ReactNode;
  };
  comments: ToolbarComments;
  layoutGuides: ToolbarLayoutGuides;
  settings: ToolbarSettings;
  features: ResolvedMesurerFeatures;
  openMenu: OpenMenu;
  setOpenMenu: Dispatch<SetStateAction<OpenMenu>>;
};

export type ToolbarTooltipProps = {
  tooltipInstant: boolean;
  tooltipSide: "top" | "bottom" | "left" | "right";
  onTooltipEnter: (id: string) => void;
  onTooltipLeave: (id: string) => void;
};
