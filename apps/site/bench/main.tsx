import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Mesurer } from "mesurer"
import "./styles.css"

const colors = ["#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3", "#ede9fe", "#cffafe"]

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
      <section class="panel" style="margin: 16px"><h2>Nested iframe boundary</h2><iframe title="Nested child iframe" srcdoc="<button style='margin:18px;padding:12px'>nested iframe target</button>"></iframe></section>
    </div>
    <script>
      const host = document.querySelector('#shadow-host');
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = '<button style="padding:10px;border:1px solid #64748b;border-radius:4px;background:#dbeafe">shadow button</button>';
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
  const popoverTriggerRef = useRef<HTMLButtonElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const popoverPosition = useAnchoredSurface(popoverOpen, popoverTriggerRef)
  const menuPosition = useAnchoredSurface(menuOpen, menuTriggerRef)

  useEffect(() => {
    if (!dialogOpen && !popoverOpen && !menuOpen) return
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setDialogOpen(false)
      setPopoverOpen(false)
      setMenuOpen(false)
    }
    window.addEventListener("keydown", dismissOnEscape)
    return () => window.removeEventListener("keydown", dismissOnEscape)
  }, [dialogOpen, menuOpen, popoverOpen])

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

export function Bench() {
  const count = 120

  return (
    <>
      <Mesurer />
      <main className="bench-page">
        <header className="bench-header">
          <div>
            <p className="bench-eyebrow">MESURER / LOCAL TEST PAGE</p>
            <h1>Test every edge case.</h1>
            <p className="bench-intro">Use the Mesurer toolbar above, then follow each card from top to bottom.</p>
          </div>
        </header>
        <TestCanvas count={count} />
      </main>
    </>
  )
}
