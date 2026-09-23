import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { colorToHex, parseCssColor } from "../core/colors"

export const SETTINGS_COLUMNS = "msr:grid-cols-[78px_150px]"

export const settingsSelectClassName =
  "mesurer-settings-select msr:h-6 msr:w-full msr:appearance-none msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:pr-6 msr:text-[11px] msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_var(--msr-accent)]"

export function SettingsSelectCaret() {
  return (
    <span
      aria-hidden="true"
      className="msr:pointer-events-none msr:absolute msr:right-2 msr:top-1/2 msr:size-1.5 msr:-translate-y-1/2 msr:rotate-45 msr:border-r msr:border-b msr:border-ink-500"
    />
  )
}

export function ControlShell({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="mesurer-control-shell msr:group msr:flex msr:h-6 msr:w-full msr:min-w-0 msr:items-center msr:overflow-hidden msr:rounded-control msr:border msr:border-transparent msr:bg-ink-50 msr:hover:border-ink-200">
      <div className="mesurer-control-focus msr:flex msr:h-full msr:min-w-0 msr:flex-1 msr:items-center msr:focus-within:rounded-l-[5px] msr:focus-within:outline msr:focus-within:outline-1 msr:focus-within:outline-[var(--msr-accent)] msr:focus-within:outline-offset-[-1px]">
        {left}
      </div>
      {right ? (
        <div className="mesurer-control-focus msr:box-border msr:flex msr:h-full msr:w-12 msr:shrink-0 msr:items-center msr:border-l msr:border-ink-200 msr:focus-within:rounded-r-[5px] msr:focus-within:outline msr:focus-within:outline-1 msr:focus-within:outline-[var(--msr-accent)] msr:focus-within:outline-offset-[-1px]">
          {right}
        </div>
      ) : null}
    </div>
  )
}

export function ColorField({
  label,
  value,
  fallback,
  ownerWindow,
  columns = SETTINGS_COLUMNS,
  onChange,
}: {
  label: string
  value: string
  fallback: string
  ownerWindow: Window
  columns?: string
  onChange: (value: string) => void
}) {
  const parsed = parseCssColor(value)
  const canvas = ownerWindow.document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (context) context.fillStyle = value
  const serialized = typeof context?.fillStyle === "string" ? context.fillStyle : ""
  const converted = serialized ? parseCssColor(serialized) : null
  const inputValue = (parsed ?? converted) ? colorToHex(parsed ?? converted!).slice(0, 7) : fallback
  const sample = parsed ?? converted ?? parseCssColor(fallback)
  const hexValue = sample ? colorToHex({ ...sample, alpha: 1 }).slice(1).toUpperCase() : "000000"
  const alphaValue = sample ? Math.round(sample.alpha * 100) : 100
  const [hexDraft, setHexDraft] = useState(hexValue)
  const [alphaDraft, setAlphaDraft] = useState(String(alphaValue))
  const [hexFocused, setHexFocused] = useState(false)
  const [alphaFocused, setAlphaFocused] = useState(false)
  const nativeColorRef = useRef<HTMLInputElement>(null)
  const hexInputRef = useRef<HTMLInputElement>(null)
  const alphaInputRef = useRef<HTMLInputElement>(null)
  const updateColor = (nextHex: string, nextAlpha: number) => {
    if (!/^[\da-f]{6}$/i.test(nextHex)) return
    const nextSample = parseCssColor(`#${nextHex}`)
    if (!nextSample) return
    onChange(colorToHex({ ...nextSample, alpha: Math.min(100, Math.max(0, nextAlpha)) / 100 }))
  }
  const handleNativeColorInput = (input: HTMLInputElement) => {
    updateColor(input.value.slice(1), alphaValue)
  }
  const handleHexInput = (input: HTMLInputElement) => {
    const next = input.value.replace(/[^\da-f]/gi, "").slice(0, 6).toUpperCase()
    setHexDraft(next)
    updateColor(next, alphaFocused ? Number(alphaDraft) : alphaValue)
  }
  const handleAlphaInput = (input: HTMLInputElement) => {
    const next = input.value.replace(/\D/g, "").slice(0, 3)
    setAlphaDraft(next)
    updateColor(hexFocused ? hexDraft : hexValue, Number(next))
  }

  useLayoutEffect(() => {
    const nativeColor = nativeColorRef.current
    const hexInput = hexInputRef.current
    const alphaInput = alphaInputRef.current
    if (!nativeColor || !hexInput || !alphaInput) return

    nativeColor.oninput = () => handleNativeColorInput(nativeColor)
    nativeColor.onchange = () => handleNativeColorInput(nativeColor)
    hexInput.oninput = () => handleHexInput(hexInput)
    alphaInput.oninput = () => handleAlphaInput(alphaInput)
    return () => {
      nativeColor.oninput = null
      nativeColor.onchange = null
      hexInput.oninput = null
      alphaInput.oninput = null
    }
  })
  const swatchColor =
    (ownerWindow as Window & { CSS?: { supports: (property: string, value: string) => boolean } }).CSS?.supports("color", value)
      ? value
      : fallback
  return (
    <div className={`msr:col-span-2 msr:grid msr:h-8 msr:w-full ${columns} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
      <span>{label}</span>
      <ControlShell
        left={
          <>
            <span
              className="msr:relative msr:ml-1 msr:block msr:size-4 msr:shrink-0 msr:overflow-hidden msr:rounded-[3px] msr:border msr:border-black/10"
              style={{ backgroundColor: swatchColor }}
            >
              <input
                ref={nativeColorRef}
                type="color"
                aria-label={`${label} color picker`}
                value={inputValue}
                className="msr:absolute msr:inset-0 msr:size-full msr:cursor-pointer msr:opacity-0"
              />
            </span>
            <input
              ref={hexInputRef}
              aria-label={`${label} hex value`}
              type="text"
              value={hexFocused ? hexDraft : hexValue}
              maxLength={7}
              className="msr:min-w-0 msr:flex-1 msr:bg-transparent msr:px-2 msr:font-mono msr:text-[12px] msr:tabular-nums msr:text-ink-700 msr:outline-none"
              onFocus={() => {
                setHexDraft(hexValue)
                setHexFocused(true)
              }}
              onBlur={() => setHexFocused(false)}
              onChange={(event) => handleHexInput(event.currentTarget)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          </>
        }
        right={
          <input
            ref={alphaInputRef}
            aria-label={`${label} opacity value`}
            type="text"
            inputMode="numeric"
            value={alphaFocused ? (alphaDraft ? `${alphaDraft}%` : "") : `${alphaValue}%`}
            maxLength={4}
            className="msr:h-full msr:w-full msr:rounded-none msr:border-0 msr:bg-transparent msr:px-1 msr:text-left msr:font-mono msr:text-[12px] msr:tabular-nums msr:text-ink-700 msr:outline-none"
            onFocus={() => {
              setAlphaDraft(String(alphaValue))
              setAlphaFocused(true)
            }}
            onBlur={() => setAlphaFocused(false)}
            onChange={(event) => handleAlphaInput(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
              event.preventDefault()
              event.stopPropagation()
              const current = Number.parseInt(alphaFocused ? alphaDraft : String(alphaValue), 10)
              const direction = event.key === "ArrowUp" ? 1 : -1
              const next = Math.min(100, Math.max(0, (Number.isFinite(current) ? current : 0) + direction))
              setAlphaDraft(String(next))
              updateColor(hexFocused ? hexDraft : hexValue, next)
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          />
        }
      />
    </div>
  )
}
