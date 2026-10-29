import { ArrowRightIcon } from "@phosphor-icons/react/ArrowRight";

const remixPaths = {
  npm: "M20.001 3C20.5533 3 21.001 3.44772 21.001 4V20C21.001 20.5523 20.5533 21 20.001 21H4.00098C3.44869 21 3.00098 20.5523 3.00098 20V4C3.00098 3.44772 3.44869 3 4.00098 3H20.001ZM17.001 7H7.00098V17H12.001V9.5H14.501V17H17.001V7Z",
  chrome: "M9.82726 21.7633C5.34912 20.7712 2 16.7767 2 12C2 10.1779 2.48734 8.46958 3.33878 6.99834L7.62189 14.4169C8.47396 15.9571 10.1152 17 12 17C12.2023 17 12.4018 16.988 12.5978 16.9646L9.82726 21.7633ZM12 22L16.2868 14.5751C16.7396 13.8229 17 12.9419 17 12C17 10.8744 16.6281 9.83566 16.0004 9H21.5422C21.8396 9.94704 22 10.9548 22 12C22 17.5228 17.5228 22 12 22ZM14.5721 13.545C14.0473 14.4168 13.0917 15 12 15C10.8897 15 9.92024 14.3967 9.40149 13.5002L9.37313 13.4501C9.13535 13.0203 9 12.526 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12C15 12.5465 14.8539 13.0589 14.5985 13.5002L14.5721 13.545ZM4.6322 5.23859C6.46008 3.24783 9.08432 2 12 2C15.7014 2 18.9331 4.01099 20.6622 7H12C9.93635 7 8.1647 8.25019 7.40112 10.0345L4.6322 5.23859Z",
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
    image: "https://assets.querrel.com/mesurer/extension.webp",
    title: "Use Mesurer everywhere",
    description: "Install the chrome extension to access mesurer toolbar on any live interface",
  },
] as const;

export default function BrowserSection({ className = "" }: { className?: string }) {
  return (
    <section
      id="installation"
      className={`relative mx-auto w-full max-w-7xl py-32 ${className}`}
      aria-label="Ways to use Mesurer"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-10 lg:flex-row">
        <article
          className="relative flex w-full flex-col items-center rounded-sm border border-border px-20 pt-20 pb-30 text-center lg:flex-1"
          style={{
            backgroundImage: "linear-gradient(180deg, rgba(255, 255, 255, 0.00) 0%, #FFFFFF 100%), url(https://assets.querrel.com/mesurer/dot-bg.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <a
            href="https://www.npmjs.com/package/mesurer"
            target="_blank"
            rel="noreferrer"
            aria-label="View the Mesurer npm package"
            className="absolute inset-0 z-10 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-strong"
          />
          <div className="flex w-full items-center justify-between">
            <div className="text-sm inline-flex h-6 w-fit items-center gap-1 rounded-full bg-accent-subtle px-2.5 text-accent">
              <RemixIcon path={remixPaths.npm} size={14} />
              <span>{cards[0].badge}</span>
            </div>
            <ArrowRightIcon aria-hidden="true" size={20} className="shrink-0 text-secondary" />
          </div>
          <div className="mt-10 flex h-[56px] items-center">
            <img src={cards[0].image} alt="" draggable={false} className="h-[56px] w-auto" loading="lazy" />
          </div>
          <h3 className="type-h3 mt-3 text-balance text-strong">{cards[0].title}</h3>
          <p className="body-md mt-2 text-pretty text-muted">{cards[0].description}</p>
        </article>

        <article className="relative flex w-full flex-col items-center rounded-sm border border-border bg-gray-dark px-20 pt-20 pb-30 text-center lg:flex-1">
          <a
            href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac"
            target="_blank"
            rel="noreferrer"
            aria-label="View Mesurer in the Chrome Web Store"
            className="absolute inset-0 z-10 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-strong"
          />
          <div className="flex w-full items-center justify-between">
            <div className="text-sm inline-flex h-6 w-fit items-center gap-1 rounded-full bg-accent-subtle px-2.5 text-accent">
              <RemixIcon path={remixPaths.chrome} size={14} />
              <span>{cards[1].badge}</span>
            </div>
            <ArrowRightIcon aria-hidden="true" size={20} className="shrink-0 text-subtle" />
          </div>
          <div className="mt-10 flex h-[56px] items-center">
            <img src={cards[1].image} alt="" draggable={false} className="h-[56px] w-auto" loading="lazy" />
          </div>
          <h3 className="type-h3 mt-3 text-balance text-white">{cards[1].title}</h3>
          <p className="body-md mt-2 text-pretty text-muted">{cards[1].description}</p>
        </article>
      </div>
    </section>
  );
}
