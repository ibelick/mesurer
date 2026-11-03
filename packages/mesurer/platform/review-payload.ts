import type { CommentThread } from "../core/types"
import type { TestReviewPayload } from "./api"
import { privatePageUrl } from "../core/review/platform"

const commentText = (comment: CommentThread) =>
  comment.messages.map((message) => message.text).join("\n").trim().slice(0, 2_000)

export const createTestReviewPayload = (ownerWindow: Window, comments: CommentThread[]): TestReviewPayload => ({
  version: 1,
  pageUrl: privatePageUrl(ownerWindow.location.href),
  origin: ownerWindow.location.origin,
  title: ownerWindow.document.title.trim().slice(0, 300) || "Untitled page",
  viewport: { width: ownerWindow.innerWidth, height: ownerWindow.innerHeight },
  annotations: [],
  comments: comments.slice(0, 500).map((comment) => ({
    id: comment.id,
    selector: comment.target.selector,
    text: commentText(comment),
    status: comment.status,
    x: comment.target.documentPoint.x,
    y: comment.target.documentPoint.y,
    width: comment.target.rect.width,
    height: comment.target.rect.height,
  })),
  selectedElements: [],
  measurements: [],
})
