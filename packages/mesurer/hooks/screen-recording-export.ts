export type RecordingExportFormat = "webm" | "mp4" | "gif"

export type RecordingExportOptions = {
  format?: RecordingExportFormat
  scale?: number
}

export type RecordingExportResult = {
  blob: Blob
  filename: string
}

const mp4MimeType = () =>
  ["video/mp4;codecs=avc1.42E01E", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type))

export const supportedRecordingFormats = (): RecordingExportFormat[] => {
  const formats: RecordingExportFormat[] = ["webm", "gif"]
  if (typeof MediaRecorder !== "undefined" && mp4MimeType()) formats.push("mp4")
  return formats
}

export const supportedWebmMimeType = () =>
  ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type),
  )

export const supportedMp4MimeType = mp4MimeType
