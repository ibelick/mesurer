import { useState } from "react";
import ToolPage, { Formula, Section, Table, type Faq } from "./layout";
import { NumberField, Output, Panel, useQueryState } from "./ui";

const PRESETS = [
  { ratio: "16:9", width: 1920, height: 1080 },
  { ratio: "4:3", width: 1600, height: 1200 },
  { ratio: "3:2", width: 1080, height: 720 },
  { ratio: "1:1", width: 1080, height: 1080 },
  { ratio: "21:9", width: 2520, height: 1080 },
  { ratio: "9:16", width: 1080, height: 1920 },
  { ratio: "4:5", width: 1080, height: 1350 },
  { ratio: "2:3", width: 1000, height: 1500 },
];

// The ratios a size is likened to when its own does not come out as small numbers.
const NAMED: Array<[number, number]> = [[16, 9], [16, 10], [4, 3], [3, 2], [5, 4], [1, 1], [21, 9], [9, 16], [4, 5], [2, 3], [3, 4], [2, 1], [1.85, 1], [2.39, 1]];

const toNumber = (text: string) => {
  const value = Number(text.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const simplify = (width: number, height: number) => {
  // Sizes with decimals are counted in thousandths, so that 1.5 by 1 is 3:2.
  const [a, b] = [Math.round(width * 1000), Math.round(height * 1000)];
  const divisor = gcd(a, b) || 1;
  return [a / divisor, b / divisor] as const;
};

const trim = (value: number, digits = 2) => String(Number(value.toFixed(digits)));

const closest = (ratio: number) => {
  const [w, h] = NAMED.reduce((best, entry) =>
    Math.abs(entry[0] / entry[1] - ratio) < Math.abs(best[0] / best[1] - ratio) ? entry : best,
  );
  return Math.abs(w / h - ratio) / ratio < 0.02 ? `${w}:${h}` : null;
};

function Calculator() {
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  // The side of the new size that was typed. The other is worked out from it.
  const [target, setTarget] = useState<{ side: "width" | "height"; value: string }>({ side: "width", value: "1280" });
  const [whole, setWhole] = useState(true);

  useQueryState({ w: width, h: height, [target.side === "width" ? "nw" : "nh"]: target.value }, (params) => {
    const [w, h, nw, nh] = ["w", "h", "nw", "nh"].map((key) => params.get(key));
    if (w && toNumber(w)) setWidth(w);
    if (h && toNumber(h)) setHeight(h);
    if (nh && toNumber(nh)) setTarget({ side: "height", value: nh });
    else if (nw && toNumber(nw)) setTarget({ side: "width", value: nw });
  });

  const w = toNumber(width);
  const h = toNumber(height);
  const ratio = w && h ? w / h : null;
  // A ratio that goes by a name keeps it: 2520 × 1080 is 21:9, though it comes down to 7:3.
  const named = ratio ? NAMED.find(([a, b]) => Math.abs(a / b - ratio) < 1e-9) : undefined;
  const [ratioW, ratioH] = named ?? (w && h ? simplify(w, h) : [null, null]);
  const label = ratioW && ratioH ? `${ratioW}:${ratioH}` : "";
  const near = ratio && label && !named ? closest(ratio) : null;

  const typed = toNumber(target.value);
  const solved = ratio && typed ? (target.side === "width" ? typed / ratio : typed * ratio) : null;
  const solvedText = solved ? trim(solved, whole ? 0 : 2) : "";
  const newWidth = target.side === "width" ? target.value : solvedText;
  const newHeight = target.side === "height" ? target.value : solvedText;

  // The preview is drawn as large as fits in a square.
  const box = ratio ? (ratio >= 1 ? { width: "100%", aspectRatio: String(ratio) } : { height: "100%", aspectRatio: String(ratio) }) : null;

  return (
    <Panel className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common aspect ratios">
        {PRESETS.map((preset) => (
          <button
            key={preset.ratio}
            type="button"
            aria-pressed={label === preset.ratio}
            className={`body-sm h-8 rounded-full border px-3 transition-colors ${
              label === preset.ratio ? "border-strong bg-strong text-bg" : "border-border text-strong hover:bg-subtle"
            }`}
            onClick={() => {
              setWidth(String(preset.width));
              setHeight(String(preset.height));
            }}
          >
            {preset.ratio}
          </button>
        ))}
      </div>

      <div className="grid items-center gap-6 sm:grid-cols-[1fr_140px]">
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-2" role="group" aria-label="Original size">
            <NumberField label="Width" min={1} value={width} onValue={setWidth} aria-invalid={!w} />
            <span className="pb-2.5 text-muted" aria-hidden="true">×</span>
            <NumberField label="Height" min={1} value={height} onValue={setHeight} aria-invalid={!h} />
          </div>
          <div className="flex items-end gap-2" role="group" aria-label="New size">
            <NumberField label="New width" min={1} value={newWidth} onValue={(value) => setTarget({ side: "width", value })} />
            <span className="pb-2.5 text-muted" aria-hidden="true">×</span>
            <NumberField label="New height" min={1} value={newHeight} onValue={(value) => setTarget({ side: "height", value })} />
          </div>
          <label className="body-sm flex w-fit items-center gap-2 text-muted">
            <input type="checkbox" checked={whole} onChange={(event) => setWhole(event.target.checked)} className="accent-strong" />
            Whole pixels
          </label>
        </div>

        <div className="hidden aspect-square w-full items-center justify-center sm:flex" aria-hidden="true">
          {box ? <div className="max-h-full max-w-full rounded-[3px] border border-strong bg-subtle" style={box} /> : null}
        </div>
      </div>

      {ratio && label ? (
        <div className="flex flex-col">
          <Output label={near ? `≈ ${near}` : "Ratio"} value={label} />
          <Output label="CSS" value={`aspect-ratio: ${ratioW} / ${ratioH};`} />
        </div>
      ) : (
        <p className="m-0 border-t border-border pt-3 text-muted" role="status">Enter a width and a height.</p>
      )}
    </Panel>
  );
}

const faq: Faq[] = [
  {
    question: "How do I calculate an aspect ratio?",
    answer: "Divide the width and the height by their greatest common divisor. 1920 × 1080 divided by 120 is 16:9.",
  },
  {
    question: "How do I resize without stretching?",
    answer: "Keep the ratio. New height = new width × height ÷ width, so 1920 × 1080 at 1280 wide is 720 high.",
  },
  {
    question: "What is the aspect ratio of 1920 × 1080?",
    answer: "16:9, the same as 1280 × 720, 2560 × 1440, and 3840 × 2160.",
  },
  {
    question: "Why do I get a ratio like 683:384?",
    answer: "Some sizes do not reduce to small numbers. 1366 × 768 is exactly 683:384, which is close to 16:9 but not equal to it.",
  },
];

export default function AspectRatioCalculator() {
  return (
    <ToolPage
      slug="aspect-ratio-calculator"
      name="Aspect ratio calculator"
      title="Aspect Ratio Calculator | Mesurer"
      description="Find the aspect ratio of any width and height, then resize to a new size without stretching. Free, with the CSS to copy."
      heading="Aspect ratio calculator"
      intro="Get the ratio of any size, and resize it without stretching."
      tool={<Calculator />}
      faq={faq}
      cta="Read the real width and height of anything on a live page."
    >
      <Section title="Formula">
        <Formula>{`ratio      = (width ÷ gcd) : (height ÷ gcd)
new height = new width × height ÷ width
new width  = new height × width ÷ height`}</Formula>
      </Section>

      <Section title="Common aspect ratios">
        <Table
          head={["Ratio", "Sizes", "Used for"]}
          rows={[
            ["16:9", "1280 × 720, 1920 × 1080, 3840 × 2160", "Video, YouTube, monitors"],
            ["16:10", "1280 × 800, 1920 × 1200", "Laptops"],
            ["4:3", "1024 × 768, 1600 × 1200", "Tablets, slides"],
            ["3:2", "1080 × 720, 2160 × 1440", "Photos"],
            ["1:1", "1080 × 1080", "Square posts, avatars"],
            ["4:5", "1080 × 1350", "Instagram portrait"],
            ["9:16", "1080 × 1920", "Reels, Shorts, TikTok"],
            ["21:9", "2560 × 1080, 3440 × 1440", "Ultrawide"],
          ]}
        />
      </Section>
    </ToolPage>
  );
}
