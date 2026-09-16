import { Mesurer } from "mesurer";
import { XLogoIcon } from "@phosphor-icons/react";
import { Header, HomeContent } from "./marketing/site";

export default function OldPage() {
  return (
    <main className="min-h-screen px-5 py-20">
      <Mesurer initialState={{ minimized: true }} />
      <div className="mx-auto flex max-w-2xl flex-col gap-14">
        <Header showDescription linkToHome={false} />
        <HomeContent />
        <div className="flex gap-4 pt-6 text-muted">
          <a href="/changelog" className="transition-colors hover:text-strong">Changelog</a>
          <a
            href="https://github.com/ibelick/mesurer/issues/new?title=Feedback&body=**What%20happened%3F**%0A%0A%0A**What%20would%20help%3F**%0A%0A%0A**Context**%20%28browser%2C%20URL%29%0A"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-strong"
          >
            Feedback
          </a>
          <a
            href="https://x.com/mesurerdev"
            target="_blank"
            rel="noreferrer"
            aria-label="Follow Mesurer on X"
            className="inline-flex items-center gap-1 transition-colors hover:text-strong"
          >
            <XLogoIcon size={14} weight="regular" aria-hidden="true" />
            <span>Follow</span>
          </a>
          <a href="/privacy" className="transition-colors hover:text-strong">Privacy</a>
        </div>
      </div>
    </main>
  );
}
