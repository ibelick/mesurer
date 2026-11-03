import { createRoot } from "react-dom/client"
import { Mesurer } from "mesurer"
import { captureReviewSnapshot } from "../../../../packages/mesurer/core/review/snapshot"

Object.assign(window, { __testCaptureReviewSnapshot: captureReviewSnapshot })

const includeComment = new URL(window.location.href).searchParams.has("comment")

createRoot(document.getElementById("root")!).render(
  <Mesurer features={new URL(window.location.href).searchParams.has("default") ? undefined : { review: true }} initialState={includeComment ? {
    comments: [{
      id: "platform-auth-comment",
      target: {
        selector: "body",
        tagName: "BODY",
        textSnippet: "",
        htmlPreview: "<body>",
        attributes: {},
        styles: "",
        rect: { left: 12, top: 24, width: 160, height: 48 },
        documentPoint: { x: 12, y: 24 },
      },
      messages: [{ id: "platform-auth-message", role: "user", text: "Review this test comment", createdAt: 1 }],
      status: "open",
      createdAt: 1,
      updatedAt: 1,
    }],
  } : undefined} />,
)
