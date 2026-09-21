const feedbackUrl = "https://github.com/ibelick/mesurer/issues/new?title=Feedback&body=**What%20happened%3F**%0A%0A%0A**What%20would%20help%3F**%0A%0A%0A**Context**%20%28browser%2C%20URL%29%0A";

const linkClassName = "text-sm text-muted transition-colors hover:text-strong";

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={linkClassName}
    >
      {children}
    </a>
  );
}

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative left-1/2 mt-12 mb-12 w-screen -translate-x-1/2 px-5 pb-8 pt-8" aria-label="Site footer">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col items-start gap-3">
            <a href="#overview" className="inline-flex w-fit items-center gap-2 text-base font-medium text-strong transition-opacity hover:opacity-70">
              <img src="/logo.svg" alt="" className="size-6" />
              <span>Mesurer</span>
            </a>
            <span className="text-sm text-muted">© {currentYear}</span>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-6" aria-label="Footer navigation">
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-1 text-sm font-medium text-strong">Product</h2>
            <FooterLink href="#overview">Overview</FooterLink>
            <FooterLink href="/changelog">Changelog</FooterLink>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-1 text-sm font-medium text-strong">Developers</h2>
            <FooterLink href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac" external>Chrome Extension</FooterLink>
            <FooterLink href="https://www.npmjs.com/package/mesurer" external>npm</FooterLink>
            <FooterLink href="https://github.com/ibelick/mesurer" external>GitHub</FooterLink>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-1 text-sm font-medium text-strong">Resources</h2>
            <FooterLink href="#installation">Getting started</FooterLink>
            <FooterLink href="#commands">Shortcuts</FooterLink>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-1 text-sm font-medium text-strong">Connect</h2>
            <FooterLink href={feedbackUrl} external>Feedback</FooterLink>
            <FooterLink href="https://x.com/mesurerdev" external>X (Twitter)</FooterLink>
            <FooterLink href="https://github.com/ibelick/mesurer" external>GitHub</FooterLink>
          </div>
          <div className="flex flex-col items-start gap-2">
            <h2 className="mb-1 text-sm font-medium text-strong">Legal</h2>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </div>
          </nav>
        </div>
      </div>
    </footer>
  );
}
