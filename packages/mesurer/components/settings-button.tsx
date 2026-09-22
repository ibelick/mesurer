import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "../core/utils"

type SettingsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "danger" | "danger-solid" | "ghost"
  shape?: "default" | "icon"
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function SettingsButton({ className, variant = "default", shape = "default", leftIcon, rightIcon, children, ...props }: SettingsButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        shape === "icon"
          ? "msr:flex msr:size-5 msr:shrink-0 msr:items-center msr:justify-center msr:rounded-control msr:border msr:p-0 msr:text-[14px] msr:focus-visible:outline-none"
          : "msr:flex msr:h-6 msr:items-center msr:gap-1.5 msr:rounded-control msr:border msr:px-2 msr:text-[11px] msr:focus-visible:outline-none",
        Boolean(leftIcon) && "msr:pl-1.5",
        Boolean(rightIcon) && "msr:pr-1.5",
        variant === "danger"
          ? "msr:border-[var(--msr-danger-border)] msr:text-[var(--msr-danger-text)] msr:hover:bg-[var(--msr-danger-bg)] msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-danger-text)]"
          : variant === "danger-solid"
            ? "msr:border-transparent msr:bg-[var(--msr-danger-solid-bg)] msr:text-[var(--msr-danger-solid-text)] msr:hover:bg-[var(--msr-danger-solid-hover)]"
          : variant === "ghost"
            ? "msr:border-transparent msr:bg-transparent msr:text-ink-500 msr:hover:bg-ink-100 msr:hover:text-ink-900"
            : "mesurer-settings-button-default msr:border-ink-200 msr:text-ink-700 msr:hover:bg-ink-50 msr:focus-visible:shadow-[inset_0_0_0_1px_var(--msr-accent)]",
        className,
      )}
    >
      {leftIcon ? <span aria-hidden="true" className="msr:inline-flex msr:shrink-0 msr:items-center msr:justify-center">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span aria-hidden="true" className="msr:inline-flex msr:w-6 msr:justify-center">{rightIcon}</span> : null}
    </button>
  )
}
