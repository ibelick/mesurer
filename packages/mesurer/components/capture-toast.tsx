import { cn } from "../core/utils"

type CaptureToastProps = {
  align: string
  title: string
  detail?: string
}

export function CaptureToast({
  align,
  title,
  detail = "Check permissions and try again.",
}: CaptureToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mesurer-toast-surface msr:pointer-events-none msr:absolute msr:top-full msr:z-10 msr:mt-2 msr:box-border msr:w-max msr:max-w-[min(240px,calc(100vw-16px))] msr:overflow-hidden msr:rounded-[10px] msr:bg-white msr:px-3 msr:py-2 msr:text-center msr:text-[12px] msr:leading-4 msr:text-ink-900 msr:whitespace-normal msr:text-pretty msr:line-clamp-2",
        align,
      )}
    >
      {title}
      {detail ? (
        <>
          <br />
          {detail}
        </>
      ) : null}
    </div>
  )
}
