# Scroll Parallax Restructure — Design

> **⚠️ RETIRED (2026-06-09).** The scroll-parallax + `.reveal-up` system described
> here has been **removed from the site** (`src/scripts/scroll-parallax.ts`
> deleted; all `data-parallax` / `data-depth` / `.reveal-up` usage gone). Kept as
> the historical "why" trail only — not active implementation guidance.

**Date:** 2026-05-28
**Status:** Retired 2026-06-09 (system removed) — was: Draft (brainstorming + full-flow prototype + codex-rescue review complete; awaiting user spec review)

## Goal

Restructure the homepage with a scroll-linked parallax experience, inspired by
the motion.dev React parallax tutorial but implemented in the project's vanilla
Astro + JS stack. The homepage becomes a **hybrid**: a cinematic full-bleed
parallax hero that resolves into the existing 880px card column (About →
Projects → Stack → Contact). Depth is built entirely from the site's existing
**typographic + glass** language — no new image assets, no photography.

The parallax direction is **"Stacked depth"** (Direction A from brainstorming):
a faint giant background word + accent glow drift slowest, the name headline
sits mid, and glass role-pills move fastest — the classic back→front,
slow→fast mapping from the reference tutorial. A working full-flow HTML
prototype validated the visual concept before this spec was finalized.

## Non-Goals

- **No new animation dependency.** Vanilla JS + `requestAnimationFrame`, reusing
  the rAF + IntersectionObserver pattern in `bento-expand.ts`. Motion One was
  considered and rejected to keep the stack lean and parity guaranteed.
- **No CSS scroll-driven animations** (`scroll-timeline` / `view-timeline`) as the
  primary path. Not supported in Safari as of 2026; would violate the project's
  first-class Safari/iOS parity requirement and force a JS fallback anyway.
- **No scroll-jacking or pinning.** Native scroll throughout.
- **No full-parallax body.** Project/stack card *interiors* stay still for
  scannability. Below the hero, motion is reveal-on-scroll plus a subtle depth
  drift on section eyebrows/headings only.
- **No mutation of the existing `.section-fade-in` primitive's sitewide
  behavior.** See "Reveal" below — a new opt-in mechanism is introduced rather
  than changing what other pages already rely on.
- **No mobile parallax ride.** Below 641px, parallax travel is reduced or
  disabled; content must read perfectly with zero motion.
- **The parallax module is homepage-only.** It is imported by the homepage, not
  globally in `BaseLayout.astro`, so project/resume pages are unaffected.

## Architecture

One new script, plus scoped edits. No new components.

```
src/
├── scripts/
│   └── scroll-parallax.ts        ← NEW: rAF scroll module, data-attribute driven
├── pages/
│   └── index.astro               ← EDIT: Hero hoisted out of .page; imports the module
├── components/
│   └── Hero.astro                ← EDIT: full-bleed stage + 3 layer groups
└── styles/
    └── global.css                ← EDIT: parallax/reveal tokens, full-bleed guard
```

### `scroll-parallax.ts` — the module

- On `DOMContentLoaded`, query all `[data-parallax]` **stages**; per stage cache
  its `[data-depth]` layer elements and their parsed depth.
- **Depth parsing is defensive:** `parseFloat` with a fallback of `0`, clamped to
  `[0, 2]`, so a malformed or extreme `data-depth` can't produce runaway transforms.
- Register **one** shared `scroll` + `resize` + `orientationchange` listener
  (passive), coalesced through a single `requestAnimationFrame` tick. Not one
  listener per element.
- Per tick, for each stage compute progress through the viewport:
  `p = clamp((stageCenter − vh/2) / (vh/2 + stageH/2), −1.2, 1.2)`.
  Off-screen stages (`r.bottom < −vh·0.3 || r.top > vh·1.3`) are skipped.
  Write `transform: translate3d(0, −p · depth · RANGE, 0)` per layer
  (`RANGE` ≈ 120px, tunable via a CSS var/const).
- **Skip redundant writes:** cache the last Y written per layer; if the new Y
  differs by < 0.5px, skip the style write.
- **Lifecycle / initial state:** run an initial tick at init, and re-tick on
  `load`, web-font load (`document.fonts.ready`), `pageshow` (bfcache), and
  `hashchange`. This guarantees the hero sits at its intended resting pose at
  `scrollY = 0` and that anchor jumps land correctly.
- **Disable path is explicit:** when `prefers-reduced-motion: reduce` is set, or
  the viewport is below the mobile breakpoint (and the stage hasn't opted into
  `data-parallax-mobile`), the module **clears any inline `transform`** it wrote
  (resets to `''`) and does not update further. A `matchMedia` change listener
  re-evaluates on motion-preference or breakpoint changes so layers never get
  stranded mid-offset.

### Public API (data attributes)

| Attribute | On | Meaning |
|---|---|---|
| `data-parallax` | stage container | marks a scroll-linked stage |
| `data-depth="<n>"` | layer inside a stage | translate factor (0–2); higher = faster/more travel |
| `data-parallax-mobile` | stage | opt into (reduced) parallax below 641px; default desktop-only |

### Transform ownership — one owner per node (resolves the blocking collision)

The existing `.section-fade-in` (and the new reveal) animate `transform`. The
parallax module also writes `transform`. **No DOM node may be both a reveal
target and a `[data-depth]` parallax layer**, or the two `transform` writes
overwrite each other.

Resolution: **nest them.** A parallax layer is always a dedicated wrapper that
owns `transform` for parallax; the reveal/animated content is a *child* of that
wrapper and owns its own `transform`. Concretely below the hero:

```html
<section id="about" data-parallax>
  <div data-depth="0.15">            <!-- parallax owns transform here -->
    <h2 class="section-title reveal-up">A short introduction.</h2>  <!-- reveal owns transform here -->
    <p class="about-body">…</p>
  </div>
</section>
```

The hero's layers are already dedicated wrappers, so no nesting issue there.

### Reveal (new opt-in, does not repurpose `.section-fade-in`)

Today `.section-fade-in` is a **load-time** keyframe (`animation: fadeIn …` in
`global.css:562`) — it fires on page load regardless of scroll, and it animates
`transform: translateY`. That is correct for above-the-fold content but wrong
for sections the user scrolls to later.

Introduce a separate **`.reveal-up`** class: initial `opacity:0; transform:
translateY(20px)`, transitioning to rest when an IntersectionObserver adds
`.in` (rootMargin `0px 0px -10% 0px`, threshold ~0.05 — mirroring the existing
bento observer). The observer lives in `scroll-parallax.ts` and only runs on the
homepage. Under `prefers-reduced-motion: reduce`, `.reveal-up` renders at rest
immediately (no transition) and the observer simply adds `.in` (or is skipped).
The existing `.section-fade-in` is left untouched.

## The hero (Direction A — stacked depth)

### Full-bleed breakout contract (resolves the blocking overflow risk)

`Hero.astro` is **hoisted out of `<main class="page">`** in `index.astro` so it
is a direct child of the layout, not a flex child of the 880px column. It spans
`width: 100vw` via a centered breakout (`margin-inline: calc(50% - 50vw)` or
rendered outside the column entirely), is roughly one viewport tall, and accounts
for the body's `pt-28` nav offset (the hero absorbs that top padding rather than
adding to it). A `overflow-x: clip` guard on the root/body prevents any
sub-pixel breakout from introducing horizontal scroll (the site hides scrollbars,
which would otherwise *mask* an overflow bug rather than prevent it). Inner hero
content is constrained back to a readable max-width and centered.

### Layers — three groups

| Group | Content | `data-depth` (approx) |
|---|---|---|
| Back | radial accent-glow wash **and** giant faint serif word (`Code`, `aria-hidden`) — both on the back plane | ~0.15 |
| Mid | `Tanel Treuberg` serif headline + existing subtitle | ~0.5 |
| Front | glass role-pills: Backend · Infrastructure · Applied ML | ~1.2 |

- The giant background word uses `--font-serif` at a `clamp()`-large size, very
  low opacity, `aria-hidden`.
- Depth values are starting points; final tuning happens in-browser.

### Moving glass pills on Safari (resolves the should-fix repaint risk)

Transforming a live `backdrop-filter` surface every scroll tick is expensive and
can glitch in WebKit (the same engine that already needs the
`html.lg-no-svg-backdrop` fallback for liquid glass). The moving front-layer
pills therefore use the glass **tokens** (`--glass-bg`, `--glass-brd`, shadow)
for the look **without a live `backdrop-filter`** while they translate — true
backdrop-filtering is reserved for static glass surfaces (nav). Equivalently,
pill travel may be reduced/disabled on Safari/mobile. WebKit verification is
required.

## Below the hero — reveal + subtle parallax

About / Projects / Stack / Contact keep their column layout and current cards.
**Each below-hero section becomes a shallow `data-parallax` stage**, and *only*
the heading/eyebrow wrapper inside it carries a small `data-depth` (~0.1–0.2) —
a `data-depth` outside a `[data-parallax]` stage is ignored by the module, so the
stage marker is required. Card interiors get no `data-depth` and stay still for
scannability. Content blocks use `.reveal-up` (nested per the ownership rule).

The module must **not** write transforms to bento cards, card titles, hoverable
`.card`/`.bento` elements, nav elements, or any liquid-glass internals — only to
explicit `[data-depth]` layers inside `[data-parallax]` stages.

## Hero → body handoff

As the hero scrolls out, front pills + headline lift away faster while the glow
fades; the first column section (About) reveals just underneath. No pinning, no
scroll-jacking — native scroll, normal scrollbar.

## Anchor links (fixed nav)

Section anchors (`#about`, `#projects`, `#skills-tools`, `#contact`) get
`scroll-margin-top` matching the fixed nav height so smooth-scroll hash jumps
don't land headings under the nav. The module forces a parallax tick on
`hashchange` so layers settle correctly after a jump.

## Accessibility, performance, parity

- **`prefers-reduced-motion: reduce`** → parallax disabled and inline transforms
  cleared; `.reveal-up` shown at rest with no transition. Re-evaluated via a
  `matchMedia` change listener. Hard requirement.
- **Mobile (<641px):** parallax travel reduced/disabled unless a stage sets
  `data-parallax-mobile`; inline transforms cleared when disabled; content reads
  perfectly with zero motion.
- **Parity:** pure `transform` + rAF behaves identically across engines; moving
  glass avoids live `backdrop-filter` per the Safari note. Verified on **both**
  Chromium and WebKit before done (standing project rule).
- **Performance:** transforms only (no layout-triggering props);
  `will-change: transform` on layers; one coalesced rAF tick shared across
  stages; off-screen stages and sub-0.5px deltas skipped.

## Files touched

- **New:** `src/scripts/scroll-parallax.ts`
- **Edit:** `src/pages/index.astro` (hoist Hero out of `.page`; import the module
  page-scoped), `src/components/Hero.astro` (full-bleed stage + layer groups),
  `src/components/About.astro` / `BentoProjectsSection.astro` /
  `BentoStackSection.astro` / `Contact.astro` (wrap heading in `data-parallax`
  stage + `data-depth` layer; swap reveal class to `.reveal-up`),
  `src/styles/global.css` (`.reveal-up`, parallax tokens, full-bleed/`overflow-x`
  guard, anchor `scroll-margin-top`).
- **No** new dependencies. **Not** imported in `BaseLayout.astro`.

## Verification

- `npm run check` (TypeScript + Astro diagnostics) passes.
- `npm run build` succeeds.
- Manual browser checks on **both** Chromium and WebKit: hero parallax tracks
  scroll smoothly with no horizontal overflow; body reveals fire once on entry;
  reduced-motion clears all motion; mobile reads cleanly; nav anchor jumps land
  below the nav; glass pills don't glitch in WebKit; project/resume pages are
  unaffected. No "tests pass" claim — verification is build-only + manual.

## Acceptance criteria

1. Scrolling drives the hero's three layer groups at distinct rates (back
   slowest, pills fastest), producing visible depth, with the hero at its resting
   pose at `scrollY = 0`.
2. The hero is full-bleed with **no horizontal scroll/overflow**; the rest of the
   page remains in the 880px column.
3. Sections below the hero reveal once on entry; eyebrows/headings drift subtly;
   card interiors stay still. No element has both reveal and parallax writing its
   `transform`.
4. `prefers-reduced-motion: reduce` removes all parallax (transforms cleared) and
   reveals render at rest.
5. On viewports <641px the page reads cleanly with parallax reduced/disabled and
   no stranded offsets.
6. Nav anchor links land section headings below the fixed nav.
7. Behavior is visually equivalent on Chromium and WebKit; glass pills show no
   WebKit repaint glitch.
8. Other pages (projects, resume) are unaffected; no new npm dependency;
   `npm run check` and `npm run build` both pass.
