# Heimdall scrolls — full-viewport-height v8 handscroll behind "Read the trial"

**Date:** 2026-07-13
**Target file:** `docs/redesign/heimdall-scrolls.html` (standalone redesign prototype; NOT in the Astro build)
**Mechanics source:** `docs/redesign/chinese_handscroll_v8_same_direction_rollers.html` (v8)

## Goal

Add the v8 same-direction-roller handscroll to `heimdall-scrolls.html` — currently a
byte-identical copy of the `heimdall-junkships.html` landing hero — scaled so the
**rollers span the full viewport height**, summoned by the hero's **"Read the trial"**
link. This is a distinct exploration from `heimdall-scroll.html` (the morphing,
side-anchored, panel-content variant); this file keeps v8's centered click-open +
drag-pan model as pure as possible, just full-height.

## Decisions (user-confirmed)

1. **Layout:** hero stays as-is on load, no scroll visible. "Read the trial" summons
   the closed full-height scroll and unrolls it (v8 open animation).
2. **Paper content:** v8's ink SVG panorama + calligraphy/seals, scaled up as
   placeholder content. Real Heimdall content is out of scope.
3. **Open width:** nearly full width — **~94vw**, rollers landing just inside the
   left/right screen edges.
4. **Close:** v8's model — a plain click (< 5px pointer movement) anywhere on the
   scroll toggles it closed; **Esc** also closes. No extra chrome.

## Architecture

Keep the existing hero markup/CSS untouched. Add three sibling layers inside
`.world`:

- `.backdrop` — dim radial wash over the painting, visible only while open
  (port the pattern from `heimdall-scroll.html`).
- `.scrollwrap` — full-viewport overlay hosting the v8 scroll structure
  (`.rollcol` ×2 + `#wrap` > `#scroller` > `#paper`), centered.
- State class `world.is-open` drives hero dim/blur (`.stack` → opacity 0.14,
  blur 3px, pointer-events none — same treatment as `heimdall-scroll.html`).

Port v8's JS verbatim where possible: grain math (`pan = |scrollLeft| * 0.6`,
`grainL = (open ? -132 : 0) + pan`, `grainR = pan`), open ease
`cubic-bezier(.3,1.18,.35,1)` 2.1s, close ease `cubic-bezier(.55,0,.3,1)`,
pointer-capture drag with the `moved` flag guarding click-vs-drag.

## Geometry

- **Roller assembly spans `100svh`, end-caps visible** (revised 2026-07-13 after the
  first build: the original "shaft = 100svh, caps clip off-screen" reading left the
  jade finials and knobs invisible, and the owner wants them seen, matching the v8
  reference). Shaft height token `--roller-h: calc(100svh - 68px)` — 68px = jade
  (12px) + knob (22px) per end — so jade + knob + shaft + knob + jade fills the
  viewport exactly inside the centered `100svh` roll-column.
- **Paper/wrap height = `calc(var(--roller-h) - 26px)`** — paper tucks 13px under
  each shaft end, preserving v8's overlap via the `margin: -13px` roll-columns
  (same shaft−26 relationship as v8's 340/314).
- **Closed width = 26px** (one roller width); **open width = 94vw, clamped** via a CSS
  token — `--paper-w-open: min(94vw, calc(100vw - 26px))` — so JS reads
  `var(--paper-w-open)` instead of a px literal. (The `min()` clamp, added in Codex
  review, keeps both rollers on-screen below ~434px viewports where
  94vw + roller overhang would exceed 100vw.)
- **Paper width:** the v8 SVG (viewBox `1200×314`) scales to paper height
  preserving aspect → paper ≈ 3.82 × paper-height wide, plus the brocade (30px) +
  trim (3px) ends. Compute with `aspect-ratio` / `height: 100%; width: auto` on the
  SVG rather than hardcoded px so any viewport height works. Absolute-positioned
  calligraphy/seal offsets may be re-tuned proportionally (they are decorative;
  exact positions are implementer's judgment, anchored to corners like v8).
- Roller-grain repeat period stays ≥ 7px so the rotation reads on a 26px shaft.

## Flow

1. Click "Read the trial" (`role` stays a real `<a>`; `href="#"` +
   `preventDefault`, or `href="#scroll"`) →
2. `.world` gains `is-open`: hero stack dims/blurs, backdrop fades in, the closed
   scroll fades/materializes centered (short opacity/scale-settle, ~0.4s), then
3. width springs 26px → `var(--paper-w-open)` with the left roller's −132px
   open-spin (both grain layers transition over 2.1s).
4. Drag / horizontal trackpad scroll pans; grain `background-position` follows
   scroll (no transition while panning). Scroller is `direction: rtl` like v8 so
   panning starts from the right end.
5. Plain click on the scroll or Esc → close ease reverses width to 26px, then
   scroll fades out, `is-open` removed, hero resolves back.

## Accessibility & motion

- Scroll stage: `role="button"`, `tabindex="0"`, `aria-expanded`, Enter/Space
  toggles (port from v8).
- `prefers-reduced-motion: reduce`: no spring/spin/fade transitions — states
  switch instantly; ambient painting drift already disabled by the existing rule.
- No native scrollbars (`scrollbar-width: none` + WebKit rule, from v8).
- No elastic overscroll (added 2026-07-13 after user feedback): a macOS rubber-band
  past the scroll bounds pulls the paper away from the rollers and exposes a void.
  `#scroller` sets `overscroll-behavior-x: none`, with a paper-toned
  `background: #efe3c6` as the fallback for engines that still bounce subscrollers —
  any residual bounce reveals cream that reads as paper, never a gap.

## Out of scope

- Real Heimdall/yolo-dualdev content on the paper.
- Mobile/touch-specific layout beyond what v8's pointer events already give.
- Astro integration; this remains a `docs/redesign/` prototype.

## Verification

Standalone HTML — no build gates apply. Serve `docs/redesign/` over local HTTP
(`file://` is blocked in the browser tool) and check in Chromium: hero intact on
load; open/close animation; same-direction grain rotation while panning; drag
does not trigger close; Esc closes; reduced-motion sanity via DevTools emulation.
Cross-engine (Safari/iOS) parity check per standing preference before promoting
the prototype further.
