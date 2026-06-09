# Scroll Parallax Hero Implementation Plan

> **⚠️ RETIRED (2026-06-09).** The scroll-parallax + `.reveal-up` scroll-reveal
> system this plan introduced has been **removed from the site**:
> `src/scripts/scroll-parallax.ts` is deleted and all
> `data-parallax` / `data-depth` / `.reveal-up` usage is gone (hero, sections,
> bento covers). This document is retained only as the historical "why" trail —
> do **not** follow it as active implementation guidance. A different fade is
> planned to be introduced separately.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the homepage into a full-bleed "stacked-depth" parallax hero that resolves into the existing 880px card column, with subtle reveal + drift on the sections below.

**Architecture:** One new vanilla-JS rAF module (`scroll-parallax.ts`) drives `transform: translate3d` on `[data-depth]` layers inside `[data-parallax]` stages, coalesced through a single tick. A separate `.reveal-up` class + IntersectionObserver handles scroll-reveal (the existing load-time `.section-fade-in` is left untouched). The hero is hoisted out of the `.page` flex column to go full-bleed. Module is imported page-scoped on the homepage only.

**Tech Stack:** Astro 6, Tailwind v4, TypeScript, vanilla DOM APIs (requestAnimationFrame, IntersectionObserver, matchMedia). No new dependencies.

**Verification note:** This repo has NO test suite. Per CLAUDE.md, verification per task is `npm run check` (astro check) + `npm run build`, with manual browser checks (Chromium **and** WebKit) in the final task. Never claim "tests pass".

**Spec:** [docs/superpowers/specs/2026-05-28-scroll-parallax-restructure-design.md](../specs/2026-05-28-scroll-parallax-restructure-design.md)

---

## File Structure

- **Create** `src/scripts/scroll-parallax.ts` — the parallax engine + reveal observer. Single responsibility: scroll-linked motion for the homepage.
- **Modify** `src/styles/global.css` — add `.reveal-up`, `overflow-x` guard, anchor `scroll-margin-top`.
- **Modify** `src/components/Hero.astro` — full-bleed `[data-parallax]` stage with three layer groups.
- **Modify** `src/pages/index.astro` — hoist `<Hero />` out of `<main class="page">`; import the module page-scoped.
- **Modify** `src/components/About.astro`, `BentoProjectsSection.astro`, `BentoStackSection.astro`, `Contact.astro` — wrap heading in a `data-parallax` stage + `data-depth` layer; swap reveal to `.reveal-up`.

---

## Task 1: CSS foundations

**Files:**
- Modify: `src/styles/global.css` (append a new block near the existing `.section-fade-in` block, ~line 560)

- [ ] **Step 1: Add the reveal class, overflow guard, and anchor offsets**

Append to `src/styles/global.css`:

```css
/* ===== Scroll-reveal (IO-gated; homepage parallax module adds .in) ===== */
.reveal-up {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
}
.reveal-up.in {
  opacity: 1;
  transform: none;
}

/* Full-bleed hero must not introduce horizontal scroll. The site hides
   scrollbars, which would otherwise MASK overflow instead of preventing it. */
html,
body {
  overflow-x: clip;
}

/* Fixed nav offset so smooth-scroll hash jumps don't land headings under the nav. */
:where(#about, #projects, #skills-tools, #contact) {
  scroll-margin-top: 7rem;
}

@media (prefers-reduced-motion: reduce) {
  .reveal-up {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

- [ ] **Step 2: Verify check + build**

Run: `npm run check && npm run build`
Expected: both succeed, no new diagnostics.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "Add reveal-up class, overflow-x guard, anchor scroll offsets"
```

---

## Task 2: The parallax engine module

**Files:**
- Create: `src/scripts/scroll-parallax.ts`

- [ ] **Step 1: Write the module**

Create `src/scripts/scroll-parallax.ts`:

```ts
// Scroll-linked parallax + reveal-on-scroll for the homepage.
// Public API (data attributes):
//   data-parallax        on a stage container
//   data-depth="<n>"     on a layer inside a stage (0..2; higher = more travel)
//   data-parallax-mobile on a stage to opt into (reduced) parallax below 641px
// Honors prefers-reduced-motion. Desktop-first. Vanilla rAF, one shared tick.

const RANGE = 120; // px of travel per unit depth
const MOBILE_BP = 641; // px; below this, parallax is off unless stage opts in
const MIN_DELTA = 0.5; // px; skip sub-pixel transform writes

interface Layer {
  el: HTMLElement;
  depth: number;
  lastY: number;
}
interface Stage {
  el: HTMLElement;
  layers: Layer[];
  mobile: boolean;
}

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

let stages: Stage[] = [];
let ticking = false;
let listening = false;

function parseDepth(raw: string | undefined): number {
  const n = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(n)) return 0;
  return Math.min(2, Math.max(0, n));
}

function collect(): Stage[] {
  return [...document.querySelectorAll<HTMLElement>('[data-parallax]')].map((el) => ({
    el,
    mobile: el.hasAttribute('data-parallax-mobile'),
    layers: [...el.querySelectorAll<HTMLElement>('[data-depth]')].map((layer) => ({
      el: layer,
      depth: parseDepth(layer.dataset.depth),
      lastY: Number.NaN,
    })),
  }));
}

function clearTransforms(): void {
  for (const stage of stages) {
    for (const layer of stage.layers) {
      layer.el.style.transform = '';
      layer.lastY = Number.NaN;
    }
  }
}

function update(): void {
  ticking = false;
  const vh = window.innerHeight;
  const isMobile = window.innerWidth < MOBILE_BP;
  for (const stage of stages) {
    const r = stage.el.getBoundingClientRect();
    if (r.bottom < -vh * 0.3 || r.top > vh * 1.3) continue; // off-screen
    const active = !isMobile || stage.mobile;
    const progress = active
      ? Math.max(
          -1.2,
          Math.min(1.2, (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2)),
        )
      : 0;
    for (const layer of stage.layers) {
      const y = active ? -progress * layer.depth * RANGE : 0;
      if (Math.abs(y - layer.lastY) < MIN_DELTA) continue;
      layer.lastY = y;
      layer.el.style.transform = y ? `translate3d(0, ${y}px, 0)` : '';
    }
  }
}

function requestTick(): void {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(update);
  }
}

function startListening(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  window.addEventListener('orientationchange', requestTick);
  window.addEventListener('hashchange', requestTick);
  window.addEventListener('pageshow', requestTick);
  requestTick();
}

function stopListening(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener('scroll', requestTick);
  window.removeEventListener('resize', requestTick);
  window.removeEventListener('orientationchange', requestTick);
  window.removeEventListener('hashchange', requestTick);
  window.removeEventListener('pageshow', requestTick);
  clearTransforms();
}

function applyMotionPref(): void {
  if (reduceMQ.matches) stopListening();
  else startListening();
}

function setupReveal(): void {
  const targets = [...document.querySelectorAll<HTMLElement>('.reveal-up')];
  if (reduceMQ.matches || !('IntersectionObserver' in window)) {
    for (const t of targets) t.classList.add('in');
    return;
  }
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
  for (const t of targets) io.observe(t);
}

function init(): void {
  stages = collect();
  setupReveal();
  applyMotionPref();
  reduceMQ.addEventListener('change', applyMotionPref);
  // Re-tick once fonts settle — layout shift changes stage geometry.
  document.fonts?.ready.then(requestTick);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
```

- [ ] **Step 2: Verify check + build**

Run: `npm run check && npm run build`
Expected: both succeed. (Module is not imported anywhere yet, so no runtime effect — this validates types/compile.)

- [ ] **Step 3: Commit**

```bash
git add src/scripts/scroll-parallax.ts
git commit -m "Add scroll-parallax engine module (rAF, reveal observer)"
```

---

## Task 3: Full-bleed parallax hero

**Files:**
- Modify: `src/components/Hero.astro` (full replacement of markup + styles)

- [ ] **Step 1: Replace Hero.astro**

Replace the entire contents of `src/components/Hero.astro` with:

```astro
---
---

<header class="hero" data-parallax aria-label="Intro">
  <div class="hero-layer hero-back" data-depth="0.15" aria-hidden="true">
    <span class="hero-ghost">Code</span>
  </div>
  <div class="hero-layer hero-mid" data-depth="0.5">
    <div>
      <h1 class="hero-headline">Tanel <em>Treuberg</em></h1>
      <p class="hero-sub">Software engineer working across backend, infrastructure, and applied ML.</p>
    </div>
  </div>
  <div class="hero-layer hero-front" data-depth="1.2">
    <ul class="hero-pills">
      <li class="hero-pill">Backend</li>
      <li class="hero-pill">Infrastructure</li>
      <li class="hero-pill">Applied ML</li>
    </ul>
  </div>
</header>

<style>
  /* Full-bleed: hero is a direct child of <body class="pt-28"> (hoisted out
     of .page in index.astro). Negative margin cancels the body's 7rem nav
     padding; padding-top re-inserts breathing room so content clears the nav. */
  .hero {
    position: relative;
    width: 100%;
    min-height: 100svh;
    margin-top: -7rem;
    padding-top: 7rem;
    overflow: clip;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hero-layer {
    position: absolute;
    inset: -12% 0;
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
  }
  .hero-back {
    background: radial-gradient(58% 50% at 50% 42%, var(--accent-soft), transparent 70%);
  }
  .hero-ghost {
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: clamp(10rem, 34vw, 28rem);
    line-height: 1;
    letter-spacing: -0.04em;
    color: var(--ink);
    opacity: 0.05;
    white-space: nowrap;
  }
  .hero-mid {
    flex-direction: column;
    text-align: center;
    padding: 0 24px;
  }
  .hero-headline {
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: clamp(2.6rem, 7vw, 5rem);
    line-height: 1.02;
    letter-spacing: -0.02em;
  }
  .hero-sub {
    color: var(--ink-dim);
    font-size: clamp(1rem, 1.4vw, 1.25rem);
    max-width: 480px;
    margin: 18px auto 0;
    line-height: 1.5;
  }
  .hero-front {
    align-items: flex-end;
    padding-bottom: 11vh;
  }
  .hero-pills {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* Token-only glass: NO live backdrop-filter on a moving surface
     (per spec — avoids per-frame WebKit repaint glitches). */
  .hero-pill {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--ink);
    padding: 10px 18px;
    border-radius: 999px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-brd);
    box-shadow: 0 6px 20px rgba(26, 26, 28, 0.07);
  }
  @media (max-width: 641px) {
    .hero-ghost { font-size: 38vw; }
  }
</style>
```

- [ ] **Step 2: Verify check + build**

Run: `npm run check && npm run build`
Expected: both succeed. (Hero still rendered inside `.page` until Task 4 — it will look constrained; that's expected mid-plan.)

- [ ] **Step 3: Commit**

```bash
git add src/components/Hero.astro
git commit -m "Rebuild Hero as full-bleed stacked-depth parallax stage"
```

---

## Task 4: Hoist hero + import the module (homepage-scoped)

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Move `<Hero />` out of `.page` and add the page-scoped script import**

In `src/pages/index.astro`, change the body slot so Hero is a sibling above `<main class="page">`:

```astro
  <Hero />
  <main class="page">
    <About />
    <BentoProjectsSection />
    <BentoStackSection />
    <Contact />
  </main>
```

Then add a script import at the end of the file (page-scoped — NOT in BaseLayout):

```astro
<script>
  import '../scripts/scroll-parallax.ts';
</script>
```

Leave the existing `.page` `<style>` block unchanged.

- [ ] **Step 2: Verify check + build**

Run: `npm run check && npm run build`
Expected: both succeed. The hero now spans full width above the column.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "Hoist hero full-bleed; import parallax module on homepage"
```

---

## Task 5: Below-hero sections — reveal + subtle drift

**Files:**
- Modify: `src/components/About.astro`, `src/components/BentoProjectsSection.astro`, `src/components/BentoStackSection.astro`, `src/components/Contact.astro`

Pattern (applies to all four): the section becomes a `data-parallax` stage; the heading is wrapped in a `<div data-depth="0.15">` (parallax owns that transform); the heading and body content get `.reveal-up` (reveal owns their transform — separate nodes, no collision). Remove `class="section-fade-in"` / `style="--delay…"` from these sections. **Do not** add `data-depth` or `.reveal-up` to bento cards — `bento-expand.ts` owns their entry animation.

- [ ] **Step 1: About.astro**

Replace the `<section>` in `src/components/About.astro` with:

```astro
<section id="about" data-parallax>
  <div data-depth="0.15">
    <h2 class="section-title reveal-up">A short <em>introduction</em>.</h2>
  </div>
  <p class="about-body reveal-up">
    I'm a software engineer with three years across backend, infrastructure, and applied
    ML. Most recently I refactored internal tooling at Estonia's national grid operator —
    cutting data-export time 10× and UI load from ~8s to under 2s — and shipped Python
    automation that erased ~15 hours of manual ops work per month. Before that, real-time
    computer vision on autonomous Navy patrol vessels: TensorRT FP16 inference on Jetson
    AGX Xavier, averaging a 3.5× speedup with a 27% drop in energy use. Based in Warsaw.
  </p>
</section>
```

(Leave the `<style>` block unchanged.)

- [ ] **Step 2: BentoProjectsSection.astro**

Change the `<section>` opening + heading in `src/components/BentoProjectsSection.astro` to:

```astro
<section id="projects" data-parallax>
  <div data-depth="0.15">
    <h2 class="section-title reveal-up">Projects <em>worth</em> showing.</h2>
  </div>
  <BentoGrid>
```

(Leave the `<BentoGrid>` body and `<style>` unchanged — bento cards keep their own animation.)

- [ ] **Step 3: BentoStackSection.astro**

In `src/components/BentoStackSection.astro`, change the section opening + heading and wrap the groups:

```astro
<section id="skills-tools" class="stack-section" data-parallax>
  <div data-depth="0.15">
    <h2 class="section-title reveal-up">Tools I <em>actually</em> reach for.</h2>
  </div>

  <div class="stack-groups reveal-up">
```

(Keep `class="stack-section"` — it carries existing layout styles. Leave the rest of the markup and `<style>` unchanged.)

- [ ] **Step 4: Contact.astro**

In `src/components/Contact.astro`, change the section opening + heading and add reveal to the links:

```astro
<section id="contact" data-parallax>
  <div data-depth="0.15">
    <h2 class="section-title reveal-up">If you have a thoughtful thing to put into the world,<br /><em>so do I</em>.</h2>
  </div>
  <div class="contact-links reveal-up">
```

(Leave the three `<a class="contact-link">` blocks and `<style>` unchanged.)

- [ ] **Step 5: Verify check + build**

Run: `npm run check && npm run build`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add src/components/About.astro src/components/BentoProjectsSection.astro src/components/BentoStackSection.astro src/components/Contact.astro
git commit -m "Wrap section headings as parallax layers; swap to reveal-up"
```

---

## Task 6: Manual verification (Chromium + WebKit)

**Files:** none (verification only)

- [ ] **Step 1: Final check + build**

Run: `npm run check && npm run build`
Expected: both succeed with no diagnostics.

- [ ] **Step 2: Run the dev server and verify in-browser**

Run: `npm run dev` (serves http://localhost:4321/)

Verify on **Chromium** and **WebKit (Safari)** — parity is a hard requirement:

1. Hero sits at its resting pose at the top (`scrollY=0`); scrolling separates the three groups (back word/glow slowest, name mid, pills fastest).
2. **No horizontal scrollbar / overflow** at any width (resize narrow → wide).
3. Sections below reveal once on entry; headings drift subtly; bento cards keep their own entry animation; card interiors don't move.
4. Nav anchor links (`#about`, `#projects`, `#skills-tools`, `#contact`) land headings **below** the fixed nav.
5. Glass pills show no repaint glitch in WebKit.
6. DevTools → emulate `prefers-reduced-motion: reduce` → all parallax stops, layers at rest, content fully visible.
7. Mobile width (<641px): page reads cleanly, no parallax travel, no stranded offsets.
8. Visit `/` then a project detail page and the resume page — confirm they are unaffected (module is homepage-scoped).

- [ ] **Step 3: Document verification result**

State explicitly what was verified and on which engines. Do NOT claim "tests pass" — verification is build + manual browser only.

---

## Self-Review (completed during plan authoring)

- **Spec coverage:** hero stacked-depth (Task 3), full-bleed breakout (Tasks 1, 3, 4), homepage-scoped module (Task 4), transform-ownership via nesting (Task 5), reveal-up not repurposing section-fade-in (Tasks 1, 2, 5), token-only glass pills (Task 3), reduced-motion + mobile reset (Task 2), anchor offsets (Task 1), lifecycle re-ticks + depth clamp + delta-skip (Task 2), verification both engines (Task 6). All spec sections mapped.
- **Placeholder scan:** none — every code step shows complete content.
- **Type/name consistency:** `parseDepth`, `collect`, `clearTransforms`, `update`, `requestTick`, `startListening`/`stopListening`, `applyMotionPref`, `setupReveal`, `init` defined once and referenced consistently; data attributes (`data-parallax`, `data-depth`, `data-parallax-mobile`) match between module and markup tasks; `.reveal-up`/`.in` consistent between CSS (Task 1) and markup (Task 5).
