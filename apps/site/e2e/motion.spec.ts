import { expect, test, type Page } from "@playwright/test"

async function fixture(page: Page, kind: "mixed" | "hybrid" | "managed" | "observed" | "shadow" | "pseudo", unsupported = false) {
  await page.goto("/bench")
  await expect(page.getByRole("button", { name: "Comments (M)" })).toBeVisible()
  if (unsupported) await page.evaluate(() => Object.defineProperty(Element.prototype, "getAnimations", { value: undefined, configurable: true }))
  await page.evaluate((kind) => {
    const source = document.createElement("div")
    source.id = "motion-review-source"
    source.style.cssText = "position:fixed;right:40px;top:240px;width:260px;height:180px;background:white;border:1px solid gray;padding:30px;box-sizing:border-box;z-index:2"
    if (kind === "shadow") {
      let constructions = 0
      customElements.define("motion-review-box", class extends HTMLElement {
        constructor() {
          super()
          constructions++
          this.attachShadow({ mode: "open" }).innerHTML = '<style>button::before{content:"★";color:rgb(255, 0, 0)}button{width:120px;height:40px}</style><button>Shadow motion</button>'
        }
      })
      source.append(document.createElement("motion-review-box"))
      Object.defineProperty(window, "reviewConstructions", { get: () => constructions })
    } else source.innerHTML = '<span id="motion-review-child" style="display:block;width:140px;height:50px">Child motion</span><img width="24" height="24" src="/motion-source.svg">'
    document.querySelector("main")!.append(source)
    if (kind === "pseudo") {
      const styles = document.createElement("style")
      styles.textContent = '#motion-review-source::before{content:"pulse";position:absolute;top:4px;left:12px;animation:review-pseudo 1s linear infinite alternate}@keyframes review-pseudo{from{opacity:.2}to{opacity:1}}'
      document.head.append(styles)
    }
    const child = source.querySelector("motion-review-box")?.shadowRoot?.querySelector("button") ?? source.querySelector("span")!
    if (kind === "observed") {
      child.setAttribute("style", child.getAttribute("style") + ";transform:translateX(var(--review-x, 0px))")
      const draw = (time: number) => { source.style.setProperty("--review-x", `${Math.sin(time / 300) * 20}px`); requestAnimationFrame(draw) }
      requestAnimationFrame(draw)
    } else {
      const short = child.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 1000, fill: "forwards" })
      const long = child.animate([{ transform: "translateX(-20px)" }, { transform: "translateX(20px)" }], { duration: 4000, iterations: Infinity })
      short.id = "short-motion"
      long.id = "long-motion"
      short.pause(); short.currentTime = 1000
      long.pause(); long.currentTime = 2000
      if (kind === "managed") {
        source.setAttribute("torph-root", "")
        child.setAttribute("torph-item", "")
        window.setTimeout(() => { child.textContent = "Next morph cycle" }, 900)
      }
      if (kind === "hybrid") {
        ;(long.effect as KeyframeEffect).composite = "add"
        long.play()
        const draw = (time: number) => {
          (child as HTMLElement).style.transform = `translateY(${Math.sin(time / 300) * 12}px)`
          requestAnimationFrame(draw)
        }
        requestAnimationFrame(draw)
      }
    }
  }, kind)
  if (kind !== "shadow") await expect.poll(() => page.evaluate(() => (document.querySelector("#motion-review-source img") as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await page.mouse.click((await page.locator("#motion-review-source").boundingBox())!.x + 5, 245)
  const player = page.locator("[data-mesurer-motion-player]")
  await expect(player).toBeVisible()
  return player
}

test.beforeEach(async ({ page }) => {
  await page.route("**/motion-source.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="red"/></svg>' }))
})

test("mixed descendant animations use one timeline with finite clamping and keyboard controls", async ({ page }) => {
  const player = await fixture(page, "mixed")
  const timeline = player.getByRole("slider", { name: "Scrub motion timeline" })
  await expect(timeline).toHaveAttribute("aria-valuenow", "2000")
  await timeline.press("End")
  await expect(timeline).toHaveAttribute("aria-valuenow", "4000")
  expect(await page.evaluate(() => document.querySelector("#motion-review-source")!.getAnimations({ subtree: true }).map((animation) => animation.currentTime))).toEqual([1000, 4000])
  await timeline.press("Home")
  await expect(timeline).toHaveAttribute("aria-valuenow", "0")
  await player.getByRole("button", { name: "Play", exact: true }).click()
  await expect(player.getByRole("button", { name: "Pause", exact: true })).toBeVisible()
})

test("scrubbing updates the paused preview within two frames and keeps the cursor under the pointer", async ({ page }) => {
  const player = await fixture(page, "mixed")
  const timeline = player.getByRole("slider", { name: "Scrub motion timeline" })
  await expect(timeline).toHaveAttribute("aria-valuenow", "2000")
  await timeline.press("Home")
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const styles = await player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    const mirror = host.shadowRoot!.querySelector('[data-motion-snapshot="1"]') as HTMLElement
    return { mirror: mirror.style.transform, source: getComputedStyle(document.querySelector("#motion-review-child")!).transform }
  })
  expect(styles.mirror).toBe(styles.source)
  // The longest animation remains at zero while another animation changes.
  await page.evaluate(() => { document.querySelector("#motion-review-child")!.getAnimations().find((animation) => animation.id === "short-motion")!.currentTime = 1000 })
  const opacity = () => player.locator('[data-motion-snapshot="1"]').evaluate((node) => (node as HTMLElement).style.opacity)
  await expect.poll(opacity).toBe("1")
  await timeline.press("Home")
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(await opacity()).toBe("0.4")
  const box = (await timeline.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2, { steps: 8 })
  await expect.poll(async () => Math.abs(Number(await timeline.getAttribute("aria-valuenow")) - 3600)).toBeLessThan(5)
  const cursor = (await player.locator(".mesurer-recording-playhead").boundingBox())!
  expect(Math.abs(cursor.x - (box.x + box.width * 0.9))).toBeLessThan(2)
  await page.mouse.move(box.x + box.width + 20, box.y + box.height / 2)
  await page.mouse.up()
  await expect(timeline).toHaveAttribute("aria-valuenow", "4000")
})

test("descendant CSS-variable motion works with an unavailable animation API", async ({ page }) => {
  const player = await fixture(page, "observed", true)
  await player.getByRole("button", { name: "Show Inspect", exact: true }).click()
  await expect(player).toContainText("observed motion")
  await expect(player.getByRole("status", { name: "JavaScript animation. Controls unavailable." })).toBeVisible()
  await expect(player.getByRole("slider", { name: "Scrub motion timeline" })).toHaveCount(0)
  await expect(player.getByRole("combobox", { name: "Playback speed" })).toHaveCount(0)
  const transform = () => player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    return host.shadowRoot!.querySelector('[data-motion-snapshot="1"]')!.getAttribute("style")
  })
  const first = await transform()
  await expect.poll(transform).not.toBe(first)
})

test("native animations plus JavaScript updates on the same property stay read-only and live", async ({ page }) => {
  const player = await fixture(page, "mixed")
  await page.evaluate(() => {
    const child = document.querySelector("#motion-review-child") as HTMLElement
    const animations = child.getAnimations()
    const long = animations.find((animation) => animation.id === "long-motion")!
    ;(long.effect as KeyframeEffect).composite = "add"
    animations.forEach((animation) => animation.play())
    const draw = (time: number) => {
      child.style.transform = `translateY(${Math.sin(time / 300) * 12}px)`
      requestAnimationFrame(draw)
    }
    requestAnimationFrame(draw)
  })
  await expect(player.getByRole("status", { name: "JavaScript animation. Controls unavailable." })).toBeVisible()
  await expect(player.getByRole("button", { name: /^(Play|Pause)$/ })).toHaveCount(0)
  await expect(player.getByRole("slider", { name: "Scrub motion timeline" })).toHaveCount(0)
  await expect(player.getByRole("combobox", { name: "Playback speed" })).toHaveCount(0)
  const mirrorTransform = () => player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    return (host.shadowRoot!.querySelector('[data-motion-snapshot="1"]') as HTMLElement).style.transform
  })
  const first = await mirrorTransform()
  await expect.poll(mirrorTransform).not.toBe(first)
  expect(await page.evaluate(() => document.querySelector("#motion-review-child")!.getAnimations().find((animation) => animation.id === "long-motion")!.playState)).toBe("running")
})

test("mixed motion shows its read-only message without flashing playback controls", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { flashed: false }
    Object.assign(window, { motionControlFlash: state })
    new MutationObserver(() => {
      if (document.querySelector('[data-mesurer-motion-player] [aria-label="Playback speed"]')) state.flashed = true
    }).observe(document, { childList: true, subtree: true })
  })
  const player = await fixture(page, "hybrid")
  await expect(player.getByRole("status", { name: "JavaScript animation. Controls unavailable." })).toBeVisible()
  await expect(player.getByRole("combobox", { name: "Playback speed" })).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { motionControlFlash: { flashed: boolean } }).motionControlFlash.flashed)).toBe(false)
})

test("Torph-managed text shows the message on the first card render before its next JS cycle", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { firstMessage: "", seen: false, flashed: false }
    Object.assign(window, { torphCardState: state })
    new MutationObserver(() => {
      const card = document.querySelector("[data-mesurer-motion-player]")
      if (!card) return
      if (!state.seen) {
        state.seen = true
        state.firstMessage = card.querySelector('[role="status"]')?.textContent?.trim() ?? ""
      }
      if (card.querySelector('[aria-label="Playback speed"]')) state.flashed = true
    }).observe(document, { childList: true, subtree: true })
  })
  const player = await fixture(page, "managed")
  await expect(player.getByRole("status", { name: "JavaScript animation. Controls unavailable." })).toBeVisible()
  await expect(page.locator("#motion-review-child")).toHaveText("Next morph cycle")
  expect(await page.evaluate(() => (window as unknown as { torphCardState: unknown }).torphCardState)).toEqual({ firstMessage: "JavaScript animation. Controls unavailable.", seen: true, flashed: false })
})

test("a JS style update shows the unavailable message by the next rendered frame", async ({ page }) => {
  const player = await fixture(page, "mixed")
  await expect(player.getByRole("combobox", { name: "Playback speed" })).toBeEnabled()
  const message = await page.evaluate(async () => {
    const child = document.querySelector("#motion-review-child") as HTMLElement
    child.style.transform = "translateY(12px)"
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return document.querySelector('[data-mesurer-motion-player] [role="status"]')?.textContent?.trim()
  })
  expect(message).toBe("JavaScript animation. Controls unavailable.")
  await expect(player.getByRole("combobox", { name: "Playback speed" })).toHaveCount(0)
})

test("the preview appears before playback controls finish classification", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { seen: false, hadControls: false, hadPreview: false }
    Object.assign(window, { initialMotionCard: state })
    new MutationObserver(() => {
      const card = document.querySelector("[data-mesurer-motion-player]")
      if (!card || state.seen) return
      state.seen = true
      state.hadControls = Boolean(card.querySelector('[aria-label="Playback speed"]'))
      state.hadPreview = [...card.querySelectorAll("div")].some((node) => node.shadowRoot)
    }).observe(document, { childList: true, subtree: true })
  })
  const player = await fixture(page, "mixed")
  await expect(player.getByRole("combobox", { name: "Playback speed" })).toBeEnabled()
  expect(await page.evaluate(() => (window as unknown as { initialMotionCard: unknown }).initialMotionCard)).toEqual({ seen: true, hadControls: false, hadPreview: true })
})

test("text morphing refreshes replaced glyphs, edited text, and native effects", async ({ page }) => {
  const player = await fixture(page, "mixed")
  await page.evaluate(() => {
    let samples = 0
    Object.defineProperty(window, "reviewSnapshotSamples", { get: () => samples })
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      if (this.hasAttribute("data-motion-snapshot")) samples++
      return animate.call(this, frames, options)
    }
    const source = document.querySelector("#motion-review-source")!
    let generation = 0
    const morph = () => {
      const glyph = document.createElement("span")
      glyph.style.cssText = "display:block;width:140px;height:50px"
      glyph.dataset.generation = String(++generation)
      glyph.append(document.createTextNode(`Text ${generation}`))
      source.replaceChildren(glyph)
      glyph.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 1200, iterations: Infinity })
    }
    morph()
    window.setInterval(morph, 600)
  })
  await expect(player.getByRole("status", { name: "JavaScript animation. Controls unavailable." })).toBeVisible()
  const mirrorText = () => player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    return host.shadowRoot!.textContent
  })
  await expect.poll(mirrorText).toMatch(/Text \d+/)
  const first = await mirrorText()
  await expect.poll(mirrorText).not.toBe(first)
  // Editing an existing text node does not replace the source or its animation.
  await page.evaluate(() => {
    const source = document.querySelector("#motion-review-source")!
    const update = () => {
      const text = source.querySelector("span")?.firstChild
      if (text) text.textContent = `Edited ${performance.now()}`
    }
    update()
    window.setInterval(update, 50)
  })
  await expect.poll(mirrorText).toContain("Edited")
  expect(await page.evaluate(() => (window as unknown as { reviewSnapshotSamples: number }).reviewSnapshotSamples)).toBe(0)
})

test("fast mixed glyph updates retain the preview root and stable framing", async ({ page }) => {
  const player = await fixture(page, "observed")
  await page.evaluate(() => {
    const source = document.querySelector("#motion-review-source")!
    let generation = 0
    window.setInterval(() => {
      const glyph = document.createElement("span")
      glyph.style.cssText = "display:block;width:140px;height:50px;transform:translateX(var(--review-x))"
      glyph.textContent = `Glyph ${++generation}`
      source.replaceChildren(glyph)
      glyph.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 600 })
    }, 64)
  })
  const root = player.locator('[data-motion-snapshot="0"]')
  await expect(root).toContainText(/Glyph [4-9]\d*/)
  const handle = await root.elementHandle()
  const framing = await root.evaluate((node) => (node.parentElement as HTMLElement).style.transform)
  const first = await root.textContent()
  await expect.poll(() => root.textContent()).not.toBe(first)
  expect(await handle!.evaluate((node) => node.isConnected)).toBe(true)
  expect(await root.evaluate((node) => (node.parentElement as HTMLElement).style.transform)).toBe(framing)
  await expect.poll(() => root.evaluate((node) => (node.firstElementChild as HTMLElement).style.transform)).toMatch(/matrix/)
  expect(await root.evaluate((node) => (node as HTMLElement).style.top)).toBe("0px")
})

test("snapshot mirrors shadow content and pseudo-elements without constructing new custom elements", async ({ page }) => {
  const player = await fixture(page, "shadow")
  expect(await page.evaluate(() => (window as unknown as { reviewConstructions: number }).reviewConstructions)).toBe(1)
  const result = await player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    const button = host.shadowRoot!.querySelector("button")!
    return { text: button.textContent, before: getComputedStyle(button, "::before").content, color: getComputedStyle(button, "::before").color }
  })
  expect(result).toEqual({ text: "Shadow motion", before: '"★"', color: "rgb(255, 0, 0)" })
})

test("animated pseudo-elements stay on their own style rule in the mirror", async ({ page }) => {
  const player = await fixture(page, "pseudo")
  const values = () => player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    const clone = host.shadowRoot!.querySelector('[data-motion-snapshot="0"]')!
    return { root: getComputedStyle(clone).opacity, pseudo: getComputedStyle(clone, "::before").opacity }
  })
  const first = await values()
  expect(first.root).toBe("1")
  await expect.poll(async () => (await values()).pseudo).not.toBe(first.pseudo)
  expect((await values()).root).toBe("1")
})

test("custom speed keeps slider and input synchronized and keyframes copy remains complete", async ({ page }) => {
  const player = await fixture(page, "mixed")
  const speed = player.getByRole("combobox", { name: "Playback speed" })
  await speed.selectOption("custom")
  const dialog = player.getByRole("dialog", { name: "Custom playback speed" })
  const input = dialog.getByRole("textbox", { name: "Speed value" })
  const slider = dialog.getByRole("slider", { name: "Speed", exact: true })
  await input.focus()
  const track = (await dialog.locator("[data-slider-container]").boundingBox())!
  await page.mouse.click(track.x + 8 + (track.width - 16) * 0.75, track.y + track.height / 2)
  await expect(input).toHaveValue((await slider.getAttribute("aria-valuetext"))!)
  const value = (await slider.getAttribute("aria-valuenow"))!
  await player.getByRole("button", { name: "Close custom speed" }).click()
  await expect(speed).toHaveValue(value)
  await player.getByRole("button", { name: "Show Inspect", exact: true }).click()
  await player.getByRole("button", { name: "Show keyframes", exact: true }).click()
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { (window as unknown as { reviewClipboard: string }).reviewClipboard = value } } }))
  await player.getByRole("button", { name: "long-motion", exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { reviewClipboard: string }).reviewClipboard)).toContain("@keyframes long-motion")
})

test("media snapshots are inert and paused preview metadata stays bounded", async ({ page }) => {
  let requests = 0
  page.on("request", (request) => { if (request.url().endsWith("/motion-source.svg")) requests++ })
  const player = await fixture(page, "mixed")
  expect(await player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    return { images: host.shadowRoot!.querySelectorAll("img,video,iframe").length, canvases: host.shadowRoot!.querySelectorAll("canvas").length }
  })).toEqual({ images: 0, canvases: 1 })
  expect(await player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    return [...host.shadowRoot!.querySelector("canvas")!.getContext("2d")!.getImageData(1, 1, 1, 1).data]
  })).toEqual([255, 0, 0, 255])
  expect(requests).toBe(1)
  await page.waitForTimeout(1700)
  await page.evaluate(() => {
    const original = KeyframeEffect.prototype.getKeyframes
    ;(window as unknown as { reviewFrameReads: number }).reviewFrameReads = 0
    KeyframeEffect.prototype.getKeyframes = function () {
      ;(window as unknown as { reviewFrameReads: number }).reviewFrameReads++
      return original.call(this)
    }
  })
  await page.waitForTimeout(1000)
  expect(await page.evaluate(() => (window as unknown as { reviewFrameReads: number }).reviewFrameReads)).toBeLessThan(40)
})
