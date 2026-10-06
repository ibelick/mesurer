# Extension content-script size budget

`scripts/report-size.mjs` measures the built `content.js` with gzip level 9 and
fails the extension build above **206 KiB**. Site-only Motion/React fixtures are
not part of this bundle.

Measured baselines for `feat/inspect-motion`:

| State | Gzip size | Budget |
| --- | ---: | ---: |
| Motion inspection and JavaScript detection | 203.8 KiB | 204 KiB |
| Review fixes: inert media snapshots, shadow/pseudo-element rendering, guarded subtree observation, multi-animation playback | 205.8 KiB | 206 KiB |

The additional approximately 2.0 KiB implements the review's correctness and
resource-safety fixes. The limit leaves approximately 0.2 KiB of headroom;
it is not an allowance for unrelated features.

Before changing the limit, build with `pnpm --filter mesurer-extension build`,
record the before/after compressed measurements here, and explain the change.
Prefer removing duplication or moving optional work out of the content script
before increasing it. The build reports remaining headroom so growth stays
visible during local development and CI.
