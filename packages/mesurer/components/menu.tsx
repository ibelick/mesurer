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
        "mesurer-menu-surface msr:z-[70] msr:rounded-lg msr:bg-white msr:p-1 msr:shadow-floating msr:outline-none msr:focus:outline-none",
        className,
      )}
      role="menu"
    >
      {children}
    </div>
  )
}

type ToolbarMenuProps = MenuSurfaceProps & {
  side: "top" | "bottom"
  align?: "left" | "right"
}

export function ToolbarMenu({ className, side, align = "left", children, ...props }: ToolbarMenuProps) {
  return (
    <MenuSurface
      {...props}
      className={cn(
        "msr:absolute msr:z-[100] msr:flex msr:w-44 msr:flex-col msr:gap-px",
        side === "bottom" ? "msr:top-full msr:mt-2" : "msr:bottom-full msr:mb-2",
        align === "left" ? "msr:left-0" : "msr:right-0",
        className,
      )}
    >
      {children}
    </MenuSurface>
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
  role,
  ...props
}: MenuItemProps) {
  return (
    <button
      {...props}
      type="button"
      role={role ?? "menuitem"}
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
