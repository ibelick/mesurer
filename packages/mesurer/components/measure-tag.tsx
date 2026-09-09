"use client"

import type { CSSProperties, PointerEventHandler, ReactNode } from "react"
import { cn } from "../core/utils"

type MeasureTagProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
  interactive?: boolean
  onPointerEnter?: PointerEventHandler<HTMLDivElement>
  onPointerDown?: PointerEventHandler<HTMLDivElement>
}

export function MeasureTag({
  children,
  className = "",
  style,
  interactive = false,
  onPointerEnter,
  onPointerDown,
}: MeasureTagProps) {
  return (
    <div
      className={cn(
        interactive
          ? "msr:pointer-events-auto msr:cursor-pointer"
          : "msr:pointer-events-none",
        "msr:absolute msr:rounded msr:px-1 msr:py-0.5 msr:text-[10px] msr:text-ink-50 msr:tabular-nums msr:select-none",
        className
      )}
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>
  )
}
