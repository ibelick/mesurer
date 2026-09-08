import type { InputHTMLAttributes, ReactNode, Ref } from "react"
import { forwardRef } from "react"
import { cn } from "../core/utils"

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: ReactNode
  containerClassName?: string
}

export const TextInput = forwardRef(function TextInput(
  { leftIcon, className, containerClassName, ...props }: TextInputProps,
  ref: Ref<HTMLInputElement>,
) {
  return (
    <div className={cn("msr:relative", containerClassName)}>
      {leftIcon ? <span className="msr:pointer-events-none msr:absolute msr:left-1.5 msr:top-1/2 msr:-translate-y-1/2">{leftIcon}</span> : null}
      <input
        ref={ref}
        {...props}
        className={cn(
          "msr:h-6 msr:w-full msr:rounded-control msr:border msr:border-ink-200 msr:bg-white msr:px-1.5 msr:text-[11px] msr:text-ink-900 msr:outline-none msr:focus:shadow-[inset_0_0_0_1px_#0d99ff]",
          Boolean(leftIcon) && "msr:pl-6",
          className,
        )}
      />
    </div>
  )
})
