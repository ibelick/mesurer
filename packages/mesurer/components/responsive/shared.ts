import type { SyntheticEvent } from "react"

// Keeps what happens in the preview's own controls from reaching the tools under it.
export const stop = (event: SyntheticEvent) => event.stopPropagation()

// The previews sit under Mesurer's overlay, which draws on them. Their controls come back over it.
export const raised = "msr:relative msr:z-[1]"

export const surface = `${raised} msr:rounded-lg msr:bg-surface msr:shadow-floating`

const iconButtonBase =
  "msr:flex msr:size-6 msr:shrink-0 msr:items-center msr:justify-center msr:rounded-control msr:outline-none msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)] msr:disabled:pointer-events-none msr:disabled:opacity-40"

export const iconButton = `${iconButtonBase} msr:text-ink-500 msr:hover:bg-ink-100 msr:hover:text-ink-900`
