export const CAPTURE_VISIBLE_MESSAGE = "mesurer:capture-visible";
export const SESSION_MESSAGE = "mesurer:session";
export const SAVE_WORKSPACE_MESSAGE = "mesurer:save-workspace";
export const BOOT_KEY = "__MESURER_BOOT__";

export type ExtensionBoot = "toggle" | "restore";

export type SessionMessage = {
  type: typeof SESSION_MESSAGE;
  open: boolean;
};

export type SaveWorkspaceMessage = {
  type: typeof SAVE_WORKSPACE_MESSAGE;
  key: string;
  workspace: unknown;
};
