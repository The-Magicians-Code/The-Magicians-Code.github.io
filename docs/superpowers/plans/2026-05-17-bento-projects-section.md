# Bento projects section v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage `ProjectsSection` with a reusable bento grid (`BentoGrid` + `BentoCard` + `BentoProjectsSection`) backed by an extracted runtime (`bento-expand.ts`). The bento renders projects in an asymmetric grid; clicking a card opens an in-place morphing modal with the project's rendered markdown body.

**Architecture:** `BentoProjectsSection` queries the `projects` content collection, pre-resolves `<Content />` per entry, and iterates `BentoCard`s inside a `BentoGrid`. `BentoGrid` owns layout CSS, the single shared backdrop, and the script import. `bento-expand.ts` discovers `[data-bento-card]` at `DOMContentLoaded` and owns open/close/morph/focus-blur/escape/resize logic with module-scope `openState`. Light-mode only for v1; pretext, filter pill, dark mode, decorative variants deferred.

**Tech Stack:** Astro 5 (content collections, `astro:content` `render()`), TypeScript for the runtime, CSS custom properties (site globals + bento-scoped tokens). No automated tests in this repo — verification is `npm run check` + `npm run build` + manual browser pass.

**Reference docs:**
- Design spec: [docs/superpowers/specs/2026-05-17-bento-projects-section-design.md](../specs/2026-05-17-bento-projects-section-design.md)
- Prototype to port: [docs/ideas/bento-mchiu.html](../../ideas/bento-mchiu.html)
- Existing per-project route (Astro `render()` pattern): [src/pages/projects/[slug].astro](../../../src/pages/projects/%5Bslug%5D.astro)

---

## Task 1: Extend the `projects` content collection schema

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: Add `bentoSpan` and `coverVariant` to the projects schema**

Replace the contents of `src/content.config.ts` with:

```ts
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

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

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, blog };
```

- [ ] **Step 2: Verify schema parses (existing files still validate; new fields default)**

Run: `npm run check`
Expected: exits 0, no schema errors. The two existing project files don't yet declare `bentoSpan` / `coverVariant`; defaults take effect.

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "Add bentoSpan + coverVariant to projects schema"
```

---

## Task 2: Update existing project frontmatter with bento metadata

**Files:**
- Modify: `src/content/projects/strato-pi.md`
- Modify: `src/content/projects/yolo-dualdev.md`

- [ ] **Step 1: Pick the visual rhythm**

Two projects, so one `hero` (2×2 square) + one `wide` (1×2 horizontal) reads as intentional. `yolo-dualdev.md` is `order: 1` (first in the grid); make it the `hero`. `strato-pi.md` is `order: 2`; make it the `wide`. Use opposite cover variants so the pair feels balanced.

- [ ] **Step 2: Update `yolo-dualdev.md`**

Replace the file's content with:

```md
---
title: Yolo-dualdev
description: Develop and deploy TensorRT-optimised YOLOv5 models on Nvidia Jetson
repoUrl: https://github.com/The-Magicians-Code/Yolo-dualdev/
order: 1
bentoSpan: hero
coverVariant: base
---

Detail page body — flesh out later.
```

- [ ] **Step 3: Update `strato-pi.md`**

Replace the file's content with:

```md
---
title: Strato_Pi
description: Motor load machine controller with online interface
repoUrl: https://github.com/The-Magicians-Code/Strato_Pi/
order: 2
bentoSpan: wide
coverVariant: alt
---

Detail page body — flesh out later.
```

- [ ] **Step 4: Verify schema accepts the new values**

Run: `npm run check`
Expected: exits 0, no schema errors.

- [ ] **Step 5: Commit**

```bash
git add src/content/projects/strato-pi.md src/content/projects/yolo-dualdev.md
git commit -m "Curate bentoSpan + coverVariant for existing projects"
```

---

## Task 3: Create the runtime script (`bento-expand.ts`)

**Files:**
- Create: `src/scripts/bento-expand.ts`

This task lands the runtime in one piece. The full code below carries every detail from the prototype's open/close/morph/cleanup/resize/focus-blur logic, with the codex-flagged ordering preserved.

- [ ] **Step 1: Create `src/scripts/bento-expand.ts` with the full runtime**

```ts
// Bento expand/collapse runtime.
//
// Discovers [data-bento-card] elements at DOMContentLoaded and wires the
// click-to-expand morphing modal. Port of docs/ideas/bento-mchiu.html — see
// docs/superpowers/specs/2026-05-17-bento-projects-section-design.md for the
// design rationale and "Carried-over fixes from the prototype" for the why
// behind the non-obvious bits (focus-outline suppression via card.blur(),
// cleanup ordering to avoid the one-frame silver snap, etc.).

interface OpenState {
  card: HTMLElement;
  placeholder: HTMLElement;
  closeBtn: HTMLButtonElement;
  backdrop: HTMLElement;
  originalInline: string;
  originalRect: DOMRect;
  appendedBodyWrap: HTMLElement | null;
  closing: boolean;
  triggeredByKeyboard: boolean;
}

const MORPH_DUR = 520; // must match --morph-dur in CSS

let openState: OpenState | null = null;

// ── Viewport rect computation ────────────────────────────────────────────
function getViewportRect(): DOMRect {
  const isMobile = window.innerWidth < 540;
  const pad = isMobile ? 16 : Math.max(24, Math.min(48, window.innerWidth * 0.05));
  const maxW = 920;
  const maxH = isMobile ? window.innerHeight - pad * 2 : 720;
  const w = Math.min(window.innerWidth - pad * 2, maxW);
  const h = Math.min(window.innerHeight - pad * 2, maxH);
  return new DOMRect(
    (window.innerWidth - w) / 2,
    (window.innerHeight - h) / 2,
    w,
    h,
  );
}

// ── Body scroll lock with scrollbar-width compensation ───────────────────
function lockBodyScroll(): void {
  const sbw = window.innerWidth - document.documentElement.clientWidth;
  if (sbw > 0) {
    const current = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.dataset.bentoPrevPaddingRight = document.body.style.paddingRight || '';
    document.body.style.paddingRight = `${current + sbw}px`;
  }
  document.body.classList.add('bento-open');
}

function unlockBodyScroll(): void {
  document.body.classList.remove('bento-open');
  if ('bentoPrevPaddingRight' in document.body.dataset) {
    document.body.style.paddingRight = document.body.dataset.bentoPrevPaddingRight ?? '';
    delete document.body.dataset.bentoPrevPaddingRight;
  }
}

// ── Close-button SVG (Lucide "minimize-2" / "shrink" glyph) ──────────────
function makeCloseIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const shapes: Array<[string, Record<string, string>]> = [
    ['polyline', { points: '4 14 10 14 10 20' }],
    ['polyline', { points: '20 10 14 10 14 4' }],
    ['line', { x1: '14', y1: '10', x2: '21', y2: '3' }],
    ['line', { x1: '3', y1: '21', x2: '10', y2: '14' }],
  ];
  for (const [name, attrs] of shapes) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}

// ── Open ─────────────────────────────────────────────────────────────────
function openCaseStudy(card: HTMLElement, triggeredByKeyboard: boolean): void {
  if (openState) return;

  const backdrop = document.querySelector<HTMLElement>('[data-bento-backdrop]');
  if (!backdrop) return;

  // Finish any in-flight card-enter animation so its transform doesn't fight
  // our position:fixed lift and the captured rect reflects the settled pose.
  card.getAnimations().forEach((a) => {
    if ((a as CSSAnimation).animationName === 'card-enter') {
      try { a.finish(); } catch { /* ignore */ }
    }
  });

  const rect = card.getBoundingClientRect();
  const vr = getViewportRect();
  const originalInline = card.getAttribute('style') ?? '';

  // Grid placeholder preserves the bento layout while the card lifts.
  const cs = getComputedStyle(card);
  const placeholder = document.createElement('div');
  placeholder.className = 'bento-card-placeholder';
  placeholder.style.gridColumnStart = cs.gridColumnStart;
  placeholder.style.gridColumnEnd = cs.gridColumnEnd;
  placeholder.style.gridRowStart = cs.gridRowStart;
  placeholder.style.gridRowEnd = cs.gridRowEnd;
  card.parentNode?.insertBefore(placeholder, card);

  // Lift the card. Transition is forced off so the position swap doesn't
  // animate — only the subsequent rAF target change does.
  card.style.transition = 'none';
  card.style.position = 'fixed';
  card.style.top = `${rect.top}px`;
  card.style.left = `${rect.left}px`;
  card.style.width = `${rect.width}px`;
  card.style.height = `${rect.height}px`;
  card.style.margin = '0';
  card.style.transform = 'none';

  // Close button as a child of the card.
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cs-close';
  closeBtn.setAttribute('aria-label', 'Close case study');
  closeBtn.appendChild(makeCloseIcon());
  card.appendChild(closeBtn);

  card.classList.add('is-expanding');
  card.setAttribute('aria-expanded', 'true');
  backdrop.classList.add('is-open');
  lockBodyScroll();

  void card.offsetHeight; // commit lift before re-enabling transitions

  requestAnimationFrame(() => {
    card.style.transition = ''; // CSS-defined transitions apply now
    card.classList.add('is-expanded');
    card.style.top = `${vr.top}px`;
    card.style.left = `${vr.left}px`;
    card.style.width = `${vr.width}px`;
    card.style.height = `${vr.height}px`;
  });

  openState = {
    card,
    placeholder,
    closeBtn,
    backdrop,
    originalInline,
    originalRect: rect,
    appendedBodyWrap: null,
    closing: false,
    triggeredByKeyboard,
  };

  // After the morph lands, clone the hidden body content into the visible
  // card-body and fade it in with a per-paragraph stagger. Guard against
  // close-during-open: if user esc'd before this fires, drop it.
  window.setTimeout(() => {
    if (!openState || openState.closing) return;
    const body = card.querySelector<HTMLElement>('.card-body');
    const source = card.querySelector<HTMLElement>('.bento-card-body');
    if (!body || !source) return;

    const wrap = document.createElement('div');
    wrap.className = 'bento-card-body-rendered';
    // Clone children so the original hidden source stays intact for a
    // potential re-open (state isn't destroyed; only inline copies are).
    for (const child of source.children) {
      const cloned = child.cloneNode(true) as HTMLElement;
      wrap.appendChild(cloned);
    }
    body.appendChild(wrap);
    openState.appendedBodyWrap = wrap;

    // Per-child stagger via inline custom property.
    [...wrap.children].forEach((el, idx) => {
      (el as HTMLElement).style.setProperty('--stagger-idx', String(idx));
      (el as HTMLElement).classList.add('body-para', 'appended');
    });
    void wrap.offsetHeight;
    requestAnimationFrame(() => {
      [...wrap.children].forEach((el) => el.classList.add('in'));
    });
  }, MORPH_DUR);

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCaseStudy();
  });
  backdrop.addEventListener('click', closeCaseStudy, { once: true });
  document.addEventListener('keydown', escClose);
}

function escClose(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (openState) openState.triggeredByKeyboard = true;
    closeCaseStudy();
  }
}

// ── Close ────────────────────────────────────────────────────────────────
function closeCaseStudy(): void {
  if (!openState || openState.closing) return;
  openState.closing = true;
  const state = openState;
  const { card, placeholder, closeBtn, backdrop, originalInline, originalRect, appendedBodyWrap } = state;

  // Blur BEFORE the morph so the UA focus outline doesn't trace the shrink.
  card.blur();

  // Fade out appended body content (CSS handles the 180ms tail via the
  // .is-collapsing rule that immediately follows).
  if (appendedBodyWrap) {
    [...appendedBodyWrap.children].forEach((el) => el.classList.remove('in'));
  }

  // Clear is-resizing in case a resize snap was mid-flight; otherwise the
  // close transition would inherit `transition: none !important`.
  card.classList.remove('is-expanded', 'is-resizing');
  card.classList.add('is-collapsing');
  card.setAttribute('aria-expanded', 'false');

  // Re-measure the placeholder; resize may have moved it.
  const slotRect = placeholder.getBoundingClientRect();
  card.style.top = `${slotRect.top}px`;
  card.style.left = `${slotRect.left}px`;
  card.style.width = `${slotRect.width}px`;
  card.style.height = `${slotRect.height}px`;

  backdrop.classList.remove('is-open');
  document.removeEventListener('keydown', escClose);

  let cleanedUp = false;
  const doCleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.clearTimeout(fallbackTimer);
    card.removeEventListener('transitionend', onTransitionEnd);

    // 1) Remove appended children + close button.
    if (appendedBodyWrap) appendedBodyWrap.remove();
    closeBtn.remove();

    // 2) Apply guarded style (originalInline + transition:none) so the
    //    inline-style swap doesn't animate. THEN remove placeholder.
    //    THEN force layout. THEN in rAF, restore originalInline, THEN
    //    remove lifecycle classes. The ordering is critical — inverting
    //    causes a one-frame silver snap when the resting border CSS rule
    //    re-applies before the inline transition:none lifts.
    const trimmed = originalInline.trim();
    const guarded = trimmed
      ? `${trimmed}${trimmed.endsWith(';') ? '' : ';'} transition: none;`
      : 'transition: none;';
    card.setAttribute('style', guarded);
    placeholder.remove();
    void card.offsetHeight;

    requestAnimationFrame(() => {
      if (originalInline) {
        card.setAttribute('style', originalInline);
      } else {
        card.removeAttribute('style');
      }
      card.classList.remove('is-expanding', 'is-collapsing', 'is-resizing');
      // Belt-and-suspenders re-blur.
      card.blur();
      // Restore focus to the card only if close was triggered by keyboard
      // (esc); mouse-driven close keeps focus detached.
      if (state.triggeredByKeyboard) {
        card.focus({ preventScroll: true });
      }
    });

    unlockBodyScroll();
    openState = null;
  };

  const onTransitionEnd = (e: TransitionEvent): void => {
    if (e.target !== card) return;
    if (e.propertyName !== 'width') return;
    doCleanup();
  };
  card.addEventListener('transitionend', onTransitionEnd);
  const fallbackTimer = window.setTimeout(doCleanup, MORPH_DUR + 280);
}

// ── Resize while open ────────────────────────────────────────────────────
let resizeRaf: number | null = null;
function onResize(): void {
  if (!openState || openState.closing) return;
  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    if (!openState || openState.closing) return;
    const { card, placeholder } = openState;

    card.classList.add('is-resizing');
    const vr = getViewportRect();
    card.style.transition = 'none';
    card.style.top = `${vr.top}px`;
    card.style.left = `${vr.left}px`;
    card.style.width = `${vr.width}px`;
    card.style.height = `${vr.height}px`;
    void card.offsetHeight;
    card.style.transition = '';

    // Update originalRect so close returns to the (possibly moved) slot.
    openState.originalRect = placeholder.getBoundingClientRect();

    requestAnimationFrame(() => {
      if (openState && !openState.closing) openState.card.classList.remove('is-resizing');
    });
  });
}

// ── Card-enter stagger (IntersectionObserver) ────────────────────────────
function initCardEnter(): void {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-bento-card]')];
  cards.forEach((c, i) => {
    c.style.setProperty('--card-enter-delay', `${Math.min(i, 8) * 0.08}s`);
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  );
  cards.forEach((c) => io.observe(c));
}

// ── Wire-up ──────────────────────────────────────────────────────────────
function init(): void {
  const cards = document.querySelectorAll<HTMLElement>('[data-bento-card]');
  if (cards.length === 0) return;

  cards.forEach((card) => {
    card.addEventListener('click', () => openCaseStudy(card, false));
    card.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCaseStudy(card, true);
      }
    });
  });

  initCardEnter();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export {}; // ensure module scope
```

- [ ] **Step 2: Verify TypeScript + Astro compile**

Run: `npm run check`
Expected: exits 0; no TS errors. (The script isn't imported anywhere yet, so it won't affect the build output, but `astro check` runs `tsc` on the project.)

- [ ] **Step 3: Commit**

```bash
git add src/scripts/bento-expand.ts
git commit -m "Add bento-expand runtime (open/close/morph/focus-blur/resize)"
```

---

## Task 4: Create `BentoCard.astro`

**Files:**
- Create: `src/components/BentoCard.astro`

- [ ] **Step 1: Create the component**

```astro
---
interface Props {
  title: string;
  eyebrow?: string;
  slug: string;
  bentoSpan?: 'hero' | 'wide' | 'tall' | 'normal';
  coverVariant?: 'base' | 'alt';
}

const {
  title,
  eyebrow,
  slug,
  bentoSpan = 'normal',
  coverVariant = 'base',
} = Astro.props;
---

<article
  class:list={[
    'bento-card',
    'project-card',
    'cs-card',
    `span-${bentoSpan}`,
    `cover-${coverVariant}`,
  ]}
  data-bento-card
  data-slug={slug}
  role="button"
  tabindex="0"
  aria-haspopup="dialog"
  aria-expanded="false"
>
  <div class="cover"></div>
  <span class="cs-expand" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  </span>
  <div class="card-body">
    {eyebrow && <div class="card-eyebrow">{eyebrow}</div>}
    <div class="card-title">{title}</div>
  </div>
  <div class="bento-card-body" hidden>
    <slot />
  </div>
</article>
```

The slotted content is the project's `<Content />` from `await render(project)`. The wrapper is `hidden` so SSG produces real DOM nodes that the runtime can clone on open, without painting them in the resting card. CSS in Task 5 hides everything inside `.bento-card-body` from layout/paint.

- [ ] **Step 2: Verify it parses (no consumers yet, but `astro check` validates)**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/BentoCard.astro
git commit -m "Add BentoCard component"
```

---

## Task 5: Create `BentoGrid.astro`

**Files:**
- Create: `src/components/BentoGrid.astro`

This component owns the grid layout CSS, the lifecycle classes' visual rules (carried over from `docs/ideas/bento-mchiu.html`), the backdrop, and the script import.

- [ ] **Step 1: Create the component**

```astro
---
// BentoGrid — layout shell for BentoCards. Owns the asymmetric grid CSS,
// the single shared backdrop, the lifecycle visual rules, and the script
// import. See docs/superpowers/specs/2026-05-17-bento-projects-section-design.md.
---

<section class="bento-section">
  <div class="bento-grid" data-bento-grid>
    <slot />
  </div>
  <div class="bento-backdrop" data-bento-backdrop aria-hidden="true"></div>
</section>

<script>
  import '../scripts/bento-expand.ts';
</script>

<style>
  /* ── Bento-scoped tokens ──────────────────────────────────────── */
  .bento-section {
    --cell: 252px;
    --gap: 18px;
    --morph-dur: 520ms;
    --ease-snappy: cubic-bezier(0.77, 0, 0.175, 1);

    /* Break out of the parent .page column (max-width: 880px) up to ~1200px,
       centre-anchored. Works because .page padding is symmetric (24px / 40px). */
    width: min(100vw - 32px, 1200px);
    margin-inline: calc((100% - min(100vw - 32px, 1200px)) / 2);
  }

  @media (max-width: 1140px) { .bento-section { --cell: 220px; } }
  @media (max-width: 540px)  { .bento-section { --cell: 88vw; } }

  /* ── Grid ─────────────────────────────────────────────────────── */
  .bento-grid {
    display: grid;
    grid-template-columns: repeat(4, var(--cell));
    grid-auto-rows: var(--cell);
    gap: var(--gap);
    justify-content: center;
    align-content: start;
  }
  @media (max-width: 920px) {
    .bento-grid { grid-template-columns: repeat(2, var(--cell)); }
  }
  @media (max-width: 540px) {
    .bento-grid { grid-template-columns: var(--cell); }
  }

  /* ── Span classes ─────────────────────────────────────────────── */
  :global(.bento-card.span-hero)   { grid-column: span 2; grid-row: span 2; }
  :global(.bento-card.span-wide)   { grid-column: span 2; }
  :global(.bento-card.span-tall)   { grid-row: span 2; }
  :global(.bento-card.span-normal) { /* 1×1, default */ }

  @media (max-width: 920px) {
    :global(.bento-card.span-hero) { grid-column: span 2; grid-row: span 2; }
    :global(.bento-card.span-wide) { grid-column: span 2; }
    :global(.bento-card.span-tall) { grid-column: span 1; grid-row: span 1; }
  }
  @media (max-width: 540px) {
    :global(.bento-card.span-hero),
    :global(.bento-card.span-wide),
    :global(.bento-card.span-tall),
    :global(.bento-card.span-normal) { grid-column: span 1; grid-row: span 1; }
  }

  /* ── Card base (port of .bento-card from bento-mchiu) ─────────── */
  :global(.bento-card) {
    position: relative;
    background: var(--paper);
    border: 0;
    border-radius: 32px;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.04),
      0 1px 2px rgba(0, 0, 0, 0.04),
      inset 0 -1px 0 rgba(0, 0, 0, 0.02);
    overflow: hidden;
    transition: box-shadow 240ms var(--ease, cubic-bezier(0.22, 1, 0.36, 1));
    cursor: pointer;
  }
  /* Card-enter starting state scoped to interactive bento cards only.
     The .all-projects CTA shares .bento-card but isn't [data-bento-card] —
     scoping here keeps it visible at rest instead of stuck at opacity:0. */
  :global([data-bento-card]) {
    opacity: 0;
    transform: translateY(24px);
  }
  :global([data-bento-card].in) {
    animation: bento-card-enter 720ms var(--ease, cubic-bezier(0.22, 1, 0.36, 1)) forwards;
    animation-delay: var(--card-enter-delay, 0s);
  }
  @keyframes bento-card-enter {
    0%   { opacity: 0; transform: translateY(24px); }
    100% { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    :global([data-bento-card])    { opacity: 1; transform: none; }
    :global([data-bento-card].in) { animation: none; }
  }

  :global(.bento-card:hover) {
    transform: translateY(-2px);
    box-shadow:
      0 6px 24px rgba(0, 0, 0, 0.06),
      0 2px 6px rgba(0, 0, 0, 0.04);
  }

  /* Project cards: no border, no shadow, bg matches cover (the prototype's
     hard-won fix to avoid cream/white leak at sub-pixel rounded corners). */
  :global(.bento-card.project-card),
  :global(.bento-card.project-card:hover) {
    border: 0;
    box-shadow: none;
    background-color: #16140f;
  }
  :global(.bento-card.project-card.cover-alt),
  :global(.bento-card.project-card.cover-alt:hover) {
    background-color: #1f1c16;
  }

  /* ── Cover layer ──────────────────────────────────────────────── */
  :global(.project-card .cover) {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(120% 120% at 0% 0%,   oklch(72% 0.16 28 / 0.35), transparent 60%),
      radial-gradient(120% 120% at 100% 100%, oklch(60% 0.14 250 / 0.35), transparent 60%),
      #16140f;
  }
  :global(.project-card .cover::after) {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.55) 100%);
  }
  :global(.project-card.cover-alt .cover) {
    background:
      radial-gradient(120% 120% at 0% 0%,   oklch(72% 0.14 140 / 0.35), transparent 60%),
      radial-gradient(120% 120% at 100% 100%, oklch(64% 0.18 28 / 0.40), transparent 60%),
      #1f1c16;
  }

  /* ── Card body (rest) ─────────────────────────────────────────── */
  :global(.bento-card .card-body) {
    position: relative;
    z-index: 1;
    padding: 28px;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 12px;
  }
  :global(.bento-card .card-eyebrow) {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.10em;
    color: rgba(245, 241, 231, 0.7);
  }
  :global(.bento-card .card-title) {
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: 24px;
    line-height: 1.15;
    letter-spacing: -0.01em;
    color: #f5f1e7;
  }
  :global(.bento-card .card-title em) {
    font-style: italic;
    color: var(--accent);
  }

  /* Hidden body source for the modal (cloned on open) */
  :global(.bento-card .bento-card-body) {
    display: none;
  }

  /* ── Hover-revealed expand affordance ─────────────────────────── */
  :global(.cs-expand) {
    position: absolute;
    top: 16px; right: 16px;
    width: 40px; height: 40px;
    border-radius: 999px;
    background: rgba(245, 241, 231, 0.10);
    color: #f5f1e7;
    display: grid;
    place-items: center;
    z-index: 2;
    box-shadow: 0 2px 40px rgba(0, 0, 0, 0.40);
    opacity: 0;
    transform: scale(0.8);
    pointer-events: none;
    transition: opacity 200ms ease, transform 200ms ease, background 200ms var(--ease);
  }
  :global(.cs-expand svg) { width: 16px; height: 16px; }
  @media (hover: hover) and (pointer: fine) {
    :global(.bento-card:hover .cs-expand) {
      opacity: 1; transform: scale(1); pointer-events: auto;
    }
  }
  :global(.bento-card:focus-visible .cs-expand) {
    opacity: 1; transform: scale(1); pointer-events: auto;
  }
  :global(.cs-expand:hover) { background: rgba(245, 241, 231, 0.18); }
  @media (prefers-reduced-motion: reduce) {
    :global(.cs-expand) { transform: none; transition: opacity 200ms ease; }
  }
  /* Suppress entirely during lifecycle so it can't peek over the modal. */
  :global(.bento-card.is-expanding .cs-expand),
  :global(.bento-card.is-expanded .cs-expand),
  :global(.bento-card.is-collapsing .cs-expand) {
    opacity: 0 !important;
    transform: scale(0.8) !important;
    pointer-events: none !important;
  }

  /* ── Lifecycle states ─────────────────────────────────────────── */
  :global(.bento-card.is-expanding) {
    z-index: 201;
    /* border-color deliberately omitted — snap in lockstep with bg.
       See spec "Carried-over fixes from the prototype". */
    transition:
      top        var(--morph-dur) var(--ease-snappy),
      left       var(--morph-dur) var(--ease-snappy),
      width      var(--morph-dur) var(--ease-snappy),
      height     var(--morph-dur) var(--ease-snappy),
      box-shadow var(--morph-dur) var(--ease-snappy);
    will-change: top, left, width, height;
  }
  :global(.bento-card.is-expanding),
  :global(.bento-card.is-expanded),
  :global(.bento-card.is-collapsing) {
    cursor: default;
    box-shadow: none;
    border-color: transparent;
  }
  :global(.bento-card.is-expanding .card-body) {
    transition: padding var(--morph-dur) var(--ease-snappy);
  }
  :global(.bento-card.is-expanded .card-body) {
    padding: 56px 48px 48px;
    justify-content: flex-start;
  }
  :global(.bento-card.is-expanded .card-title) {
    font-size: 34px;
  }
  @media (max-width: 540px) {
    :global(.bento-card.is-expanded .card-body) { padding: 48px 22px 32px; }
  }

  /* Resizing suppresses transitions for instant snap. */
  :global(.bento-card.is-resizing) {
    transition: none !important;
  }

  /* Grid placeholder — invisible, holds the grid slot. */
  :global(.bento-card-placeholder) {
    visibility: hidden;
    pointer-events: none;
  }

  /* ── Appended modal body content (cloned at open) ─────────────── */
  :global(.bento-card .bento-card-body-rendered) {
    font-size: 15px;
    line-height: 1.55;
    color: rgba(245, 241, 231, 0.75);
    max-width: 64ch;
  }
  :global(.bento-card .body-para.appended) {
    margin: 14px 0;
    opacity: 0;
    transition: opacity 280ms ease;
  }
  :global(.bento-card .body-para.appended.in) {
    opacity: 1;
    transition-delay: calc(var(--stagger-idx, 0) * 80ms);
  }
  :global(.bento-card.is-collapsing .body-para.appended),
  :global(.bento-card.is-collapsing .body-para.appended.in) {
    opacity: 0;
    transition: opacity 180ms ease;
    transition-delay: 0ms;
  }
  /* Markdown body styling — rendered content may carry headings, lists, code, links. */
  :global(.bento-card .bento-card-body-rendered :is(h2, h3)) {
    font-family: var(--font-serif);
    color: #f5f1e7;
    font-weight: 400;
    letter-spacing: -0.01em;
    margin: 1.4em 0 0.5em;
  }
  :global(.bento-card .bento-card-body-rendered :is(ul, ol)) {
    margin: 0.8em 0 0.8em 1.2em;
  }
  :global(.bento-card .bento-card-body-rendered li) {
    margin-bottom: 0.4em;
  }
  :global(.bento-card .bento-card-body-rendered code) {
    font-family: var(--font-mono);
    font-size: 0.92em;
    background: rgba(245, 241, 231, 0.10);
    padding: 1px 5px;
    border-radius: 4px;
  }
  :global(.bento-card .bento-card-body-rendered a) {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* ── Close button ─────────────────────────────────────────────── */
  :global(.cs-close) {
    position: absolute;
    top: 16px; right: 16px;
    width: 40px; height: 40px;
    border-radius: 999px;
    background: rgba(245, 241, 231, 0.10);
    color: #f5f1e7;
    display: grid;
    place-items: center;
    cursor: pointer;
    z-index: 2;
    border: 0;
    opacity: 0;
    pointer-events: none;
    transition: background 200ms var(--ease), opacity 240ms ease;
  }
  :global(.bento-card.is-expanded .cs-close) {
    opacity: 1;
    pointer-events: auto;
    transition-delay: 0ms, 280ms;
  }
  :global(.bento-card.is-collapsing .cs-close) {
    opacity: 0;
    pointer-events: none;
    transition: opacity 180ms ease, background 200ms ease;
    transition-delay: 0ms;
  }
  :global(.cs-close:hover) { background: rgba(245, 241, 231, 0.18); }
  :global(.cs-close svg) { width: 16px; height: 16px; }

  /* ── Backdrop ─────────────────────────────────────────────────── */
  .bento-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(26, 26, 28, 0.4);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 320ms ease;
    cursor: pointer;
  }
  .bento-backdrop.is-open {
    opacity: 1;
    pointer-events: auto;
  }

  /* ── Body scroll lock ─────────────────────────────────────────── */
  :global(body.bento-open) {
    overflow: hidden;
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/BentoGrid.astro
git commit -m "Add BentoGrid component (layout, lifecycle CSS, backdrop, script import)"
```

---

## Task 6: Create `BentoProjectsSection.astro`

**Files:**
- Create: `src/components/BentoProjectsSection.astro`

- [ ] **Step 1: Create the section wrapper**

```astro
---
import { Icon } from 'astro-icon/components';
import { getCollection, render } from 'astro:content';
import BentoGrid from './BentoGrid.astro';
import BentoCard from './BentoCard.astro';

const projects = (await getCollection('projects'))
  .filter((p) => !p.data.draft)
  .sort((a, b) => a.data.order - b.data.order);

// Pre-resolve <Content /> per project. render() is a top-level function in
// Astro 5 (from astro:content); it can't be called inside JSX .map(), so we
// resolve up-front via Promise.all. Matches the pattern at
// src/pages/projects/[slug].astro.
const projectsWithContent = await Promise.all(
  projects.map(async (project) => {
    const { Content } = await render(project);
    return { project, Content };
  }),
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
    <a
      href="https://github.com/The-Magicians-Code/"
      target="_blank"
      rel="noopener noreferrer"
      class="bento-card all-projects span-wide"
      aria-label="View all projects on GitHub"
    >
      <Icon name="lucide:github" class="w-5 h-5" aria-hidden="true" />
      <span>See all projects on GitHub</span>
      <Icon name="lucide:arrow-up-right" class="w-4 h-4 trail" aria-hidden="true" />
    </a>
  </BentoGrid>
</section>

<style>
  .section-title {
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: clamp(1.75rem, 1.5vw + 1.25rem, 2.5rem);
    line-height: 1.15;
    letter-spacing: -0.01em;
    margin-bottom: 24px;
  }
  .all-projects {
    /* The "See all on GitHub" card reuses .bento-card geometry but renders
       as a static CTA — not data-bento-card, so the runtime ignores it. */
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--ink-dim);
    font-family: var(--font-mono);
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    text-decoration: none;
    background: var(--paper) !important;
    color: var(--ink-dim) !important;
    cursor: pointer;
    padding: 0 28px;
  }
  .all-projects:hover {
    color: var(--ink) !important;
  }
  .all-projects .trail {
    transition: transform 0.2s ease;
  }
  .all-projects:hover .trail {
    transform: translate(2px, -2px);
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/BentoProjectsSection.astro
git commit -m "Add BentoProjectsSection — queries projects collection, mounts BentoGrid"
```

---

## Task 7: Swap the homepage to use `BentoProjectsSection`

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Replace the import + element**

Replace the contents of `src/pages/index.astro` with:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import About from '../components/About.astro';
import BentoProjectsSection from '../components/BentoProjectsSection.astro';
import SkillsTools from '../components/SkillsTools.astro';
import Contact from '../components/Contact.astro';
---

<BaseLayout
  title="Tanel Treuberg - SWE"
  description="Software engineer working across backend, infrastructure, and applied ML."
  canonicalPath="/"
  includePersonSchema={true}
>
  <main class="page">
    <Hero />
    <About />
    <BentoProjectsSection />
    <SkillsTools />
    <Contact />
  </main>
</BaseLayout>

<style>
  .page {
    max-width: 880px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 64px;
  }
  @media (min-width: 720px) {
    .page {
      padding: 0 40px;
      gap: 88px;
    }
  }
</style>
```

- [ ] **Step 2: Run check + build to verify integration**

Run: `npm run check`
Expected: exits 0.

Run: `npm run build`
Expected: exits 0; build output contains `/projects/strato-pi/` and `/projects/yolo-dualdev/` (per-project routes are still alive).

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "Mount BentoProjectsSection on homepage (replaces ProjectsSection)"
```

---

## Task 8: Browser verification

**No code changes in this task — manual browser pass.**

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts at `http://localhost:4321/`.

- [ ] **Step 2: Open homepage and verify resting state**

Open `http://localhost:4321/` in Chrome. Verify:
- Bento section appears in place of the old project list, breaking out past the 880px column.
- `yolo-dualdev` renders as a 2×2 hero card.
- `strato-pi` renders as a 1×2 wide card.
- Both cards show the dark cover gradient with the title and "Case study" eyebrow.
- "See all projects on GitHub" CTA renders at the bottom as a wide card.
- Card-enter stagger animation fires on scroll into view.
- No console errors.

- [ ] **Step 3: Verify open / close lifecycle**

For each project card:
- **Click** → card morphs to centered modal over blurred backdrop; markdown body fades in after morph.
- **Backdrop click** → card morphs back to grid slot, no visible white/cream border, no focus outline lingering.
- **Esc key** → same close behavior as backdrop click; focus returns to the card after cleanup.
- **Enter / Space on focused card** → opens (verify via Tab to card first).
- **Tab while modal is open** → focus should stay within the card or close button (best-effort; not strictly enforced in v1).

- [ ] **Step 4: Verify resize while open**

Open a card. Resize the browser window:
- Card snaps to new viewport-centered target without animation.
- Close still returns to the correct grid slot in the new layout.

- [ ] **Step 5: Verify reduced motion**

In Chrome DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`:
- Card-enter animation does not fire.
- Open/close still works; morph runs at the same speed (CSS transition stays), but card-enter stagger is off.

- [ ] **Step 6: Verify `/projects/[slug]/` still works**

Navigate directly to `http://localhost:4321/projects/yolo-dualdev/` and `http://localhost:4321/projects/strato-pi/`. Both render the detail page with the markdown body. No bento script should load on these routes (open DevTools → Sources, verify `bento-expand.ts` is not present).

- [ ] **Step 7: If any verification fails — fix and re-test**

Common likely issues:
- White border on close → focus blur ordering. Confirm `card.blur()` runs at the start of `closeCaseStudy()`, not just in cleanup.
- Body content doesn't appear → check the cloned wrap's children have `.body-para.appended.in` applied. Inspect DOM in DevTools.
- Card jumps mid-morph → `card.getAnimations().filter(card-enter).finish()` not running. Confirm the `animationName` check.

Each fix is its own commit:

```bash
git add <changed-files>
git commit -m "Fix <thing>: <one-line why>"
```

---

## Task 9: Remove the old components

**Files:**
- Delete: `src/components/ProjectsSection.astro`
- Delete: `src/components/ProjectCard.astro`

- [ ] **Step 1: Verify no remaining references**

Run: `grep -r "ProjectsSection\|ProjectCard" src/ --include="*.astro" --include="*.ts" --include="*.js"`
Expected: no matches (the homepage now imports `BentoProjectsSection`, and nothing else referenced the old components).

If grep finds a match → don't delete; fix the call site first.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/ProjectsSection.astro src/components/ProjectCard.astro
```

- [ ] **Step 3: Re-run check + build**

Run: `npm run check`
Expected: exits 0.

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git commit -m "Remove ProjectsSection + ProjectCard (replaced by BentoProjectsSection)"
```

---

## Task 10: Final verification + push

- [ ] **Step 1: Full check + build**

Run: `npm run check`
Expected: exits 0.

Run: `npm run build`
Expected: exits 0; `dist/` contains `index.html`, `projects/yolo-dualdev/index.html`, `projects/strato-pi/index.html`.

- [ ] **Step 2: Manual browser pass on the production build**

Run: `npm run preview`
Open: `http://localhost:4321/`
Verify: same checks as Task 8 (resting render, open/close, esc/backdrop, resize, reduced-motion). The production build should match the dev build.

- [ ] **Step 3: Push the branch**

```bash
git push origin editorial-redesign
```

Per the project's workflow ([CLAUDE.md](../../../CLAUDE.md)), this is a feature branch → expect the `chatgpt-codex-connector` bot to auto-review on PR open. Open the PR via `gh pr create` or in the GitHub UI when ready.

---

## Acceptance check (matches the spec)

Before marking the plan done, confirm each item:

- [ ] Bento renders on `/` in place of the old `ProjectsSection`, breaking out past the 880px column.
- [ ] All projects from the collection render with the correct `bentoSpan` and `coverVariant`.
- [ ] Click / Enter / Space on a card opens the modal with rendered markdown body.
- [ ] Esc and backdrop click both close cleanly. No visible focus outline, white border, or cream artifact at any lifecycle point.
- [ ] Resize while modal is open snaps the card to the new viewport target. Close returns to the new grid slot.
- [ ] `prefers-reduced-motion: reduce` disables card-enter.
- [ ] `npm run check` passes.
- [ ] `npm run build` produces no errors.
- [ ] No console errors in browser at rest, on open, on close, or on resize.
- [ ] `/projects/[slug]/` routes still resolve and render markdown bodies.
