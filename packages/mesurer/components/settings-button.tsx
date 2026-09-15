import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "../core/utils"

type SettingsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "danger"
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function SettingsButton({ className, variant = "default", leftIcon, rightIcon, children, ...props }: SettingsButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "msr:flex msr:h-6 msr:items-center msr:gap-1.5 msr:rounded-control msr:border msr:px-2 msr:text-[11px] msr:focus-visible:outline-none",
        Boolean(leftIcon) && "msr:pl-1.5",
        Boolean(rightIcon) && "msr:pr-1.5",
        variant === "danger"
          ? "msr:border-red-200 msr:text-red-600 msr:hover:bg-red-50 msr:focus-visible:shadow-[inset_0_0_0_1px_#ef4444]"
          : "msr:border-ink-200 msr:text-ink-700 msr:hover:bg-ink-50 msr:focus-visible:shadow-[inset_0_0_0_1px_#0d99ff]",
        className,
      )}
    >
      {leftIcon ? <span aria-hidden="true" className="msr:inline-flex msr:shrink-0 msr:items-center msr:justify-center">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span aria-hidden="true" className="msr:inline-flex msr:w-6 msr:justify-center">{rightIcon}</span> : null}
    </button>
  )
}
