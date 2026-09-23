import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { colorToHex, parseCssColor } from "../core/colors"
import {
  createLayoutGuide,
  DEFAULT_LAYOUT_GUIDE_COLOR,
  layoutGuideLabel,
  type LayoutGuide,
  type LayoutGuideAlign,
  type LayoutGuideKind,
} from "../core/layout-guides"
import { cn } from "../core/utils"
import {
  ColorField,
  ControlShell,
  SettingsSelectCaret,
  settingsSelectClassName,
} from "./control-field"
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
  ownerWindow: Window
  onChange: Dispatch<SetStateAction<LayoutGuide[]>>
}

const KindIcon = ({ kind }: { kind: LayoutGuideKind }) => {
  if (kind === "rows") return <LayoutRowsIcon size={14} />
  if (kind === "grid") return <LayoutGridIcon size={14} />
  return <LayoutColumnsIcon size={14} />
}

const FIELD_COLUMNS = "msr:grid-cols-[78px_minmax(0,1fr)]"

const Field = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <label className={`msr:col-span-2 msr:grid msr:h-8 msr:w-full ${FIELD_COLUMNS} msr:items-center msr:gap-0 msr:text-[12px] msr:text-ink-700`}>
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
  <span className="msr:relative msr:block msr:w-full">
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={settingsSelectClassName}
    >
      {children}
    </select>
    <SettingsSelectCaret />
  </span>
)

const numberInputClassName =
  "msr:h-full msr:w-full msr:min-w-0 msr:border-0 msr:bg-transparent msr:px-2 msr:font-mono msr:text-[12px] msr:font-medium msr:tabular-nums msr:text-ink-700 msr:outline-none"

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
}) => {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(String(value))
  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [focused, value])
  const commit = (input: string) => {
    const next = Number(input.replace(/[^\d.-]/g, ""))
    if (!Number.isFinite(next)) {
      setDraft(String(value))
      return
    }
    onChange(Math.min(max, Math.max(min, next)))
  }
  return (
    <ControlShell
      left={
        <input
          aria-label={label}
          type="text"
          inputMode="numeric"
          value={focused ? draft : String(value)}
          className={numberInputClassName}
          onFocus={() => {
            setDraft(String(value))
            setFocused(true)
          }}
          onBlur={() => {
            commit(draft)
            setFocused(false)
          }}
           onChange={(event) => {
             const next = event.currentTarget.value.replace(/[^\d.-]/g, "")
             setDraft(next)
             const parsed = Number(next)
             if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)))
           }}
           onKeyDown={(event) => {
             if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
             event.preventDefault()
             const current = Number(draft)
             const base = Number.isFinite(current) ? current : value
             const next = Math.min(max, Math.max(min, base + (event.key === "ArrowUp" ? 1 : -1)))
             setDraft(String(next))
             onChange(next)
           }}
           onPointerDown={(event) => event.stopPropagation()}
         />
      }
    />
  )
}

function LayoutGuideEditor({
  guide,
  ownerWindow,
  onChange,
  onClose,
}: {
  guide: LayoutGuide
  ownerWindow: Window
  onChange: (guide: LayoutGuide) => void
  onClose: () => void
}) {
  const alignLabel =
    guide.kind === "rows"
      ? { stretch: "Stretch", min: "Top", center: "Center", max: "Bottom" }
      : { stretch: "Stretch", min: "Left", center: "Center", max: "Right" }
  const sizeLabel = guide.kind === "rows" ? "Height" : guide.kind === "grid" ? "Size" : "Width"
  return (
    <div className="mesurer-thin-scrollbar msr:flex msr:min-h-0 msr:flex-1 msr:flex-col msr:gap-2 msr:overflow-y-auto msr:p-3">
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
      <ColorField
        label="Color"
        columns={FIELD_COLUMNS}
        value={colorToHex({ ...(parseCssColor(guide.color) ?? parseCssColor(DEFAULT_LAYOUT_GUIDE_COLOR)!), alpha: guide.opacity })}
        fallback={DEFAULT_LAYOUT_GUIDE_COLOR}
        ownerWindow={ownerWindow}
        onChange={(next) => {
          const parsed = parseCssColor(next)
          onChange({
            ...guide,
            color: parsed ? colorToHex({ ...parsed, alpha: 1 }).slice(0, 7) : next,
            opacity: parsed?.alpha ?? guide.opacity,
          })
        }}
      />
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
          <NumberField label={sizeLabel} value={guide.size} min={1} max={4096} onChange={(size) => onChange({ ...guide, size })} />
        </Field>
      ) : null}
      {guide.kind !== "grid" ? (
        <>
          <Field label="Offset">
            <NumberField label="Offset" value={guide.offset} min={0} max={4096} onChange={(offset) => onChange({ ...guide, offset })} />
          </Field>
          <Field label="Gutter">
            <NumberField label="Gutter" value={guide.gutter} min={0} max={800} onChange={(gutter) => onChange({ ...guide, gutter })} />
          </Field>
        </>
      ) : null}
    </div>
  )
}

export function LayoutGuidesPanel({ guides, ownerWindow, onChange }: LayoutGuidesPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = guides.find((guide) => guide.id === editingId)
  if (editing) {
    return (
      <LayoutGuideEditor
        guide={editing}
        ownerWindow={ownerWindow}
        onClose={() => setEditingId(null)}
        onChange={(next) =>
          onChange((current) => current.map((guide) => (guide.id === next.id ? next : guide)))
        }
      />
    )
  }
  return (
    <div className="msr:flex msr:min-h-0 msr:flex-1 msr:flex-col msr:gap-1 msr:p-2">
      <div className="msr:flex msr:h-7 msr:shrink-0 msr:items-center msr:justify-between msr:px-1">
        <h2 className="msr:text-[11px] msr:font-semibold msr:text-ink-700">Layout guides</h2>
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
        <ul className="mesurer-thin-scrollbar msr:m-0 msr:flex msr:min-h-0 msr:flex-1 msr:list-none msr:flex-col msr:gap-0.5 msr:overflow-y-auto msr:p-0">
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
                <CaretDownIcon size={8} className="msr:-rotate-90 msr:text-ink-400" />
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
