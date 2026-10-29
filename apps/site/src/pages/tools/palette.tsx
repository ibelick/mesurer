import { useEffect, useRef, useState } from "react";
import { contrast, hslToHsv, hsvToRgb, parseHex, rgbToHex } from "./color";
import ToolPage, { Section, Table, type Faq } from "./layout";
import { CopyButton, Panel, useQueryState } from "./ui";

type Swatch = { hex: string; locked: boolean };

// The palette the page is first drawn with, before one is made at random.
const FIRST = ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51"];

const between = (min: number, max: number) => min + Math.random() * (max - min);
const hsl = (h: number, s: number, l: number) => rgbToHex(hsvToRgb(hslToHsv({ h: ((h % 360) + 360) % 360, s, l })));

// The ways five colours are made to go together, each from one hue picked at random.
const SCHEMES: Array<(hue: number) => string[]> = [
  // Neighbours on the color wheel.
  (hue) => [-40, -20, 0, 20, 40].map((turn, at) => hsl(hue + turn, between(45, 80), 28 + at * 13)),
  // One hue, from dark to light.
  (hue) => [18, 34, 50, 68, 86].map((l) => hsl(hue + between(-6, 6), between(35, 75), l)),
  // A hue and its opposite.
  (hue) => [0, 0, 0, 180, 180].map((turn, at) => hsl(hue + turn + between(-8, 8), between(45, 85), [25, 45, 85, 60, 40][at])),
  // Three hues evenly apart.
  (hue) => [0, 0, 120, 120, 240].map((turn, at) => hsl(hue + turn + between(-8, 8), between(45, 80), [30, 70, 50, 85, 45][at])),
  // A hue with the two beside its opposite.
  (hue) => [0, 0, 150, 210, 210].map((turn, at) => hsl(hue + turn, between(40, 80), [22, 55, 88, 65, 40][at])),
];

const generate = () => SCHEMES[Math.floor(Math.random() * SCHEMES.length)](Math.random() * 360);

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };
// Whichever of white and black reads better on a colour.
const inkOn = (hex: string) => {
  const rgb = parseHex(hex)?.rgb ?? BLACK;
  return contrast(rgb, WHITE) >= contrast(rgb, BLACK) ? "#FFFFFF" : "#000000";
};

function Generator() {
  const [swatches, setSwatches] = useState<Swatch[]>(FIRST.map((hex) => ({ hex, locked: false })));
  const [copied, setCopied] = useState<number | null>(null);
  const shared = useRef(false);

  const roll = () => {
    const next = generate();
    setSwatches((previous) => previous.map((swatch, at) => (swatch.locked ? swatch : { ...swatch, hex: next[at] })));
  };

  useQueryState({ colors: swatches.map((swatch) => swatch.hex.slice(1).toLowerCase()).join("-") }, (params) => {
    const colors = (params.get("colors") ?? "").split("-").map((part) => parseHex(part));
    if (colors.length !== FIRST.length || colors.some((color) => !color)) return;
    shared.current = true;
    setSwatches(colors.map((color) => ({ hex: rgbToHex(color!.rgb), locked: false })));
  });

  // A palette is made at random when the page is opened, unless the link came with one.
  useEffect(() => {
    if (!shared.current && !window.__MESURER_PRERENDER__) roll();
    // Space makes another, wherever the keyboard is, except in a field or on a button.
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || (event.target as Element).closest("input, textarea, button, a, summary")) return;
      event.preventDefault();
      roll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (copied === null) return;
    const timer = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const css = `:root {\n${swatches.map((swatch, at) => `  --color-${at + 1}: ${swatch.hex};`).join("\n")}\n}`;

  return (
    <Panel className="flex flex-col gap-5">
      <div className="flex h-56 overflow-hidden rounded-lg border border-border-strong max-sm:h-80 max-sm:flex-col">
        {swatches.map((swatch, at) => (
          <div key={at} className="group relative flex min-h-0 min-w-0 flex-1" style={{ backgroundColor: swatch.hex, color: inkOn(swatch.hex) }}>
            <button
              type="button"
              aria-label={`Copy ${swatch.hex}`}
              className="body-sm flex flex-1 cursor-pointer items-end justify-center pb-4 outline-none focus-visible:underline max-sm:items-center max-sm:pb-0"
              onClick={() => {
                void navigator.clipboard?.writeText(swatch.hex).then(() => setCopied(at));
              }}
            >
              <span aria-live="polite">{copied === at ? "Copied" : swatch.hex}</span>
            </button>
            <button
              type="button"
              aria-pressed={swatch.locked}
              className={`body-sm absolute top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-1 outline-none transition-opacity focus-visible:opacity-100 focus-visible:underline group-hover:opacity-100 max-sm:left-auto max-sm:right-2 max-sm:top-1/2 max-sm:-translate-y-1/2 max-sm:translate-x-0 ${
                swatch.locked ? "opacity-100" : "opacity-0 max-sm:opacity-60 [@media(hover:none)]:opacity-60"
              }`}
              onClick={() => setSwatches((previous) => previous.map((entry, index) => (index === at ? { ...entry, locked: !entry.locked } : entry)))}
            >
              {swatch.locked ? "Locked" : "Lock"}
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="body-sm-emphasis h-9 rounded-full bg-strong px-4 text-bg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
          onClick={roll}
        >
          Generate
        </button>
        <span className="body-sm text-muted max-sm:hidden">or press Space</span>
        <span className="ml-auto flex gap-2">
          <CopyButton value={swatches.map((swatch) => swatch.hex).join(", ")} label="Copy HEX" />
          <CopyButton value={css} label="Copy CSS" />
        </span>
      </div>
    </Panel>
  );
}

const faq: Faq[] = [
  {
    question: "How do I generate a color palette?",
    answer: "Press Generate, or the space bar. Each press gives five new colors that go together.",
  },
  {
    question: "How do I keep a color I like?",
    answer: "Lock it. Locked colors stay while the others change.",
  },
  {
    question: "Are the palettes really random?",
    answer: "The starting hue is random. The other colors follow from it by a color harmony, so that the five work together.",
  },
  {
    question: "How do I share or save a palette?",
    answer: "Copy the address of the page: it holds the five colors. You can also copy them as HEX codes or CSS variables.",
  },
];

export default function PaletteGenerator() {
  return (
    <ToolPage
      slug="random-color-palette-generator"
      name="Color palette generator"
      title="Random Color Palette Generator | Mesurer"
      description="Generate random color palettes of five colors that go together. Lock the ones you like, and copy the HEX codes or CSS. Free."
      heading="Random color palette generator"
      intro="Press Space for five colors that go together. Lock the ones you like."
      tool={<Generator />}
      faq={faq}
      cta="Sample the colors of any live page, and check them where they are used."
    >
      <Section title="Color harmonies">
        <Table
          head={["Harmony", "How it is made"]}
          rows={[
            ["Analogous", "Hues next to each other on the color wheel"],
            ["Monochrome", "One hue, from dark to light"],
            ["Complementary", "A hue and its opposite"],
            ["Triadic", "Three hues evenly apart"],
            ["Split complementary", "A hue and the two beside its opposite"],
          ]}
        />
      </Section>
    </ToolPage>
  );
}
