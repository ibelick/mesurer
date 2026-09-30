const shortcuts = [
  { keys: "M", description: "Toggle Mesurer on/off" },
  { keys: "I", description: "Toggle Inspect mode" },
  { keys: "S", description: "Toggle Select mode for annotations" },
  { keys: "A", description: "Toggle Typography mode" },
  { keys: "1 / 2", description: "Switch between Select & Inspect and Annotate tools" },
  { keys: "D / N / T", description: "Toggle Arrows, Pen, or Text mode" },
  { keys: "P", description: "Open the native color sampler" },
  { keys: "C", description: "Drag a screenshot region (Chrome extension)" },
  { keys: "V", description: "Drag a region to record a video (Chrome extension)" },
  { keys: "L", description: "Toggle layout guides" },
  { keys: "G", description: "Toggle Guides mode" },
  { keys: "X", description: "Toggle X-ray mode" },
  { keys: "R", description: "Toggle pixel rulers" },
  { keys: "H", description: "Set guide orientation to horizontal" },
  { keys: "V", description: "Set guide orientation to vertical" },
  { keys: "Alt", description: "Temporarily enable option/guide measurement overlays" },
  { keys: ["Option + S", "Alt + S"], description: "Pin the distance currently shown under Option/Alt" },
  { keys: "Esc", description: "Exit the active tool; press again to minimize Mesurer" },
  { keys: ["Backspace", "Delete"], description: "Remove selected guides, arrows, pen strokes, or text" },
  { keys: "Cmd/Ctrl + Z", description: "Undo" },
  { keys: "Cmd/Ctrl + Shift + Z", description: "Redo" },
  { keys: "Cmd/Ctrl + A", description: "Select all annotations" },
  { keys: "Cmd/Ctrl + ,", description: "Open Settings" },
  { keys: "Cmd/Ctrl + K", description: "Copy comments for an agent" },
] as const;

function KeyLabel({ keys }: { keys: string | readonly string[] }) {
  const values = typeof keys === "string" ? [keys] : keys;
  return (
    <div className="font-mono text-strong">
      {values.map((key, index) => (
        <span key={key}>
          {index > 0 ? <span className="px-1 text-muted">/</span> : null}
          <code className="code">{key}</code>
        </span>
      ))}
    </div>
  );
}

export default function ShortcutList() {
  return (
    <div className="-mx-2 flex flex-col border-t border-border">
      {shortcuts.map((shortcut) => (
        <div
          key={typeof shortcut.keys === "string" ? shortcut.keys : shortcut.keys.join("/")}
          className="flex items-start justify-between gap-8 border-b border-border px-2 py-2"
        >
          <KeyLabel keys={shortcut.keys} />
          <div className="max-w-[60%] text-right text-balance text-muted">{shortcut.description}</div>
        </div>
      ))}
    </div>
  );
}
