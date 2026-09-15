import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { cn } from "../core/utils"

type MenuSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export function MenuSurface({ className, children, ...props }: MenuSurfaceProps) {
  return (
    <div
      {...props}
      className={cn(
        "mesurer-menu-surface msr:z-[70] msr:rounded-lg msr:border msr:border-ink-200 msr:bg-white msr:p-1 msr:shadow-lg msr:outline-none msr:focus:outline-none",
        className,
      )}
      role="menu"
    >
      {children}
    </div>
  )
}

type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: "neutral" | "accent"
}

export function MenuItem({
  className,
  children,
  variant = "accent",
  ...props
}: MenuItemProps) {
  return (
    <button
      {...props}
      type="button"
      role="menuitem"
      className={cn(
        "msr:flex msr:w-full msr:items-center msr:rounded-control msr:px-2 msr:py-1.5 msr:text-left msr:text-[11px] msr:leading-4 msr:text-ink-700",
        variant === "accent"
          ? "msr:hover:bg-[#0d99ff] msr:hover:text-white"
          : "msr:hover:bg-ink-50",
        "msr:disabled:cursor-not-allowed msr:disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  )
}
