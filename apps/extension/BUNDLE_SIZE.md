# Extension content-script size budget

`scripts/report-size.mjs` measures the built `content.js` with gzip level 9 and
fails the extension build above **211 KiB**. Site-only Motion/React fixtures are
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
