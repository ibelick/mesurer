import type { ButtonHTMLAttributes } from "react"
import { SettingsButton } from "./settings-button"

export function InspectCardToggle(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <SettingsButton
      type="button"
      variant="ghost"
      className="mesurer-inspect-info-card-toggle msr:h-auto msr:min-h-0 msr:w-full msr:justify-center msr:border-0 msr:px-1 msr:py-0.5 msr:text-[10px] msr:text-ink-500 msr:hover:bg-transparent msr:hover:text-ink-900"
      {...props}
    />
  )
}
