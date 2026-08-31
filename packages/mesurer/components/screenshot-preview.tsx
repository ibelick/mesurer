
type ScreenshotPreviewProps = {
  url: string;
  side: "top" | "bottom";
  label: string;
  onExited: () => void;
};

export function ScreenshotPreview({
  url,
  side,
  label,
  onExited,
}: ScreenshotPreviewProps) {
  return (
    <div
      role="status"
      aria-label={label}
      data-side={side}
      className={`mesurer-screenshot-preview msr:pointer-events-none msr:absolute msr:left-1/2 msr:z-[100] msr:w-max msr:max-w-[min(200px,calc(100vw-24px))] msr:overflow-hidden msr:rounded-[4px] msr:bg-black msr:p-1 msr:-translate-x-1/2 msr:shadow-md msr:animate-[mesurer-screenshot-preview_5.16s_ease-out_both] ${side === "bottom" ? "msr:top-full msr:mt-2" : "msr:bottom-full msr:mb-2"}`}
      onAnimationEnd={(event) => {
        if (
          event.animationName === "mesurer-screenshot-preview" ||
          event.animationName === "mesurer-screenshot-preview-reduced"
        ) {
          onExited();
        }
      }}
    >
      <img
        src={url}
        alt=""
        className="msr:block msr:h-auto msr:max-h-[120px] msr:max-w-[180px] msr:rounded-[2px] msr:bg-white msr:object-contain"
      />
    </div>
  );
}
