import { expect, test, type Page } from "@playwright/test"

async function fixture(page: Page, kind: "mixed" | "observed" | "shadow" | "pseudo", unsupported = false) {
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

test("descendant CSS-variable motion works with an unavailable animation API", async ({ page }) => {
  const player = await fixture(page, "observed", true)
  await player.getByRole("button", { name: "Show Inspect", exact: true }).click()
  await expect(player).toContainText("observed motion")
  await expect(player.getByRole("combobox", { name: "Playback speed" })).toBeDisabled()
  const transform = () => player.evaluate((node) => {
    const host = [...node.querySelectorAll("div")].find((div) => div.shadowRoot)!
    return host.shadowRoot!.querySelector('[data-motion-snapshot="1"]')!.getAttribute("style")
  })
  const first = await transform()
  await expect.poll(transform).not.toBe(first)
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
