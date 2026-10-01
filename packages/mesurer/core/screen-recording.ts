export {
  getCaptureViewportMetrics,
  tabCaptureRectToVideoCrop,
  placeScreenshotRectInVideo,
  visibleSelectionSlice,
  createRecordingCropTarget,
  cropTrackToElement,
  screenshotRectToVideoCrop,
  type CaptureViewportMetrics,
  type VideoCropRect,
  type PlacedVideoCrop,
  type VisibleSelectionSlice,
} from "./screen-recording-crop"

export { writeWebmDuration, correctWebmDuration } from "./screen-recording-webm"

export {
  resolveRecordingDuration,
  isFullClipExport,
  readBlobVideoDuration,
  seekVideoElement,
  requestDisplayMediaStream,
  reencodeVideoClip,
} from "./screen-recording-export"

export {
  openDisplayRecordingCapture,
  paintDisplayRecordingFrame,
  runDisplayRecordingDrawLoop,
  waitForRegionCropDimensions,
  type DisplayRecordingCapture,
} from "./screen-recording-display-capture"
