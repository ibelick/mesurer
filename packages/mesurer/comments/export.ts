import type { CommentThread } from "../core/types"

const formatTarget = (comment: CommentThread) => {
  const { target } = comment
  const text = target.textSnippet ? `${target.textSnippet}` : ""
  return `[<${target.tagName}>${text}</${target.tagName}> selector: \`${target.selector}\`]`
}

type Viewport = {
  width: number
  height: number
}

const formatFeedback = (comment: CommentThread) => {
  const messages = comment.messages.map((message) => message.text)
  return messages.length === 1 ? messages[0] : messages.map((message) => `- ${message}`).join("\n")
}

// Where a comment was left: the page, and the size of the window it was in.
const formatPlace = (url?: string, viewport?: Viewport) =>
  [
    url ? `URL: ${url}` : "",
    viewport ? `Viewport: ${viewport.width} × ${viewport.height} CSS px` : "",
  ].filter(Boolean).join("\n")

// The comments under the place each was left in, the places in the order they first come up.
// One left before places were kept goes under `url` and `viewport`, the window's own.
export const formatCommentsForAgent = (comments: CommentThread[], url = "", viewport?: Viewport) => {
  const places = new Map<string, CommentThread[]>()
  for (const comment of comments) {
    const place = formatPlace(comment.target.url ?? url, comment.target.viewport ?? viewport)
    places.set(place, [...(places.get(place) ?? []), comment])
  }
  // Numbered in the order they are listed, across the places.
  const listed = [...places.values()].flat()
  return [...places]
    .flatMap(([place, group]) => [
      place,
      ...group.map((comment) => `${listed.indexOf(comment) + 1}. ${formatFeedback(comment)}\n${formatTarget(comment)}`),
    ])
    .filter(Boolean)
    .join("\n\n")
}

export const copyCommentsForAgent = async (
  comments: CommentThread[],
  ownerWindow: Window = window,
) => {
  const unresolvedComments = comments.filter((comment) => comment.status === "open")
  if (unresolvedComments.length === 0) return false
  await ownerWindow.navigator.clipboard.writeText(
    formatCommentsForAgent(unresolvedComments, ownerWindow.location.href, {
      width: ownerWindow.innerWidth,
      height: ownerWindow.innerHeight,
    }),
  )
  return true
}

export const copyCommentSelector = async (
  selector: string,
  ownerWindow: Window = window,
) => {
  await ownerWindow.navigator.clipboard.writeText(selector)
}
