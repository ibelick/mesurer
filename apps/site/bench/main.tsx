import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Mesurer } from "mesurer"
import "./styles.css"

type Preset = "edges" | "dense" | "scroll" | "transforms" | "all"

const PRESETS: Record<Preset, { label: string; count: number }> = {
  edges: { label: "Edges", count: 24 },
  dense: { label: "Dense layout", count: 120 },
  scroll: { label: "Nested scroll", count: 72 },
  transforms: { label: "Transforms", count: 48 },
  all: { label: "All stress", count: 500 },
}

const colors = ["#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3", "#ede9fe", "#cffafe"]

function TestCanvas({ count, preset }: { count: number; preset: Preset }) {
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
  }, [count, preset])

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
            <h2 id="edge-title">Edges &amp; targets</h2>
          </div>
          <span className="bench-coordinate">0, 0 → 100vw, 100vh</span>
        </div>
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
        <div className="bench-generated-grid">
          {Array.from({ length: count }, (_, index) => (
            <article
              className={`bench-generated-item ${preset === "transforms" || preset === "all" ? "bench-transformed" : ""}`}
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

      <section className="bench-split-grid">
        <article className="bench-card bench-scroll-card" aria-labelledby="scroll-title">
          <div className="bench-card-heading">
            <div><span className="bench-kicker">03 / overflow</span><h2 id="scroll-title">Nested scroll</h2></div>
          </div>
          <div className="bench-scroll-frame">
            {Array.from({ length: 18 }, (_, index) => <div className="bench-scroll-row" key={index}><span>row {String(index + 1).padStart(2, "0")}</span><button type="button">Action</button></div>)}
          </div>
        </article>
        <article className="bench-card" aria-labelledby="media-title">
          <div className="bench-card-heading">
            <div><span className="bench-kicker">04 / rendered</span><h2 id="media-title">Canvas &amp; SVG</h2></div>
          </div>
          <canvas ref={canvasRef} aria-label="Generated canvas test surface" />
          <svg className="bench-svg" viewBox="0 0 320 120" role="img" aria-label="Generated SVG test surface">
            <path d="M8 98 C58 8 116 112 164 42 S260 20 312 82" fill="none" stroke="#0f172a" strokeWidth="2" />
            <circle cx="72" cy="57" r="18" fill="#f59e0b" /><rect x="190" y="28" width="74" height="52" fill="#86efac" transform="rotate(-8 227 54)" />
          </svg>
        </article>
      </section>

      <section className="bench-card bench-special-grid" aria-labelledby="special-title">
        <div className="bench-card-heading">
          <div><span className="bench-kicker">05 / boundaries</span><h2 id="special-title">Transforms, form controls &amp; boundaries</h2></div>
        </div>
        <p className="bench-section-note">Try every kind of target: normal HTML, form controls, transformed shapes, shadow DOM, and iframe content.</p>
        <div className="bench-special-items">
          <div className="bench-transform-box">rotated target</div>
          <label className="bench-field">Text target<input aria-label="Bench text input" placeholder="Type into me" /></label>
          <label className="bench-field">Select target<select aria-label="Bench select"><option>Option one</option><option>Option two</option></select></label>
          <div ref={shadowRef} className="bench-shadow-host" aria-label="Shadow DOM target" />
          <iframe title="Nested iframe target" className="bench-iframe" srcDoc="<button style='margin:16px;padding:10px'>Iframe target</button>" />
        </div>
        <div className="bench-native-elements">
          <a href="#native-elements">A real link target</a>
          <label><input type="checkbox" /> checkbox</label>
          <label><input type="radio" name="bench-radio" defaultChecked /> radio</label>
          <button type="button">native button</button>
          <table><tbody><tr><th>Table</th><td>cell target</td></tr></tbody></table>
        </div>
      </section>
    </>
  )
}

export function Bench() {
  const [preset, setPreset] = useState<Preset>("dense")
  const [count, setCount] = useState(PRESETS.dense.count)
  const [showGuides, setShowGuides] = useState(false)
  const activePreset = PRESETS[preset]

  const choosePreset = (next: Preset) => {
    setPreset(next)
    setCount(PRESETS[next].count)
  }

  return (
    <>
      <Mesurer />
      <main className="bench-page">
        <header className="bench-header">
          <div>
            <p className="bench-eyebrow">MESURER / LOCAL PLAYGROUND</p>
            <h1>Stress the interface.</h1>
            <p className="bench-intro">Use the Mesurer toolbar above to inspect, measure, annotate, and comment on the awkward elements below.</p>
          </div>
          <div className="bench-status"><span className="bench-status-dot" /> package source / live</div>
        </header>
        <section className="bench-how-to" aria-label="How to use the bench">
          <div className="bench-how-step"><span>01</span><strong>Pick a preset</strong><p>Change the shape and number of elements.</p></div>
          <div className="bench-how-step"><span>02</span><strong>Choose a Mesurer tool</strong><p>Try Inspect, Comments, Guides, Arrows, Text, or Screenshot.</p></div>
          <div className="bench-how-step"><span>03</span><strong>Try the awkward bits</strong><p>Test corners, scrolling, transforms, frames, and dense layouts.</p></div>
        </section>
        <section className="bench-controls" aria-label="Bench controls">
          <div className="bench-control-group">
            <span className="bench-control-label">Preset</span>
            {(Object.keys(PRESETS) as Preset[]).map((key) => <button type="button" className={preset === key ? "bench-control active" : "bench-control"} key={key} onClick={() => choosePreset(key)}>{PRESETS[key].label}</button>)}
          </div>
          <div className="bench-control-group bench-count-control">
            <label className="bench-control-label" htmlFor="bench-count">Nodes</label>
            <input id="bench-count" type="range" min="12" max="1000" step="1" value={count} onChange={(event) => { setCount(Number(event.target.value)); setPreset("dense") }} />
            <output>{count.toLocaleString()}</output>
          </div>
          <button type="button" className={showGuides ? "bench-control active" : "bench-control"} onClick={() => setShowGuides((value) => !value)}>{showGuides ? "Hide guides" : "Show guides"}</button>
        </section>
        {showGuides ? <div className="bench-guide-line bench-guide-horizontal" aria-hidden="true" /> : null}
        <div className="bench-readout"><span>{activePreset.label}</span><span>{count.toLocaleString()} nodes</span><span>scroll: enabled</span><span>viewport: {window.innerWidth} × {window.innerHeight}</span></div>
        <TestCanvas count={count} preset={preset} />
      </main>
    </>
  )
}
