import { useState, type ClipboardEvent } from "react";
import {
  COMMON_COLORS,
  formatHsl,
  formatRgb,
  parseHex,
  parseRgb,
  rgbToHex,
  rgbToHsl,
  type Rgb,
} from "./color";
import ToolPage, { Formula, Section, Table, type Faq } from "./layout";
import { CopyCode, Field, NumberField, Output, Panel, useQueryState } from "./ui";

// The colour as it looks, at the end of the fields. Pressing it opens the browser's own color
// picker, for choosing a colour rather than typing one.
function Swatch({ color, value, onPick }: { color: string | null; value: Rgb | null; onPick: (hex: string) => void }) {
  return (
    <label
      className="relative block size-10 shrink-0 cursor-pointer rounded-md border border-border-strong transition-shadow hover:shadow-[0_0_0_3px_var(--color-subtle)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-strong"
      title="Pick a color"
      // A see-through colour is shown over a chequerboard.
      style={{
        backgroundImage: color
          ? `linear-gradient(${color}, ${color}), repeating-conic-gradient(#E5E5E5 0 25%, #fff 0 50%)`
          : "repeating-linear-gradient(45deg, #FAFAFA 0 4px, #fff 4px 8px)",
        backgroundSize: "auto, 10px 10px",
      }}
    >
      <span className="sr-only">Pick a color</span>
      <input
        type="color"
        value={value ? rgbToHex(value).toLowerCase() : "#000000"}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        onChange={(event) => onPick(event.target.value)}
      />
    </label>
  );
}

const colorTable = (from: "rgb" | "hex") => (
  <Table
    head={from === "rgb" ? ["Color", "RGB", "HEX"] : ["Color", "HEX", "RGB"]}
    rows={COMMON_COLORS.map(({ name, hex }) => {
      const rgb = formatRgb(parseHex(hex)!.rgb);
      const cells = [<CopyCode>{hex}</CopyCode>, <CopyCode>{rgb}</CopyCode>];
      return [
        <span className="flex items-center gap-2">
          <span className="size-4 shrink-0 rounded-full border border-border-strong" style={{ backgroundColor: hex }} aria-hidden="true" />
          {name}
        </span>,
        ...(from === "rgb" ? cells.reverse() : cells),
      ];
    })}
  />
);

const CHANNELS = [
  { key: "r", label: "Red" },
  { key: "g", label: "Green" },
  { key: "b", label: "Blue" },
] as const;

function RgbToHexConverter() {
  const [channels, setChannels] = useState({ r: "66", g: "133", b: "244" });
  const [alpha, setAlpha] = useState("");

  const read = (text: string) => {
    const value = Number(text);
    return text.trim() !== "" && Number.isFinite(value) && value >= 0 && value <= 255 ? Math.round(value) : null;
  };
  const [r, g, b] = [read(channels.r), read(channels.g), read(channels.b)];
  const rgb: Rgb | null = r !== null && g !== null && b !== null ? { r, g, b } : null;
  const opacity = alpha.trim() === "" ? 1 : Number(alpha.replace(",", "."));
  const alphaValid = Number.isFinite(opacity) && opacity >= 0 && opacity <= 1;
  const hex = rgb && alphaValid ? rgbToHex(rgb, opacity) : null;

  const fill = (value: { rgb: Rgb; alpha: number }) => {
    setChannels({ r: String(value.rgb.r), g: String(value.rgb.g), b: String(value.rgb.b) });
    setAlpha(value.alpha < 1 ? String(value.alpha) : "");
  };
  // A whole colour pasted into one field, such as rgb(255, 87, 51), fills them all.
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = parseRgb(event.clipboardData.getData("text"));
    if (!pasted) return;
    event.preventDefault();
    fill(pasted);
  };

  useQueryState({ r: channels.r, g: channels.g, b: channels.b, ...(alpha ? { a: alpha } : null) }, (params) => {
    const pasted = parseRgb(["r", "g", "b", "a"].map((key) => params.get(key)).filter(Boolean).join(","));
    if (pasted) fill(pasted);
  });

  return (
    <Panel className="flex flex-col gap-5">
      <div className="flex items-end gap-2">
        {CHANNELS.map(({ key, label }) => (
          <NumberField
            key={key}
            label={label}
            max={255}
            value={channels[key]}
            aria-invalid={read(channels[key]) === null}
            onPaste={onPaste}
            onValue={(value) => setChannels((previous) => ({ ...previous, [key]: value }))}
          />
        ))}
        <NumberField label="Alpha" max={1} step={0.01} placeholder="1" value={alpha} aria-invalid={!alphaValid} onValue={setAlpha} />
        <Swatch
          color={hex}
          value={rgb}
          onPick={(picked) => {
            const read = parseHex(picked);
            // The alpha is left as it is: the picker only knows solid colours.
            if (read) setChannels({ r: String(read.rgb.r), g: String(read.rgb.g), b: String(read.rgb.b) });
          }}
        />
      </div>
      {hex && rgb ? (
        <div className="flex flex-col">
          <Output label="HEX" value={hex} />
          <Output label="RGB" value={formatRgb(rgb, opacity)} />
          <Output label="HSL" value={formatHsl(rgbToHsl(rgb), opacity)} />
        </div>
      ) : (
        <p className="m-0 border-t border-border pt-3 text-muted" role="status">Red, green, and blue go from 0 to 255. Alpha goes from 0 to 1.</p>
      )}
    </Panel>
  );
}

const rgbToHexFaq: Faq[] = [
  {
    question: "How do I convert RGB to HEX?",
    answer: "Write red, green, and blue in base 16, two digits each, after a #. rgb(66, 133, 244) is 42, 85, and F4: #4285F4.",
  },
  {
    question: "How do I convert RGBA to HEX?",
    answer: "Add the alpha as a fourth pair: multiply it by 255 and write it in base 16. rgba(66, 133, 244, 0.5) is #4285F480.",
  },
  {
    question: "Are HEX codes case sensitive?",
    answer: "No. #4285F4 and #4285f4 are the same color.",
  },
  {
    question: "Can I paste an rgb() value?",
    answer: "Yes. Paste rgb(255, 87, 51) or rgba(255, 87, 51, 0.5) into any field and it fills them all.",
  },
];

export function RgbToHex() {
  return (
    <ToolPage
      slug="rgb-to-hex"
      name="RGB to HEX"
      title="RGB to HEX Converter | Mesurer"
      description="Convert RGB or RGBA to a HEX color code. Type the values or paste rgb(), and copy the result. Free."
      heading="RGB to HEX converter"
      intro="Type red, green, and blue, or paste rgb(), and copy the HEX code."
      tool={<RgbToHexConverter />}
      faq={rgbToHexFaq}
      cta="Copy the color of any element on a live page, as HEX or RGB."
    >
      <Section title="How it works">
        <Formula>{`rgb(66, 133, 244)
 66 ÷ 16 =  4 remainder 2  → 42
133 ÷ 16 =  8 remainder 5  → 85
244 ÷ 16 = 15 remainder 4  → F4
                           = #4285F4`}</Formula>
      </Section>

      <Section title="RGB to HEX chart">{colorTable("rgb")}</Section>
    </ToolPage>
  );
}

function HexToRgbConverter() {
  const [text, setText] = useState("#4285F4");
  const parsed = parseHex(text);

  useQueryState({ hex: text.trim().replace(/^#/, "") }, (params) => {
    const value = params.get("hex");
    if (value && parseHex(value)) setText(`#${value.replace(/^#/, "")}`);
  });

  const rgb = parsed?.rgb;
  const alpha = parsed?.alpha ?? 1;

  return (
    <Panel className="flex flex-col gap-5">
      <div className="flex items-end gap-2">
        <Field
          label="HEX"
          value={text}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          placeholder="#4285F4"
          aria-invalid={!parsed}
          onChange={(event) => setText(event.target.value)}
        />
        <Swatch color={rgb ? formatRgb(rgb, alpha) : null} value={rgb ?? null} onPick={(picked) => setText(picked.toUpperCase())} />
      </div>
      {rgb ? (
        <div className="flex flex-col">
          <Output label={alpha < 1 ? "RGBA" : "RGB"} value={formatRgb(rgb, alpha)} />
          <Output label="Values" value={`${rgb.r}, ${rgb.g}, ${rgb.b}`} />
          <Output label="HSL" value={formatHsl(rgbToHsl(rgb), alpha)} />
        </div>
      ) : (
        <p className="m-0 border-t border-border pt-3 text-muted" role="status">Use 3, 4, 6, or 8 characters from 0 to 9 and A to F.</p>
      )}
    </Panel>
  );
}

const hexToRgbFaq: Faq[] = [
  {
    question: "How do I convert HEX to RGB?",
    answer: "Split the code into three pairs and read each in base 16. #4285F4 is 42, 85, and F4: rgb(66, 133, 244).",
  },
  {
    question: "How do I read a three-digit HEX code?",
    answer: "Double each digit. #F60 is #FF6600, which is rgb(255, 102, 0).",
  },
  {
    question: "What is an eight-digit HEX code?",
    answer: "The last pair is the alpha, from 00 (invisible) to FF (solid). #4285F480 is rgba(66, 133, 244, 0.5).",
  },
  {
    question: "Should I use HEX or RGB in CSS?",
    answer: "Either. They give the same color in every browser. HEX is shorter, and RGB is easier to adjust in code.",
  },
];

export function HexToRgb() {
  return (
    <ToolPage
      slug="hex-to-rgb"
      name="HEX to RGB"
      title="HEX to RGB Converter | Mesurer"
      description="Convert a HEX color code to RGB or RGBA and copy the result. Works with 3, 4, 6, and 8 digit codes. Free."
      heading="HEX to RGB converter"
      intro="Paste a HEX code and copy its RGB values."
      tool={<HexToRgbConverter />}
      faq={hexToRgbFaq}
      cta="Copy the color of any element on a live page, as HEX or RGB."
    >
      <Section title="How it works">
        <Formula>{`#4285F4
42 →  4 × 16 + 2  = 66
85 →  8 × 16 + 5  = 133
F4 → 15 × 16 + 4  = 244
                  = rgb(66, 133, 244)`}</Formula>
      </Section>

      <Section title="HEX to RGB chart">{colorTable("hex")}</Section>
    </ToolPage>
  );
}
