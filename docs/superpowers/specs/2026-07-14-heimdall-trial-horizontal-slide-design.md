# Heimdall — horizontal slide to a full-bleed "The Trial" tab

**Date:** 2026-07-14
**Status:** approved (revised — flat shift, full-bleed details), building
**Prototype:** `docs/redesign/heimdall-trial.html` (standalone, not yet sewn into Astro)

## Intent

A third interaction variant for the Heimdall project world. From the junk-ships
section header, clicking **Read the trial** slides the view horizontally: the
header (watercolor + hero stack) travels out to the left and a full-bleed
written case-study tab ("The Trial") slides in from the right. A persistent back
affordance returns to the header.

Siblings this does **not** replace:
- `heimdall-junkships.html` — the plain section header (fork source).
- `heimdall-scrolls.html` — the in-place handscroll unfurl. Left intact.

## Decisions

1. **Details content** = a written case study (Problem / Approach / Results +
   tech tags + repo link), not the handscroll.
2. **Details surface** = **full-bleed porcelain paper** filling the whole
   viewport — the trial tab is its own screen, not a card floating over the
   watercolor. Dark ink text in a centered reading column; paper grain, a gold
   left rule, and a vermillion seal as accents. No watercolor on this tab.
3. **Motion** = **flat horizontal shift, no parallax.** The whole track slides
   as one board; the painting rides inside the header panel and leaves with it.
   Back arrow + Esc + ArrowLeft return.
4. **Interruptible**, CSS-transition based (explicit user requirement).

> Revised from an earlier parallax + floating-porcelain-panel design. Dropping
> parallax removes the painting over-scan/edge-exposure problem entirely (the
> painting now just covers its own 100vw panel), and the full-bleed opaque paper
> removes the need for `backdrop-filter` + its fallback.

## Structure

```
.world  (viewport, overflow:hidden)
└─ .track            200vw rail, two 100vw panels, transform: translateX(0 → -100vw)
   ├─ .panel--header   100vw, overflow:hidden
   │    watercolor <img> (drift) + focal scrim + hero stack
   │    (見 · Heimdall · subtitle · line · "Read the trial →")
   └─ .panel--trial    100vw, overflow-y:auto
        full-bleed porcelain paper + centered reading column ("The Trial")
```

Opening = add `.is-trial` to `.world`. A single CSS transition on `.track`
transform drives the slide. No separate painting layer, no parallax translate,
no dimming scrim.

## Motion detail

- Slide: `.track` → `translateX(-100vw)` on `--ease-out` `cubic-bezier(.22,1,.36,1)`,
  **symmetric 0.9s** for enter and exit. (An earlier asymmetric after-change-style
  variant felt buggy on interrupt; symmetric is simpler and robust.)
  `will-change: transform` on `.track`.
- **Scrollbars hidden globally** (`scrollbar-width:none` + `::-webkit-scrollbar`
  `display:none`): scrolling still works, but no native bar/gutter slides in with
  the trial tab or flickers as the reveal shifts content height.
- **Focus-scroll fix (important):** the trial panel sits 100vw right in the
  track's *layout*, so `back.focus()` made the browser scroll `.world` to reveal
  it (`scrollLeft` → ~1247). On interrupt that scroll was left at a residual and
  never unwound, shifting the header and growing an empty gap on the right after
  each exit. Fixed two ways: `focus({ preventScroll: true })` on both the Back and
  the trigger, and `.world { overflow: clip }` (not `hidden`) so `.world` is never
  a scroll container in the first place.
- The watercolor `drift` keyframe stays on the header's `<img>`; the header panel
  is `overflow:hidden` so the drift-scaled painting is clipped to its 100vw box
  (no bleed into the trial panel).
- Trial content reveal: per-section `opacity`/`blur`/`translateY` **transitions**
  with staggered `transition-delay`, gated on `.is-trial`. Transitions (not
  `@keyframes ... forwards`) so an interrupted close reverses cleanly.
- **Interruptibility:** open/close only toggle the `.is-trial` class. CSS
  transitions interpolate from the current computed transform, so reversing
  mid-slide is native. No `transitionend`-gated teardown, no debounce lock.
  (Verified in Chrome on the prior build: mid-slide reverse retargeted from the
  current position with zero overshoot.)

## Details tab layout

- `.panel--trial` is the scroll container and carries the full-bleed porcelain
  paper background (paper-grain gradients over solid `--porcelain`). Background
  stays put while content scrolls.
- To vertically center a short column without top-clipping a tall one, use an
  inner wrapper with `min-height:100%` + flex centering inside the scroll
  container (the robust no-clip pattern), holding the reading column.
- Reading column: `min(64ch, 100%)`, dark ink text, gold rule down its left
  edge, vermillion seal in the head. No card border/shadow, no backdrop-filter
  (the paper is opaque and full-bleed).
- Copy (placeholder, real content sewn later): kicker `見 Heimdall`, brush title
  **The Trial**, Problem / Approach / Results, footer tech tags + repo link.
- `← Back` button (real `<button>`) styled like `.more`, dark on porcelain.

## Return / focus (mirrors heimdall-scrolls gotcha)

- `← Back` button, plus **Esc** and **ArrowLeft**.
- Back-button / Enter / ArrowLeft close → restore focus to the "Read the trial"
  trigger.
- **Esc close → blur, do NOT refocus the trigger** — a real keypress flips the
  focus-visible heuristic to keyboard and would leave a stuck ring.

## A11y / reduced-motion / cross-browser

- Off-screen panel is `inert` (not tabbable); `inert` swaps on open/close.
  `aria-expanded` / `aria-controls` on the trigger.
- **Reduced motion:** drop the slide + the reveal *movement/blur*, but **keep a
  short opacity fade** (gentler, not an instant jump-cut — per the animation
  review, Standard 8).
- **Hover motion gated** behind `@media (hover: hover) and (pointer: fine)` so
  the arrow-nudge / underline can't stick on touch (animation review, Standard 8).
- Safari/iOS parity: `translateX` + `svh` are WebKit-safe; `.world`
  overflow-hidden prevents any horizontal scrollbar from the 200vw rail.

## Signature (one bold element, rest quiet)

The trial tab reads as an unrolled **colophon** even full-bleed: paper grain, a
gold rule down the reading column's left edge, and a single vermillion seal —
thematically linking to the handscroll sibling without repeating it.

## Verification

Manual + instrumented browser check (Chromium done; WebKit pending): slide in/out,
interrupt mid-slide (reverses smoothly), Esc/ArrowLeft/back-button return, no
horizontal scrollbar, full-bleed paper covers the viewport with no watercolor
leak on the trial tab, tall content scrolls without top-clip, reduced-motion keeps
a fade, keyboard focus order sane.
