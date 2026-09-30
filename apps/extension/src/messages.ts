export const CAPTURE_VISIBLE_MESSAGE = "mesurer:capture-visible";
export const SESSION_MESSAGE = "mesurer:session";
export const SAVE_WORKSPACE_MESSAGE = "mesurer:save-workspace";
export const RECORDING_START_MESSAGE = "mesurer:recording-start";
export const RECORDING_PREPARE_MESSAGE = "mesurer:recording-prepare";
export const RECORDING_PREPARED_MESSAGE = "mesurer:recording-prepared";
export const RECORDING_STOP_MESSAGE = "mesurer:recording-stop";
export const RECORDING_ABORT_MESSAGE = "mesurer:recording-abort";
export const RECORDING_READY_MESSAGE = "mesurer:recording-ready";
export const RECORDING_STARTED_MESSAGE = "mesurer:recording-started";
export const OFFSCREEN_RECORDING_START_MESSAGE = "mesurer:offscreen-recording-start";
export const OFFSCREEN_RECORDING_PREPARE_MESSAGE = "mesurer:offscreen-recording-prepare";
export const OFFSCREEN_RECORDING_STOP_MESSAGE = "mesurer:offscreen-recording-stop";
export const OFFSCREEN_RECORDING_ABORT_MESSAGE = "mesurer:offscreen-recording-abort";
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
