import InstallCommand from "./components/install-command";
import CodeBlock from "./components/code-block";

export function App() {
  return (
    <main className="min-h-screen px-5 py-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-14">
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <h1 className="font-medium leading-tight text-strong">Mesurer</h1>
            <a
              href="https://github.com/ibelick/mesurer"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="mb-0.5 inline-flex h-4 w-4 items-center justify-center text-muted transition-colors hover:text-strong"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.5 0-.24-.01-1.03-.01-1.87-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.32.1-2.75 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.92c.85 0 1.7.12 2.5.36 1.9-1.33 2.74-1.05 2.74-1.05.55 1.43.2 2.49.1 2.75.64.72 1.02 1.63 1.02 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.95.68 1.93 0 1.4-.01 2.53-.01 2.88 0 .28.18.6.69.5A10.2 10.2 0 0 0 22 12.23C22 6.58 17.52 2 12 2z" />
              </svg>
            </a>
          </div>
          <p className="max-w-xl leading-relaxed text-muted">
            Measure and align anything in your UI directly in the browser.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <p className="font-[450] text-strong">Installation</p>
          <InstallCommand>npm install mesurer</InstallCommand>
          <p>
            Then add the component preference at the root of your application:
          </p>
          <CodeBlock as="pre">{`import Mesurer from "mesurer";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Mesurer />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}`}</CodeBlock>
        </div>

        <div className="flex flex-col gap-4">
          <p className="font-[450] text-strong">Props</p>
          <div className="flex flex-col border-t border-border -mx-2">
            <div className="flex items-start justify-between gap-8 border-b border-border px-2 py-2">
              <div className="font-mono text-strong">
                <code className="code">enabled</code>
              </div>
              <div className="text-muted">Toggles the overlay on and off.</div>
            </div>
            <div className="flex items-start justify-between gap-8 border-b border-border px-2 py-2">
              <div className="font-mono text-strong">
                <code className="code">unit</code>
              </div>
              <div className="text-muted">
                Sets the display unit for measurements.
              </div>
            </div>
            <div className="flex items-start justify-between gap-8 border-b border-border px-2 py-2">
              <div className="font-mono text-strong">
                <code className="code">color</code>
              </div>
              <div className="text-muted">Customizes the overlay tint.</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <p className="font-[450] text-strong">Commands</p>
          <div className="flex flex-col border-t border-border -mx-2">
            <div className="flex items-start justify-between gap-8 border-b border-border px-2 py-2">
              <div className="font-mono text-strong">
                <code className="code">mesurer toggle</code>
              </div>
              <div className="text-muted">
                Show or hide the measurement overlay.
              </div>
            </div>
            <div className="flex items-start justify-between gap-8 border-b border-border px-2 py-2">
              <div className="font-mono text-strong">
                <code className="code">mesurer align</code>
              </div>
              <div className="text-muted">
                Align selected elements to edges or centers.
              </div>
            </div>
            <div className="flex items-start justify-between gap-8 border-b border-border px-2 py-2">
              <div className="font-mono text-strong">
                <code className="code">mesurer snap</code>
              </div>
              <div className="text-muted">
                Snap measurements to the nearest grid step.
              </div>
            </div>
            <div className="flex items-start justify-between gap-8 border-b border-border px-2 py-2">
              <div className="font-mono text-strong">
                <code className="code">mesurer guide</code>
              </div>
              <div className="text-muted">Toggle layout guides and rulers.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
