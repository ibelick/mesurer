import { forwardRef, type CSSProperties } from "react";

type ScreenshotPreviewProps = {
  url: string;
  side: "top" | "bottom";
  style?: CSSProperties;
  label: string;
  onExited: () => void;
};

// Positioned by the toolbar's floating placement, like its menus, so it stays on screen.
export const ScreenshotPreview = forwardRef<HTMLDivElement, ScreenshotPreviewProps>(function ScreenshotPreview(
  { url, side, style, label, onExited },
  ref,
) {
  return (
    <div
      ref={ref}
      role="status"
      aria-label={label}
      data-side={side}
      style={style}
      className="mesurer-screenshot-preview msr:pointer-events-none msr:fixed msr:z-[120] msr:w-max msr:max-w-[min(200px,calc(100vw-24px))] msr:overflow-hidden msr:rounded-[4px] msr:bg-black msr:p-1 msr:shadow-floating msr:animate-[mesurer-screenshot-preview_5.16s_ease-out_both]"
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
});
