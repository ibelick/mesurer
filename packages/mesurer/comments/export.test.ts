import { describe, expect, it } from "vitest"
import type { CommentTarget, CommentThread } from "../core/types"
import { formatCommentsForAgent } from "./export"

const PAGE = "https://example.com/pricing"
const PHONE = { width: 375, height: 667 }
const WINDOW = { width: 1512, height: 857 }

const comment = (text: string, target: Partial<CommentTarget> = {}, replies: string[] = []): CommentThread => ({
  id: text,
  target: {
    selector: "main > h1",
    tagName: "h1",
    textSnippet: "Pricing",
    htmlPreview: "<h1>Pricing</h1>",
    attributes: {},
    styles: "",
    rect: { left: 0, top: 0, width: 100, height: 20 },
    documentPoint: { x: 0, y: 0 },
    ...target,
  },
  messages: [text, ...replies].map((message) => ({ id: message, role: "user", text: message, createdAt: 0 })),
  status: "open",
  createdAt: 0,
  updatedAt: 0,
})

const TARGET = "[<h1>Pricing</h1> selector: `main > h1`]"

describe("formatCommentsForAgent", () => {
  it("lists the comments under the page and the size of the window they were left in", () => {
    expect(formatCommentsForAgent([comment("Too big.", { url: PAGE, viewport: PHONE })])).toBe(
      [`URL: ${PAGE}\nViewport: 375 × 667 CSS px`, `1. Too big.\n${TARGET}`].join("\n\n"),
    )
  })

  it("groups them by place, in the order the places first come up, and numbers them as listed", () => {
    const tablet = { width: 820, height: 1180 }
    const copied = formatCommentsForAgent([
      comment("First.", { url: PAGE, viewport: PHONE }),
      comment("Second.", { url: PAGE, viewport: tablet }),
      comment("Third.", { url: PAGE, viewport: PHONE }),
    ])
    expect(copied).toBe(
      [
        `URL: ${PAGE}\nViewport: 375 × 667 CSS px`,
        `1. First.\n${TARGET}`,
        `2. Third.\n${TARGET}`,
        `URL: ${PAGE}\nViewport: 820 × 1180 CSS px`,
        `3. Second.\n${TARGET}`,
      ].join("\n\n"),
    )
  })

  it("keeps apart two pages at the same size", () => {
    const other = "https://example.com/about"
    const copied = formatCommentsForAgent([
      comment("Here.", { url: PAGE, viewport: PHONE }),
      comment("There.", { url: other, viewport: PHONE }),
    ])
    expect(copied).toContain(`URL: ${PAGE}\nViewport: 375 × 667 CSS px\n\n1. Here.`)
    expect(copied).toContain(`URL: ${other}\nViewport: 375 × 667 CSS px\n\n2. There.`)
  })

  it("puts a comment left before places were kept under the window's own", () => {
    const copied = formatCommentsForAgent([comment("Old."), comment("New.", { url: PAGE, viewport: WINDOW })], PAGE, WINDOW)
    expect(copied).toBe(
      [`URL: ${PAGE}\nViewport: 1512 × 857 CSS px`, `1. Old.\n${TARGET}`, `2. New.\n${TARGET}`].join("\n\n"),
    )
  })

  it("lists a thread's replies under its first message", () => {
    expect(formatCommentsForAgent([comment("Too big.", {}, ["Agreed."])])).toBe(`1. - Too big.\n- Agreed.\n${TARGET}`)
  })
})
