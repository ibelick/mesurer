export {
  getCaptureViewportMetrics,
  tabCaptureRectToVideoCrop,
  placeScreenshotRectInVideo,
  visibleSelectionSlice,
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
  encodeGifClip,
} from "./screen-recording-export"

export { encodeMp4Clip, supportsMp4Encoding } from "./screen-recording-mp4"

export {
  openDisplayRecordingCapture,
  openCanvasCaptureStream,
  nextPresentedVideoFrame,
  paintDisplayRecordingFrame,
  runDisplayRecordingDrawLoop,
  type DisplayRecordingCapture,
} from "./screen-recording-display-capture"
