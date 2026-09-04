import type { CommentThread } from "../core/types"

const formatAttributes = (attributes: Record<string, string>) =>
  Object.entries(attributes)
    .map(([name, value]) => `- ${name}: \`${value}\``)
    .join("\n")

export const formatCommentsForAgent = (comments: CommentThread[], url = "") =>
  [
    "# Mesurer Comments",
    url ? `\nURL: ${url}` : "",
    ...comments.map((comment, index) => {
      const { target } = comment
      return [
        `\n## Comment ${index + 1}`,
        `Status: ${comment.status}`,
        "\n### Feedback",
        ...comment.messages.map((message) => `- User: ${message.text}`),
        "\n### DOM Target",
        `- Element: \`${target.tagName}\``,
        `- Selector: \`${target.selector}\``,
        `- Text: ${target.textSnippet || "(none)"}`,
        `- Position: ${Math.round(target.rect.left)}px, ${Math.round(target.rect.top)}px`,
        `- Size: ${Math.round(target.rect.width)}px x ${Math.round(target.rect.height)}px`,
        "\n### Attributes",
        formatAttributes(target.attributes) || "- None",
        "\n### HTML",
        "```html",
        target.htmlPreview,
        "```",
        "\n### Computed Styles",
        "```text",
        target.styles,
        "```",
      ].join("\n")
    }),
  ].join("\n")

export const copyCommentsForAgent = async (
  comments: CommentThread[],
  ownerWindow: Window = window,
) => {
  if (comments.length === 0) return false
  await ownerWindow.navigator.clipboard.writeText(
    formatCommentsForAgent(comments, ownerWindow.location.href),
  )
  return true
}
