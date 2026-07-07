# Cover Hero → Pinned Header (scroll-driven) — Design

**Date:** 2026-07-07
**Status:** Draft (design-panel synthesis + refinements complete; awaiting adversarial review + implementation)

## Goal

Replace the current `.has-cover` project open behaviour — where the cover image **fades away to a blank paper box** before the case study fades in — with a **cover-as-hero** treatment: the cover image becomes a tall hero at the top of the expanded view, the case study flows **below** it, and as the reader scrolls, the cover **shrinks and pins into a slim fixed header** (iOS large-title → navbar), with the codename docking onto the **close-button line**.

Applies to **both** surfaces:

1. **Expanded bento modal** (`.has-cover` cards) — scroller is the nested `.card-body`.
2. **`/projects/[slug]`** standalone page — scroller is the document. This page currently has **no cover**; we add one.

Reference: <https://scroll-driven-animations.style/demos/cover-to-fixed-header/css/> (but that demo animates `height`/`font-size`; we do **not** — see Non-Goals).

## Non-Goals

- **No animating `height` / `width` / `top` / `font-size`.** Those force per-frame layout and cannot run on the compositor. All motion is `transform` + `opacity` only. (This is also what structurally protects us from the documented WebKit `aspect-ratio` morph-jump — see "Handoff".)
- **No WAAPI `ScrollTimeline` constructor.** It is not shipped in Safari's JS API (CSS-only there) and would need a polyfill. We use native CSS scroll timelines.
- **No touching the open/close box morph.** The grid-slot → full-viewport geometry morph (and its Safari `aspect-ratio: auto` fix) is the most-debugged code in the repo and stays byte-for-byte. All new behaviour lives in the **settled, static, scroll-only state**.
- **No JS scroll listener / `--scroll-progress` driver.** The collapse is native-CSS-scroll-driven (compositor). The already-commented-out `.cs-sticky-header` scroll-listener machinery in `bento-expand.ts` is deleted, not revived.
- **No new dependencies.**
- **Plain `.cs-card` (non-cover) modals are unchanged.** This is a `.has-cover`-only feature.

## Browser support context (July 2026)

- **Safari 26.0** (Sept 2025) shipped CSS scroll-driven animations; **26.4** made them **threaded** (compositor); **26.5** fixed reliability bugs. Transform/opacity-only animations run threaded; `height`/`font-size` ones would not — which is the whole reason for the transform-only constraint.
- **Chrome/Edge 115+**: supported (threaded).
- **Firefox stable**: still behind `layout.css.scroll-driven-animations.enabled` (FF 152). → must degrade gracefully.
- **Lenis smooth-scroll** (`src/scripts/smooth-scroll.ts`) drives **native** scroll on both the document and each `.card-body` (no transform hijack), so native `scroll()` timelines advance correctly on both surfaces.

## Core mechanism — the shrink is *layout*, not an animated size

Two overlapping elements live inside the scroller:

- **`.cs-hero`** — a **normal-flow** tall band (`height: var(--cs-hero-h)`, `overflow: hidden`) holding a cloned cover image + overlay + the big codename title. Being in normal flow, it **scrolls away naturally**.
- **`.cs-headerbar`** — a **`position: sticky; top: var(--cs-bar-top)`** slim bar (`height: var(--cs-bar-h)`, e.g. 56px) with `margin-top: calc(-1 * var(--cs-bar-h))` so it overlaps the hero's tail and **adds zero net height** to the flow. It holds the small codename title and a frosted background.

As the reader scrolls `--cs-hero-h` px, the tall hero scrolls off and the slim bar pins — so the **occupied header height shrinks from ~42vh to 56px purely by layout**, never by an animated height. On top of that, compositor-only keyframes polish the transition:

```
.card-body (overflow-y:auto ⇒ the scroll source, only when .is-expanded)
┌───────────────────────────────┐ scrollTop 0
│ .cs-hero   (normal flow, tall) │  cover clone + overlay + BIG codename
│                                │   → cover-img: scale(1→1.06) + opacity 1→0
│                                │   → hero title: translateY + scale(→0.55) + opacity→0
├───────────────────────────────┤
│ .cs-headerbar (sticky, slim)   │  margin-top:-56px ⇒ net 0 height
│   ::before frosted bg          │   → opacity 0→1
│   .cs-bar-title (small)        │   → docks onto the close-button line, opacity 0→1
├───────────────────────────────┤
│ .card-eyebrow / .card-subtitle │  existing intro block, flows below the hero
│ .cs-mode-toggle / rendered prose│  existing cloned case study
└───────────────────────────────┘
```

### Why no distortion

The image is never size-animated: `object-fit: cover` fills the fixed-height band, and its only transform is a **uniform** `scale(1 → 1.06)` (a slight Ken-Burns push preserving full coverage) plus opacity. No `scaleY` crop, no non-linear counter-scale (the rejected Design-B path, which breathes mid-scroll because a linear keyframe can't invert a non-linear ratio). The title "shrinks" via `scale()`, not `font-size`.

### Keyframes (linear, so progress == scroll position)

```css
@keyframes cs-hero-media { from { transform: scale(1);    opacity: 1 } to { transform: scale(1.06); opacity: 0 } }
@keyframes cs-hero-title { from { transform: translateY(0)    scale(1);    opacity: 1 }
                           to   { transform: translateY(-32px) scale(0.55); opacity: 0 } }
@keyframes cs-bar-bg     { from { opacity: 0 } to { opacity: 1 } }
@keyframes cs-bar-title  { from { transform: translateY(6px); opacity: 0 } to { transform: none; opacity: 1 } }
```

- `.cs-bar-title` binds over the **back 60 %** of the range (`animation-range: calc(var(--cs-shrink)*0.4) var(--cs-shrink)`) so it fades in *after* the big hero title has mostly gone — a clean cross-dissolve, never two titles at once.
- The bar title's resting placement + `transform-origin` are tuned so its docked position sits on the **close-button line** (close is `top:16 + 20 = y:36` in card coords), reusing the math from the dormant `.cs-sticky-header .card-title` rule (`translateY(-54px) scale(0.7)` there → adapt to the small-title-in-bar layout here). Small title **left**, close button **right**, one line.
- `animation-fill-mode: both` holds the 0 % frame before the range (perfect static hero at `scrollTop 0`, matching the reveal target so activation can't flash) and the 100 % frame after (bar stays pinned/solid as you keep scrolling).
- `animation-range` uses **absolute px** measured from scroll start (`--cs-shrink = var(--cs-hero-h) - var(--cs-bar-h)`), so the transition completes over the hero's height regardless of content length.

## Timeline scoping

Primary: **`animation-timeline: scroll(nearest)`** on every animated `.cs-*` node — one rule serves both surfaces (nearest scroller = `.card-body` in the modal, = document root on the slug page). Binding is gated so it only exists where a scroller exists:

```css
@supports (animation-timeline: scroll()) {
  @media (prefers-reduced-motion: no-preference) {
    /* modal (scoped so it only binds once .card-body is overflow:auto) */
    .bento-card.is-expanded .card-body :is(.cs-hero .cover-img, .cs-hero-title,
      .cs-headerbar::before, .cs-bar-title),
    /* slug page */
    .cs-hero--page .cover-img, .cs-hero--page .cs-hero-title,
    .cs-headerbar--page::before, .cs-headerbar--page .cs-bar-title {
      animation-timeline: scroll(nearest);
    }
  }
}
```

**Documented fallback** if `scroll(nearest)` ever mis-resolves in the modal (e.g. an intermediate `overflow` ancestor appears): declare a named `scroll-timeline: --cs-body block` on `.bento-card.is-expanded .card-body` and switch the modal rules to `animation-timeline: --cs-body`; the slug page then uses `scroll(root)`. Ship `scroll(nearest)` first — it is correct here and keeps the CSS single-sourced. (Rationale: between the animated node and its scroller there is no intermediate scroll container on either surface.)

## Handoff: morph → hero, with NO jump (and the Safari `aspect-ratio` gotcha)

The box morph is untouched, so there is nothing new to desync:

- Open geometry is identical to today — the lift still nulls `card.style.aspectRatio = 'auto'` and transitions `top/left/width/height/border-radius` in lockstep (the CLAUDE.md fix for "expands right then jumps to center"). **No geometry transition is added to any hero node.**
- The hero is **composited in, not morphed in**: it is built into `.card-body` at the existing reveal beat (one `--morph-dur` after `mountContent`, i.e. after the box settles) and revealed by opacity. At `scrollTop 0` the scroll animations sit at their 0 % frame = full hero = the reveal target, so activating the timeline cannot flash.
- The cloned hero image carries **no `aspect-ratio`** and is only `transform`/`opacity`-animated (fixed-height band + `object-fit: cover`). The documented desync — an `aspect-ratio` element having `width/height` transitioned against `top/left` — structurally cannot occur.
- The full-card `.cover`/`.cover-resttitle` still fade out during the morph exactly as today. Because the hero clone shows the **same photo at the same horizontal crop** (`object-position: center 42%`), the fade-out + fade-in reads as one continuous image whose lower half becomes the case study — "the cover lifts into a hero", pure opacity.

Per CLAUDE.md: validate the open **and** the scroll collapse **and** close on a real Safari/iOS 26.4+ device by frame-extracting a screen recording **before** any speculative follow-up fix.

## Close — clean reverse to the resting card

Reuses today's two-beat has-cover close plus removing two cloned nodes:

1. `.is-closing-content` fades the case study out in place (`--content-close-dur` 280ms). The hero + bar join that fade and their scroll animation is killed so the transition wins:
   ```css
   .bento-card.has-cover.is-closing-content :is(.cs-hero, .cs-headerbar) {
     animation: none; opacity: 0; transition: opacity var(--content-close-dur) var(--fade-ease);
   }
   ```
2. `runCollapse` collapses the box to the placeholder slot (unchanged). The hero/bar ride the collapse invisibly.
3. `doCleanup` removes the cloned `.cs-hero` + `.cs-headerbar` (beside the existing `appendedBodyWrap.remove()`), strips lifecycle classes, and the original `.cover`/`.cover-resttitle` fade back in via their base transitions (the existing "fade to white box, then image back in" beat). `mountContent` already resets `scrollTop = 0` on every open, so a re-open always starts with the hero expanded (progress 0). The collapse is **stateless** (derived purely from `scrollTop`) — no scroll listener to tear down.

## Progressive-blur strips — kept (site-owner requirement)

Both strips stay:

- **Bottom strip** (`.card-blur-bottom`): unchanged — frosts the bottom edge of the scrolling case study.
- **Top strip** (`.card-blur-top`): kept, but its **blur radius is scroll-driven** so it is inert (blur 0) while the hero is tall (otherwise it would blur the top of the hero image) and **ramps in over the back of the collapse** so it frosts the case-study content passing **under** the pinned bar. Driving the `backdrop-filter` *radius* (not opacity) is consistent with the file's existing approach (opacity on `.card-blur` would isolate the compositing surface and break `backdrop-filter` sampling).
  - Z-order: the sticky bar is `z-index: 6` (above the z:2 strips and z:1 content) so the bar title stays sharp; the top strip (z:2) frosts only the sliver of content between the bar's bottom edge and the interior. The close button (z:3) stays above the strips as today.
  - **Compositor caveat / fallback:** scroll-driving a `backdrop-filter` radius is the one novel bit — verify it stays smooth on Safari 26.4+. If it regresses, the fallback is to keep the top strip inert (blur 0) in the tall-hero state and rely on the bar's own frosted `::before` for the pinned-state top edge (both strips still present; only the bottom stays active). This still honours "keep the layers".

## Pinned-bar background — decision

The pinned bar's background is a **frosted paper `::before`** (opacity 0 → 1), matching the site's existing glass chrome (the white-glass close button). Rationale: on-brand, maximally legible, and the kept top blur strip softens the edge just below it. *Alternative considered:* a slim strip of the darkened cover image in the bar (more demo-faithful). Deferred as an easy post-review tweak — surfaced in the PR for the owner to choose.

## `/projects/[slug]` — document-scroll version (shared CSS)

The page currently has no cover. Add a **full-bleed** hero + sticky bar authored in Astro from `project.data.cover` (guarded — `cover` is `image().optional()`), reusing the exact same classes + shared stylesheet so the same keyframes and `scroll(nearest)` apply with the document as scroller.

- `.cs-hero--page` full-bleed breakout of the 720px column (`width: 100vw; margin-inline: calc(50% - 50vw)`), `--cs-hero-h: clamp(240px, 52vh, 460px)`.
- `.cs-headerbar--page` pins **below** the fixed MorphNav: `--cs-bar-top` = nav height; `z-index` below the nav, above content. Horizontal overflow contained by the global `html { overflow-x: clip }` guard.
- The codename becomes the hero `<h1>` (real heading); the duplicate text `.project-title` in `.project-header` is removed. Subtitle / lede / repo-link / `<Content />` flow below in the existing padded column.
- If a project ever lacks a cover, fall back to the existing static text header (`{cover ? hero : staticHeader}`). All three current projects ship covers.

## Fallbacks — three tiers

1. **Full collapse** — Chrome, Safari 26.4+ (`@supports` true, motion allowed).
2. **Static hero** — Firefox stable (`@supports` false) and `prefers-reduced-motion: reduce` (outside the `no-preference` wrapper): no `animation` binds, every node renders at its authored base = full cover hero + big title, `.cs-headerbar { display: none }`, content scrolls normally. Explicit belt-and-suspenders `@media (prefers-reduced-motion: reduce)` also forces `animation: none`.
3. **Box morph itself** — always works regardless (untouched).

Feature-detect: CSS `@supports (animation-timeline: scroll())` is the source of truth for animation. In `bento-expand.ts`, a matching `CSS.supports('animation-timeline', 'scroll()') && !prefersReducedMotion()` guard decides only whether to build the inert `.cs-headerbar` node (the hero is always built — it is the static fallback too), so unsupported paths carry no dead DOM.

## Files touched

| File | Change |
|---|---|
| **`src/styles/cs-cover-hero.css`** *(NEW, global)* | Single source of truth: `.cs-hero` + band `.cover-img`/`.cover-overlay`, `.cs-hero-title`, `.cs-headerbar`(+`::before`), `.cs-bar-title`; the four `@keyframes`; `--cs-hero-h/--cs-bar-h/--cs-bar-top/--cs-shrink` tokens; the `@supports` + `no-preference` binding; reduced-motion / no-support static-hero fallback; `--page` full-bleed modifiers. Global (not Astro-scoped) because the modal nodes are JS-built and can't receive scoped hashes — same reason all existing modal CSS uses `:global`. Imported by both `BentoGrid.astro` and `[slug].astro`. |
| **`src/scripts/bento-expand.ts`** | has-cover branch of `mountContent`: `buildCoverHero(card)` (clone `.cover-img` + `.cover-overlay`, build big codename title) and, when `scrollDriven`, `buildHeaderBar(card)` (small codename title); `prepend` both into `.card-body`; store `heroEl`/`barEl` on `OpenState`. `doCleanup`: `heroEl?.remove(); barEl?.remove()`. Add fields to `OpenState`. Add the `CSS.supports` guard. Delete the dead commented `.cs-sticky-header` scroll-listener block + its `detachScrollCollapse` plumbing. |
| **`src/components/BentoGrid.astro`** | `import '../styles/cs-cover-hero.css'` (frontmatter). Refactor `.has-cover.is-expanded .card-body` padding so the hero is edge-to-edge/top-flush (padding moved onto the content elements; hero + bar break out); visually-hide the now-redundant flow `.card-title` for has-cover (keep it in the a11y tree, not `display:none`); make the top `.card-blur` strip's blur scroll-driven (keep both strips); keep the existing cover fade-out rules (they drive the cross-dissolve). |
| **`src/pages/projects/[slug].astro`** | `import '../../styles/cs-cover-hero.css'`. Add the guarded full-bleed `.cs-hero--page` + `.cs-headerbar--page` from `project.data.cover`/`codename` above `.project-page`; set `--cs-bar-top` to the nav height; make the codename the hero `<h1>` and remove the duplicate `.project-title`. |
| **`src/components/BentoCard.astro`** | **No change** — the hero is cloned at runtime from the existing `.cover`/`.card-title`. |

## Risks & mitigations

1. **Regressing the most-annotated CSS in the repo (`.has-cover` choreography) / re-triggering the Safari morph-jump.** *Mitigation:* keep the box morph + `aspectRatio='auto'` fix byte-for-byte; the hero reveals by **opacity only** into the settled box; its collapse is `transform`-only on a fixed-`height` band (no `aspect-ratio`, no width/height animation anywhere new). Gate behind `@supports`/RM. Frame-extract a Safari/iOS recording before any speculative fix.
2. **`scroll(nearest)` resolution + Lenis + overflow-toggling `.card-body`.** *Mitigation:* Lenis drives native `scrollTop` (verified) so native timelines advance; scope binding under `.bento-card.is-expanded .card-body`; hero opacity 0 until reveal; 0 % keyframe == reveal state so a momentary mis-resolve still shows the correct static hero; `scrollTop` reset to 0 on open. Documented named-timeline fallback.
3. **Scroll-driven `backdrop-filter` radius on the top strip (novel) + cross-dissolve crop match.** *Mitigation:* identical `object-position` on the clone; couple the hero fade-in to the existing cover fade-out beat; if the scroll-driven blur regresses on WebKit, fall back to an inert top strip + the bar's own frosted `::before`. Restrict live `backdrop-filter` to the single bar `::before` + the kept strips; profile with the built-in `?fps` monitor on device.

## Verification

- `npm run check` + `npm run build` pass (no new diagnostics).
- Manual **Chromium** checks: open a `.has-cover` card → cover is a tall hero, case study below; scroll → cover collapses, codename docks onto the close-button line, both blur strips behave; close → clean reverse to the resting card; TL;DR mode (no overflow) shows a static hero (correct, not a bug); `/projects/[slug]` mirrors it against document scroll under the nav. Emulate `prefers-reduced-motion: reduce` → static hero. Resize → hero height + range track.
- **Safari 26.4+ / iOS parity** is a hard requirement but cannot be verified in the build env → verify on a real device via the PR's Netlify deploy-preview (per CLAUDE.md). No "tests pass" claim — build + manual only.

## Acceptance criteria

1. Opening a `.has-cover` card shows the cover as a tall hero with the case study below — the cover no longer fades to a blank box.
2. Scrolling collapses the cover into a slim pinned header; the codename shrinks and docks onto the close-button line (title left, close right); content scrolls beneath.
3. No `height`/`width`/`top`/`font-size` is animated; the effect runs on the compositor (Chrome + Safari 26.4+); the image never distorts.
4. Both progressive-blur strips remain; the top strip frosts under the pinned bar without blurring the tall hero.
5. The open/close box morph is unchanged; no new Safari `aspect-ratio` jump.
6. `/projects/[slug]` gains the same cover-hero, document-scrolled, pinned under the nav; the codename is the page `<h1>`.
7. Firefox stable and reduced-motion render a clean static hero; no dead DOM/animation binds.
8. `npm run check` + `npm run build` pass; no new dependency; the dead `.cs-sticky-header` scroll-listener code is removed.
