import { useState } from "react";
import { setupPrompt } from "./components/agent-prompt-button";

const remixPaths = {
  npm: "M20.001 3C20.5533 3 21.001 3.44772 21.001 4V20C21.001 20.5523 20.5533 21 20.001 21H4.00098C3.44869 21 3.00098 20.5523 3.00098 20V4C3.00098 3.44772 3.44869 3 4.00098 3H20.001ZM17.001 7H7.00098V17H12.001V9.5H14.501V17H17.001V7Z",
  chrome: "M9.82726 21.7633C5.34912 20.7712 2 16.7767 2 12C2 10.1779 2.48734 8.46958 3.33878 6.99834L7.62189 14.4169C8.47396 15.9571 10.1152 17 12 17C12.2023 17 12.4018 16.988 12.5978 16.9646L9.82726 21.7633ZM12 22L16.2868 14.5751C16.7396 13.8229 17 12.9419 17 12C17 10.8744 16.6281 9.83566 16.0004 9H21.5422C21.8396 9.94704 22 10.9548 22 12C22 17.5228 17.5228 22 12 22ZM14.5721 13.545C14.0473 14.4168 13.0917 15 12 15C10.8897 15 9.92024 14.3967 9.40149 13.5002L9.37313 13.4501C9.13535 13.0203 9 12.526 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12C15 12.5465 14.8539 13.0589 14.5985 13.5002L14.5721 13.545ZM4.6322 5.23859C6.46008 3.24783 9.08432 2 12 2C15.7014 2 18.9331 4.01099 20.6622 7H12C9.93635 7 8.1647 8.25019 7.40112 10.0345L4.6322 5.23859Z",
  copy: "M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z",
  arrow: "M16.0037 9.41421L7.39712 18.0208L5.98291 16.6066L14.5895 8H7.00373V6H18.0037V17H16.0037V9.41421Z",
} as const;

function RemixIcon({ path, size }: { path: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const cards = [
  {
    badge: "Npm package",
    image: "https://assets.querrel.com/mesurer/npm.webp",
    title: "Run Mesurer in your project",
    description: "Embed the toolbar in your own project and make it available to all contributors",
  },
  {
    badge: "Chrome extension",
    image: "https://assets.querrel.com/mesurer/chrome.webp",
    title: "Use Mesurer everywhere",
    description: "Install the chrome extension to access mesurer toolbar on any live interface",
  },
] as const;

export default function BrowserSection() {
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(setupPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="relative left-1/2 mt-24 w-screen -translate-x-1/2 px-5" aria-label="Ways to use Mesurer">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-12 lg:flex-row lg:gap-20">
        <article className="flex w-[340px] max-w-full flex-col items-center text-center">
          <div className="inline-flex h-[22px] items-center gap-1 rounded-full bg-[#E5F0FF] px-[10px] text-xs leading-none text-[#1F78FF]">
            <RemixIcon path={remixPaths.npm} size={14} />
            <span>{cards[0].badge}</span>
          </div>
          <div className="mt-5 flex h-[56px] items-center">
            <img src={cards[0].image} alt="" draggable={false} className="h-[56px] w-auto" loading="lazy" />
          </div>
          <h2 className="mt-3 text-balance text-[22px] font-medium leading-tight text-strong">{cards[0].title}</h2>
          <p className="mt-2 text-pretty text-base leading-normal text-muted">{cards[0].description}</p>
          <button
            type="button"
            onClick={() => void copyPrompt()}
            className="mt-4 inline-flex select-none items-center gap-1 text-base leading-normal text-strong underline decoration-border underline-offset-2 transition-opacity hover:opacity-70"
          >
            <RemixIcon path={remixPaths.copy} size={16} />
            {copied ? "Prompt copied" : "Copy setup prompt"}
          </button>
        </article>

        <article className="flex w-[340px] max-w-full flex-col items-center text-center">
          <div className="inline-flex h-[22px] items-center gap-1 rounded-full bg-[#E5F0FF] px-[10px] text-xs leading-none text-[#1F78FF]">
            <RemixIcon path={remixPaths.chrome} size={14} />
            <span>{cards[1].badge}</span>
          </div>
          <div className="mt-5 flex h-[56px] items-center">
            <img src={cards[1].image} alt="" draggable={false} className="h-[40px] w-auto" loading="lazy" />
          </div>
          <h2 className="mt-3 text-balance text-[22px] font-medium leading-tight text-strong">{cards[1].title}</h2>
          <p className="mt-2 text-pretty text-base leading-normal text-muted">{cards[1].description}</p>
          <a
            href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex select-none items-center gap-1 text-base leading-normal text-strong underline decoration-border underline-offset-2 transition-opacity hover:opacity-70"
          >
            <RemixIcon path={remixPaths.arrow} size={16} />
            Install chrome extension
          </a>
        </article>
      </div>
    </section>
  );
}
