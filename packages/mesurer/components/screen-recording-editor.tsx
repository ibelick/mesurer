import { useEffect, useRef, useState } from "react"
import { SettingsButton } from "./settings-button"

type ScreenRecordingEditorProps = {
  url: string
  duration: number
  onDiscard: () => void
  onExport: (start: number, end: number) => Promise<Blob>
  ownerDocument: Document
}

const MIN_CLIP_SECONDS = 0.1

const timestamp = (value: number) => {
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

const percent = (value: number, duration: number) => `${Math.min(100, Math.max(0, (value / duration) * 100))}%`

export function ScreenRecordingEditor({ url, duration, onDiscard, onExport, ownerDocument }: ScreenRecordingEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(duration)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStart(0)
    setEnd(duration)
    setCurrentTime(0)
  }, [duration, url])

  const updateStart = (value: number) => {
    const next = Math.min(value, end - MIN_CLIP_SECONDS)
    setStart(next)
    if (videoRef.current) videoRef.current.currentTime = next
  }

  const updateEnd = (value: number) => {
    const next = Math.max(value, start + MIN_CLIP_SECONDS)
    setEnd(next)
  }

  const togglePlayback = async () => {
    const video = videoRef.current
    if (!video) return
    if (!video.paused) {
      video.pause()
      return
    }
    if (video.currentTime < start || video.currentTime >= end) video.currentTime = start
    await video.play()
  }

  const downloadRecording = async () => {
    setExporting(true)
    setError(null)
    try {
      const exported = await onExport(start, end)
      const objectUrl = URL.createObjectURL(new Blob([exported], { type: "video/webm" }))
      const link = ownerDocument.createElement("a")
      link.href = objectUrl
      link.download = "mesurer-recording.webm"
      link.style.position = "fixed"
      link.style.left = "-9999px"
      ownerDocument.body.append(link)
      link.click()
      link.remove()
      ownerDocument.defaultView?.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
    } catch {
      setError("Could not export the recording.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="msr:w-[min(390px,calc(100vw-24px))] msr:overflow-hidden msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:shadow-floating" aria-label="Screen recording editor">
      <div className="msr:p-3">
        <div className="msr:relative msr:overflow-hidden msr:rounded-lg msr:bg-black">
          <video ref={videoRef} className="msr:aspect-video msr:w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => {
            const next = event.currentTarget.currentTime
            if (next >= end) {
              event.currentTarget.pause()
              event.currentTarget.currentTime = start
              setCurrentTime(start)
              return
            }
            setCurrentTime(next)
          }} onEnded={() => setCurrentTime(start)} src={url} />
          <SettingsButton className="msr:absolute msr:bottom-2 msr:left-2 msr:border-transparent msr:bg-ink-900 msr:text-white msr:hover:bg-ink-900" onClick={() => void togglePlayback()}>
            {playing ? "Pause" : "Play"}
          </SettingsButton>
        </div>
        <div className="msr:mt-4">
          <div className="msr:relative msr:h-8">
            <div className="msr:absolute msr:left-0 msr:right-0 msr:top-3 msr:h-2 msr:rounded-full msr:bg-ink-200" />
            <div className="msr:absolute msr:top-3 msr:h-2 msr:rounded-full msr:bg-[var(--msr-accent)]" style={{ left: percent(start, duration), right: `${100 - Number(percent(end, duration).slice(0, -1))}%` }} />
            <div className="msr:absolute msr:top-2 msr:size-4 msr:rounded-full msr:border-2 msr:border-[var(--msr-accent)] msr:bg-white" style={{ left: `calc(${percent(start, duration)} - 8px)` }} />
            <div className="msr:absolute msr:top-2 msr:size-4 msr:rounded-full msr:border-2 msr:border-[var(--msr-accent)] msr:bg-white" style={{ left: `calc(${percent(end, duration)} - 8px)` }} />
          </div>
          <label className="msr:mt-1 msr:grid msr:grid-cols-[28px_1fr_36px] msr:items-center msr:gap-2 msr:text-[11px]"><span className="msr:font-medium msr:text-ink-700">IN</span><input aria-label="Trim start" className="msr:accent-[var(--msr-accent)]" type="range" min="0" max={duration} step="0.1" value={start} onChange={(event) => updateStart(Number(event.target.value))} /><span className="msr:text-right msr:font-mono msr:text-ink-700">{timestamp(start)}</span></label>
          <label className="msr:mt-1 msr:grid msr:grid-cols-[28px_1fr_36px] msr:items-center msr:gap-2 msr:text-[11px]"><span className="msr:font-medium msr:text-ink-700">OUT</span><input aria-label="Trim end" className="msr:accent-[var(--msr-accent)]" type="range" min="0" max={duration} step="0.1" value={end} onChange={(event) => updateEnd(Number(event.target.value))} /><span className="msr:text-right msr:font-mono msr:text-ink-700">{timestamp(end)}</span></label>
        </div>
        {error ? <p className="msr:mt-3 msr:text-[11px] msr:leading-4 msr:text-[var(--msr-danger-text)]" role="alert">{error}</p> : null}
        <div className="msr:mt-4 msr:flex msr:justify-end msr:gap-1.5"><SettingsButton variant="ghost" onClick={onDiscard}>Discard</SettingsButton><SettingsButton disabled={exporting} onClick={() => void downloadRecording()}>{exporting ? "Exporting..." : "Download"}</SettingsButton></div>
      </div>
    </section>
  )
}
