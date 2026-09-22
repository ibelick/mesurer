import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Mesurer } from "mesurer"
import "./styles.css"

const colors = ["#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3", "#ede9fe", "#cffafe"]

const cliCommands = [
  { command: "npx skills add https://github.com/ui-skills/cli", note: "install the review skill" },
  { command: "skills init --preset interface", note: "create a local workspace" },
  { command: "skills check --target ./src", note: "scan the current project" },
]

const agentLogos = [
  ["OpenAI", "https://assets.querrel.com/logo/muted/openai.webp"],
  ["Claude", "https://assets.querrel.com/logo/muted/claude.webp"],
  ["Cursor", "https://assets.querrel.com/logo/muted/cursor.webp"],
  ["Copilot", "https://assets.querrel.com/logo/muted/copilot.webp"],
  ["Anthropic", "https://assets.querrel.com/logo/muted/anthropic.webp"],
  ["Gemini", "https://assets.querrel.com/logo/muted/gemini.webp"],
  ["OpenClaw", "https://assets.querrel.com/logo/muted/openclaw.webp"],
  ["DeepSeek", "https://assets.querrel.com/logo/muted/deepseek.webp"],
] as const

const iframeSrcDoc = `<!doctype html>
<html>
  <head>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-width: 520px; color: #172033; background: #f8fafc; font: 12px system-ui, sans-serif; }
      .frame { min-height: 620px; padding-bottom: 28px; }
      .toolbar { position: sticky; top: 0; z-index: 4; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; color: white; background: #172033; font: 600 10px ui-monospace, monospace; text-transform: uppercase; }
      .toolbar button, button { cursor: pointer; border: 1px solid #94a3b8; border-radius: 4px; padding: 7px 10px; color: #172033; background: white; font: inherit; }
      .toolbar button { border-color: #64748b; color: white; background: transparent; }
      .hero { display: grid; grid-template-columns: 1.2fr .8fr; gap: 14px; margin: 16px; }
      .panel { border: 1px solid #cbd5e1; border-radius: 7px; padding: 14px; background: white; box-shadow: 0 4px 14px #0f172a12; }
      h1, h2, p { margin: 0; } h1 { font-size: 22px; letter-spacing: -.04em; } h2 { margin-bottom: 10px; font-size: 13px; }
      .muted { margin-top: 7px; color: #64748b; line-height: 1.5; }
      .orbit { position: relative; min-height: 126px; overflow: hidden; border: 1px dashed #94a3b8; background: radial-gradient(circle, #dbeafe 0 3px, transparent 4px); }
      .target { position: absolute; top: 50%; left: 50%; border: 1px solid #172033; border-radius: 99px; padding: 8px; background: #fde68a; animation: orbit 3s linear infinite; }
      @keyframes orbit { from { transform: translate(-50%, -50%) rotate(0) translateX(56px) rotate(0); } to { transform: translate(-50%, -50%) rotate(360deg) translateX(56px) rotate(-360deg); } }
      .scroll { max-height: 190px; overflow: auto; border: 1px solid #cbd5e1; }
      .row { display: flex; justify-content: space-between; min-width: 360px; padding: 10px; border-bottom: 1px solid #e2e8f0; }
      .row:nth-child(even) { background: #f8fafc; }
      form { display: grid; gap: 9px; } label { display: grid; gap: 4px; color: #64748b; font-size: 10px; text-transform: uppercase; } input, select { width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; color: #172033; background: white; font: 12px system-ui, sans-serif; }
      table { width: 100%; border-collapse: collapse; margin-top: 14px; } th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; } th { background: #e2e8f0; }
      .graphics { display: flex; align-items: center; gap: 14px; margin-top: 14px; } svg { width: 150px; height: 74px; border: 1px solid #cbd5e1; } canvas { width: 150px; height: 74px; border: 1px solid #cbd5e1; }
      .footer { margin: 16px; padding: 16px; border: 1px dashed #94a3b8; color: #64748b; }
      @media (prefers-reduced-motion: reduce) { .target { animation-play-state: paused; } }
    </style>
  </head>
  <body>
    <div class="frame">
      <div class="toolbar"><span>Embedded workspace</span><button type="button">toolbar action</button></div>
      <section class="hero">
        <div class="panel"><h1>Iframe application</h1><p class="muted">A complete document with its own layout, controls, graphics, and animated content.</p></div>
        <div class="panel orbit"><button class="target" type="button">moving target</button></div>
      </section>
      <section class="panel" style="margin: 16px"><h2>Nested scrolling rows</h2><div class="scroll">${Array.from({ length: 12 }, (_, index) => `<div class="row"><span>iframe row ${String(index + 1).padStart(2, "0")}</span><button type="button">inspect</button></div>`).join("")}</div></section>
      <section class="hero">
        <div class="panel"><h2>Form inside iframe</h2><form><label>Display name<input placeholder="Type here" /></label><label>Mode<select><option>Default</option><option>Diagnostic</option></select></label><label><span><input type="checkbox" /> Enable alerts</span></label><button type="button">Submit locally</button></form></div>
        <div class="panel"><h2>Shadow boundary</h2><div id="shadow-host"></div><p class="muted">The button below is rendered in a shadow root.</p></div>
      </section>
      <section class="panel" style="margin: 16px"><h2>Table and rendered graphics</h2><table><thead><tr><th>Signal</th><th>Status</th><th>Value</th></tr></thead><tbody><tr><td>Layout</td><td>Ready</td><td>98%</td></tr><tr><td>Motion</td><td>Active</td><td>60fps</td></tr><tr><td>Boundary</td><td>Nested</td><td>iframe</td></tr></tbody></table><div class="graphics"><svg viewBox="0 0 150 74" role="img" aria-label="Iframe SVG"><path d="M4 62 C28 8 53 70 76 30 S122 12 146 54" fill="none" stroke="#2563eb" stroke-width="3" /><circle cx="76" cy="30" r="7" fill="#f97316" /></svg><canvas id="frame-canvas" width="300" height="148" aria-label="Iframe canvas"></canvas></div></section>
      <div class="footer">End of embedded document. Scroll the iframe itself to test the boundary.</div>
       <section class="panel" style="margin: 16px"><h2>Nested iframe boundary</h2><iframe title="Nested child iframe" srcdoc="<button style='margin:18px;padding:12px'>nested iframe target</button>"></iframe><div id="shadow-frame-host"></div></section>
    </div>
    <script>
      const host = document.querySelector('#shadow-host');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button style="padding:10px;border:1px solid #64748b;border-radius:4px;background:#dbeafe">shadow button</button>';
      const shadowFrameHost = document.querySelector('#shadow-frame-host');
      if (!shadowFrameHost) throw new Error('Shadow iframe host is missing');
      const shadowFrame = document.createElement('iframe');
      shadowFrame.title = 'Shadow child iframe';
      shadowFrame.srcdoc = '<button style="margin:18px;padding:12px">shadow iframe target</button>';
      shadowFrameHost.attachShadow({ mode: 'open' }).append(shadowFrame);
      const canvas = document.querySelector('#frame-canvas');
      const context = canvas.getContext('2d');
      context.scale(2, 2); context.fillStyle = '#dcfce7'; context.fillRect(0, 0, 150, 74); context.fillStyle = '#172033'; context.font = '12px monospace'; context.fillText('canvas pixels', 28, 40);
    </script>
  </body>
</html>`

function TestCanvas({ count }: { count: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (!context) return
    const ratio = window.devicePixelRatio || 1
    const width = 720
    const height = 220
    canvas.width = width * ratio
    canvas.height = height * ratio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.scale(ratio, ratio)
    context.fillStyle = "#f8fafc"
    context.fillRect(0, 0, width, height)
    for (let index = 0; index < 18; index += 1) {
      const x = 16 + (index % 6) * 118
      const y = 16 + Math.floor(index / 6) * 64
      context.fillStyle = colors[index % colors.length]
      context.fillRect(x, y, 92, 42)
      context.strokeStyle = "#94a3b8"
      context.strokeRect(x + 0.5, y + 0.5, 91, 41)
    }
  }, [count])

  useEffect(() => {
    const host = shadowRef.current
    if (!host || host.shadowRoot) return
    const shadow = host.attachShadow({ mode: "open" })
    const card = document.createElement("button")
    card.textContent = "Shadow target"
    card.type = "button"
    card.style.cssText = "border:1px solid #94a3b8;background:#fff;padding:10px 14px;border-radius:6px;font:600 12px ui-monospace;"
    shadow.append(card)
  }, [])

  return (
    <>
      <section className="bench-card bench-edge-card" aria-labelledby="edge-title">
        <div className="bench-card-heading">
          <div>
            <span className="bench-kicker">01 / primitives</span>
            <h2 id="edge-title">Test the four viewport corners</h2>
          </div>
          <span className="bench-coordinate">0, 0 → 100vw, 100vh</span>
        </div>
        <p className="bench-card-instruction">Use Inspect, Measure, or Comments on each button. Check that panels stay visible at every edge.</p>
        <div className="bench-edge-stage">
          <button className="bench-edge bench-edge-tl" type="button">top left</button>
          <button className="bench-edge bench-edge-tr" type="button">top right</button>
          <button className="bench-edge bench-edge-bl" type="button">bottom left</button>
          <button className="bench-edge bench-edge-br" type="button">bottom right</button>
          <div className="bench-edge-center">Select / measure / annotate</div>
        </div>
      </section>

      <section className="bench-card" aria-labelledby="composer-title">
        <div className="bench-card-heading">
          <div>
            <span className="bench-kicker">02 / host</span>
            <h2 id="composer-title">Focus-stealing composer</h2>
          </div>
          <span className="bench-coordinate">ChatGPT · Claude</span>
        </div>
        <p className="bench-card-instruction">This prompt steals focus on blur, like ChatGPT. Use the Text tool on the corners above; typing should stay in Mesurer.</p>
        <HostComposer />
      </section>

      <section className="bench-card" aria-labelledby="elements-title">
        <div className="bench-card-heading">
          <div>
            <span className="bench-kicker">02 / generated</span>
            <h2 id="elements-title">{count.toLocaleString()} live elements</h2>
          </div>
          <span className="bench-coordinate">nested / repeated / mixed</span>
        </div>
        <p className="bench-card-instruction">Measure or comment on repeated elements, then increase the count to stress the page.</p>
        <div className="bench-generated-grid">
          {Array.from({ length: count }, (_, index) => (
            <article
              className="bench-generated-item"
              key={index}
              style={{ "--bench-index": index } as CSSProperties}
            >
              <span className="bench-item-number">{String(index + 1).padStart(3, "0")}</span>
              <strong>{index % 3 === 0 ? "Card title" : index % 3 === 1 ? "Nested control" : "Longer content block"}</strong>
              <button type="button">Inspect me</button>
            </article>
          ))}
        </div>
      </section>

      <section className="bench-card bench-scroll-card" aria-labelledby="scroll-title">
           <div className="bench-card-heading">
             <div><span className="bench-kicker">03 / overflow</span><h2 id="scroll-title">Nested scroll</h2></div>
           </div>
           <p className="bench-card-instruction">Inspect elements inside this scroll box and test overlays while it is moving.</p>
           <div className="bench-scroll-frame">
            {Array.from({ length: 18 }, (_, index) => <div className="bench-scroll-row" key={index}><span>row {String(index + 1).padStart(2, "0")}</span><button type="button">Action</button></div>)}
          </div>
      </section>
      <section className="bench-card" aria-labelledby="media-title">
           <div className="bench-card-heading">
             <div><span className="bench-kicker">04 / rendered</span><h2 id="media-title">Canvas &amp; SVG</h2></div>
           </div>
           <p className="bench-card-instruction">Try inspecting rendered graphics that are not regular HTML elements.</p>
           <canvas ref={canvasRef} aria-label="Generated canvas test surface" />
          <svg className="bench-svg" viewBox="0 0 320 120" role="img" aria-label="Generated SVG test surface">
            <path d="M8 98 C58 8 116 112 164 42 S260 20 312 82" fill="none" stroke="#0f172a" strokeWidth="2" />
            <circle cx="72" cy="57" r="18" fill="#f59e0b" /><rect x="190" y="28" width="74" height="52" fill="#86efac" transform="rotate(-8 227 54)" />
          </svg>
      </section>

      <section className="bench-card" aria-labelledby="transform-title">
        <div className="bench-card-heading">
          <div><span className="bench-kicker">05 / transform</span><h2 id="transform-title">Rotated target</h2></div>
        </div>
        <p className="bench-card-instruction">Inspect this rotated element and check that its bounds follow its transform.</p>
        <div className="bench-transform-box">rotated target</div>
      </section>
      <section className="bench-card" aria-labelledby="form-title">
        <div className="bench-card-heading">
          <div><span className="bench-kicker">06 / controls</span><h2 id="form-title">Form controls</h2></div>
        </div>
        <p className="bench-card-instruction">Click and inspect each native control without losing focus or selection.</p>
        <div className="bench-native-elements">
          <a href="#native-elements">A real link target</a>
          <label><input type="checkbox" /> checkbox</label>
          <label><input type="radio" name="bench-radio" defaultChecked /> radio</label>
          <button type="button">native button</button>
          <label className="bench-field">Text target<input aria-label="Bench text input" placeholder="Type into me" /></label>
          <label className="bench-field">Select target<select aria-label="Bench select"><option>Option one</option><option>Option two</option></select></label>
        </div>
      </section>
      <section className="bench-card" aria-labelledby="shadow-title">
        <div className="bench-card-heading">
          <div><span className="bench-kicker">07 / boundary</span><h2 id="shadow-title">Shadow DOM target</h2></div>
        </div>
        <p className="bench-card-instruction">Inspect the button rendered inside a separate shadow root.</p>
        <div ref={shadowRef} className="bench-shadow-host" aria-label="Shadow DOM target" />
      </section>
      <FloatingUiExamples />
      <section className="bench-card" aria-labelledby="iframe-title">
        <div className="bench-card-heading">
          <div><span className="bench-kicker">09 / boundary</span><h2 id="iframe-title">Iframe target</h2></div>
        </div>
        <p className="bench-card-instruction">Use Inspect (I), not Select (S), to select elements inside this iframe. Try the sticky toolbar, animated target, form, shadow root, table, SVG, and canvas.</p>
        <iframe title="Complex embedded application" className="bench-iframe bench-complex-iframe" srcDoc={iframeSrcDoc} />
      </section>
      <section className="bench-card" aria-labelledby="motion-title">
        <div className="bench-card-heading">
          <div><span className="bench-kicker">10 / motion</span><h2 id="motion-title">Animated targets</h2></div>
          <span className="bench-coordinate">transform / opacity</span>
        </div>
        <p className="bench-card-instruction">Inspect these while they move. Check that measurements and comments stay anchored to the animated target.</p>
        <div className="bench-motion-stage">
          <button className="bench-motion-target bench-motion-orbit" type="button">orbiting target</button>
          <button className="bench-motion-target bench-motion-pulse" type="button">pulsing target</button>
          <div className="bench-motion-scan" aria-hidden="true"><span>moving scan line</span></div>
        </div>
      </section>
      <section className="bench-card" aria-labelledby="layers-title">
        <div className="bench-card-heading">
          <div><span className="bench-kicker">11 / layers</span><h2 id="layers-title">Sticky header and overlapping cards</h2></div>
        </div>
        <p className="bench-card-instruction">Scroll inside this panel. Inspect the sticky bar and the cards that overlap it at different depths.</p>
        <div className="bench-layer-frame">
          <div className="bench-sticky-bar">sticky toolbar <button type="button">inspect</button></div>
          <div className="bench-layer-content">
            <div className="bench-layer-card bench-layer-one">layer one</div>
            <div className="bench-layer-card bench-layer-two">layer two</div>
            <div className="bench-layer-card bench-layer-three">layer three</div>
            <p>Scroll farther to test the sticky boundary and stacking order.</p>
            <div className="bench-layer-filler" />
          </div>
        </div>
      </section>
    </>
  )
}

type SurfacePosition = { left: number; top: number }

function useAnchoredSurface(open: boolean, anchorRef: RefObject<HTMLButtonElement | null>) {
  const [position, setPosition] = useState<SurfacePosition | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setPosition({ left: rect.left, top: rect.bottom + 8 })
    }
    update()
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [anchorRef, open])

  return position
}

function FloatingUiExamples() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const popoverTriggerRef = useRef<HTMLButtonElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const modelTriggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const popoverPosition = useAnchoredSurface(popoverOpen, popoverTriggerRef)
  const menuPosition = useAnchoredSurface(menuOpen, menuTriggerRef)
  const modelPosition = useAnchoredSurface(modelOpen, modelTriggerRef)

  useEffect(() => {
    if (!dialogOpen && !popoverOpen && !menuOpen && !modelOpen) return
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setDialogOpen(false)
      setPopoverOpen(false)
      setMenuOpen(false)
      setModelOpen(false)
    }
    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [dialogOpen, menuOpen, modelOpen, popoverOpen])

  useEffect(() => {
    if (!popoverOpen && !menuOpen) return
    const dismissOnOutsidePointerDown = (event: PointerEvent) => {
      const path = event.composedPath()
      const isMesurerInteraction = path.some((node) => node instanceof Element && node.closest("[data-mesurer-root]"))
      if (isMesurerInteraction) return
      if (popoverOpen && !path.includes(popoverRef.current!) && !path.includes(popoverTriggerRef.current!)) {
        setPopoverOpen(false)
      }
      if (menuOpen && !path.includes(menuRef.current!) && !path.includes(menuTriggerRef.current!)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener("pointerdown", dismissOnOutsidePointerDown, true)
    return () => window.removeEventListener("pointerdown", dismissOnOutsidePointerDown, true)
  }, [menuOpen, popoverOpen])

  useEffect(() => {
    if (!modelOpen) return
    const trigger = modelTriggerRef.current
    const dismissOnPointerDown = (event: PointerEvent) => {
      const path = event.composedPath()
      if (path.includes(modelMenuRef.current!) || (trigger && path.includes(trigger))) return
      setModelOpen(false)
    }
    const dismissOnFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget
      if (next instanceof Node && (modelMenuRef.current?.contains(next) || trigger?.contains(next))) return
      setModelOpen(false)
    }
    window.addEventListener("pointerdown", dismissOnPointerDown, true)
    trigger?.addEventListener("focusout", dismissOnFocusOut)
    return () => {
      window.removeEventListener("pointerdown", dismissOnPointerDown, true)
      trigger?.removeEventListener("focusout", dismissOnFocusOut)
    }
  }, [modelOpen])

  return (
    <section className="bench-card" aria-labelledby="overlays-title">
      <div className="bench-card-heading">
        <div><span className="bench-kicker">08 / floating ui</span><h2 id="overlays-title">Dialog, popover, and menu</h2></div>
        <span className="bench-coordinate">portal / stacking / dismissal</span>
      </div>
      <p className="bench-card-instruction">These surfaces are portaled to the document body, matching common Base UI behavior. Inspect triggers, surfaces, and nested controls.</p>
      <div className="bench-floating-examples">
        <div className="bench-floating-example">
          <span className="bench-control-label">Popover</span>
          <button ref={popoverTriggerRef} type="button" aria-expanded={popoverOpen} aria-haspopup="dialog" onClick={() => setPopoverOpen((open) => !open)}>Toggle popover</button>
        </div>
        <div className="bench-floating-example">
          <span className="bench-control-label">Menu</span>
          <button ref={menuTriggerRef} type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>Open actions</button>
        </div>
        <div className="bench-floating-example">
          <span className="bench-control-label">Dialog</span>
          <button type="button" onClick={() => setDialogOpen(true)}>Open confirmation</button>
        </div>
        <div className="bench-floating-example">
          <span className="bench-control-label">Model selector</span>
          <button
            ref={modelTriggerRef}
            type="button"
            aria-haspopup="listbox"
            aria-expanded={modelOpen}
            onClick={() => setModelOpen((open) => !open)}
          >
            Open model selector
          </button>
        </div>
      </div>
      {popoverOpen && popoverPosition ? createPortal(
        <div ref={popoverRef} className="bench-popover" role="dialog" aria-label="Bench popover" style={popoverPosition}>
          <strong>Build status</strong>
          <p>Three targets overlap this portaled surface.</p>
          <button type="button" onClick={() => setPopoverOpen(false)}>Review changes</button>
        </div>,
        document.body,
      ) : null}
      {menuOpen && menuPosition ? createPortal(
        <div ref={menuRef} className="bench-action-menu" role="menu" aria-label="Bench actions" style={menuPosition}>
          <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>Duplicate target</button>
          <button type="button" role="menuitem" onClick={() => setMenuOpen(false)}>Archive target</button>
          <button type="button" role="menuitem" className="bench-menu-danger" onClick={() => setMenuOpen(false)}>Remove target</button>
        </div>,
        document.body,
      ) : null}
      {modelOpen && modelPosition ? createPortal(
        <div ref={modelMenuRef} className="bench-action-menu" role="listbox" aria-label="Model selector" style={modelPosition}>
          <button type="button" role="option">Sonnet</button>
          <button type="button" role="option">Opus</button>
        </div>,
        document.body,
      ) : null}
      {dialogOpen ? createPortal(
        <div className="bench-dialog-backdrop" onMouseDown={() => setDialogOpen(false)}>
          <div className="bench-dialog" role="dialog" aria-modal="true" aria-label="Bench confirmation dialog" onMouseDown={(event) => event.stopPropagation()}>
            <span className="bench-kicker">Dialog / modal layer</span>
            <h2>Archive this test target?</h2>
            <p>Use this modal to test fixed positioning, backdrop hit testing, and nested button selection.</p>
            <div className="bench-dialog-actions">
              <button type="button" onClick={() => setDialogOpen(false)}>Cancel</button>
              <button type="button" className="bench-dialog-confirm" onClick={() => setDialogOpen(false)}>Archive target</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  )
}

function HostComposer() {
  const promptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prompt = promptRef.current
    if (!prompt) return
    const stealFocus = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (active instanceof Element && active.closest('[role="menu"], [role="listbox"], [role="dialog"], [data-mesurer-root], .mesurer-root')) {
          return
        }
        prompt.focus()
      })
    }
    prompt.addEventListener("blur", stealFocus)
    return () => prompt.removeEventListener("blur", stealFocus)
  }, [])

  return (
    <div className="bench-host-composer" data-testid="host-composer">
      <div
        ref={promptRef}
        className="bench-host-prompt"
        role="textbox"
        aria-label="Host prompt"
        contentEditable
        suppressContentEditableWarning
        data-testid="host-prompt"
      />
    </div>
  )
}

function CliCardFixture() {
  const [activeCommand, setActiveCommand] = useState(0)
  const [copied, setCopied] = useState(false)

  const copyCommand = () => {
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <section className="bench-card bench-cli-card" aria-labelledby="cli-card-title">
      <div className="bench-card-heading">
        <div>
          <span className="bench-kicker">00 / reference fixture</span>
          <h2 id="cli-card-title">CLI card lookalike</h2>
        </div>
        <span className="bench-coordinate">dense / dark / nested</span>
      </div>
      <p className="bench-card-instruction">A close, inspectable approximation of the UI-skills CLI card. Try the command rows, prompt, badges, copy action, and the clipped terminal edge.</p>
      <div className="bench-cli-shell">
        <div className="bench-cli-topbar">
          <div className="bench-cli-window-controls" aria-label="Terminal window controls">
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          <span className="bench-cli-title">ui-skills / terminal</span>
          <button className="bench-cli-icon-button" type="button" aria-label="Open terminal actions">···</button>
        </div>
        <div className="bench-cli-body">
          <div className="bench-cli-intro">
            <span className="bench-cli-prompt">$</span>
            <div>
              <strong>Ship interfaces that hold up under inspection.</strong>
              <p>Run a focused skill against the page, then review the exact element boundaries.</p>
            </div>
            <span className="bench-cli-status">ready</span>
          </div>
          <div className="bench-cli-command-list" role="list" aria-label="CLI commands">
            {cliCommands.map((item, index) => (
              <button
                className={`bench-cli-command${activeCommand === index ? " is-active" : ""}`}
                key={item.command}
                type="button"
                onClick={() => setActiveCommand(index)}
              >
                <span className="bench-cli-line-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="bench-cli-command-copy">
                  <code><span className="bench-cli-prompt">$</span> {item.command}</code>
                  <small>{item.note}</small>
                </span>
                <span className="bench-cli-command-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <div className="bench-cli-output" aria-live="polite">
            <div className="bench-cli-output-heading">
              <span>output / {String(activeCommand + 1).padStart(2, "0")}</span>
              <button type="button" onClick={copyCommand} aria-label="Copy selected command">{copied ? "copied" : "copy"}</button>
            </div>
            <code><span className="bench-cli-success">✓</span> {cliCommands[activeCommand].command}</code>
            <div className="bench-cli-tags">
              <span>12 targets</span>
              <span>0 warnings</span>
              <span>local</span>
            </div>
          </div>
          <label className="bench-cli-input-row">
            <span className="bench-cli-prompt">$</span>
            <input aria-label="CLI command input" defaultValue="skills check --target ./src" />
            <span className="bench-cli-caret" aria-hidden="true">▌</span>
          </label>
        </div>
      </div>
    </section>
  )
}

function UiSkillsOpeningFixture() {
  const [copied, setCopied] = useState(false)

  const copyCliCommand = () => {
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <section className="bench-card bench-uiskills-opening" aria-labelledby="uiskills-opening-title">
      <div className="bench-card-heading">
        <div>
          <span className="bench-kicker">00 / homepage reference</span>
          <h2 id="uiskills-opening-title">UI Skills opening section</h2>
        </div>
        <span className="bench-coordinate">hero / two cards</span>
      </div>
      <p className="bench-card-instruction">Lookalike of the first UI Skills homepage section: a centered statement followed by CLI and MCP cards. Inspect the text hierarchy, card edges, code control, and links.</p>
      <div className="bench-uiskills-hero">
        <span className="bench-uiskills-mark">UI SKILLS / DESIGN ENGINEERING</span>
        <h3>Curated skills for design engineering</h3>
        <p>Practical tools and guidance for building interfaces that feel intentional.</p>
      </div>
      <div className="bench-uiskills-card-grid">
        <div data-card-href="/cli" aria-label="Open CLI installation guide" role="link" tabIndex={0} className="bench-uiskills-card bench-uiskills-cli-card">
          <a className="bench-uiskills-card-link" href="/cli" aria-label="Open CLI installation guide">↗</a>
          <div className="bench-uiskills-card-description">
            <div>CLI</div>
            <div>Run the UI Skills CLI from your terminal.</div>
          </div>
          <div className="bench-uiskills-command-row" data-command-row="npx ui-skills">
            <span>npx ui-skills</span>
            <button type="button" aria-label="Copy command" onClick={copyCliCommand}>
              <span data-copy-icon="copy" className={copied ? "hidden" : ""}><CopyIcon /></span>
              <span data-copy-icon="check" className={copied ? "" : "hidden"}><CheckIcon /></span>
            </button>
          </div>
        </div>
        <div data-card-href="/mcp/docs" aria-label="Open MCP installation guide" role="link" tabIndex={0} className="bench-uiskills-card bench-uiskills-mcp-card">
          <a className="bench-uiskills-card-link" href="/mcp/docs" aria-label="Open MCP installation guide">↗</a>
          <div className="bench-uiskills-card-description">
            <div>MCP</div>
            <div>Connect your agent to the UI Skills catalog.</div>
          </div>
          <div className="bench-uiskills-agent-track" aria-label="Supported agents">
            <div className="bench-uiskills-agent-track-inner">
              {agentLogos.map(([name, src]) => <img key={name} src={src} alt={name} width="36" height="36" />)}
            </div>
            <div className="bench-uiskills-agent-track-inner" aria-hidden="true">
              {agentLogos.map(([name, src]) => <img key={name} src={src} alt="" width="36" height="36" />)}
            </div>
            <div className="bench-uiskills-agent-fade bench-uiskills-agent-fade-left" aria-hidden="true" />
            <div className="bench-uiskills-agent-fade bench-uiskills-agent-fade-right" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  )
}

function CopyIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
}

function InspectorEdgeCaseLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const closedShadowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext("2d")
    if (!context) return
    context.fillStyle = "#f8fafc"
    context.fillRect(0, 0, 320, 120)
    context.fillStyle = "#2563eb"
    context.fillRect(24, 24, 96, 64)
    context.fillStyle = "#f97316"
    context.beginPath()
    context.arc(220, 56, 30, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = "#172033"
    context.font = "12px monospace"
    context.fillText("bitmap surface", 104, 108)
  }, [])

  useEffect(() => {
    const host = closedShadowRef.current
    if (!host || host.shadowRoot || host.dataset.closedShadowReady === "true") return
    const shadow = host.attachShadow({ mode: "closed" })
    host.dataset.closedShadowReady = "true"
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = "closed shadow target"
    button.style.cssText = "border:1px solid #64748b;border-radius:6px;padding:10px 12px;color:#172033;background:#fff;font:11px ui-monospace,monospace"
    shadow.append(button)
  }, [])

  return (
    <section className="bench-card bench-edge-lab" aria-labelledby="edge-lab-title">
      <div className="bench-card-heading">
        <div><span className="bench-kicker">12 / production edge cases</span><h2 id="edge-lab-title">Inspector edge-case lab</h2></div>
        <span className="bench-coordinate">geometry / boundaries / scale</span>
      </div>
      <p className="bench-card-instruction">Use Inspect on the smallest visible target in each fixture. This section documents what the inspector should select, measure, and identify.</p>

      <div className="bench-edge-lab-grid">
        <div className="bench-edge-lab-panel">
          <span className="bench-edge-lab-label">01 / fragmented text</span>
          <p className="bench-fragmented-text" data-testid="fragmented-text">This sentence wraps across several lines and contains <span>nested inline text</span> with a second <strong>styled fragment</strong> to inspect.</p>
        </div>
        <div className="bench-edge-lab-panel bench-pseudo-panel">
          <span className="bench-edge-lab-label">02 / generated content</span>
          <div className="bench-pseudo-target" data-testid="pseudo-target">Inspect the element and its generated edges</div>
        </div>
        <div className="bench-edge-lab-panel">
          <span className="bench-edge-lab-label">03 / transforms</span>
          <div className="bench-transform-lab">
            <button className="bench-transform-target bench-transform-rotate" type="button" data-testid="rotated-target">rotated</button>
            <button className="bench-transform-target bench-transform-scale" type="button" data-testid="scaled-target">scaled</button>
            <button className="bench-transform-target bench-transform-skew" type="button" data-testid="skewed-target">skewed</button>
          </div>
        </div>
        <div className="bench-edge-lab-panel">
          <span className="bench-edge-lab-label">04 / SVG geometry</span>
          <svg className="bench-edge-svg" viewBox="0 0 320 120" role="img" aria-label="Inspector SVG targets">
            <path data-testid="svg-path-target" d="M18 96 C54 8 92 112 132 42 S220 16 302 88" fill="none" stroke="#2563eb" strokeWidth="12" strokeLinecap="round" />
            <circle data-testid="svg-circle-target" cx="76" cy="58" r="17" fill="#f97316" />
            <rect data-testid="svg-rect-target" x="192" y="28" width="70" height="48" fill="#86efac" transform="rotate(-10 227 52)" />
          </svg>
        </div>
        <div className="bench-edge-lab-panel">
          <span className="bench-edge-lab-label">05 / bitmap</span>
          <canvas ref={canvasRef} className="bench-edge-canvas" width="320" height="120" aria-label="Inspector canvas surface" data-testid="canvas-target" />
          <small>Canvas is one inspectable surface; its pixels are not DOM targets.</small>
        </div>
        <div className="bench-edge-lab-panel">
          <span className="bench-edge-lab-label">06 / closed boundary</span>
          <div ref={closedShadowRef} className="bench-closed-shadow" data-testid="closed-shadow-host" />
          <small>Inspect should stop at the host when the shadow root is closed.</small>
        </div>
        <div className="bench-edge-lab-panel bench-fixed-transform-panel">
          <span className="bench-edge-lab-label">07 / fixed in transform</span>
          <div className="bench-fixed-transform-frame"><button type="button" data-testid="fixed-transform-target">fixed target</button></div>
        </div>
        <div className="bench-edge-lab-panel">
          <span className="bench-edge-lab-label">08 / opaque iframe boundary</span>
          <iframe className="bench-opaque-iframe" title="Opaque sandbox boundary" sandbox="" srcDoc="<button style='margin:16px;padding:10px'>opaque child target</button>" />
          <small>Inspect should select the iframe boundary, not cross into its opaque document.</small>
        </div>
      </div>

      <div className="bench-edge-lab-panel bench-performance-panel">
        <span className="bench-edge-lab-label">09 / large DOM</span>
        <div className="bench-performance-grid" data-testid="large-dom-grid">
          {Array.from({ length: 1000 }, (_, index) => <button key={index} type="button">target {index + 1}</button>)}
        </div>
      </div>
    </section>
  )
}

const seededInitialState = {
  enabled: true,
  toolMode: "select" as const,
  toolbarPosition: { x: 24, y: 24 },
  guides: [{ id: "bench-initial-guide", orientation: "vertical" as const, position: 760 }],
  arrows: [{
    id: "bench-initial-arrow",
    start: { x: 520, y: 180 },
    end: { x: 700, y: 240 },
    color: "#0d99ff",
    width: 2,
  }],
  penStrokes: [{
    id: "bench-initial-pen",
    points: [{ x: 520, y: 300 }, { x: 580, y: 270 }, { x: 640, y: 300 }],
    color: "#ef4444",
    width: 3,
  }],
  textAnnotations: [{
    id: "bench-initial-text",
    x: 520,
    y: 360,
    text: "Seeded annotation",
  }],
}

export function Bench() {
  const count = 120

  return (
    <>
      <Mesurer persistKey="mesurer-bench-initial-state" persistOnReload={false} initialState={seededInitialState} />
      <main className="bench-page">
        <header className="bench-header">
          <div>
            <p className="bench-eyebrow">MESURER / LOCAL TEST PAGE</p>
            <h1>Test every edge case.</h1>
            <p className="bench-intro">Use the Mesurer toolbar above, then follow each card from top to bottom.</p>
          </div>
        </header>
        <section className="bench-card bench-black-card" aria-labelledby="black-card-title">
          <div className="bench-card-heading">
            <div>
              <span className="bench-kicker">00 / dark surface</span>
              <h2 id="black-card-title">Black card contrast test</h2>
            </div>
            <span className="bench-coordinate">#000 / #323232</span>
          </div>
          <p className="bench-card-instruction">Use the toolbar and Settings on top of this card. Inspect the text, controls, separators, and inset surface.</p>
          <div className="bench-black-card-grid">
            <div>
              <span className="bench-black-eyebrow">Interface review</span>
              <strong>Dark surfaces should still feel precise.</strong>
              <p>Try comments, measurements, guides, and the floating menus against this background.</p>
            </div>
            <div className="bench-black-inset">
              <span>Inset panel</span>
              <button type="button">Test control</button>
            </div>
          </div>
        </section>
        <UiSkillsOpeningFixture />
        <CliCardFixture />
        <InspectorEdgeCaseLab />
        <section className="bench-card" aria-labelledby="initial-state-title">
          <div className="bench-card-heading">
            <div><span className="bench-kicker">00 / initial state</span><h2 id="initial-state-title">Initial workspace</h2></div>
            <span className="bench-coordinate">toolbar / guides / annotations</span>
          </div>
          <p className="bench-card-instruction">This page starts with a positioned toolbar, guide, arrow, pen stroke, and text annotation. Use it to verify `initialState` rendering before interacting.</p>
        </section>
        <TestCanvas count={count} />
      </main>
    </>
  )
}
