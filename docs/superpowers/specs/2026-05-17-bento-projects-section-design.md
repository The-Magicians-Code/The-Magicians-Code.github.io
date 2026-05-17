# Bento projects section — design (v1)

**Date:** 2026-05-17
**Branch:** editorial-redesign
**Status:** Spec — pending implementation

## Summary

Port the bento grid from [docs/ideas/bento-mchiu.html](../../ideas/bento-mchiu.html) to the main Astro site as a reusable component set. The bento replaces the existing `ProjectsSection` on `/`, renders projects from the `projects` content collection in an asymmetric grid, and opens each project's full markdown body in an in-place morphing case-study modal on click. v1 is light-mode only, project-card only — decorative variants, dark mode, pretext title rendering, and the filter pill are out of scope.

## Context

The existing [src/components/ProjectsSection.astro](../../../src/components/ProjectsSection.astro) is a flat 2-column grid of project cards that link to `/projects/[slug]/` detail pages. The bento prototype at [docs/ideas/bento-mchiu.html](../../ideas/bento-mchiu.html) is a 1500-line single-file experiment with an asymmetric grid, click-to-expand morph animation, three card variants beyond project (about, brand, quote, stack-marquee), and a pretext title renderer. The user wants the prototype's visual feel and morph interaction on the live site, scoped to projects only for v1.

The prototype already shipped several hard-won fixes — focus-outline suppression via `card.blur()` at the start of close, `.cover` `border-radius: inherit`, project-card bg matching the cover color, removal of cream/white insets from `--card-shadow`. These all need to carry over to the port.

## Goals

- Replace `ProjectsSection` on `/` with a bento grid driven by the projects content collection.
- Asymmetric grid sized per-project via a new `bentoSpan` frontmatter field.
- Click / Enter / Space on a card opens a centered morphing modal containing the project's rendered markdown body.
- Esc and backdrop click close cleanly with no UA focus-outline artifact.
- Resize while a modal is open snaps the card to the new viewport target.
- Reduced-motion is respected (animations off, interaction intact).
- `/projects/[slug]/` routes remain functional for direct links and SEO.

## Non-goals (deferred to v2+)

- Dark-mode support (site has dark-mode tokens; bento ignores them in v1).
- Pretext word-span title rendering and the `--cs-title-rest-y` centering logic.
- Filter pill nav (decorative-only in the prototype).
- Card variants other than project (about, brand, quote, stack-marquee).
- Per-card image covers (frontmatter picks one of two gradient variants only).

## Architecture

### New files

| Path | Role |
|--|--|
| `src/components/BentoGrid.astro` | Owns the asymmetric grid CSS, the section-level layout (including the width breakout from the 880px column), the single shared backdrop element, and the `<script>` import for the runtime. Renders `<slot />` for cards. |
| `src/components/BentoCard.astro` | Renders a single tile. Props: `title`, `eyebrow?`, `slug`, `bentoSpan?`, `coverVariant?`. Default slot is the rendered `<Content />` of the project's markdown, placed inside a `<div class="bento-card-body" hidden>` so the runtime can reveal it on expand. |
| `src/components/BentoProjectsSection.astro` | Section wrapper. Imports `getCollection('projects')`, filters drafts, sorts by `order`, maps each entry to a `BentoCard` (with `<Content />` as slot), wraps in `BentoGrid`. Also renders the "See all on GitHub" CTA card at the end. |
| `src/scripts/bento-expand.ts` | TS port of the prototype's runtime. Discovers `[data-bento-card]` and `[data-bento-backdrop]` at `DOMContentLoaded`; owns open/close/morph/focus-blur/escape/resize logic and module-scope `openState`. |

### Modified files

- [src/content.config.ts](../../../src/content.config.ts) — extend the `projects` schema with `bentoSpan: z.enum(['hero', 'wide', 'tall', 'normal']).default('normal')` and `coverVariant: z.enum(['base', 'alt']).default('base')`.
- [src/pages/index.astro](../../../src/pages/index.astro) — replace the `ProjectsSection` import + element with `BentoProjectsSection`. No other changes.
- [src/content/projects/strato-pi.md](../../../src/content/projects/strato-pi.md) and [src/content/projects/yolo-dualdev.md](../../../src/content/projects/yolo-dualdev.md) — add `bentoSpan` and `coverVariant` values so the grid has visual rhythm from day one. Pick `bentoSpan: 'hero'` for one and `'wide'` for the other; pick differing `coverVariant`s so the two cards read as a pair, not duplicates.

### Deleted files

After the swap, with no remaining call sites:

- `src/components/ProjectsSection.astro`
- `src/components/ProjectCard.astro`

We don't ship dead code; the implementation plan removes these in the same change.

### Preserved

- `src/pages/projects/[slug].astro` — unchanged. Direct links and SEO keep working.

## Component API

### `BentoGrid.astro`

No props in v1. Renders:

```astro
<section class="bento-section">
  <div class="bento-grid" data-bento-grid>
    <slot />
  </div>
  <div class="bento-backdrop" data-bento-backdrop></div>
</section>
<script>import '../scripts/bento-expand.ts'</script>
```

The backdrop sits as a fixed-position sibling of the grid (not body-appended at runtime as in the prototype). The script targets it via `[data-bento-backdrop]`.

### `BentoCard.astro`

```ts
interface Props {
  title: string;
  eyebrow?: string;
  slug: string;
  bentoSpan?: 'hero' | 'wide' | 'tall' | 'normal';
  coverVariant?: 'base' | 'alt';
}
```

Renders:

```astro
<article
  class={`bento-card project-card cs-card span-${bentoSpan} cover-${coverVariant}`}
  data-bento-card
  data-slug={slug}
>
  <div class="cover"></div>
  <span class="cs-expand" aria-hidden="true"><!-- arrows --></span>
  <div class="card-body">
    {eyebrow && <div class="card-eyebrow">{eyebrow}</div>}
    <div class="card-title">{title}</div>
  </div>
  <div class="bento-card-body" hidden><slot /></div>
</article>
```

Span CSS classes (declared in `BentoGrid.astro`):

```css
.span-hero   { grid-column: span 2; grid-row: span 2; }  /* prototype: .square-2 */
.span-wide   { grid-column: span 2; }                     /* prototype: .span-2 */
.span-tall   { grid-row: span 2; }                        /* prototype: .tall-2 */
.span-normal { /* 1×1, no overrides */ }
```

At the responsive breakpoints (920px / 540px) all spans collapse to 1×1 the same way the prototype does.

`coverVariant` picks between two pre-defined gradient backgrounds on `.cover` (matching the prototype's `.project-card` and `.project-card.alt`).

### `BentoProjectsSection.astro`

```astro
---
import BentoGrid from './BentoGrid.astro';
import BentoCard from './BentoCard.astro';
import { getCollection } from 'astro:content';

const projects = (await getCollection('projects'))
  .filter((p) => !p.data.draft)
  .sort((a, b) => a.data.order - b.data.order);
---

<section id="projects" class="section-fade-in" style="--delay: 0.2s">
  <div class="section-eyebrow">03 · Selected work</div>
  <h2 class="section-title">Projects <em>worth</em> showing.</h2>
  <BentoGrid>
    {projects.map((project) => {
      const { Content } = project.render();
      return (
        <BentoCard
          title={project.data.title}
          eyebrow="Case study"
          slug={project.id}
          bentoSpan={project.data.bentoSpan}
          coverVariant={project.data.coverVariant}
        >
          <Content />
        </BentoCard>
      );
    })}
    <!-- "See all on GitHub" CTA card preserved from current ProjectsSection -->
  </BentoGrid>
</section>
```

## Layout — breaking out of the 880px column

`src/pages/index.astro`'s `.page` wrapper has `max-width: 880px`. The bento needs ~1100–1200px at desktop. `BentoGrid` handles its own width:

```css
.bento-section {
  width: min(100vw - 32px, 1200px);
  margin-inline: calc((100% - min(100vw - 32px, 1200px)) / 2);
}
```

This anchors the section centered while extending past its parent's content box. The grid inside uses the prototype's `repeat(4, var(--cell, 252px))` with the prototype's responsive cell-size media queries (220px @ 1140px, 2-col @ 920px, 1-col @ 540px).

**Bento-scoped tokens** are declared on `.bento-section`: `--cell`, `--gap`, `--morph-dur`, `--ease-snappy`. All others (`--ink`, `--ink-dim`, `--rule`, `--accent`, `--paper`, `--font-serif`, `--font-mono`, `--ease`) come from the site globals. No edits to `global.css`.

## Script architecture (`bento-expand.ts`)

### Module shape

```ts
interface OpenState {
  card: HTMLElement;
  placeholder: HTMLElement;
  closeBtn: HTMLElement;
  originalInline: string;
  originalRect: DOMRect;
  appendedBody: HTMLElement[];
  closing: boolean;
}

let openState: OpenState | null = null;

function openCaseStudy(card: HTMLElement): void { /* ... */ }
function closeCaseStudy(): void { /* ... */ }
function onResize(): void { /* ... */ }

document.addEventListener('DOMContentLoaded', init);
```

### Open lifecycle

1. Guard against double-open (`if (openState) return`).
2. Finish any in-flight `card-enter` animation via `card.getAnimations().filter(...).forEach(a => a.finish())` so the captured rect reflects the settled position.
3. `card.getBoundingClientRect()` snapshot for `originalRect`.
4. Insert grid placeholder (`<div class="bento-card-placeholder">`) before the card with copied `grid-column-start`/`grid-column-end`/`grid-row-start`/`grid-row-end` longhands from `getComputedStyle(card)`.
5. Disable transitions inline, flip the card to `position: fixed` at `originalRect`.
6. Append a close button (`.cs-close` with shrink-arrows SVG) as a child of the card.
7. Add `.is-expanding` class, lock body scroll (with scrollbar-width padding compensation).
8. `requestAnimationFrame` → re-enable transitions, add `.is-expanded`, set rect to the centered modal target via the prototype's `getViewportRect()` calc.
9. After `--morph-dur` (520ms) settle, clone `.bento-card-body` children into the `.card-body` of the card and fade them in with a per-paragraph stagger.

### Close lifecycle

1. `card.blur()` immediately (kill UA focus outline before morph begins — the lesson from the prototype).
2. Fade out appended body content (`opacity: 0`, 180ms).
3. Remove `.is-expanded`, add `.is-collapsing`, set rect back to the placeholder's current `getBoundingClientRect()` (re-measure in case of resize).
4. `transitionend` on `width` (with 800ms `setTimeout` fallback) → cleanup:
   - Remove appended body content + close button.
   - Set inline `transition: none` + restore original inline style.
   - Force layout commit, then `requestAnimationFrame` → clear inline, remove `.is-expanding`, `.is-collapsing`, `.is-resizing` classes, `card.blur()` again.
   - Remove placeholder.
   - Unlock body scroll.
5. `openState = null`.

### Resize while open

Debounced via `requestAnimationFrame`. Recompute target rect from `getViewportRect()`, snap the card with `transition: none` then re-enable. Update `openState.originalRect` to the placeholder's new rect so close still returns home.

### Escape + backdrop

- `document.addEventListener('keydown', escClose)` attached at open, detached at close.
- Backdrop click handler attached at module init (one element, reused).

### Card-enter stagger

Carried over from the prototype as-is:

- CSS `@keyframes card-enter` (24px translateY + opacity 0 → 1) over 720ms.
- Per-card `--card-enter-delay` CSS variable set inline by the runtime based on DOM order (capped at index 8).
- IntersectionObserver fires at `rootMargin: '0px 0px -10% 0px'`, `threshold: 0.05`, adds `.in` to trigger the animation.
- `prefers-reduced-motion: reduce` cancels the animation.

The IntersectionObserver wiring lives in `bento-expand.ts` alongside the modal logic; both run at `DOMContentLoaded` and target elements within the same `BentoGrid`.

### Carried-over fixes from the prototype

The bento-mchiu.html iteration burned through a series of subtle issues; the port must include all of them:

- `card.blur()` at the start of `closeCaseStudy()` (and again in cleanup as belt-and-suspenders) to kill the UA focus outline.
- `.cover` gets `border-radius: inherit` (defensive seal against sub-pixel corner bleed).
- Project cards set their `background-color` to match the cover color (`#16140f` for base, `#1f1c16` for alt) — no paper bg sits under the cover to leak at corners.
- `border: 0; box-shadow: none;` on `.bento-card.project-card` and its `:hover` variant.
- The `inset 0 1px 0 rgba(255, 255, 255, 0.6)` removed from both `--card-shadow` and the clickable-hover box-shadow.
- `border-color` excluded from `.is-expanding`'s transition list (snaps with the bg snap, no silver fade).

## Frontmatter changes

### Schema additions in `content.config.ts`

```ts
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    repoUrl: z.url(),
    order: z.number().int(),
    draft: z.boolean().default(false),
    bentoSpan: z.enum(['hero', 'wide', 'tall', 'normal']).default('normal'),
    coverVariant: z.enum(['base', 'alt']).default('base'),
  }),
});
```

### Existing project files

Both existing project markdown files get the new optional fields. Suggested initial layout — one `hero` + one `wide` so the grid reads as intentional from day one:

- `strato-pi.md` — `bentoSpan: 'hero'`, `coverVariant: 'base'`
- `yolo-dualdev.md` — `bentoSpan: 'wide'`, `coverVariant: 'alt'`

(Final choice deferred to the implementation plan — whichever pairing reads best visually.)

## Acceptance criteria

- Bento renders on `/` in place of the old `ProjectsSection`, with the section breaking out past the 880px column up to ~1200px.
- All projects from the collection render with the correct `bentoSpan` and `coverVariant` from frontmatter.
- Click / Enter / Space on a card opens the case-study modal with the project's rendered markdown body inside.
- Esc and backdrop click both close cleanly with no visible focus outline, white border, or cream artifact at any point in the open or close lifecycle.
- Resize while modal is open snaps the card to the new viewport target without animation; close still morphs back to the correct grid slot.
- `prefers-reduced-motion: reduce` disables animations (the prototype's existing media query carries over); interaction still works.
- `npm run check` passes.
- `npm run build` produces no errors.
- No console errors in browser at rest, on open, on close, or on resize.
- `/projects/[slug]/` routes still resolve and render markdown bodies.

## Open questions / things to verify during implementation

- **`<Content />` in the slot** — Astro renders project markdown bodies via `const { Content } = project.render()` and `<Content />`. Verify that putting `<Content />` inside a `display: none` / `hidden` wrapper still produces hydrated HTML in the DOM that the runtime can clone/reveal. (If not, fall back to rendering body HTML to a string via `project.render()` then `set:html` into the wrapper.)
- **Astro hydration of the script** — `<script>import '../scripts/bento-expand.ts'</script>` in `BentoGrid.astro` should be bundled and processed by Astro's default behavior. Verify it runs on the homepage and not on `/projects/[slug]/` (where it shouldn't be loaded).
- **Animation interaction** — the prototype's `card-enter` IntersectionObserver fires on scroll. Verify it doesn't conflict with Astro view transitions if they get enabled later. (Not enabled today; flag for future.)

## Pre-implementation review checkpoint

Per the user's global CLAUDE.md convention, hand this spec to `codex-rescue` before drafting the implementation plan. Focus codex's review on:

- The `<Content />` inside `hidden` wrapper assumption — does Astro actually hydrate this?
- Width breakout math — does `margin-inline: calc((100% - X) / 2)` actually centre-anchor when the parent has padding rather than just max-width?
- Whether the `body-scroll-lock` padding-right compensation needs to know about Astro's view-transition layer.
- Anything in the prototype's `closeCaseStudy()` cleanup ordering (the long comment block at the cleanup site) that doesn't survive the port unchanged.
