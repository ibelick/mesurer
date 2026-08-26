# mesurer

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
