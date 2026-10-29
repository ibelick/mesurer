import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

export const inputClassName =
  "body-sm h-10 w-full min-w-0 rounded-md border border-border bg-bg px-3 text-strong outline-none transition-colors placeholder:text-muted hover:border-border-strong focus:border-strong aria-invalid:border-gray-dark";

export function CopyButton({
  value,
  label = "Copy",
  inset = false,
}: {
  value: string;
  label?: string;
  /** The button is inside a field, at its end, with no frame of its own. */
  inset?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={`${label} ${value}`}
      className={`body-sm h-7 shrink-0 rounded-md px-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong ${
        inset
          ? "absolute top-1/2 right-1.5 -translate-y-1/2 bg-bg text-muted hover:text-strong"
          : "border border-border text-strong hover:bg-subtle"
      }`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true));
      }}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

/** A code in running text or a table that is copied by pressing it, as its tooltip says. */
export function CopyCode({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="code group relative cursor-pointer border-0 transition-colors hover:bg-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
      onClick={() => {
        void navigator.clipboard?.writeText(children).then(() => setCopied(true));
      }}
    >
      {children}
      <span
        role="status"
        className="body-sm pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-strong px-2 py-1 text-bg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {copied ? "Copied" : "Click to copy"}
      </span>
    </button>
  );
}

/** A result with its name, to read and to copy. */
export function Output({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 border-t border-border py-3">
      <span className="body-sm w-14 shrink-0 text-muted">{label}</span>
      <output className="body-sm min-w-0 flex-1 truncate text-strong">{value}</output>
      <CopyButton value={value} />
    </div>
  );
}

export function Field({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="body-sm text-muted">{label}</span>
      <input {...props} className={`${inputClassName} ${className}`} />
    </label>
  );
}

/**
 * A field for a number. The up and down arrows step it, by ten times as much with Shift held,
 * and it never leaves `min` to `max`.
 */
export function NumberField({
  value,
  onValue,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "min" | "max" | "step"> & {
  label: string;
  value: string;
  onValue: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field
      inputMode="decimal"
      autoComplete="off"
      {...props}
      value={value}
      onChange={(event) => onValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        // An empty field steps from what it stands for: its placeholder.
        const current = Number((value.trim() || props.placeholder || "").replace(",", "."));
        const by = (event.key === "ArrowUp" ? step : -step) * (event.shiftKey ? 10 : 1);
        const next = Math.min(max, Math.max(min, (Number.isFinite(current) ? current : min) + by));
        // Rounded so that stepping by 0.01 does not leave 0.30000000000000004.
        onValue(String(Number(next.toFixed(4))));
      }}
    />
  );
}

/** The frame a tool sits in. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border p-5 ${className}`}>{children}</div>;
}

/**
 * Keeps what a tool is set to in the address, so that a link to it opens the same thing. It is
 * read once the page is shown, not before: the page is first drawn as it was built.
 */
export function useQueryState(values: Record<string, string>, onRead: (params: URLSearchParams) => void) {
  const query = new URLSearchParams(values).toString();
  const written = useRef(query);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length > 0) onRead(params);
    // Read once, when the page is first shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (written.current === query) return;
    written.current = query;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
  }, [query]);
}
