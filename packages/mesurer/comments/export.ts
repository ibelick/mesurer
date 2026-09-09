import type { CommentThread } from "../core/types"
import { getCommentTargetKey } from "./dom"

const formatTarget = (comment: CommentThread) => {
  const { target } = comment
  const text = target.textSnippet ? `${target.textSnippet}` : ""
  return `[<${target.tagName}>${text}</${target.tagName}> selector: \`${target.selector}\`]`
}

export const formatCommentsForAgent = (comments: CommentThread[], url = "") => {
  const groups: Array<{ comment: CommentThread; messages: string[] }> = []
  for (const comment of comments) {
    const group = groups.find(
      ({ comment: grouped }) => getCommentTargetKey(grouped.target) === getCommentTargetKey(comment.target),
    )
    if (group) {
      group.messages.push(...comment.messages.map((message) => message.text))
    } else {
      groups.push({
        comment,
        messages: comment.messages.map((message) => message.text),
      })
    }
  }

  return [
    "# Mesurer Comments",
    url ? `URL: ${url}` : "",
    ...groups.map(({ comment, messages }, index) => {
      const feedback = messages.length === 1
        ? messages[0]
        : messages.map((message) => `- ${message}`).join("\n")
      return `${index + 1}. ${feedback}\n${formatTarget(comment)}`
    }),
  ].filter(Boolean).join("\n\n")
}

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

export const copyCommentSelector = async (
  selector: string,
  ownerWindow: Window = window,
) => {
  await ownerWindow.navigator.clipboard.writeText(selector)
}
