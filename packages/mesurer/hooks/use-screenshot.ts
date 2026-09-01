import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"
import type { ScreenshotSettings } from "../core/persistence"
import {
  copyPngToClipboard,
  createScreenshotFilename,
  cropPngToViewportRect,
  downloadPng,
  hideNodesForCapture,
  MIN_SCREENSHOT_SELECTION,
  normalizeScreenshotRect,
  waitForNextPaint,
  type ScreenshotRect,
} from "../core/screenshot"
import {
  captureVisibleTabPng,
  prepareScreenshotCapture,
  releaseScreenshotCapture,
} from "../core/screenshot-capture"

const SCREENSHOT_ERROR_MS = 2500

type UseScreenshotOptions = {
  ownerDocument: Document
  ownerWindow: Window
  overlayRef: RefObject<HTMLDivElement | null>
  captureVisibleTab?: () => Promise<Blob>
  settings: ScreenshotSettings
  setEnabled: (enabled: boolean) => void
  setToolbarActive: (active: boolean) => void
  onPrepare: () => void
}

export const useScreenshot = ({
  ownerDocument,
  ownerWindow,
  overlayRef,
  captureVisibleTab,
  settings,
  setEnabled,
  setToolbarActive,
  onPrepare,
}: UseScreenshotOptions) => {
  const screenshotOverlayRef = useRef<HTMLDivElement>(null)
  const screenshotOriginRef = useRef<{ x: number; y: number } | null>(null)
  const capturingScreenshotRef = useRef(false)
  const preparingScreenshotRef = useRef(false)
  const captureOperationRef = useRef(0)
  const capturingOperationRef = useRef<number | null>(null)
  const screenshotPreviewUrlRef = useRef<string | null>(null)
  const screenshotErrorTimeoutRef = useRef<number | null>(null)

  const [error, setError] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [active, setActive] = useState(false)
  const [rect, setRect] = useState<ScreenshotRect | null>(null)

  const flashError = useCallback(() => {
    setError(true)
    if (screenshotErrorTimeoutRef.current !== null) {
      ownerWindow.clearTimeout(screenshotErrorTimeoutRef.current)
    }
    screenshotErrorTimeoutRef.current = ownerWindow.setTimeout(() => {
      screenshotErrorTimeoutRef.current = null
      setError(false)
    }, SCREENSHOT_ERROR_MS)
  }, [ownerWindow])

  const cancelSelection = useCallback(() => {
    screenshotOriginRef.current = null
    setRect(null)
    setActive(false)
  }, [])

  const dismissPreview = useCallback(() => {
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      screenshotPreviewUrlRef.current = null
      return null
    })
  }, [])

  const closeUi = useCallback(() => {
    captureOperationRef.current += 1
    cancelSelection()
    dismissPreview()
    releaseScreenshotCapture(ownerWindow)
  }, [cancelSelection, dismissPreview, ownerWindow])

  useLayoutEffect(() => {
    return () => {
      captureOperationRef.current += 1
      if (screenshotErrorTimeoutRef.current !== null) {
        ownerWindow.clearTimeout(screenshotErrorTimeoutRef.current)
      }
      const url = screenshotPreviewUrlRef.current
      if (url) URL.revokeObjectURL(url)
      releaseScreenshotCapture(ownerWindow)
    }
  }, [ownerWindow])

  const captureRegion = useCallback(
    (nextRect: ScreenshotRect) => {
      if (capturingScreenshotRef.current) return
      capturingScreenshotRef.current = true
      const operationId = ++captureOperationRef.current
      capturingOperationRef.current = operationId
      setError(false)
      const restore = hideNodesForCapture([
        screenshotOverlayRef.current,
        overlayRef.current?.querySelector<HTMLElement>(".mesurer-color-picker") ??
          null,
        overlayRef.current?.querySelector<HTMLElement>(
          ".mesurer-screenshot-preview",
        ) ?? null,
      ])
      const croppedPromise = (async () => {
        await waitForNextPaint(ownerWindow)
        const blob = captureVisibleTab
          ? await captureVisibleTab()
          : await captureVisibleTabPng(ownerDocument, ownerWindow)
        return cropPngToViewportRect(
          blob,
          nextRect,
          {
            width: ownerWindow.innerWidth,
            height: ownerWindow.innerHeight,
          },
          ownerDocument,
        )
      })()
      void croppedPromise.catch(() => undefined)
      const shouldCopy = settings.copy
      const shouldDownload = settings.download
      const copyPromise = shouldCopy
        ? copyPngToClipboard(croppedPromise, ownerWindow.navigator.clipboard)
        : Promise.resolve()
      void (async () => {
        try {
          const cropped = await croppedPromise
          if (captureOperationRef.current !== operationId) return
          const results = await Promise.allSettled([
            copyPromise,
            shouldDownload
              ? Promise.resolve(
                  downloadPng(
                    cropped,
                    createScreenshotFilename(),
                    ownerDocument,
                    ownerWindow,
                  ),
                )
              : Promise.resolve(),
          ])
          const copyFailed = shouldCopy && results[0]?.status === "rejected"
          const downloadFailed =
            shouldDownload && results[1]?.status === "rejected"
          if (
            (copyFailed && !shouldDownload) ||
            (downloadFailed && !shouldCopy) ||
            (copyFailed && downloadFailed)
          ) {
            throw new Error("Could not save screenshot")
          }
          if (captureOperationRef.current !== operationId) return
          const nextUrl = URL.createObjectURL(cropped)
          setPreviewUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous)
            screenshotPreviewUrlRef.current = nextUrl
            return nextUrl
          })
        } catch {
          if (captureOperationRef.current === operationId) {
            flashError()
          }
        } finally {
          const ownsCapture = capturingOperationRef.current === operationId
          if (ownsCapture) {
            capturingScreenshotRef.current = false
            capturingOperationRef.current = null
          }
          if (captureOperationRef.current === operationId) {
            cancelSelection()
            ownerWindow.requestAnimationFrame(restore)
          } else {
            restore()
          }
        }
      })()
    },
    [
      cancelSelection,
      captureVisibleTab,
      flashError,
      ownerDocument,
      ownerWindow,
      overlayRef,
      settings.copy,
      settings.download,
    ],
  )

  const toggleSelection = useCallback(async () => {
    if (active) {
      closeUi()
      return
    }
    if (preparingScreenshotRef.current) return
    preparingScreenshotRef.current = true
    dismissPreview()
    try {
      if (!captureVisibleTab) {
        await prepareScreenshotCapture(ownerDocument, ownerWindow)
      }
      setEnabled(true)
      setToolbarActive(true)
      onPrepare()
      setError(false)
      screenshotOriginRef.current = null
      setRect(null)
      setActive(true)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        flashError()
      }
    } finally {
      preparingScreenshotRef.current = false
    }
  }, [
    active,
    captureVisibleTab,
    closeUi,
    dismissPreview,
    flashError,
    onPrepare,
    ownerDocument,
    ownerWindow,
    setEnabled,
    setToolbarActive,
  ])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      screenshotOriginRef.current = { x: event.clientX, y: event.clientY }
      setRect(
        normalizeScreenshotRect(
          screenshotOriginRef.current,
          screenshotOriginRef.current,
          {
            width: ownerWindow.innerWidth,
            height: ownerWindow.innerHeight,
          },
        ),
      )
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [ownerWindow],
  )

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = screenshotOriginRef.current
      if (!origin) return
      setRect(
        normalizeScreenshotRect(
          origin,
          { x: event.clientX, y: event.clientY },
          {
            width: ownerWindow.innerWidth,
            height: ownerWindow.innerHeight,
          },
        ),
      )
    },
    [ownerWindow],
  )

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      const origin = screenshotOriginRef.current
      screenshotOriginRef.current = null
      if (!origin) return
      const nextRect = normalizeScreenshotRect(
        origin,
        { x: event.clientX, y: event.clientY },
        {
          width: ownerWindow.innerWidth,
          height: ownerWindow.innerHeight,
        },
      )
      setRect(nextRect)
      if (
        nextRect.width < MIN_SCREENSHOT_SELECTION ||
        nextRect.height < MIN_SCREENSHOT_SELECTION
      ) {
        setRect(null)
        return
      }
      void captureRegion(nextRect)
    },
    [captureRegion, ownerWindow],
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
      captureOperationRef.current += 1
      cancelSelection()
    },
    [cancelSelection],
  )

  return {
    overlayRef: screenshotOverlayRef,
    error,
    previewUrl,
    active,
    rect,
    cancelSelection,
    dismissPreview,
    closeUi,
    toggleSelection,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  }
}
