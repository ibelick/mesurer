import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  clamp,
  cmykToRgb,
  contrast,
  formatCmyk,
  formatHsl,
  formatHsv,
  formatRgb,
  hslToHsv,
  hsvToHsl,
  hsvToRgb,
  numbersIn,
  parseHex,
  parseRgb,
  rgbToCmyk,
  rgbToHex,
  rgbToHsv,
  type Hsv,
  type Rgb,
} from "./color";
import ToolPage, { Section, Table, type Faq } from "./layout";
import { CopyButton, CopyCode, inputClassName, Panel, useQueryState } from "./ui";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

// A code that can be typed over: while it is being typed it is left as it is, and it sets the
// colour as soon as it reads as one.
function CodeField({ label, value, onCommit }: { label: string; value: string; onCommit: (text: string) => boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="body-sm text-muted">{label}</label>
      {/* The button to copy the code is inside the field, at its end. */}
      <div className="relative">
        <input
          id={id}
          value={draft ?? value}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid}
          className={`${inputClassName} pr-16`}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(!onCommit(event.target.value));
          }}
          onBlur={() => {
            setDraft(null);
            setInvalid(false);
          }}
        />
        <CopyButton value={value} inset />
      </div>
    </div>
  );
}

type EyeDropperWindow = Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };

function Picker() {
  // Kept as hue, saturation and value: grey has no hue and black no saturation, and reading
  // them back from the colour would throw the sliders to one end as they pass through.
  const [hsv, setHsv] = useState<Hsv>({ h: 217, s: 73, v: 96 });
  const [canSample, setCanSample] = useState(false);
  const areaRef = useRef<HTMLDivElement | null>(null);

  const rgb = hsvToRgb(hsv);
  const hex = rgbToHex(rgb);
  const hsl = hsvToHsl(hsv);

  const setRgb = (next: Rgb) => {
    const read = rgbToHsv(next);
    setHsv((previous) => ({ h: read.s === 0 ? previous.h : read.h, s: read.v === 0 ? previous.s : read.s, v: read.v }));
    return true;
  };
  const setHex = (text: string) => {
    const read = parseHex(text);
    return read ? setRgb(read.rgb) : false;
  };

  // Not while the page is being built: it is built in a browser that can sample the screen,
  // and would be handed with the button to browsers that cannot.
  useEffect(() => setCanSample("EyeDropper" in window && !window.__MESURER_PRERENDER__), []);
  useQueryState({ color: hex.slice(1).toLowerCase() }, (params) => {
    setHex(params.get("color") ?? "");
  });

  const moveTo = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = areaRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setHsv((previous) => ({
      h: previous.h,
      s: clamp((event.clientX - bounds.left) / bounds.width, 0, 1) * 100,
      v: (1 - clamp((event.clientY - bounds.top) / bounds.height, 0, 1)) * 100,
    }));
  };

  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const by = move[event.key];
    if (!by) return;
    event.preventDefault();
    setHsv((previous) => ({ h: previous.h, s: clamp(previous.s + by[0], 0, 100), v: clamp(previous.v + by[1], 0, 100) }));
  };

  const percents = (text: string, count: number) => {
    const values = numbersIn(text).map((part) => part.value);
    return values.length === count && values.slice(count === 4 ? 0 : 1).every((value) => value >= 0 && value <= 100) ? values : null;
  };

  const onWhite = contrast(rgb, WHITE);
  const onBlack = contrast(rgb, BLACK);
  const grade = (ratio: number) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "Fail");
  // The same hue and saturation, from dark to light.
  const shades = [10, 20, 30, 40, 50, 60, 70, 80, 90].map((l) => rgbToHex(hsvToRgb(hslToHsv({ h: hsl.h, s: hsl.s, l }))));

  return (
    <Panel className="grid gap-5 sm:grid-cols-2">
      <div className="flex flex-col gap-4">
        <div
          ref={areaRef}
          role="slider"
          tabIndex={0}
          aria-label="Saturation and brightness"
          aria-valuetext={`Saturation ${Math.round(hsv.s)}%, brightness ${Math.round(hsv.v)}%`}
          aria-valuenow={Math.round(hsv.s)}
          className="relative aspect-[4/3] w-full cursor-crosshair touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-strong focus-visible:ring-offset-2"
          style={{
            backgroundColor: `hsl(${hsv.h} 100% 50%)`,
            backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            moveTo(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event);
          }}
          onKeyDown={nudge}
        >
          <span
            className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_#454545,0_1px_3px_#454545]"
            style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: hex }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={Math.round(hsv.h)}
          aria-label="Hue"
          className="tool-hue"
          onChange={(event) => setHsv((previous) => ({ ...previous, h: Number(event.target.value) }))}
        />
        {canSample ? (
          <button
            type="button"
            className="body-sm h-9 w-fit rounded-full border border-border px-3.5 text-strong transition-colors hover:bg-subtle"
            onClick={() => {
              const Sampler = (window as EyeDropperWindow).EyeDropper;
              if (!Sampler) return;
              // Leaving the sampler without picking is not an error.
              void new Sampler().open().then((result) => setHex(result.sRGBHex)).catch(() => undefined);
            }}
          >
            Pick from screen
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <CodeField label="HEX" value={hex} onCommit={setHex} />
        <CodeField
          label="RGB"
          value={formatRgb(rgb)}
          onCommit={(text) => {
            const read = parseRgb(text);
            return read ? setRgb(read.rgb) : false;
          }}
        />
        <CodeField
          label="HSL"
          value={formatHsl(hsl)}
          onCommit={(text) => {
            const values = percents(text, 3);
            if (!values) return false;
            setHsv(hslToHsv({ h: clamp(values[0], 0, 360), s: values[1], l: values[2] }));
            return true;
          }}
        />
        <CodeField
          label="HSV"
          value={formatHsv(hsv)}
          onCommit={(text) => {
            const values = percents(text, 3);
            if (!values) return false;
            setHsv({ h: clamp(values[0], 0, 360), s: values[1], v: values[2] });
            return true;
          }}
        />
        <CodeField
          label="CMYK"
          value={formatCmyk(rgbToCmyk(rgb))}
          onCommit={(text) => {
            const values = percents(text, 4);
            return values ? setRgb(cmykToRgb({ c: values[0], m: values[1], y: values[2], k: values[3] })) : false;
          }}
        />
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <div className="flex overflow-hidden rounded-lg border border-border-strong" role="group" aria-label="Shades">
          {shades.map((shade) => (
            <button
              key={shade}
              type="button"
              aria-label={`Use ${shade}`}
              title={shade}
              className="h-8 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
              style={{ backgroundColor: shade }}
              onClick={() => setHex(shade)}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        {[
          { name: "White text", text: "#FFFFFF", ratio: onWhite },
          { name: "Black text", text: "#000000", ratio: onBlack },
        ].map(({ name, text, ratio }) => (
          <div key={name} className="flex items-center justify-between gap-3 rounded-lg border border-border-strong px-3 py-2" style={{ backgroundColor: hex, color: text }}>
            <span>{name}</span>
            <span className="body-sm">
              {ratio.toFixed(2)}:1 · {grade(ratio)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const faq: Faq[] = [
  {
    question: "Is this the Google color picker?",
    answer: "No, it is Mesurer's own. It does the same job as the one in Google search, and adds picking from the screen, shades, and contrast.",
  },
  {
    question: "How do I pick a color from an image or a website?",
    answer: "Press \"Pick from screen\" and click any pixel. It works in Chrome, Edge, and other Chromium browsers.",
  },
  {
    question: "Can I type a color code?",
    answer: "Yes. Type or paste into any field, such as #FF5733 or rgb(255, 87, 51), and the others follow.",
  },
  {
    question: "What do the contrast numbers mean?",
    answer: "They are WCAG contrast ratios against white and black text. 4.5:1 passes AA, 3:1 passes AA for large text, and 7:1 passes AAA.",
  },
];

export default function ColorPickerTool() {
  return (
    <ToolPage
      slug="color-picker"
      name="Color picker"
      title="Color Picker: HEX, RGB, HSL, CMYK | Mesurer"
      description="Pick a color or sample one from your screen, and copy it as HEX, RGB, HSL, HSV, or CMYK. A free alternative to the Google color picker."
      heading="Color picker"
      intro="Pick a color, or sample one from your screen, and copy its code."
      tool={<Picker />}
      faq={faq}
      cta="Sample the color of any pixel on a live page, with its fonts and spacing."
    >
      <Section title="Color formats">
        <Table
          head={["Format", "Example", "Used in"]}
          rows={[
            ["HEX", <CopyCode>#4285F4</CopyCode>, "CSS, design tools"],
            ["RGB", <CopyCode>rgb(66, 133, 244)</CopyCode>, "CSS, screens"],
            ["HSL", <CopyCode>hsl(217, 89%, 61%)</CopyCode>, "CSS, color scales"],
            ["HSV", <CopyCode>hsv(217, 73%, 96%)</CopyCode>, "Design software"],
            ["CMYK", <CopyCode>cmyk(73%, 45%, 0%, 4%)</CopyCode>, "Print"],
          ]}
        />
      </Section>
    </ToolPage>
  );
}
