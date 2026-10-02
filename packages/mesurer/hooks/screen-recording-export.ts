export type RecordingExportFormat = "webm" | "mp4" | "gif"

export type RecordingExportOptions = {
  format?: RecordingExportFormat
  scale?: number
}

export type RecordingExportResult = {
  blob: Blob
  filename: string
}

export const supportedRecordingFormats = (): RecordingExportFormat[] => {
  return ["webm", "gif"]
}

export const supportedWebmMimeType = () =>
  ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  )
