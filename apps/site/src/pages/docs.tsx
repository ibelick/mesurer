import type { ReactNode } from "react";
import CodeBlock from "../components/code-block";
import InstallCommand from "../components/install-command";
import PropList from "../components/prop-list";
import ShortcutList from "../components/shortcut-list";
import MarketingFooter from "./marketing/footer";

const chromeStoreUrl =
  "https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac";

const docsNav = [
  { href: "/docs", label: "Getting started" },
  { href: "/docs/props", label: "Props" },
  { href: "/docs/shortcuts", label: "Shortcuts" },
] as const;

function DocsNav({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap gap-x-5 gap-y-2 md:flex-col md:gap-2" aria-label="Documentation">
      {docsNav.map((item) => {
        const isCurrent = item.href === current;
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            className={
              isCurrent
                ? "text-strong"
                : "text-muted transition-colors hover:text-strong"
            }
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}

function GettingStarted() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <img src="/chrome.svg" alt="" draggable={false} className="size-5" />
          <h2 className="font-[450] text-strong">Chrome extension</h2>
        </div>
        <p className="text-pretty text-muted">Inspect and capture any interface directly in your browser.</p>
        <a
          href={chromeStoreUrl}
          target="_blank"
          rel="noreferrer"
          className="w-fit text-muted transition-colors hover:text-strong"
        >
          Add to Chrome
        </a>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <img src="/npm.svg" alt="" draggable={false} className="size-5" />
          <h2 className="font-[450] text-strong">npm package</h2>
        </div>
        <p className="text-pretty text-muted">Add Mesurer to your development environment.</p>
        <InstallCommand>npm install mesurer</InstallCommand>
        <p className="text-pretty text-muted">Then render the component alongside your application:</p>
        <CodeBlock as="pre">{`import { Mesurer } from "mesurer";

function App() {
  return (
    <>
      <YourApp />
      <Mesurer />
    </>
  );
}`}</CodeBlock>
      </div>
    </div>
  );
}

function DocsLayout({
  title,
  current,
  children,
}: {
  title: string;
  current: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh pb-0 pt-20">
      <title>{`${title} | Mesurer`}</title>
      <div className="mx-auto max-w-5xl px-5 pb-40">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:gap-16">
          <aside className="md:sticky md:top-20 md:w-44 md:shrink-0">
            <div className="flex flex-col gap-8">
              <a href="/" aria-label="Mesurer home" className="inline-flex w-fit transition-opacity hover:opacity-70">
                <img src="/logo.svg" alt="" draggable={false} className="size-6" />
              </a>
              <DocsNav current={current} />
            </div>
          </aside>
          <article className="min-w-0 max-w-2xl flex-1" aria-labelledby="doc-title">
            <h1 id="doc-title" className="font-[450] text-strong">
              {title}
            </h1>
            <div className="mt-8">{children}</div>
          </article>
        </div>
      </div>
      <MarketingFooter />
    </main>
  );
}

export default function DocsPage() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const page =
    path === "/docs/props"
      ? { href: "/docs/props", title: "Props", children: <PropList /> }
      : path === "/docs/shortcuts"
        ? { href: "/docs/shortcuts", title: "Shortcuts", children: <ShortcutList /> }
        : { href: "/docs", title: "Getting started", children: <GettingStarted /> };

  return (
    <DocsLayout title={page.title} current={page.href}>
      {page.children}
    </DocsLayout>
  );
}
