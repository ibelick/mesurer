"use client"

import type { CSSProperties, ReactNode } from "react"
import { cn } from "../utils"

type MeasureTagProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

export function MeasureTag({
  children,
  className = "",
  style,
}: MeasureTagProps) {
  return (
    <div
      className={cn(
        "msr:pointer-events-none msr:absolute msr:rounded msr:px-1 msr:py-0.5 msr:text-[10px] msr:text-ink-50 msr:tabular-nums msr:select-none",
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}
