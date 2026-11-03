# Extension content-script size budget

`scripts/report-size.mjs` measures the built `content.js` with gzip level 9 and
fails the extension build above **219 KiB**, or **220 KiB** for the optional
`MESURER_REVIEW=1` test build. Site-only Motion/React fixtures are
not part of this bundle.

Measured baselines for `feat/inspect-motion`:

| State | Gzip size | Budget |
| --- | ---: | ---: |
| Motion inspection and JavaScript detection | 203.8 KiB | 204 KiB |
| Review fixes: inert media snapshots, shadow/pseudo-element rendering, guarded subtree observation, multi-animation playback | 205.8 KiB | 206 KiB |
| Mixed-motion fixes: detect JS inputs alongside native effects and refresh changing text/glyph structure | 206.3 KiB | 207 KiB |
| Preview fidelity: reuse snapshot nodes, preserve framing, and synchronize short-lived glyphs | 206.5 KiB | 207 KiB |
| Preview responsiveness: immediate card rendering, batched style reads, and deferred/skipped bounds sweeps | 206.7 KiB | 207 KiB |
| Timeline responsiveness: frame-aligned cursor, cached drag geometry/handles, and direct preview wakeups on seek | 206.9 KiB | 207 KiB |
| Immediate JS detection: synchronous baseline and first-mutation confirmation | 207.0 KiB | 207 KiB |
| Torph recognition: classify managed roots/glyphs before their next cycle, with selection-scoped state | 207.0 KiB | 207.5 KiB |
| Generic review fixes: remove vendor detection, narrow preview properties, resolve stylesheet variables, and project transformed iframe geometry | 210.2 KiB | 211 KiB |
| Toolbar snap: optional glue to screen edges with a drag preview, vertical toolbar layout, and edge-aware surfaces and tooltips (before: 210.2 KiB, after: 212.9 KiB) | 212.9 KiB | 213 KiB |
| Toolbar snap motion: orientation fade, arc glide, release catch-up, and light edge glow (before: 212.9 KiB, after: 213.0 KiB) | 213.0 KiB | 214 KiB |
| Toolbar snap continuity: magnetic approach, resisting release, and cached glue size (before: 213.0 KiB, after: 213.2 KiB) | 213.2 KiB | 214 KiB |
| Toolbar carets, shared anchored-surface placement for menus and the screenshot card (before: 213.2 KiB, after: 213.2 KiB) | 213.2 KiB | 214 KiB |
| Toolbar axis motion: vertical mode switch and minimize, centered resize in snap mode, and the orientation swing (before: 213.2 KiB, after: 214.1 KiB) | 214.1 KiB | 215 KiB |
| Toolbar held drag: the dragged toolbar stays under the pointer through glue, turn and release (before: 214.1 KiB, after: 214.4 KiB) | 214.4 KiB | 215 KiB |
| Toolbar corners: recording card side, corner glue, and open/minimize from the held corner (before: 214.4 KiB, after: 215.2 KiB) | 215.2 KiB | 216 KiB |
| Toolbar zones: pointer zones, kept orientation, saved placement, and auto-hide (before: 215.2 KiB, after: 215.8 KiB) | 215.8 KiB | 216 KiB |
| Toolbar drop: square drop zones, turning against a wall, and the auto-hide delay (before: 215.8 KiB, after: 216.0 KiB) | 216.0 KiB | 217 KiB |
| Toolbar polish: auto-hide while in use, saved placement on resize, and resumed swings (before: 216.0 KiB, after: 216.4 KiB) | 216.4 KiB | 217 KiB |
| Toolbar corners: corner zones, the lit drop zone, and settling on the nearest spot (before: 216.4 KiB, after: 216.9 KiB) | 216.9 KiB | 217 KiB |
| Comment commands: resolve-all shortcut, shared resolve icon and copy/resolve success feedback | 217.1 KiB | 217.5 KiB |
| Responsive tool: the page at several sizes side by side in resizable, reorderable frames the tools work in, named devices, and the page's own breakpoints (before: 217.1 KiB, after: 221.1 KiB) | 221.1 KiB | 221.5 KiB |
| Content script trim: the stylesheet read from the shipped mesurer.css instead of a second copy in the script, and the in-page recording editor and encoders left out (before: 225.2 KiB, after: 207.1 KiB) | 207.1 KiB | 207.5 KiB |
| Pen tool: ink drawn as smooth, variable-width strokes, a marker, an eraser that rubs out part of a stroke, the tray of pens with their widths and colours, and a colour picker (before: 207.1 KiB, after: to be recorded from the next build) | 216.9 KiB | 217 KiB |
| Text notes: a background per note, a text style menu on the Text tool, and review notes keeping their own style (before: 216.9 KiB, after: 217.9 KiB) | 217.9 KiB | 218 KiB |
| Platform integration: keep npm authentication out of the extension; shared integration plumbing remains (normal build) | 218.1 KiB | 219 KiB |
| Review-enabled test build, including review capture and publication plumbing | 219.3 KiB | 220 KiB |

The additional approximately 2.0 KiB implements the review's correctness and
resource-safety fixes. The final stylesheet and iframe hardening adds
approximately 1.1 KiB. Mixed-motion detection and dynamic text snapshots add
approximately 0.4 KiB over the 205.9 KiB read-only player UI baseline. The new
limit now leaves approximately 0.8 KiB of headroom; it is not an allowance for
unrelated features. Native effects continue to use sampled computed styles
rather than adding a second animation engine to the content script.

Torph recognition adds a small synchronous attribute check and scopes observer
results to their selected element. The measured output slightly exceeds the
previous 207 KiB limit (both round to 207.0 KiB), so the limit is now 207.5 KiB.
This replaces timing guesses for this known JS-managed component.

The final generic review removes that vendor recognition. Browser effect
lifecycle signals and previously observed changes replace private library
attributes. Accessible stylesheet dependencies and transformed frame projection
add approximately 3.2 KiB over the previous baseline. The 211 KiB limit covers
these correctness fixes while continuing to enforce bounded bundle growth.

Before changing the limit, build with `pnpm --filter mesurer-extension build`,
record the before/after compressed measurements here, and explain the change.
Prefer removing duplication or moving optional work out of the content script
before increasing it. The build reports remaining headroom so growth stays
visible during local development and CI.

The toolbar dock adds the snap-to-edge glue, the vertical toolbar layout, and
edge-aware floating surfaces and tooltips. Before: 210.2 KiB; after: 212.9 KiB.
The remaining code is distinct branches rather than duplication, so the limit is
raised to 213 KiB (about 0.1 KiB headroom) instead of trimming behavior.

The snap motion (orientation fade, arc glide, release catch-up) adds about 0.1 KiB.
The limit is raised to 214 KiB (about 1.0 KiB headroom after this change). Trimming
the remaining code was not possible without removing behavior.

The continuity change adds about 0.2 KiB; the toolbar caret layout adds about 0.1 KiB (about 0.8 KiB headroom remaining).

The axis motion (vertical mode switch and minimize, centered resize in snap mode, and
the orientation swing that replaces the fade) adds about 0.9 KiB. The limit is raised to
215 KiB (about 0.9 KiB headroom after this change).

The held drag (pointer-anchored glue and release) adds about 0.3 KiB (about 0.6 KiB headroom remaining).

The recording card's toolbar side and held drag capture add about 0.4 KiB; corner glue and
opening and minimizing from the held corner add about 0.4 KiB. The limit is raised to
216 KiB (about 0.8 KiB headroom after this change).

The pointer zones, the orientation a free toolbar keeps, the saved placement and auto-hide add
about 0.6 KiB (about 0.2 KiB headroom remaining).

The square drop zones, the turn of a toolbar pushed into a wall and the auto-hide delay add
about 0.2 KiB. The limit is raised to 217 KiB (about 1.0 KiB headroom after this change).

Keeping an auto-hidden toolbar out while it is in use, saving the placement on resize and
resuming an interrupted swing add about 0.4 KiB (about 0.6 KiB headroom remaining).

The corner zones, the drop zone that lights up and settling on the nearest spot add about
0.5 KiB (about 0.1 KiB headroom remaining).

The comment commands measure 217.1 KiB after consolidating the feedback hook,
action handlers, and resolve icon. The last documented baseline is 216.9 KiB;
the new limit is 217.5 KiB, leaving about 0.4 KiB of headroom for this feature.

The Responsive tool is a new tool in the Inspect group and measures 221.1 KiB: about 4.0 KiB
for its row of preview frames, their controls, reordering and zoom, the list of named devices,
the stylesheet reader that finds the page's breakpoints, making those frames known to the other
tools, and its toolbar button, shortcut and icon. The new limit is 221.5 KiB, leaving about
0.4 KiB of headroom.

Commenting inside the responsive previews, their guides and wheel handling had taken the content
script to 225.2 KiB, over the 221.5 KiB limit. Two trims bring it to 207.1 KiB instead of raising
the limit. The stylesheet was shipped twice, as mesurer.css and built into the script: the
background now reads the file and hands its text to the content script. And the extension always
trims and exports a recording in its own page, so the in-page editor and the GIF, MP4 and WebM
encoders are compiled out of the content script (`globalThis.__MESURER_EXTENSION__`, set for that
build alone). The limit is lowered to 207.5 KiB, leaving about 0.4 KiB of headroom.

Fixes after the responsive previews shipped (their comments, scrolling and menus, and Persist on
by default) brought the content script to 207.5 KiB, the limit itself, so any further fix failed
the check. The limit is raised to 210 KiB to leave about 2.5 KiB for fixes. It is not room for
features: one that needs more gets its own entry here, and past 250 KiB the script is made
lighter instead of the limit raised.

Saving a review adds about 5 KiB to the content script (212.5 KiB with it built in). A normal
build leaves it out, since Save is not offered there yet, and stays near 207.5 KiB. The limit is
raised to 215 KiB so that a build made with `MESURER_REVIEW=1` passes too, and so the feature
fits when it is switched on for everyone. Past 250 KiB the script is made lighter instead.

The pen tool and the text backgrounds took the content script to 216.9 KiB; the text style menu and the per-note review styles take it to 217.9 KiB, and the limit is set to 218 KiB, leaving about 0.1 KiB of headroom. An earlier build of the pen tool, before the eraser, measured about 212 KiB.

From here the limit is raised with each feature as before, up to a ceiling of **250 KiB**. That is
where a content script built on React, injected only when the extension is opened, stops being an
ordinary size. Past it the answer is no longer a higher limit but a lighter script: loading what
is rarely used when it is asked for (motion inspection, the responsive previews), or a smaller
renderer in the extension's build.
