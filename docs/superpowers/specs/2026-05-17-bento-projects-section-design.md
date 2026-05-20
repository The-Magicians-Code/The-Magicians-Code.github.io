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
import { getCollection, render } from 'astro:content';

const projects = (await getCollection('projects'))
  .filter((p) => !p.data.draft)
  .sort((a, b) => a.data.order - b.data.order);

// Astro 5: render() is a top-level function from astro:content, not a method
// on the entry. Pre-resolve <Content /> components for each project up-front
// since render() can't be called inside the JSX map.
const projectsWithContent = await Promise.all(
  projects.map(async (project) => {
    const { Content } = await render(project);
    return { project, Content };
  })
);
---

<section id="projects" class="section-fade-in" style="--delay: 0.2s">
  <div class="section-eyebrow">03 · Selected work</div>
  <h2 class="section-title">Projects <em>worth</em> showing.</h2>
  <BentoGrid>
    {projectsWithContent.map(({ project, Content }) => (
      <BentoCard
        title={project.data.title}
        eyebrow="Case study"
        slug={project.id}
        bentoSpan={project.data.bentoSpan}
        coverVariant={project.data.coverVariant}
      >
        <Content />
      </BentoCard>
    ))}
    <!-- "See all on GitHub" CTA card preserved from current ProjectsSection -->
  </BentoGrid>
</section>
```

The site's existing [src/pages/projects/[slug].astro](../../../src/pages/projects/%5Bslug%5D.astro) uses the same `await render(entry)` pattern — reference for verification.

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
9. After `--morph-dur` (520ms) settle, clone `.bento-card-body` children into the `.card-body` of the card and fade them in with a per-paragraph stagger. **Guard the appended body insertion** (`if (!openState || openState.closing) return`) so a fast esc-during-open doesn't leak appended content into a card that's already closing — prototype `bento-mchiu.html:1169-1173`.

### Close lifecycle

1. Guard against double-close (`if (!openState || openState.closing) return; openState.closing = true`).
2. `card.blur()` immediately (kill UA focus outline before morph begins — the lesson from the prototype).
3. Fade out appended body content (`opacity: 0`, 180ms).
4. Remove `.is-expanded` AND `.is-resizing` (a resize snap may have been in flight; clearing it lets the close transition run unimpeded — prototype `bento-mchiu.html:1232`). Add `.is-collapsing`. Set rect back to the placeholder's current `getBoundingClientRect()` (re-measure in case of resize).
5. Detach `escClose` keydown listener.
6. `transitionend` on `width` (with 800ms `setTimeout` fallback) → cleanup.

### Cleanup ordering (CRITICAL — must match prototype to avoid the one-frame silver snap)

The order below is non-obvious; the prototype's comment at `bento-mchiu.html:1258-1267` explains why. The implementation must preserve it:

1. Remove appended body content + close button.
2. Remove the backdrop's `.is-open` class (start its fade-out — backdrop stays in DOM for re-use, no `.remove()` needed since it's a sibling, not body-appended).
3. Build a `guarded` inline style = `originalInline + '; transition: none;'` and apply via `card.setAttribute('style', guarded)`. This freezes any transition while the inline-position styles are dropped.
4. Remove the placeholder so the grid slot is empty when the card returns to flow.
5. Force layout commit via `void card.offsetHeight`.
6. `requestAnimationFrame` →
   - Restore `originalInline` exactly (drops the `transition: none` inline override).
   - Remove `.is-expanding`, `.is-collapsing`, `.is-resizing` classes **after** the style restoration. Doing this in the opposite order causes a one-frame silver border snap because the resting border CSS rule applies before the inline `transition: none` lifts.
   - `card.blur()` again as belt-and-suspenders.
7. Unlock body scroll.
8. `openState = null`.

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

### Pointer-event gating (prototype details to preserve)

- **`.cs-close`** is `opacity: 0; pointer-events: none;` at rest; only `.is-expanded .cs-close` flips it to `opacity: 1; pointer-events: auto;`. Close is gated to the expanded state only — prototype `bento-mchiu.html:647-668`.
- **`.cs-expand`** (the hover-revealed expand affordance) is `pointer-events: none;` everywhere except `:hover` at rest. During `.is-expanding`, `.is-expanded`, `.is-collapsing` it's force-suppressed to prevent hover from re-revealing it over the modal — prototype `bento-mchiu.html:626-636`.
- **Close button click handler** uses `stopPropagation` so the click doesn't bubble up to the card (which would re-fire its own click handler) — prototype `bento-mchiu.html:1189-1191`.

### Accessibility

The card markup must include explicit a11y attributes (the prototype set `tabIndex` and key handlers in JS at `bento-mchiu.html:1328-1333`; the port declares them statically in the component):

```astro
<article
  class={`bento-card project-card cs-card span-${bentoSpan} cover-${coverVariant}`}
  data-bento-card
  data-slug={slug}
  role="button"
  tabindex="0"
  aria-haspopup="dialog"
  aria-expanded="false"
>
  ...
</article>
```

The runtime toggles `aria-expanded` between `"false"` and `"true"` synchronously with `.is-expanded`. The close button gets `aria-label="Close case study"`. The backdrop is `aria-hidden="true"`. Focus management: on close, focus returns to the card via `card.focus({ preventScroll: true })` only if the close was triggered by keyboard (`escClose`); if triggered by mouse (backdrop click), focus stays detached.

### Modal body content styling

The prototype only renders prose paragraphs (`<p class="body-para appended">`) and styles that one selector. The port clones the rendered markdown body, which may contain `<h2>`, `<h3>`, `<ul>`, `<ol>`, `<code>`, `<pre>`, `<a>`. The `BentoGrid`-scoped CSS adds:

```css
.bento-card.is-expanded .bento-card-body-rendered :is(h2, h3) {
  font-family: var(--font-serif);
  margin-top: 1.4em;
}
.bento-card.is-expanded .bento-card-body-rendered :is(ul, ol) {
  margin: 0.8em 0 0.8em 1.2em;
}
.bento-card.is-expanded .bento-card-body-rendered code {
  font-family: var(--font-mono);
  font-size: 0.92em;
  background: rgba(245, 241, 231, 0.10);
  padding: 1px 5px;
  border-radius: 4px;
}
.bento-card.is-expanded .bento-card-body-rendered a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
```

These rules scope to a `.bento-card-body-rendered` wrapper that the runtime creates when it clones the hidden body into the visible card-body. The existing per-paragraph fade-in stagger applies to direct children regardless of tag.

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

## Pre-implementation review — codex findings folded in

Codex reviewed this spec against the prototype and current codebase. Resolutions:

- **`<Content />` rendering** — confirmed working in Astro 5 with `await render(entry)` from `astro:content` (the existing `src/pages/projects/[slug].astro` uses this pattern). Spec example updated to pre-resolve `Content` components in frontmatter via `Promise.all` since `render()` cannot be called inside JSX `.map()`. No HTML-string fallback needed.
- **Width breakout math** — confirmed centre-anchors correctly at 375px / 880px / 1280px viewports because the parent `.page` padding is symmetric (`0 24px` mobile, `0 40px` desktop). Spec keeps the proposed `margin-inline: calc(...)` formula.
- **Cleanup ordering** — was underspecified; spec now has an explicit ordered list under "Cleanup ordering (CRITICAL)" with the why.
- **Missing prototype details** — added: `is-resizing` removed at close start, body-append guard against close-during-open, close-button `stopPropagation`, expand/close pointer-event gating.
- **Accessibility** — added explicit `role`, `tabindex`, `aria-haspopup`, `aria-expanded` on the card; close button gets `aria-label`; focus returns to card only on keyboard-triggered close.
- **Modal body markdown styling** — added CSS rules for `<h2>`/`<h3>`/`<ul>`/`<ol>`/`<code>`/`<a>` (the prototype only styled `<p>`).

## Things to verify during implementation

- **Script bundling** — `<script>import '../scripts/bento-expand.ts'</script>` in `BentoGrid.astro` should be bundled by Astro's default behavior. Verify it runs on `/` and is NOT included on `/projects/[slug]/` (where the bento isn't mounted).
- **View transitions** — the prototype's `card-enter` IntersectionObserver fires on scroll. Verify it doesn't conflict with Astro view transitions if they get enabled later. Not enabled today; flag for future.
