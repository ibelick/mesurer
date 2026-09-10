export const XRAY_STYLE_ID = "mesurer-xray-styles"

export const XRAY_STYLES = `
.xray-mode * {
  outline: solid 1px blue !important;
}
.xray-mode #mesurer-extension-host,
.xray-mode #mesurer-extension-host *,
.xray-mode .mesurer-root,
.xray-mode .mesurer-root *,
.xray-mode .mesurer-toolbar-surface,
.xray-mode .mesurer-toolbar-surface *,
.xray-mode .mesurer-toast-surface,
.xray-mode .mesurer-screenshot-preview,
.xray-mode .mesurer-screenshot-select,
.xray-mode .mesurer-screenshot-select *,
.xray-mode .mesurer-ti-box,
.xray-mode .mesurer-ti-card,
.xray-mode .mesurer-ti-card *,
.xray-mode .mesurer-ti-close {
  outline: none !important;
}
`

export const syncXrayStyles = (ownerDocument: Document, visible: boolean) => {
  let style = ownerDocument.getElementById(XRAY_STYLE_ID)
  if (!style) {
    style = ownerDocument.createElement("style")
    style.id = XRAY_STYLE_ID
    style.textContent = XRAY_STYLES
    ownerDocument.head.appendChild(style)
  }
  ownerDocument.body?.classList.toggle("xray-mode", visible)
}
