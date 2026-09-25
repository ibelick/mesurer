# mesurer

## 0.2.0

- add configurable column, row, and pixel layout guides with selection, keyboard controls, persistence, and undo/redo
- scope workspaces to page URLs and preserve guides, comments, measurements, and annotations across navigation and reloads
- improve inspect selection, transparent and iframe targets, spacing geometry, typography details, and guide-linked distances
- improve arrow, pen, and text annotation selection, transforms, cursors, and group editing
- improve comment threads with replies, editing, deletion, resolve/reopen actions, selector copying, tooltips, and safer draft dismissal
- improve toolbar dragging, menu stacking, minimization, restoration, and overlay lifecycle behavior
- add dark mode and theme-aware controls across the toolbar, comments, settings, and menus
- improve keyboard ownership, host-page focus handling, CSS isolation, and overlay stacking
- improve color picker, screenshot, ruler, and settings interactions
- improve the Chrome extension across reloads, SPA navigation, host recovery, tab persistence, screenshots, and per-tab workspaces

## 0.1.5

- add DOM-attached comment threads with replies, persistence, iframe and Shadow DOM targets, and agent-ready copy
- improve inspection with copyable info cards, typography details, iframe selection, and X-ray support
- add guide-linked measurements, Option+S pinned measurements, and shared guide controls
- add configurable Screenshot, Rulers, and Settings features with matching shortcut control
- isolate Mesurer styles and keyboard behavior from host pages
- harden extension screenshot capture by removing the page-injected capture bridge
- Thanks to [Moumen Soliman](https://github.com/moumen-soliman) for [adding Option+S pinned measurements](https://github.com/ibelick/mesurer/pull/25).

## 0.1.4

- inject extension scripts only after the user activates the extension
- remove the global `<all_urls>` keyboard-gate injection to avoid interfering with embedded Mesurer instances

## 0.1.3

- fix color settings input, copy, and paste updates in embedded apps and the Chrome extension
- scope extension keyboard isolation so it does not interfere with embedded Mesurer instances

## 0.1.2

- add configurable keyboard shortcuts and toolbar minimization
- improve keyboard shortcut reliability in host-page editors and browser prompts
- preserve Text-tool typing, paste, IME input, and host-page focus
- fix annotation deletion with Backspace/Delete after a page editor has focus
- improve Chrome extension keyboard isolation and focus handoff
- fix interruptible toolbar motion when switching inspect/annotate or minimizing
- stretch toolbar separators to the pill edges

## 0.1.1

- add grouped Select & Inspect and Annotate toolbars
- add arrows, freehand pen strokes, and text annotations
- add annotation selection, transforms, persistence, and undo/redo
- add arrow and text configuration props
- improve keyboard shortcuts and Escape behavior

## 0.1.0

- add screenshot region selection with clipboard copy and local download support
- add Chrome extension visible-tab capture integration
- add configurable screenshot copy and download settings
- rename the public `Measurer` component and props type to `Mesurer` and `MesurerProps`
- improve extension isolation, persistence, settings, guides, rulers, and visual inspection workflows

## 0.0.11

- keep guides, select, and rulers on screen while Settings is open so styles can be edited live
- isolate the Chrome extension overlay from host-page CSS
- stop settings saves from clearing the live workspace

## 0.0.10

- add a color picker with hex, rgb, hsl, and oklch output
- add Settings for colors, guide styles, rulers, snap, and persistence
- persist settings across tabs; optionally keep the workspace across reloads
- isolate workspaces per tab and sync settings in the Chrome extension
- expose settings as `Measurer` props for React embeds
- style guides with weight, dashed/dotted patterns, and opacity

## 0.0.9

- add persistent pixel rulers along the top and left edges
- create and drag guides directly from rulers
- show live guide values with masked ruler labels
- select and drag guides across tool modes
- prevent page text selection while dragging guides
- add X-ray inspection mode
- improve Text Inspector behavior and toolbar interactions
- update toolbar and marketing-site feature icons
- Thanks to [@alecramos-sudo](https://github.com/alecramos-sudo) for [adding the Aa text-style inspector mode to the overlay toolbar](https://github.com/ibelick/mesurer/pull/8).
- Thanks to [@Romariin](https://github.com/Romariin) for [keeping guides visible without blocking page clicks](https://github.com/ibelick/mesurer/pull/12).

## 0.0.8

- restore precise element targeting with top-layer extension host
- normalize Mesurer spacing to 4px across host sites

## 0.0.7

- restore toolbar/menu shadow rendering with stable surface CSS classes

## 0.0.6

- add Chrome extension (MV3) with click-to-toggle toolbar
- isolate styles to avoid host site conflicts
- prefix Tailwind utilities with `msr:` to prevent class collisions
- fix guide Alt/Option distance measurement behavior

## 0.0.5

- update toolbar UI
- add changelog
- stop auto selecting new guides

## 0.0.3

- fix: initial public release polish
