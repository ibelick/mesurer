import { useEffect, useRef, useState, type DragEvent } from "react";
import ToolPage, { Section, type Faq } from "./layout";
import { traceToSvg } from "./trace";
import { Panel } from "./ui";

type Kind = "webp" | "svg" | "png" | "jpg" | "jpeg" | "heic" | "avif" | "image";
type Output = "png" | "jpg" | "svg";

type Item = {
  id: number;
  file: File;
  // The image, once it is made. `null` while it is being made, and `false` when it could not be.
  result: { url: string; width: number; height: number; size: number } | null | false;
};

const SCALES = [1, 2, 3, 4];
const COLORS = [2, 4, 8, 16];
// A picture is traced at no more than this many pixels a side: beyond it the tracing is slow
// and the SVG no better.
const TRACED_SIDE = 800;
// Past this a browser will not draw: its canvas has a largest side.
const LARGEST_SIDE = 16384;

const KINDS: Record<Kind, { accept: string; matches: (file: File) => boolean; noun: string }> = {
  webp: { accept: "image/webp,.webp", matches: (file) => file.type === "image/webp" || /\.webp$/i.test(file.name), noun: "WebP" },
  svg: { accept: "image/svg+xml,.svg", matches: (file) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name), noun: "SVG" },
  png: { accept: "image/png,.png", matches: (file) => file.type === "image/png" || /\.png$/i.test(file.name), noun: "PNG" },
  jpg: { accept: "image/jpeg,.jpg,.jpeg", matches: (file) => file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name), noun: "JPG" },
  jpeg: { accept: "image/jpeg,.jpeg,.jpg,.jfif", matches: (file) => file.type === "image/jpeg" || /\.(jpe?g|jfif)$/i.test(file.name), noun: "JPEG" },
  // A HEIC often comes with no type at all: it is known by its name.
  heic: { accept: "image/heic,image/heif,.heic,.heif", matches: (file) => /^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name), noun: "HEIC" },
  avif: { accept: "image/avif,.avif", matches: (file) => file.type === "image/avif" || /\.avif$/i.test(file.name), noun: "AVIF" },
  image: {
    accept: "image/png,image/jpeg,image/webp,image/gif,image/bmp",
    matches: (file) => /^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type),
    noun: "PNG, JPG, or WebP",
  },
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be read."));
    image.src = url;
  });

// An SVG says how large it is in its width and height, or failing that its viewBox. It is given
// the size to be drawn at before it is read as an image, so that it is drawn sharp at any scale.
const sizedSvg = async (file: File, scale: number) => {
  const document = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
  const svg = document.documentElement;
  if (svg.nodeName !== "svg") throw new Error("Not an SVG.");
  const length = (name: string) => {
    const value = svg.getAttribute(name) ?? "";
    return /^\s*[\d.]+(px)?\s*$/.test(value) ? Number.parseFloat(value) : null;
  };
  const box = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  const width = length("width") ?? (box.length === 4 && box[2] > 0 ? box[2] : 300);
  const height = length("height") ?? (box.length === 4 && box[3] > 0 ? box[3] : 150);
  if (box.length !== 4) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width * scale));
  svg.setAttribute("height", String(height * scale));
  return new Blob([new XMLSerializer().serializeToString(document)], { type: "image/svg+xml" });
};

// A picture kept as it is, under a new name: it is read only for how large it is.
const kept = async (blob: Blob) => {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    return { url, width: image.naturalWidth, height: image.naturalHeight, size: blob.size };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
};

// `option` is the scale an SVG is drawn at, or the number of colours a picture is traced in.
const convertImage = async (file: File, kind: Kind, option: number, to: Output) => {
  // A JPEG and a JPG are the same thing: nothing is done to the picture but naming it.
  if (kind === "jpeg") return kept(file.slice(0, file.size, "image/jpeg"));
  if (kind !== "heic") return drawn(file, kind, option, to);
  try {
    // Safari reads a HEIC by itself.
    return await drawn(file, kind, option, to);
  } catch {
    // The others need the decoder, which is large: it is fetched only now that it is needed.
    const { heicTo } = await import("heic-to");
    return kept(await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 }));
  }
};

const drawn = async (file: File, kind: Kind, option: number, to: Output) => {
  const source = URL.createObjectURL(kind === "svg" ? await sizedSvg(file, option) : file);
  try {
    const image = await loadImage(source);
    const [width, height] = [image.naturalWidth, image.naturalHeight];
    if (!width || !height || Math.max(width, height) > LARGEST_SIDE) throw new Error("The image is too large.");
    const canvas = document.createElement("canvas");
    if (to === "svg") {
      // A large picture is traced smaller, and a small one larger: an icon's fine lines are
      // then a few pixels across, and are traced as shapes with curves to them.
      const side = Math.max(width, height);
      const shrink = side > TRACED_SIDE ? TRACED_SIDE / side : Math.min(8, Math.max(1, Math.floor(TRACED_SIDE / 2 / side)));
      canvas.width = Math.max(1, Math.round(width * shrink));
      canvas.height = Math.max(1, Math.round(height * shrink));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("The image could not be drawn.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const svg = traceToSvg(pixels, canvas.width, canvas.height, option, { width, height });
      const traced = new Blob([svg], { type: "image/svg+xml" });
      return { url: URL.createObjectURL(traced), width, height, size: traced.size };
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The image could not be drawn.");
    // A JPG has no see-through parts: what would be is white.
    if (to === "jpg") {
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      to === "jpg" ? canvas.toBlob(resolve, "image/jpeg", 0.92) : canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("The image could not be made.");
    return { url: URL.createObjectURL(blob), width, height, size: blob.size };
  } finally {
    URL.revokeObjectURL(source);
  }
};

const bytes = (size: number) => (size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`);

function Converter({ kind, to = "png" }: { kind: Kind; to?: Output }) {
  const { accept, matches, noun } = KINDS[kind];
  const outName = (name: string) => `${name.replace(/\.[^.]+$/, "")}.${to}`;
  const [items, setItems] = useState<Item[]>([]);
  // What the conversion can be set to: the scale of an SVG, or the colours of a tracing.
  const option = to === "svg" ? { label: "Colors", values: COLORS, unit: "", first: 8 } : kind === "svg" ? { label: "Scale", values: SCALES, unit: "×", first: 1 } : null;
  const [scale, setScale] = useState(option?.first ?? 1);
  const [over, setOver] = useState(false);
  // How many of the files last given were of another kind, and left out.
  const [skipped, setSkipped] = useState(0);
  const nextId = useRef(0);
  const made = useRef(new Set<string>());

  // Counts the changes of scale, so that an image made at a scale since left is not kept.
  const round = useRef(0);

  const convert = (list: Item[], at: number) => {
    const started = round.current;
    for (const item of list) {
      void convertImage(item.file, kind, at, to)
        .then((result) => {
          made.current.add(result.url);
          return result;
        })
        .catch(() => false as const)
        .then((result) => {
          if (started !== round.current) {
            if (result) URL.revokeObjectURL(result.url);
            return;
          }
          setItems((previous) =>
            previous.map((entry) => {
              if (entry.id !== item.id) return entry;
              if (entry.result) URL.revokeObjectURL(entry.result.url);
              return { ...entry, result };
            }),
          );
        });
    }
  };

  const add = (files: Iterable<File>) => {
    const all = [...files];
    const added = all.filter(matches).map((file) => ({ id: nextId.current++, file, result: null }));
    setSkipped(all.length - added.length);
    if (added.length === 0) return;
    setItems((previous) => [...previous, ...added]);
    convert(added, scale);
  };

  // The images made are kept by the browser until they are let go of.
  useEffect(() => {
    const urls = made.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const done = items.filter((item) => item.result);

  return (
    <Panel className="flex flex-col gap-5">
      <label
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-10 text-center transition-colors has-[:focus-visible]:border-strong ${
          over ? "border-strong bg-subtle" : "border-border-strong hover:bg-subtle"
        }`}
        onDragOver={(event: DragEvent) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event: DragEvent) => {
          event.preventDefault();
          setOver(false);
          add(event.dataTransfer.files);
        }}
      >
        <span className="text-strong">Drop {noun} files here, or click to choose</span>
        <span className="body-sm text-muted">Converted in your browser. Nothing is uploaded.</span>
        <input
          type="file"
          accept={accept}
          multiple
          className="sr-only"
          onChange={(event) => {
            add(event.target.files ?? []);
            event.target.value = "";
          }}
        />
      </label>

      {skipped > 0 ? (
        <p className="body-sm m-0 text-gray-dark" role="status">
          {skipped === 1 ? "1 file was" : `${skipped} files were`} left out: not {noun}.
        </p>
      ) : null}

      {option ? (
        <div className="flex items-center gap-3">
          <span className="body-sm text-muted">{option.label}</span>
          <div className="flex gap-1.5" role="group" aria-label={option.label}>
            {option.values.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={scale === value}
                className={`body-sm h-8 rounded-full border px-3 transition-colors ${
                  scale === value ? "border-strong bg-strong text-bg" : "border-border text-strong hover:bg-subtle"
                }`}
                onClick={() => {
                  round.current += 1;
                  setScale(value);
                  setItems((previous) => previous.map((item) => ({ ...item, result: item.result || null })));
                  convert(items, value);
                }}
              >
                {value}
                {option.unit}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 border-t border-border py-3">
              <span
                className="size-10 shrink-0 rounded-md border border-border-strong bg-contain bg-center bg-no-repeat"
                style={{
                  backgroundImage: `${item.result ? `url(${item.result.url}), ` : ""}repeating-conic-gradient(#E5E5E5 0 25%, #FFFFFF 0 50%)`,
                  backgroundSize: "contain, 10px 10px",
                  backgroundRepeat: "no-repeat, repeat",
                }}
                aria-hidden="true"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-strong">{outName(item.file.name)}</span>
                <span className="body-sm text-muted" role="status">
                  {item.result
                    ? `${item.result.width} × ${item.result.height} · ${bytes(item.result.size)}`
                    : item.result === false
                      ? "Could not be converted"
                      : "Converting…"}
                </span>
              </div>
              {item.result ? (
                <a
                  href={item.result.url}
                  download={outName(item.file.name)}
                  className="body-sm inline-flex h-7 shrink-0 items-center rounded-md border border-border px-2.5 text-strong transition-colors hover:bg-subtle"
                >
                  Download
                </a>
              ) : null}
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                className="body-sm h-7 shrink-0 rounded-md px-1.5 text-muted transition-colors hover:text-strong"
                onClick={() => setItems((previous) => previous.filter((entry) => entry.id !== item.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {done.length > 1 ? (
        <button
          type="button"
          className="body-sm-emphasis h-9 w-fit rounded-full bg-strong px-4 text-bg transition-opacity hover:opacity-90"
          onClick={() => {
            for (const item of done) {
              if (!item.result) continue;
              const link = document.createElement("a");
              link.href = item.result.url;
              link.download = outName(item.file.name);
              link.click();
            }
          }}
        >
          Download all ({done.length})
        </button>
      ) : null}
    </Panel>
  );
}

const noUpload = {
  question: "Are my images uploaded?",
  answer: "No. The conversion happens in your browser. The files never leave your device.",
};

const webpFaq: Faq[] = [
  {
    question: "How do I convert WebP to PNG?",
    answer: "Drop your WebP files above. Each one is converted right away, and you download the PNG.",
  },
  noUpload,
  {
    question: "Does PNG keep transparency?",
    answer: "Yes. Transparent areas in the WebP stay transparent in the PNG.",
  },
  {
    question: "Does it lose quality?",
    answer: "No. PNG is lossless, so the image is kept exactly as the WebP shows it. The file is usually larger.",
  },
  {
    question: "What about animated WebP?",
    answer: "Only the first frame is converted. PNG does not hold animation.",
  },
];

const svgFaq: Faq[] = [
  {
    question: "How do I convert SVG to PNG?",
    answer: "Drop your SVG files above, pick a scale, and download the PNG.",
  },
  {
    question: "How do I get a larger or sharper PNG?",
    answer: "Raise the scale. An SVG is drawn from shapes, so 2×, 3×, or 4× gives more pixels with no blur.",
  },
  noUpload,
  {
    question: "Is the background transparent?",
    answer: "Yes, unless the SVG draws a background of its own.",
  },
  {
    question: "Why does my SVG look different?",
    answer: "Fonts and images the SVG links to from elsewhere are not loaded. Convert text to outlines and embed images first.",
  },
];

const svgJpgFaq: Faq[] = [
  {
    question: "How do I convert SVG to JPG?",
    answer: "Drop your SVG files above, pick a scale, and download the JPG.",
  },
  {
    question: "What happens to the transparent background?",
    answer: "It becomes white. JPG cannot be transparent. Use SVG to PNG to keep it.",
  },
  {
    question: "How do I get a larger or sharper JPG?",
    answer: "Raise the scale. An SVG is drawn from shapes, so 2×, 3×, or 4× gives more pixels with no blur.",
  },
  noUpload,
  {
    question: "Should I use JPG or PNG?",
    answer: "PNG for logos, icons, and anything with sharp edges or transparency. JPG when you need a small file and a solid background.",
  },
];

export function SvgToJpg() {
  return (
    <ToolPage
      slug="svg-to-jpg"
      name="SVG to JPG"
      title="SVG to JPG Converter | Mesurer"
      description="Convert SVG to JPG in your browser, at 1× to 4× size. Free, no upload. Drop your files and download."
      heading="SVG to JPG converter"
      intro="Drop SVG files and download them as JPG, at any scale. Nothing is uploaded."
      tool={<Converter kind="svg" to="jpg" />}
      faq={svgJpgFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="SVG and JPG">
        <p className="m-0">
          SVG is made of shapes and stays sharp at any size. JPG is made of pixels, opens everywhere, and makes small files, but it has no transparency: see-through areas turn white.
        </p>
      </Section>
    </ToolPage>
  );
}

const pngJpgFaq: Faq[] = [
  {
    question: "How do I convert PNG to JPG?",
    answer: "Drop your PNG files above. Each one is converted right away, and you download the JPG.",
  },
  {
    question: "What happens to transparent areas?",
    answer: "They become white. JPG cannot be transparent.",
  },
  {
    question: "Why is the JPG smaller?",
    answer: "JPG compresses the picture by dropping detail the eye rarely notices. It suits photos. For text, logos, and screenshots, PNG stays sharper.",
  },
  noUpload,
];

const jpgPngFaq: Faq[] = [
  {
    question: "How do I convert JPG to PNG?",
    answer: "Drop your JPG files above. Each one is converted right away, and you download the PNG.",
  },
  {
    question: "Does converting to PNG improve quality?",
    answer: "No. It keeps the picture exactly as the JPG shows it, and stops it losing more each time it is saved again.",
  },
  {
    question: "Why is the PNG larger?",
    answer: "PNG is lossless: it keeps every pixel as it is. For photos that takes more space than JPG.",
  },
  noUpload,
];

const imageSvgFaq: Faq[] = [
  {
    question: "How do I convert an image to SVG?",
    answer: "Drop a PNG, JPG, or WebP above. It is traced into shapes of a few colors, and you download the SVG.",
  },
  {
    question: "Which images work best?",
    answer: "Logos, icons, and flat illustrations. Photos have too many colors and details to trace well.",
  },
  {
    question: "How many colors should I pick?",
    answer: "As few as the image has. 2 for a one-color logo on a plain background, 4 to 8 for most icons and illustrations.",
  },
  {
    question: "Is the SVG a real vector?",
    answer: "Yes. It is made of paths you can scale and edit, not the original picture wrapped in an SVG file.",
  },
  noUpload,
];

export function PngToJpg() {
  return (
    <ToolPage
      slug="png-to-jpg"
      name="PNG to JPG"
      title="PNG to JPG Converter | Mesurer"
      description="Convert PNG to JPG in your browser. Free, no upload. Drop your files and download smaller JPGs."
      heading="PNG to JPG converter"
      intro="Drop PNG images and download them as JPG. Nothing is uploaded."
      tool={<Converter kind="png" to="jpg" />}
      faq={pngJpgFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="PNG and JPG">
        <p className="m-0">
          PNG keeps every pixel and can be transparent. JPG makes much smaller files for photos, with a solid background.
        </p>
      </Section>
    </ToolPage>
  );
}

export function JpgToPng() {
  return (
    <ToolPage
      slug="jpg-to-png"
      name="JPG to PNG"
      title="JPG to PNG Converter | Mesurer"
      description="Convert JPG to PNG in your browser. Free, no upload. Drop your files and download lossless PNGs."
      heading="JPG to PNG converter"
      intro="Drop JPG images and download them as PNG. Nothing is uploaded."
      tool={<Converter kind="jpg" />}
      faq={jpgPngFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="JPG and PNG">
        <p className="m-0">
          JPG loses a little detail every time it is saved. PNG does not, which makes it the better format to edit and save again.
        </p>
      </Section>
    </ToolPage>
  );
}

export function ImageToSvg() {
  return (
    <ToolPage
      slug="image-to-svg"
      name="Image to SVG"
      title="Image to SVG Converter | Mesurer"
      description="Convert PNG, JPG, or WebP to SVG in your browser. Traces logos and icons into real vector paths. Free, no upload."
      heading="Image to SVG converter"
      intro="Drop a logo or icon and download it traced as an SVG. Nothing is uploaded."
      tool={<Converter kind="image" to="svg" />}
      faq={imageSvgFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="How it works">
        <p className="m-0">
          The image is brought down to the number of colors you pick, and the outline of each patch of color becomes a path. Fewer colors give a cleaner, smaller SVG.
        </p>
      </Section>
    </ToolPage>
  );
}

const heicFaq: Faq[] = [
  {
    question: "How do I convert HEIC to JPG?",
    answer: "Drop your HEIC photos above. Each one is converted right away, and you download the JPG.",
  },
  {
    question: "What is a HEIC file?",
    answer: "The format iPhones save photos in. It makes small files, but many apps and websites cannot open it.",
  },
  {
    question: "Does it work on Windows and Android?",
    answer: "Yes, in any modern browser. The first conversion takes a moment while the HEIC decoder loads.",
  },
  {
    question: "What about Live Photos?",
    answer: "You get the still picture. The short video of a Live Photo is a separate file.",
  },
  noUpload,
];

const avifFaq: Faq[] = [
  {
    question: "How do I convert AVIF to PNG?",
    answer: "Drop your AVIF files above. Each one is converted right away, and you download the PNG.",
  },
  {
    question: "What is an AVIF file?",
    answer: "A newer image format that makes very small files. Browsers show it, but many apps cannot open it yet.",
  },
  {
    question: "Does PNG keep transparency?",
    answer: "Yes. Transparent areas in the AVIF stay transparent in the PNG.",
  },
  noUpload,
];

const jpegFaq: Faq[] = [
  {
    question: "What is the difference between JPEG and JPG?",
    answer: "None. They are the same format. .jpg is the three-letter ending older versions of Windows needed.",
  },
  {
    question: "How do I convert JPEG to JPG?",
    answer: "Drop your .jpeg files above and download them as .jpg. Only the name changes.",
  },
  {
    question: "Does it lose quality?",
    answer: "No. The picture is not compressed again. The file is the same, byte for byte.",
  },
  noUpload,
];

export function HeicToJpg() {
  return (
    <ToolPage
      slug="heic-to-jpg"
      name="HEIC to JPG"
      title="HEIC to JPG Converter | Mesurer"
      description="Convert iPhone HEIC photos to JPG in your browser. Free, no upload. Drop your files and download."
      heading="HEIC to JPG converter"
      intro="Drop iPhone photos and download them as JPG. Nothing is uploaded."
      tool={<Converter kind="heic" to="jpg" />}
      faq={heicFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="HEIC and JPG">
        <p className="m-0">
          HEIC is what iPhones save photos in. JPG opens everywhere, so it is the format to send, upload, or edit.
        </p>
      </Section>
    </ToolPage>
  );
}

export function AvifToPng() {
  return (
    <ToolPage
      slug="avif-to-png"
      name="AVIF to PNG"
      title="AVIF to PNG Converter | Mesurer"
      description="Convert AVIF to PNG in your browser. Free, no upload, transparency kept. Drop your files and download."
      heading="AVIF to PNG converter"
      intro="Drop AVIF images and download them as PNG. Nothing is uploaded."
      tool={<Converter kind="avif" />}
      faq={avifFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="AVIF and PNG">
        <p className="m-0">
          AVIF makes the smallest files and is what many websites now serve. PNG is lossless and opens everywhere, which makes it the safer choice for editing and sharing.
        </p>
      </Section>
    </ToolPage>
  );
}

export function JpegToJpg() {
  return (
    <ToolPage
      slug="jpeg-to-jpg"
      name="JPEG to JPG"
      title="JPEG to JPG Converter | Mesurer"
      description="Change .jpeg files to .jpg in your browser. Free, no upload, no quality lost: only the file name changes."
      heading="JPEG to JPG converter"
      intro="Drop .jpeg files and download them as .jpg, with no quality lost."
      tool={<Converter kind="jpeg" to="jpg" />}
      faq={jpegFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="JPEG and JPG">
        <p className="m-0">
          JPEG and JPG are two names for one format. Some upload forms and older apps only take <code className="code">.jpg</code>, and that is the only reason to change it.
        </p>
      </Section>
    </ToolPage>
  );
}

export function WebpToPng() {
  return (
    <ToolPage
      slug="webp-to-png"
      name="WebP to PNG"
      title="WebP to PNG Converter | Mesurer"
      description="Convert WebP to PNG in your browser. Free, no upload, transparency kept. Drop your files and download."
      heading="WebP to PNG converter"
      intro="Drop WebP images and download them as PNG. Nothing is uploaded."
      tool={<Converter kind="webp" />}
      faq={webpFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="WebP and PNG">
        <p className="m-0">
          WebP makes smaller files and is what most websites serve. PNG is lossless and opens everywhere, which makes it the safer choice for editing, slides, and older apps.
        </p>
      </Section>
    </ToolPage>
  );
}

export function SvgToPng() {
  return (
    <ToolPage
      slug="svg-to-png"
      name="SVG to PNG"
      title="SVG to PNG Converter | Mesurer"
      description="Convert SVG to PNG in your browser, at 1× to 4× size. Free, no upload, transparent background kept."
      heading="SVG to PNG converter"
      intro="Drop SVG files and download them as PNG, at any scale. Nothing is uploaded."
      tool={<Converter kind="svg" />}
      faq={svgFaq}
      cta="Capture and annotate any part of a live page as an image."
    >
      <Section title="SVG and PNG">
        <p className="m-0">
          SVG is made of shapes and stays sharp at any size. PNG is made of pixels and works where SVG does not: email, chat, slides, and most upload forms. Pick the scale to match where the PNG will be shown.
        </p>
      </Section>
    </ToolPage>
  );
}
