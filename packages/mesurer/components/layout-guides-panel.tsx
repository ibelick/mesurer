import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { colorToHex, parseCssColor } from "../core/colors"
import {
  createLayoutGuide,
  layoutGuideLabel,
  type LayoutGuide,
  type LayoutGuideAlign,
  type LayoutGuideKind,
} from "../core/layout-guides"
import { cn } from "../core/utils"
import { CloseIcon } from "./icons"
import {
  EyeIcon,
  EyeOffIcon,
  LayoutColumnsIcon,
  LayoutGridIcon,
  LayoutRowsIcon,
  PlusIcon,
} from "./icons/layout-guides"
import { CaretDownIcon, MinusIcon } from "./icons/menu-icons"

type LayoutGuidesPanelProps = {
  guides: LayoutGuide[]
  onChange: Dispatch<SetStateAction<LayoutGuide[]>>
}

const KindIcon = ({ kind }: { kind: LayoutGuideKind }) => {
  if (kind === "rows") return <LayoutRowsIcon size={14} />
  if (kind === "grid") return <LayoutGridIcon size={14} />
  return <LayoutColumnsIcon size={14} />
}

const Field = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <label className="msr:grid msr:grid-cols-[4.5rem_minmax(0,1fr)] msr:items-center msr:gap-2 msr:text-[11px] msr:text-ink-700">
    <span>{label}</span>
    {children}
  </label>
)

const NativeSelect = ({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) => (
  <select
    aria-label={label}
    value={value}
    onChange={(event) => onChange(event.currentTarget.value)}
    className="mesurer-settings-select msr:h-6 msr:w-full msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:text-[11px] msr:text-ink-700 msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]"
  >
    {children}
  </select>
)

const NumberField = ({
  label,
  value,
  min = 0,
  max = 9999,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}) => (
  <input
    aria-label={label}
    type="number"
    inputMode="numeric"
    min={min}
    max={max}
    value={Number.isFinite(value) ? value : 0}
    onChange={(event) => {
      const next = Number(event.currentTarget.value)
      if (!Number.isFinite(next)) return
      onChange(Math.min(max, Math.max(min, next)))
    }}
    className="msr:h-6 msr:w-full msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:text-[11px] msr:tabular-nums msr:text-ink-700 msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]"
  />
)

function ColorRow({
  value,
  opacity,
  onChange,
}: {
  value: string
  opacity: number
  onChange: (color: string, opacity: number) => void
}) {
  const parsed = parseCssColor(value)
  const hex = parsed ? colorToHex({ ...parsed, alpha: 1 }).slice(1, 7).toUpperCase() : "FF0000"
  const percent = Math.round(opacity * 100)
  return (
    <div className="msr:flex msr:h-6 msr:overflow-hidden msr:rounded-control msr:border msr:border-ink-200">
      <span className="msr:relative msr:size-6 msr:shrink-0 msr:border-r msr:border-ink-200">
        <span className="msr:absolute msr:inset-1 msr:rounded-[3px]" style={{ backgroundColor: value }} />
        <input
          type="color"
          aria-label="Layout guide color"
          value={`#${hex}`}
          className="msr:absolute msr:inset-0 msr:cursor-pointer msr:opacity-0"
          onChange={(event) => onChange(event.currentTarget.value, opacity)}
        />
      </span>
      <input
        aria-label="Layout guide hex"
        value={hex}
        maxLength={6}
        className="msr:min-w-0 msr:flex-1 msr:border-0 msr:bg-transparent msr:px-1.5 msr:font-mono msr:text-[11px] msr:uppercase msr:text-ink-700 msr:outline-none"
        onChange={(event) => {
          const next = event.currentTarget.value.replace(/[^\da-f]/gi, "").slice(0, 6)
          if (next.length === 6) onChange(`#${next}`, opacity)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <input
        aria-label="Layout guide opacity"
        value={`${percent}%`}
        className="msr:w-12 msr:border-l msr:border-ink-200 msr:bg-transparent msr:px-1 msr:text-[11px] msr:tabular-nums msr:text-ink-700 msr:outline-none"
        onChange={(event) => {
          const next = Number(event.currentTarget.value.replace(/\D/g, ""))
          if (!Number.isFinite(next)) return
          onChange(value, Math.min(100, Math.max(0, next)) / 100)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      />
    </div>
  )
}

function LayoutGuideEditor({
  guide,
  onChange,
  onClose,
}: {
  guide: LayoutGuide
  onChange: (guide: LayoutGuide) => void
  onClose: () => void
}) {
  const alignLabel =
    guide.kind === "rows"
      ? { stretch: "Stretch", min: "Top", center: "Center", max: "Bottom" }
      : { stretch: "Stretch", min: "Left", center: "Center", max: "Right" }
  const sizeLabel = guide.kind === "rows" ? "Height" : guide.kind === "grid" ? "Size" : "Width"
  return (
    <div className="msr:flex msr:flex-col msr:gap-2 msr:p-3">
      <div className="msr:flex msr:items-center msr:justify-between msr:gap-2">
        <NativeSelect
          label="Layout guide type"
          value={guide.kind}
          onChange={(kind) =>
            onChange({
              ...guide,
              kind: kind as LayoutGuideKind,
              align: kind === "grid" ? "min" : guide.align === "stretch" || kind === guide.kind ? guide.align : "stretch",
            })
          }
        >
          <option value="columns">Columns</option>
          <option value="rows">Rows</option>
          <option value="grid">Grid</option>
        </NativeSelect>
        <button
          type="button"
          aria-label="Back to layout guides"
          className="msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-control msr:text-ink-500 msr:outline-none msr:hover:bg-ink-100 msr:hover:text-ink-900"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
      {guide.kind !== "grid" ? (
        <Field label="Count">
          <NumberField label="Count" value={guide.count} min={1} max={24} onChange={(count) => onChange({ ...guide, count })} />
        </Field>
      ) : null}
      <Field label="Color">
        <ColorRow
          value={guide.color}
          opacity={guide.opacity}
          onChange={(color, opacity) => onChange({ ...guide, color, opacity })}
        />
      </Field>
      {guide.kind !== "grid" ? (
        <Field label="Type">
          <NativeSelect
            label="Alignment"
            value={guide.align}
            onChange={(align) => onChange({ ...guide, align: align as LayoutGuideAlign })}
          >
            {(["stretch", "min", "center", "max"] as const).map((align) => (
              <option key={align} value={align}>
                {alignLabel[align]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      {guide.kind === "grid" || guide.align !== "stretch" ? (
        <Field label={sizeLabel}>
          <NumberField label={sizeLabel} value={guide.size} min={1} max={400} onChange={(size) => onChange({ ...guide, size })} />
        </Field>
      ) : null}
      {guide.kind !== "grid" ? (
        <>
          <Field label="Offset">
            <NumberField label="Offset" value={guide.offset} min={0} max={800} onChange={(offset) => onChange({ ...guide, offset })} />
          </Field>
          <Field label="Gutter">
            <NumberField label="Gutter" value={guide.gutter} min={0} max={200} onChange={(gutter) => onChange({ ...guide, gutter })} />
          </Field>
        </>
      ) : null}
    </div>
  )
}

export function LayoutGuidesPanel({ guides, onChange }: LayoutGuidesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = guides.find((guide) => guide.id === editingId)
  if (editing) {
    return (
      <LayoutGuideEditor
        guide={editing}
        onClose={() => setEditingId(null)}
        onChange={(next) =>
          onChange((current) => current.map((guide) => (guide.id === next.id ? next : guide)))
        }
      />
    )
  }
  return (
    <div className="msr:flex msr:flex-col msr:gap-1 msr:p-2">
      <div className="msr:flex msr:h-7 msr:items-center msr:justify-between msr:px-1">
        <h2 className="msr:text-[11px] msr:font-semibold msr:text-ink-700">Layout guide</h2>
        <button
          type="button"
          aria-label="Add layout guide"
          className="msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-control msr:text-ink-500 msr:outline-none msr:hover:bg-ink-100 msr:hover:text-ink-900"
          onClick={() => onChange((current) => [...current, createLayoutGuide()])}
        >
          <PlusIcon />
        </button>
      </div>
      {guides.length === 0 ? (
        <p className="msr:px-1 msr:pb-2 msr:text-[11px] msr:text-ink-500">Add columns, rows, or a pixel grid on the page.</p>
      ) : (
        <ul className="msr:m-0 msr:flex msr:list-none msr:flex-col msr:gap-0.5 msr:p-0">
          {guides.map((guide) => (
            <li key={guide.id} className="msr:flex msr:items-center msr:gap-0.5">
              <button
                type="button"
                className="msr:flex msr:min-w-0 msr:flex-1 msr:items-center msr:gap-2 msr:rounded-control msr:px-1 msr:py-1 msr:text-left msr:text-[11px] msr:text-ink-700 msr:outline-none msr:hover:bg-ink-100"
                onClick={() => setEditingId(guide.id)}
              >
                <span className="msr:text-ink-500">
                  <KindIcon kind={guide.kind} />
                </span>
                <span className="msr:min-w-0 msr:flex-1 msr:truncate">{layoutGuideLabel(guide)}</span>
                <CaretDownIcon size={8} className="msr:text-ink-400" />
              </button>
              <button
                type="button"
                aria-label={guide.visible ? `Hide ${layoutGuideLabel(guide)}` : `Show ${layoutGuideLabel(guide)}`}
                aria-pressed={guide.visible}
                className={cn(
                  "msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-control msr:outline-none msr:hover:bg-ink-100",
                  guide.visible ? "msr:text-ink-700" : "msr:text-ink-400",
                )}
                onClick={() =>
                  onChange((current) =>
                    current.map((item) => (item.id === guide.id ? { ...item, visible: !item.visible } : item)),
                  )
                }
              >
                {guide.visible ? <EyeIcon /> : <EyeOffIcon />}
              </button>
              <button
                type="button"
                aria-label={`Remove ${layoutGuideLabel(guide)}`}
                className="msr:flex msr:size-6 msr:items-center msr:justify-center msr:rounded-control msr:text-ink-400 msr:outline-none msr:hover:bg-ink-100 msr:hover:text-ink-900"
                onClick={() => onChange((current) => current.filter((item) => item.id !== guide.id))}
              >
                <MinusIcon size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
