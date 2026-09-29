import {
  ArrowUpRightIcon,
  ArrowsCounterClockwiseIcon,
  CalculatorIcon,
  CameraIcon,
  ChatCircleIcon,
  CursorIcon,
  GridFourIcon,
  GearIcon,
  EyedropperIcon,
  LockKeyIcon,
  PencilSimpleIcon,
  RulerIcon,
  SelectionAllIcon,
  TextAaIcon,
  TextTIcon,
  ToggleLeftIcon,
} from "@phosphor-icons/react";
import InstallCommand from "../../components/install-command";
import CodeBlock from "../../components/code-block";
import PropList from "../../components/prop-list";
import ShortcutList from "../../components/shortcut-list";
import { getPackageVersion } from "../../utils/get-package-version";

const version = getPackageVersion();
export function Header({
  showDescription,
  linkToHome,
}: {
  showDescription: boolean;
  linkToHome: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {linkToHome ? (
        <a href="/" className="w-fit">
          <img
            draggable={false}
            src="/logo.png"
            alt="Mesurer"
            className="h-auto w-9"
            width={36}
            height={21}
            loading="eager"
          />
        </a>
      ) : (
        <img
          draggable={false}
          src="/logo.png"
          alt="Mesurer"
          className="h-auto w-9"
          width={36}
          height={21}
          loading="eager"
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {linkToHome ? (
          <a href="/" className="text-strong">
            <span className="font-medium leading-tight">Mesurer</span>
          </a>
        ) : (
          <span className="font-medium leading-tight text-strong">Mesurer</span>
        )}
        <a
          href="https://www.npmjs.com/package/mesurer"
          target="_blank"
          rel="noreferrer"
          className="text-muted transition-colors hover:text-strong"
        >
          v{version}
        </a>
        <a
          href="https://github.com/ibelick/mesurer"
          target="_blank"
          rel="noreferrer"
          aria-label="Mesurer on GitHub"
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
      {showDescription && (
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 className="leading-tight text-strong">
            Inspect, annotate, and give feedback on any live interface
          </h2>
          <p className="leading-relaxed text-muted">
            Mesurer runs directly where you build. Share feedback with your
            agents and your team.
          </p>
        </div>
      )}
    </div>
  );
}

export function HomeContent() {
  const features = [
    {
      icon: <ToggleLeftIcon size={16} weight="light" />,
      title: "Toggle on/off",
      description: "Enable the overlay with a single shortcut",
    },
    {
      icon: <CursorIcon size={16} weight="light" />,
      title: "Inspect mode",
      description: "Click elements to measure their bounds",
    },
    {
      icon: <ArrowUpRightIcon size={16} weight="light" />,
      title: "Arrows",
      description: "Draw, move, resize, rotate, and snap arrows",
    },
    {
      icon: <PencilSimpleIcon size={16} weight="light" />,
      title: "Pen",
      description: "Draw freehand annotations and transform them",
    },
    {
      icon: <TextTIcon size={16} weight="light" />,
      title: "Text annotations",
      description: "Add, edit, resize, rotate, and style notes",
    },
    {
      icon: <SelectionAllIcon size={16} weight="light" />,
      title: "Annotation selection",
      description: "Multi-select and manipulate annotations together",
    },
    {
      icon: <ChatCircleIcon size={16} weight="light" />,
      title: "Comments",
      description: "Pin threads to live elements and copy feedback for agents",
    },
    {
      icon: <RulerIcon size={16} weight="light" className="-rotate-90" />,
      title: "Guides mode",
      description: "Add vertical or horizontal guides",
    },
    {
      icon: <RulerIcon size={16} weight="light" />,
      title: "Rulers",
      description: "Show pixel rulers along the top and left edges",
    },
    {
      icon: <CalculatorIcon size={16} weight="light" />,
      title: "Distance overlays",
      description: "Hold Alt for quick spacing checks",
    },
    {
      icon: <ArrowsCounterClockwiseIcon size={16} weight="light" />,
      title: "Undo/redo",
      description: "Command history for guides, measurements, and annotations",
    },
    {
      icon: <LockKeyIcon size={16} weight="light" />,
      title: "Persist state",
      description: "Keep guides, measurements, and annotations on reload",
    },
    {
      icon: <EyedropperIcon size={16} weight="light" />,
      title: "Sample color",
      description: "Sample colors and copy values in your chosen format",
    },
    {
      icon: <CameraIcon size={16} weight="light" />,
      title: "Screenshot",
      description: "Capture a visible-tab region to copy or download",
    },
    {
      icon: <TextAaIcon size={16} weight="light" />,
      title: "Text inspector",
      description: "Inspect typography styles on any element",
    },
    {
      icon: <GridFourIcon size={16} weight="light" />,
      title: "X-ray mode",
      description: "Reveal the structure of every element",
    },
    {
      icon: <GearIcon size={16} weight="light" />,
      title: "Settings",
      description:
        "Configure selection, guides, arrows, text, colors, and persistence",
    },
  ];

  return (
    <>
      <div id="features" className="flex flex-col gap-4">
        <p className="font-[450] text-strong">Features</p>
        <div className="flex flex-col gap-2">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-center gap-1">
              <span className="text-medium text-strong">{feature.icon}</span>
              <p>
                <span className="font-[450] text-strong">{feature.title}</span>{" "}
                <span className="text-muted">- {feature.description}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <p className="font-[450] text-strong">How to use</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[var(--radius)] border border-[#EDEDED] bg-gradient-to-b from-[#FFF] to-[#FCFCFC] p-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-strong">
              <img src="/chrome.svg" alt="" draggable={false} className="h-6 w-6" />
            </div>
            <p className="mt-3 text-[15px] font-medium text-strong">
              Chrome extension
            </p>
            <p className="mt-1 text-[15px] font-normal text-muted">
              Inspect and capture any interface directly in your browser.
            </p>
            <a
              href="https://chromewebstore.google.com/detail/mesurer/icmjafcffhpcnadkmmklegommbcekcac"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-[15px] font-medium text-muted transition-colors hover:text-strong"
            >
              Add to Chrome
            </a>
          </div>
          <div className="rounded-[var(--radius)] border border-[#EDEDED] bg-gradient-to-b from-[#FFF] to-[#FCFCFC] p-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-strong">
              <img src="/npm.svg" alt="" draggable={false} className="h-5 w-5" />
            </div>
            <p className="mt-3 text-[15px] font-medium text-strong">
              npm package
            </p>
            <p className="mt-1 text-[15px] font-normal text-muted">
              Add Mesurer directly to your development environment.
            </p>
            <a
              href="#installation"
              className="mt-3 inline-flex text-[15px] font-medium text-muted transition-colors hover:text-strong"
            >
              Install package
            </a>
          </div>
        </div>
      </div>

      <div id="installation" className="flex flex-col gap-4">
        <p className="font-[450] text-strong">Installation</p>
        <InstallCommand>npm install mesurer</InstallCommand>
        <p>Then render the component alongside your application:</p>
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

      <div className="flex flex-col gap-4">
        <p className="font-[450] text-strong">Props</p>
        <PropList />
      </div>

      <div id="commands" className="flex flex-col gap-4">
        <p className="font-[450] text-strong">Commands</p>
        <ShortcutList />
      </div>
    </>
  );
}
