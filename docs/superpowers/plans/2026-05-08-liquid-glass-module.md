# Liquid Glass Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the liquid-glass refraction effect from `src/components/Nav.astro` into a reusable runtime module any element can opt into via `class="liquid-glass"`, with an opt-in dev tuner enabled by `data-lg-tuner`.

**Architecture:** Three new files: `src/scripts/liquid-glass.ts` (runtime — physics + auto-discovery + per-instance filters), `src/styles/liquid-glass.css` (`.liquid-glass` fallback styling + `:root` defaults), and `src/scripts/liquid-glass-tuner.ts` (dynamically-imported dev panel). The runtime and stylesheet are wired into `BaseLayout.astro`. `Nav.astro` is stripped of physics/SVG-defs/IIFE but keeps its existing tuner panel; the tuner is rewired to write CSS vars to `pill.style` and call `window.__lg.refresh(pill)`.

**Tech Stack:** Astro 5 (static site), TypeScript, vanilla DOM/SVG/Canvas APIs (no framework runtime). No automated test suite — verification is via `npm run dev` plus manual browser checks against the pre-migration baseline.

**Spec:** `docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md`

---

## Verification approach

This project has no test runner. Each task includes manual browser verification steps. The plan assumes a baseline visual check: before starting Task 5 (which is the first user-visible change), the engineer takes a screenshot of the nav pill at light/dark themes and desktop/mobile widths. After Task 5 the pill should look pixel-identical to that baseline. After all tasks, a final pass repeats the comparison.

A short shared session-state checklist (run at the **start of every task** that runs the dev server):

```bash
# From repo root
git status                          # Confirm clean working tree before starting a task
npm install                         # Idempotent; ensures deps are present
npm run dev                         # Starts astro dev on http://localhost:4321
```

When stopping the dev server between tasks: `Ctrl-C` in the dev-server terminal.

---

### Task 1: Create the liquid-glass stylesheet

**Files:**
- Create: `src/styles/liquid-glass.css`

This is a no-op visually (the class isn't on any element yet), so we just verify the file exists and the dev build doesn't error.

- [ ] **Step 1: Create `src/styles/liquid-glass.css` with the contents below**

```css
/* Liquid-glass module — extracted from src/components/Nav.astro.
   Spec: docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md
   Technique: kube.io/blog/liquid-glass-css-svg + Atlas Pup pattern. */

:root {
  --lg-thickness: 80;
  --lg-bezel: 20;
  --lg-ior: 1.5;
  --lg-uniform-shift: -4.5;
  --lg-blur: 4;
  --lg-saturate: 100;
  --lg-svg-saturate: 4;
  --lg-spec-alpha: 0.4;
}

/* Always-on fallback identical to .glass. Shown on Safari/Firefox without
   SVG-backdrop support, below 641px (without data-lg-mobile), and during the
   brief window between HTML parse and module init. The runtime overrides this
   via inline backdrop-filter on each upgraded element. */
.liquid-glass {
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
}

/* Hidden defs container the runtime appends per-instance <filter> chains to. */
.liquid-glass-defs {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: hidden;
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls src/styles/liquid-glass.css`
Expected: prints the path with no error.

- [ ] **Step 3: Commit**

```bash
git add src/styles/liquid-glass.css
git commit -m "Add liquid-glass stylesheet with :root defaults and .glass-equivalent fallback"
```

---

### Task 2: Wire the stylesheet into BaseLayout

**Files:**
- Modify: `src/layouts/BaseLayout.astro:6` (add an import after the existing `global.css` line)

- [ ] **Step 1: Edit `src/layouts/BaseLayout.astro`**

Find the line:
```astro
import '../styles/global.css';
```

Add immediately after it:
```astro
import '../styles/liquid-glass.css';
```

- [ ] **Step 2: Run dev server, verify no build errors**

Run: `npm run dev`
Expected: dev server starts without "Cannot find module" or CSS-parse errors. Visit `http://localhost:4321/`. Page renders. (Pill still uses the old IIFE — visually unchanged.)

- [ ] **Step 3: Open devtools, verify the new stylesheet loaded**

In Chrome devtools → Sources tab → `localhost:4321/` → `src/styles/liquid-glass.css` should be listed.
In the Elements tab, inspect `<head>` and confirm a `<style>` block (or link) corresponding to liquid-glass.css is present.

- [ ] **Step 4: Stop the dev server, then commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "Wire liquid-glass.css into BaseLayout"
```

---

### Task 3: Create the runtime module skeleton

**Files:**
- Create: `src/scripts/liquid-glass.ts`

The skeleton publishes `window.__lg` synchronously at script-eval time, sets up the defs SVG, and stubs the discovery flow. No physics yet — the next task adds them.

- [ ] **Step 1: Create the `src/scripts/` directory and the file**

Run:
```bash
mkdir -p src/scripts
```

- [ ] **Step 2: Write `src/scripts/liquid-glass.ts` with the contents below**

```ts
/**
 * Liquid-glass runtime.
 *
 * Spec: docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md
 *
 * Auto-discovers `.liquid-glass` elements at DOMContentLoaded, builds a
 * per-instance SVG filter for each, and applies the inline backdrop-filter.
 *
 * Originally ported from
 * github.com/The-Magicians-Code/prototypes/liquid-glass-pill (pill.js).
 */

declare global {
  interface Window {
    __lg?: {
      refresh: (el: Element) => void;
    };
  }
}

const DESKTOP_MQ = '(min-width: 641px)';

let defsContainer: SVGSVGElement | null = null;

function ensureDefsContainer(): SVGSVGElement {
  if (defsContainer && defsContainer.isConnected) return defsContainer;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'liquid-glass-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('color-interpolation-filters', 'sRGB');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  defsContainer = svg;
  return svg;
}

function initElement(_el: Element): void {
  // Filled in by Task 5.
}

function refresh(el: Element): void {
  initElement(el);
}

function discoverAndInit(): void {
  ensureDefsContainer();
  const elements = document.querySelectorAll<HTMLElement>('.liquid-glass');
  elements.forEach(initElement);
}

window.__lg = { refresh };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', discoverAndInit);
} else {
  discoverAndInit();
}

export {};
```

- [ ] **Step 3: Type-check the file**

Run: `npx astro check`
Expected: no errors. (If `astro check` reports the file isn't covered, ignore — Astro picks up `src/**/*.ts` automatically.)

- [ ] **Step 4: Commit**

```bash
git add src/scripts/liquid-glass.ts
git commit -m "Add liquid-glass runtime skeleton with defs container and stub init"
```

---

### Task 4: Wire the runtime into BaseLayout

**Files:**
- Modify: `src/layouts/BaseLayout.astro` (add a `<script>` tag)

- [ ] **Step 1: Open `src/layouts/BaseLayout.astro` and locate `</head>`**

`</head>` is around line 91. The two existing `<script is:inline>` blocks (lines 75 and 78) are FOUC-prevention scripts and must remain `is:inline` and run early. The new liquid-glass import is the opposite: an Astro-bundled module that should defer, so we use a plain `<script>` (no `is:inline`).

- [ ] **Step 2: Add the script import just before `</head>`**

Insert this block immediately above the `</head>` line:

```astro
<script>
  import '../scripts/liquid-glass';
</script>
```

Astro's bundler will hoist this, dedupe across pages, and emit it as a deferred module script.

- [ ] **Step 3: Run dev server**

Run: `npm run dev`
Expected: no console errors. Open http://localhost:4321 and check devtools console for `Uncaught` errors. There should be none. The pill visually unchanged (the old IIFE in Nav.astro is still doing the work; the new module finds zero `.liquid-glass` elements and does nothing).

- [ ] **Step 4: Verify the defs SVG was injected**

In devtools Elements tab, search the `<body>` for `class="liquid-glass-defs"`. The new runtime appends one. The original static `<svg class="liquid-glass-defs">` from Nav.astro is still in the DOM too — that's expected, both coexist for now.

- [ ] **Step 5: Verify `window.__lg` is published**

In devtools console, type: `window.__lg`
Expected: `{refresh: ƒ}` (or similar object with a `refresh` function).

- [ ] **Step 6: Stop dev server, commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "Load liquid-glass runtime from BaseLayout"
```

---

### Task 5: Port physics + per-element init into the runtime

**Files:**
- Modify: `src/scripts/liquid-glass.ts`

This task is the bulk of the runtime. It:
1. Ports the five physics functions from Nav.astro (lines 71-212).
2. Implements `initElement(el)` to read CSS vars, geometry, build the filter chain with random hex IDs, rasterize maps, and set inline backdrop-filter.
3. Adds the per-element ResizeObserver + media-query gate.

The pill is still served by the old IIFE at the end of this task. The next task migrates it.

- [ ] **Step 1: Replace the entire contents of `src/scripts/liquid-glass.ts` with the version below**

```ts
/**
 * Liquid-glass runtime.
 *
 * Spec: docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md
 *
 * Auto-discovers `.liquid-glass` elements at DOMContentLoaded, builds a
 * per-instance SVG filter for each, and applies the inline backdrop-filter.
 *
 * Originally ported from
 * github.com/The-Magicians-Code/prototypes/liquid-glass-pill (pill.js).
 */

declare global {
  interface Window {
    __lg?: {
      refresh: (el: Element) => void;
    };
  }
}

const DESKTOP_MQ = '(min-width: 641px)';
const SAMPLES = 128;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

interface Instance {
  filterId: string;
  filterEl: SVGFilterElement;
  dispImageEl: SVGFEImageElement;
  dispMapEl: SVGFEDisplacementMapElement;
  satMatrixEl: SVGFEColorMatrixElement;
  specImageEl: SVGFEImageElement;
  specAlphaEl: SVGFEFuncAElement;
  observer: ResizeObserver;
  resizeTimer: number | null;
}

const instances = new WeakMap<Element, Instance>();
let defsContainer: SVGSVGElement | null = null;

// ---------- Physics (verbatim from Nav.astro lines 71-212) ----------

function heightAt(t: number): number {
  return Math.pow(1 - Math.pow(1 - t, 4), 0.25);
}

function refractRay(nx: number, ny: number, ior: number): [number, number] | null {
  const eta = 1 / ior;
  const dot = ny;
  const k = 1 - eta * eta * (1 - dot * dot);
  if (k < 0) return null;
  const sq = Math.sqrt(k);
  return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
}

function buildRefractionProfile(thickness: number, bezelWidth: number, ior: number, samples = SAMPLES): Float64Array {
  const profile = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const y = heightAt(t);
    const dt = t < 1 ? 0.0001 : -0.0001;
    const y2 = heightAt(t + dt);
    const deriv = (y2 - y) / dt;
    const mag = Math.sqrt(deriv * deriv + 1);
    const nx = -deriv / mag;
    const ny = -1 / mag;
    const ref = refractRay(nx, ny, ior);
    if (!ref) { profile[i] = 0; continue; }
    profile[i] = ref[0] * ((y * bezelWidth + thickness) / ref[1]);
  }
  return profile;
}

function generateDisplacementMap(
  w: number, h: number, radius: number, bezelWidth: number,
  profile: Float64Array, maxDisp: number, uniformShiftPx: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) * (r + 1);
  const rBSq = Math.max(r - bezelWidth, 0) * Math.max(r - bezelWidth, 0);
  const wB = w - r * 2;
  const hB = h - r * 2;
  const samples = profile.length;
  const uniformR = -((uniformShiftPx || 0) / maxDisp) * 255;

  // Phase 1 — uniform slab fill inside pill, neutral outside
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const x = cx < r ? cx - r : (cx >= w - r ? cx - r - wB : 0);
      const y = cy < r ? cy - r : (cy >= h - r ? cy - r - hB : 0);
      const dSq = x * x + y * y;
      const idx = (py * w + px) * 4;
      const insidePill = dSq <= rSq;
      data[idx] = 128 + (insidePill ? Math.round(uniformR) : 0);
      data[idx + 1] = 128;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  // Phase 2 — bezel rim curl combined with the uniform shift
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const x = cx < r ? cx - r : (cx >= w - r ? cx - r - wB : 0);
      const y = cy < r ? cy - r : (cy >= h - r ? cy - r - hB : 0);
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      if (dist === 0) continue;
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0) continue;
      const t = Math.max(0, Math.min(1, fromSide / bezelWidth));
      const sampleIdx = Math.min((t * samples) | 0, samples - 1);
      const disp = profile[sampleIdx] || 0;
      const dirX = x / dist;
      const dirY = y / dist;
      const dX = (-dirX * disp) / maxDisp;
      const dY = (-dirY * disp) / maxDisp;
      const baseR = 128 + uniformR * (dSq <= rSq ? 1 : op);
      const idx = (py * w + px) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(baseR + dX * 127 * op)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + dY * 127 * op)));
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function generateSpecularMap(w: number, h: number, radius: number, bezelWidth: number, angle: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  data.fill(0);

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) * (r + 1);
  const rBSq = Math.max(r - bezelWidth, 0) * Math.max(r - bezelWidth, 0);
  const wB = w - r * 2;
  const hB = h - r * 2;
  const lightX = Math.cos(angle);
  const lightY = Math.sin(angle);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const x = cx < r ? cx - r : (cx >= w - r ? cx - r - wB : 0);
      const y = cy < r ? cy - r : (cy >= h - r ? cy - r - hB : 0);
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      if (dist === 0) continue;
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0) continue;
      const dirX = x / dist;
      const dirY = -y / dist;
      const dot = Math.abs(dirX * lightX + dirY * lightY);
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) * (1 - fromSide)));
      const coeff = dot * edge;
      const col = (255 * coeff) | 0;
      const alpha = (255 * coeff * coeff * op) | 0;
      const idx = (py * w + px) * 4;
      data[idx] = col;
      data[idx + 1] = col;
      data[idx + 2] = col;
      data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

// ---------- DOM helpers ----------

function ensureDefsContainer(): SVGElement {
  if (defsContainer && defsContainer.isConnected) {
    return defsContainer.querySelector('defs')!;
  }
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'liquid-glass-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('color-interpolation-filters', 'sRGB');
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  defsContainer = svg;
  return defs;
}

function randomFilterId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return 'lg-filter-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readCssNumber(el: Element, prop: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(prop).trim();
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

function buildFilterChain(): { filter: SVGFilterElement; refs: Pick<Instance, 'dispImageEl' | 'dispMapEl' | 'satMatrixEl' | 'specImageEl' | 'specAlphaEl'> } {
  const filter = document.createElementNS(SVG_NS, 'filter') as SVGFilterElement;
  filter.setAttribute('x', '0%');
  filter.setAttribute('y', '0%');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', '1.5');
  blur.setAttribute('result', 'blurred_source');
  filter.appendChild(blur);

  const dispImage = document.createElementNS(SVG_NS, 'feImage') as SVGFEImageElement;
  dispImage.setAttribute('result', 'disp_map');
  filter.appendChild(dispImage);

  const dispMap = document.createElementNS(SVG_NS, 'feDisplacementMap') as SVGFEDisplacementMapElement;
  dispMap.setAttribute('in', 'blurred_source');
  dispMap.setAttribute('in2', 'disp_map');
  dispMap.setAttribute('scale', '0');
  dispMap.setAttribute('xChannelSelector', 'R');
  dispMap.setAttribute('yChannelSelector', 'G');
  dispMap.setAttribute('result', 'displaced');
  filter.appendChild(dispMap);

  const satMatrix = document.createElementNS(SVG_NS, 'feColorMatrix') as SVGFEColorMatrixElement;
  satMatrix.setAttribute('in', 'displaced');
  satMatrix.setAttribute('type', 'saturate');
  satMatrix.setAttribute('values', '4');
  satMatrix.setAttribute('result', 'displaced_sat');
  filter.appendChild(satMatrix);

  const specImage = document.createElementNS(SVG_NS, 'feImage') as SVGFEImageElement;
  specImage.setAttribute('result', 'spec_layer');
  filter.appendChild(specImage);

  const specComposite = document.createElementNS(SVG_NS, 'feComposite');
  specComposite.setAttribute('in', 'displaced_sat');
  specComposite.setAttribute('in2', 'spec_layer');
  specComposite.setAttribute('operator', 'in');
  specComposite.setAttribute('result', 'spec_masked');
  filter.appendChild(specComposite);

  const componentTransfer = document.createElementNS(SVG_NS, 'feComponentTransfer');
  componentTransfer.setAttribute('in', 'spec_layer');
  componentTransfer.setAttribute('result', 'spec_faded');
  const specAlpha = document.createElementNS(SVG_NS, 'feFuncA') as SVGFEFuncAElement;
  specAlpha.setAttribute('type', 'linear');
  specAlpha.setAttribute('slope', '0.4');
  componentTransfer.appendChild(specAlpha);
  filter.appendChild(componentTransfer);

  const blendSat = document.createElementNS(SVG_NS, 'feBlend');
  blendSat.setAttribute('in', 'spec_masked');
  blendSat.setAttribute('in2', 'displaced');
  blendSat.setAttribute('mode', 'normal');
  blendSat.setAttribute('result', 'with_sat');
  filter.appendChild(blendSat);

  const blendFinal = document.createElementNS(SVG_NS, 'feBlend');
  blendFinal.setAttribute('in', 'spec_faded');
  blendFinal.setAttribute('in2', 'with_sat');
  blendFinal.setAttribute('mode', 'normal');
  filter.appendChild(blendFinal);

  return {
    filter,
    refs: {
      dispImageEl: dispImage,
      dispMapEl: dispMap,
      satMatrixEl: satMatrix,
      specImageEl: specImage,
      specAlphaEl: specAlpha,
    },
  };
}

// ---------- Per-element init ----------

function initElement(el: Element): void {
  const htmlEl = el as HTMLElement;
  const isMobile = !window.matchMedia(DESKTOP_MQ).matches;
  const optInMobile = htmlEl.hasAttribute('data-lg-mobile');

  if (isMobile && !optInMobile) {
    return;
  }

  const rect = htmlEl.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w <= 0 || h <= 0) return;

  const radius = Math.min(parseFloat(getComputedStyle(htmlEl).borderRadius) || h / 2, h / 2);

  const thickness = readCssNumber(htmlEl, '--lg-thickness', 80);
  const bezelWidth = readCssNumber(htmlEl, '--lg-bezel', 20);
  const ior = readCssNumber(htmlEl, '--lg-ior', 1.5);
  const uniformShift = readCssNumber(htmlEl, '--lg-uniform-shift', 0);
  const blur = readCssNumber(htmlEl, '--lg-blur', 4);
  const saturate = readCssNumber(htmlEl, '--lg-saturate', 100);
  const svgSaturate = readCssNumber(htmlEl, '--lg-svg-saturate', 4);
  const specAlpha = readCssNumber(htmlEl, '--lg-spec-alpha', 0.4);

  const clampedBezel = Math.min(bezelWidth, radius - 1, Math.min(w, h) / 2 - 1);

  try {
    const profile = buildRefractionProfile(thickness, clampedBezel, ior, SAMPLES);
    const maxRimDisp = Math.max.apply(null, Array.from(profile).map(Math.abs)) || 1;
    const maxDisp = (maxRimDisp + 2 * Math.abs(uniformShift)) || 1;

    const dispUrl = generateDisplacementMap(w, h, radius, clampedBezel, profile, maxDisp, uniformShift);
    const specBezel = clampedBezel * 2.5;
    const specUrl = generateSpecularMap(w, h, radius, specBezel, Math.PI / 2);

    const defs = ensureDefsContainer();

    let inst = instances.get(htmlEl);
    if (!inst) {
      const filterId = randomFilterId();
      const { filter, refs } = buildFilterChain();
      filter.setAttribute('id', filterId);
      defs.appendChild(filter);

      const observer = new ResizeObserver(() => {
        if (inst!.resizeTimer !== null) clearTimeout(inst!.resizeTimer);
        inst!.resizeTimer = window.setTimeout(() => initElement(htmlEl), 100);
      });
      observer.observe(htmlEl);

      inst = {
        filterId,
        filterEl: filter,
        ...refs,
        observer,
        resizeTimer: null,
      };
      instances.set(htmlEl, inst);
    }

    inst.dispImageEl.setAttribute('href', dispUrl);
    inst.dispImageEl.setAttributeNS(XLINK_NS, 'href', dispUrl);
    inst.dispImageEl.setAttribute('width', String(w));
    inst.dispImageEl.setAttribute('height', String(h));

    inst.dispMapEl.setAttribute('scale', String(maxDisp));

    inst.satMatrixEl.setAttribute('values', String(svgSaturate));

    inst.specImageEl.setAttribute('href', specUrl);
    inst.specImageEl.setAttributeNS(XLINK_NS, 'href', specUrl);
    inst.specImageEl.setAttribute('width', String(w));
    inst.specImageEl.setAttribute('height', String(h));

    inst.specAlphaEl.setAttribute('slope', String(specAlpha));

    const filterUrl = `url(#${inst.filterId})`;
    const declaration = `blur(${blur}px) saturate(${saturate}%) ${filterUrl}`;
    htmlEl.style.backdropFilter = declaration;
    htmlEl.style.webkitBackdropFilter = declaration;
  } catch (err) {
    console.warn('liquid-glass: filter generation failed; .glass fallback remains active.', err);
  }
}

function clearElementUpgrade(el: Element): void {
  const htmlEl = el as HTMLElement;
  htmlEl.style.backdropFilter = '';
  htmlEl.style.webkitBackdropFilter = '';
}

function refresh(el: Element): void {
  initElement(el);
}

function discoverAndInit(): void {
  ensureDefsContainer();
  document.querySelectorAll<HTMLElement>('.liquid-glass').forEach(initElement);
}

// Crossing the desktop breakpoint: init skipped elements, or strip inline
// upgrades from non-data-lg-mobile elements when going down to mobile.
const desktopMQ = window.matchMedia(DESKTOP_MQ);
desktopMQ.addEventListener('change', (e) => {
  const elements = document.querySelectorAll<HTMLElement>('.liquid-glass');
  if (e.matches) {
    elements.forEach(initElement);
  } else {
    elements.forEach((el) => {
      if (!el.hasAttribute('data-lg-mobile')) clearElementUpgrade(el);
    });
  }
});

window.__lg = { refresh };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', discoverAndInit);
} else {
  discoverAndInit();
}

export {};
```

- [ ] **Step 2: Type-check the file**

Run: `npx astro check`
Expected: no errors.

- [ ] **Step 3: Run dev server, verify the existing pill still renders**

Run: `npm run dev`
Visit http://localhost:4321. Pill renders correctly (the old IIFE in Nav.astro is still doing the work; the new module finds zero `.liquid-glass` elements).

In the devtools console: `document.querySelectorAll('.liquid-glass').length`
Expected: `0` (nothing carries the class yet).

- [ ] **Step 4: Stop dev server, commit**

```bash
git add src/scripts/liquid-glass.ts
git commit -m "Port liquid-glass physics + per-instance filter generation into runtime module"
```

---

### Task 6: Migrate the nav pill onto the new module

**Files:**
- Modify: `src/components/Nav.astro`
  - Delete lines 8-48 (the static `<svg class="liquid-glass-defs">` block)
  - Delete lines 50-314 (the `<script is:inline>` IIFE block)
  - Change line 318 markup `<div id="nav-pill" class="glass">` → `<div id="nav-pill" class="liquid-glass">`
- Modify: `src/styles/global.css`
  - Inside the `@media (min-width: 641px)` block at lines 102-128, delete the two `backdrop-filter` lines (currently 116-117) that hardcode `url(#liquid-glass-distort)`
  - Delete the `:root --lg-thickness/--lg-bezel/--lg-ior/--lg-uniform-shift` declarations (currently lines 38-41) — they have moved to `liquid-glass.css`
  - Delete the `.liquid-glass-defs` rule (currently lines 86-92) — moved to `liquid-glass.css`

**This is the visual pivot.** Take a screenshot of the nav pill in light + dark themes, desktop + mobile widths BEFORE this task. The pill should look pixel-identical AFTER.

- [ ] **Step 1: Screenshot the pre-migration baseline**

Run: `npm run dev`
Visit http://localhost:4321. Take screenshots of the nav pill in:
- Light theme, desktop width (e.g. 1280px wide)
- Dark theme, desktop width
- Light theme, mobile width (≤640px)
- Dark theme, mobile width

Save to a temp folder for visual comparison after the migration. Stop the dev server.

- [ ] **Step 2: Delete the static SVG defs block from Nav.astro**

Open `src/components/Nav.astro`. Delete lines 8-48 inclusive — the entire `<svg class="liquid-glass-defs"> … </svg>` block. The frontmatter (lines 1-6) stays. The next thing in the file should be the `<script is:inline>` block.

- [ ] **Step 3: Delete the IIFE script block from Nav.astro**

Delete lines 50-314 inclusive — the entire `<script is:inline> (function() { … })() </script>` block. After this delete, the `<nav id="site-nav">` block should appear directly under the frontmatter.

- [ ] **Step 4: Update the pill class**

Find:
```astro
<div id="nav-pill" class="glass">
```

Replace with:
```astro
<div id="nav-pill" class="liquid-glass">
```

- [ ] **Step 5: Remove the old backdrop-filter hardcode from global.css**

Open `src/styles/global.css`. Find the `@media (min-width: 641px)` block starting around line 102. Inside `#nav-pill { … }`, delete these two lines:

```css
    -webkit-backdrop-filter: blur(4px) saturate(100%) url(#liquid-glass-distort);
    backdrop-filter: blur(4px) saturate(100%) url(#liquid-glass-distort);
```

The `background`, `box-shadow`, `position`, `isolation` declarations stay. The new module sets backdrop-filter inline on the pill at runtime.

- [ ] **Step 6: Remove the old :root --lg-* defaults from global.css**

In `src/styles/global.css`, find the `:root` block (around lines 23-42). Delete these four lines (and their leading blank line / comment block if present):

```css
  --lg-thickness: 80;
  --lg-bezel: 20;
  --lg-ior: 1.5;
  --lg-uniform-shift: -4.5;
```

Also delete the comment block immediately above them (lines 34-37):

```css
  /* Liquid-glass refraction tunables — read by Nav.astro's IIFE via
     getComputedStyle. Edit here, not in JS. Unitless because the IIFE
     parseFloat()s and uses them as plain numbers. Defaults from
     github.com/The-Magicians-Code/prototypes/liquid-glass-pill. */
```

Defaults now live in `liquid-glass.css` on `:root`.

- [ ] **Step 7: Remove the .liquid-glass-defs rule from global.css**

In `src/styles/global.css`, find and delete the `.liquid-glass-defs { … }` rule (around lines 86-92), including its preceding comment if present:

```css
/* SVG filter definition lives off-canvas; the filter itself is invisible. */
.liquid-glass-defs {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: hidden;
}
```

This rule now lives in `liquid-glass.css`.

- [ ] **Step 8: Run dev server, verify visual parity**

Run: `npm run dev`
Visit http://localhost:4321. Compare the nav pill against the screenshots from Step 1 across all four matrix combinations:
- Light + desktop: refraction visible at the bezel, content behind the pill warps when scrolling. Specular highlight on the top edge.
- Dark + desktop: same effect, different glass tint.
- Light + mobile (≤640px): pill drops to plain transparent with hamburger button; no backdrop-filter.
- Dark + mobile: same.

If anything looks different, do not commit. Common breakages:
- Pill is plain frosted glass on desktop with no refraction → module may not be finding the `.liquid-glass` element, or `window.__lg` isn't running. Check devtools console for warnings; check `instances.has(document.getElementById('nav-pill'))` is truthy after init.
- Pill is invisible / pure transparent on desktop → the inline backdrop-filter wasn't set. Check `document.getElementById('nav-pill').style.backdropFilter` in console; it should be a `blur(...) saturate(...) url(#lg-filter-XXXX)` string.
- Refraction is correct but specular highlight is wrong intensity → `--lg-spec-alpha` default may not be reading; check `getComputedStyle(document.getElementById('nav-pill')).getPropertyValue('--lg-spec-alpha')` returns `0.4`.

- [ ] **Step 9: Verify the dev tuner is broken (expected)**

The tuner panel still renders (its UI hasn't changed yet) but moving any slider does nothing visible — the IIFE it calls into has been deleted. Console may show errors when sliders move (it tries to access `#liquid-glass-saturate` etc which no longer exist). This is expected and fixed in Task 7.

- [ ] **Step 10: Stop dev server, commit**

```bash
git add src/components/Nav.astro src/styles/global.css
git commit -m "Migrate nav pill to liquid-glass module; strip old defs/IIFE/CSS hardcode"
```

---

### Task 7: Rewire the nav tuner to write CSS vars on the pill and call refresh

**Files:**
- Modify: `src/components/Nav.astro` (the tuner `<script is:inline>` block, currently the only script left in the file)

The tuner currently:
- Mutates `:root` CSS vars (lines ~688-691)
- Mutates `#liquid-glass-saturate` and `#liquid-glass-spec-alpha` SVG element attributes directly (lines ~636-637)
- Writes a `<style id="nav-tuner-overrides">` with `!important backdrop-filter` (lines ~650-651)
- Dispatches `navlens:reinit` to trigger the (now-deleted) IIFE re-run (lines ~592-595)

It must converge on:
- Writing **all** module CSS vars to the pill's inline style
- Calling `window.__lg?.refresh?.(pill)` instead of dispatching `navlens:reinit`
- Dropping the SVG-element-attribute mutations entirely (the module reads `--lg-svg-saturate` and `--lg-spec-alpha` from the pill's CSS vars instead)
- Removing the `!important backdrop-filter` lines from the override stylesheet (the module sets backdrop-filter inline, which already wins)

The tuner's nav-specific knobs (`glassBg`, `progBlur`) stay as-is — they don't go through the module.

- [ ] **Step 1: Open Nav.astro and locate the tuner script**

The script block starts around line 575 (`<script is:inline>`). The `(function() { ... })()` body contains the tuner logic.

- [ ] **Step 2: Update the CSS_VAR_BY_KEY mapping to include the new vars**

Find:
```js
const CSS_VAR_BY_KEY = {
  thickness: '--lg-thickness',
  bezel: '--lg-bezel',
  ior: '--lg-ior',
  uniformShift: '--lg-uniform-shift',
};
const REINIT_KEYS = new Set(Object.keys(CSS_VAR_BY_KEY));
```

Replace with:
```js
const CSS_VAR_BY_KEY = {
  thickness: '--lg-thickness',
  bezel: '--lg-bezel',
  ior: '--lg-ior',
  uniformShift: '--lg-uniform-shift',
  internalSat: '--lg-svg-saturate',
  specStrength: '--lg-spec-alpha',
  backdropBlur: '--lg-blur',
  saturate: '--lg-saturate',
};
const REINIT_KEYS = new Set(Object.keys(CSS_VAR_BY_KEY));
```

- [ ] **Step 3: Replace `scheduleReinit` to call `window.__lg.refresh(pill)`**

Find:
```js
let reinitScheduled = false;
function scheduleReinit() {
  if (reinitScheduled) return;
  reinitScheduled = true;
  requestAnimationFrame(() => {
    reinitScheduled = false;
    window.dispatchEvent(new Event('navlens:reinit'));
  });
}
```

Replace with:
```js
let reinitScheduled = false;
function scheduleReinit() {
  if (reinitScheduled) return;
  reinitScheduled = true;
  requestAnimationFrame(() => {
    reinitScheduled = false;
    const pill = document.getElementById('nav-pill');
    if (pill) window.__lg?.refresh?.(pill);
  });
}
```

- [ ] **Step 4: Remove the SVG-attribute lookups and the apply()-side mutations**

Find:
```js
const satMatrix = document.getElementById('liquid-glass-saturate');
const specAlpha = document.getElementById('liquid-glass-spec-alpha');
const progLayer = document.querySelector('.nav-progressive-blur');
```

Replace with:
```js
const progLayer = document.querySelector('.nav-progressive-blur');
```

Find inside the `apply()` function:
```js
// SVG attributes — direct
satMatrix.setAttribute('values', String(state.internalSat));
specAlpha.setAttribute('slope', String(state.specStrength));
```

Delete those three lines. The module now picks up `internalSat` and `specStrength` via the `--lg-svg-saturate` and `--lg-spec-alpha` CSS vars.

- [ ] **Step 5: Update apply()'s override stylesheet to drop the backdrop-filter lines**

Find:
```js
overrideStyle.textContent = `
  @media (min-width: 641px) {
    #nav-pill {
      background: rgba(255, 255, 255, ${state.glassBg}) !important;
      -webkit-backdrop-filter: blur(${state.backdropBlur}px) saturate(${state.saturate}%) url(#liquid-glass-distort) !important;
      backdrop-filter: blur(${state.backdropBlur}px) saturate(${state.saturate}%) url(#liquid-glass-distort) !important;
    }
    html.dark #nav-pill {
      background: rgba(23, 23, 23, ${state.glassBg}) !important;
    }
  }
`;
```

Replace with:
```js
overrideStyle.textContent = `
  @media (min-width: 641px) {
    #nav-pill {
      background: rgba(255, 255, 255, ${state.glassBg}) !important;
    }
    html.dark #nav-pill {
      background: rgba(23, 23, 23, ${state.glassBg}) !important;
    }
  }
`;
```

`backdropBlur` and `saturate` now flow through the module via their CSS vars (set in Step 6 below); they no longer need `!important` overrides.

- [ ] **Step 6: Update pushCssVars() to write to pill.style instead of root.style**

Find:
```js
function pushCssVars() {
  const root = document.documentElement;
  Object.keys(CSS_VAR_BY_KEY).forEach((key) => {
    root.style.setProperty(CSS_VAR_BY_KEY[key], String(state[key]));
  });
}
```

Replace with:
```js
function pushCssVars() {
  const pill = document.getElementById('nav-pill');
  if (!pill) return;
  Object.keys(CSS_VAR_BY_KEY).forEach((key) => {
    pill.style.setProperty(CSS_VAR_BY_KEY[key], String(state[key]));
  });
}
```

- [ ] **Step 7: Update the slider input handler to write to pill.style**

Find inside the panel.querySelectorAll('input[type="range"]') handler:
```js
if (REINIT_KEYS.has(key)) {
  document.documentElement.style.setProperty(CSS_VAR_BY_KEY[key], String(v));
  scheduleReinit();
}
```

Replace with:
```js
if (REINIT_KEYS.has(key)) {
  const pill = document.getElementById('nav-pill');
  if (pill) pill.style.setProperty(CSS_VAR_BY_KEY[key], String(v));
  scheduleReinit();
}
```

- [ ] **Step 8: Initial push of CSS vars on tuner setup**

After the `panel.querySelectorAll('input[type="range"]').forEach(...)` block but before the final `apply()` call, insert:

```js
pushCssVars();
```

This ensures the pill picks up the tuner's default state on first paint. (Without it, the pill uses `:root` defaults until the first slider drag.)

- [ ] **Step 9: Run dev server, verify the tuner**

Run: `npm run dev`
Visit http://localhost:4321 (in dev mode the tuner panel appears). For each slider, drag it and confirm the pill responds:
- **Glass Thickness**: refraction at the bezel changes intensity
- **Bezel Width**: width of the curved bezel band changes
- **IOR**: how much light bends at the rim
- **Uniform Shift**: directional drift across the whole pill
- **Color Punch (internalSat)**: refracted color saturation
- **Specular Strength (specStrength)**: highlight visibility
- **Backdrop Blur**: softness of the pre-filter blur
- **Backdrop Saturate**: pre-filter saturation
- **Glass Bg Opacity**: pill background tint
- **Progressive Blur**: top-strip blur intensity

The first 8 hit the module via CSS vars + refresh. The last 2 hit nav-specific code (override stylesheet + progLayer style mutation).

Click **Reset**: all sliders return to defaults; pill snaps back to the baseline look from Task 6.

Click **Copy values**: pasted clipboard contents include all 10 values formatted as `Key=Value` lines.

- [ ] **Step 10: Stop dev server, commit**

```bash
git add src/components/Nav.astro
git commit -m "Rewire nav tuner to write CSS vars on the pill and call window.__lg.refresh"
```

---

### Task 8: Build the module tuner (`liquid-glass-tuner.ts`)

**Files:**
- Create: `src/scripts/liquid-glass-tuner.ts`
- Modify: `src/scripts/liquid-glass.ts` (add the dynamic-import hook)

The tuner is its own module, dynamic-imported only when the runtime sees a `data-lg-tuner` attribute. It mounts a fixed-position panel to `<body>`, writes CSS vars to the target's inline style, and calls `window.__lg.refresh(target)`.

- [ ] **Step 1: Create `src/scripts/liquid-glass-tuner.ts` with the contents below**

```ts
/**
 * Liquid-glass dev tuner.
 *
 * Spec: docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md
 *
 * Dynamically imported by the runtime when at least one .liquid-glass element
 * carries the data-lg-tuner attribute. Mounts a slider panel to <body> and
 * writes CSS vars to the target element's inline style.
 */

interface SliderConfig {
  key: string;
  cssVar: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

const SLIDERS: SliderConfig[] = [
  { key: 'thickness',    cssVar: '--lg-thickness',     min: 10,    max: 200, step: 5,    fmt: (v) => v.toFixed(0) },
  { key: 'bezel',        cssVar: '--lg-bezel',         min: 2,     max: 80,  step: 1,    fmt: (v) => v.toFixed(0) },
  { key: 'ior',          cssVar: '--lg-ior',           min: 1.0,   max: 2.5, step: 0.01, fmt: (v) => v.toFixed(2) },
  { key: 'uniformShift', cssVar: '--lg-uniform-shift', min: -20,   max: 20,  step: 0.5,  fmt: (v) => v.toFixed(1) },
  { key: 'blur',         cssVar: '--lg-blur',          min: 0,     max: 30,  step: 0.5,  fmt: (v) => v.toFixed(1) },
  { key: 'saturate',     cssVar: '--lg-saturate',      min: 0,     max: 300, step: 5,    fmt: (v) => v.toFixed(0) },
  { key: 'svgSaturate',  cssVar: '--lg-svg-saturate',  min: 0,     max: 10,  step: 0.25, fmt: (v) => v.toFixed(2) },
  { key: 'specAlpha',    cssVar: '--lg-spec-alpha',    min: 0,     max: 1,   step: 0.02, fmt: (v) => v.toFixed(2) },
];

function readInitial(target: HTMLElement, cssVar: string): number {
  const raw = getComputedStyle(target).getPropertyValue(cssVar).trim();
  return parseFloat(raw);
}

function buildPanel(target: HTMLElement): HTMLElement {
  const panel = document.createElement('aside');
  panel.id = 'lg-tuner-panel';
  panel.setAttribute('aria-label', 'Liquid glass tuner');
  panel.style.cssText = [
    'position: fixed',
    'top: 12px',
    'right: 12px',
    'z-index: 9999',
    'width: 280px',
    'padding: 12px',
    'background: rgba(20, 20, 24, 0.92)',
    'color: #fafafa',
    'font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    'border-radius: 8px',
    'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4)',
    'pointer-events: auto',
  ].join(';');

  const head = document.createElement('header');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600;';
  head.textContent = 'Liquid Glass Tuner';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'background:transparent;border:0;color:#fafafa;font-size:16px;cursor:pointer;padding:0 4px;';
  closeBtn.addEventListener('click', () => panel.remove());
  head.appendChild(closeBtn);
  panel.appendChild(head);

  for (const slider of SLIDERS) {
    const initial = readInitial(target, slider.cssVar);
    const value = Number.isFinite(initial) ? initial : (slider.min + slider.max) / 2;

    const label = document.createElement('label');
    label.style.cssText = 'display:block;margin:6px 0;';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:2px;';
    const name = document.createElement('span');
    name.textContent = slider.cssVar;
    const out = document.createElement('output');
    out.textContent = slider.fmt(value);
    row.appendChild(name);
    row.appendChild(out);
    label.appendChild(row);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(slider.min);
    input.max = String(slider.max);
    input.step = String(slider.step);
    input.value = String(value);
    input.style.cssText = 'width:100%;';
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      out.textContent = slider.fmt(v);
      target.style.setProperty(slider.cssVar, String(v));
      window.__lg?.refresh?.(target);
    });
    label.appendChild(input);
    panel.appendChild(label);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;margin-top:10px;';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset';
  resetBtn.style.cssText = 'flex:1;padding:6px;background:#34343a;color:#fafafa;border:0;border-radius:4px;cursor:pointer;';
  resetBtn.addEventListener('click', () => {
    for (const slider of SLIDERS) {
      target.style.removeProperty(slider.cssVar);
    }
    window.__lg?.refresh?.(target);
    // Re-read defaults and update slider positions
    panel.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((input, i) => {
      const slider = SLIDERS[i];
      const v = readInitial(target, slider.cssVar);
      input.value = String(v);
      const out = input.parentElement?.querySelector('output');
      if (out) out.textContent = slider.fmt(v);
    });
  });
  actions.appendChild(resetBtn);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy CSS';
  copyBtn.style.cssText = 'flex:1;padding:6px;background:#34343a;color:#fafafa;border:0;border-radius:4px;cursor:pointer;';
  copyBtn.addEventListener('click', async () => {
    const lines = SLIDERS.map((s) => `  ${s.cssVar}: ${target.style.getPropertyValue(s.cssVar) || readInitial(target, s.cssVar)};`);
    const css = `:root {\n${lines.join('\n')}\n}`;
    try {
      await navigator.clipboard.writeText(css);
      copyBtn.textContent = 'Copied ✓';
      setTimeout(() => { copyBtn.textContent = 'Copy CSS'; }, 1200);
    } catch {
      console.warn('liquid-glass-tuner: clipboard write failed', css);
    }
  });
  actions.appendChild(copyBtn);

  panel.appendChild(actions);

  return panel;
}

export function mountTuner(target: HTMLElement): void {
  // Single panel per page. If one already exists, refuse and warn.
  if (document.getElementById('lg-tuner-panel')) {
    console.warn('liquid-glass-tuner: a tuner panel is already mounted; skipping.');
    return;
  }
  const panel = buildPanel(target);
  document.body.appendChild(panel);
}
```

- [ ] **Step 2: Add the dynamic-import hook to the runtime**

Open `src/scripts/liquid-glass.ts`. Find `discoverAndInit`:

```ts
function discoverAndInit(): void {
  ensureDefsContainer();
  document.querySelectorAll<HTMLElement>('.liquid-glass').forEach(initElement);
}
```

Replace with:

```ts
function discoverAndInit(): void {
  ensureDefsContainer();
  document.querySelectorAll<HTMLElement>('.liquid-glass').forEach(initElement);

  const tunerTargets = document.querySelectorAll<HTMLElement>('.liquid-glass[data-lg-tuner]');
  if (tunerTargets.length === 0) return;
  if (tunerTargets.length > 1) {
    console.warn(`liquid-glass: ${tunerTargets.length} elements have data-lg-tuner; only the first will receive a tuner panel.`);
  }
  const target = tunerTargets[0];
  import('./liquid-glass-tuner').then((mod) => mod.mountTuner(target)).catch((err) => {
    console.warn('liquid-glass: tuner failed to load', err);
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: no errors.

- [ ] **Step 4: Verify in browser via devtools (no source-tree changes)**

Run: `npm run dev`
Visit http://localhost:4321. The pill renders normally (no `data-lg-tuner` on it). The module-tuner chunk is NOT loaded — verify in devtools Network tab: filter for "tuner"; nothing. The Sources tab `localhost:4321/` does not list `liquid-glass-tuner.ts`.

In the devtools console, append a sandbox element with `data-lg-tuner`:

```js
document.body.insertAdjacentHTML('beforeend',
  '<div class="liquid-glass" data-lg-tuner ' +
  'style="position:fixed;left:30px;bottom:30px;width:280px;height:160px;border-radius:24px;display:grid;place-items:center;color:#fff;">' +
  'sandbox</div>'
);
window.__lg.refresh(document.querySelector('.liquid-glass[data-lg-tuner]'));
```

Expected:
- The sandbox div renders with refraction visible.
- A "Liquid Glass Tuner" panel appears top-right with 8 sliders.
- Dragging any slider mutates the sandbox div's appearance in real time.
- The Network tab now shows a request for the tuner chunk (a JS file, name will vary by Astro's hash).
- The pill is unaffected by the panel.

Click the panel's `×` close button → panel disappears, sandbox stays.

Reload the page. Sandbox is gone (it was console-injected). No tuner panel. No tuner chunk in Network tab. (Confirms dynamic-import is correctly gated.)

- [ ] **Step 5: Stop dev server, commit**

```bash
git add src/scripts/liquid-glass.ts src/scripts/liquid-glass-tuner.ts
git commit -m "Add liquid-glass dev tuner enabled by data-lg-tuner attribute"
```

---

### Task 9: Final visual + behavior verification

This task does not modify code. It runs through the spec's acceptance criteria end-to-end and commits any final fixes if regressions are found.

- [ ] **Step 1: Run dev server**

Run: `npm run dev`

- [ ] **Step 2: Visual parity vs. main**

Compare the nav pill against the pre-Task-6 baseline screenshots from Task 6 Step 1:
- Light + desktop: ✓ identical
- Dark + desktop: ✓ identical
- Light + mobile: ✓ identical (pill drops to plain transparent)
- Dark + mobile: ✓ identical

If any difference, investigate:
- Compare `getComputedStyle(document.getElementById('nav-pill')).backdropFilter` to what the old IIFE produced (you can stash uncommitted changes and run on main to compare, then re-pop).

- [ ] **Step 3: Tuner functional**

Tuner panel visible in dev mode. Dragging each of the 10 sliders changes the pill in real time. Reset returns to defaults. Copy values writes to clipboard.

- [ ] **Step 4: Cross-instance isolation**

In devtools console, inject two `.liquid-glass` elements with different per-instance overrides:

```js
document.body.insertAdjacentHTML('beforeend',
  '<div class="liquid-glass" style="position:fixed;left:20px;bottom:20px;width:200px;height:120px;border-radius:24px;--lg-bezel:8;">A</div>' +
  '<div class="liquid-glass" style="position:fixed;left:240px;bottom:20px;width:200px;height:120px;border-radius:24px;--lg-bezel:40;">B</div>'
);
[...document.querySelectorAll('.liquid-glass[style]')].forEach((el) => window.__lg.refresh(el));
```

Expected: A has a tight rim curl (small bezel), B has a wide rim curl (large bezel), and the pill is unaffected. Each filter has a unique `id` in the defs SVG (look in Elements tab for `<svg class="liquid-glass-defs">` → multiple `<filter id="lg-filter-XXXXXXXX">` children).

- [ ] **Step 5: Mobile gate + crossing**

Resize the browser window across the 641px breakpoint:
- Going down to ≤640px: pill returns to plain frosted (the nav-specific mobile CSS strips backdrop-filter via `!important`). The sandbox elements from Step 4 (no `data-lg-mobile`) lose their inline backdrop-filter and fall back to the `.glass`-equivalent fallback.
- Going back up to >640px: pill regains refraction. Sandbox elements regain refraction (the runtime re-inits them on the MQ change event).

- [ ] **Step 6: data-lg-mobile opt-out**

```js
const sandbox = document.createElement('div');
sandbox.className = 'liquid-glass';
sandbox.dataset.lgMobile = '';
sandbox.style.cssText = 'position:fixed;top:120px;right:20px;width:200px;height:80px;border-radius:16px;';
sandbox.textContent = 'mobile-on';
document.body.appendChild(sandbox);
window.__lg.refresh(sandbox);
```

Resize to ≤640px. The sandbox element retains refraction (because `data-lg-mobile`); other `.liquid-glass` elements do not.

- [ ] **Step 7: data-lg-tuner functional**

Repeat Task 8 Step 4 sandbox-injection: tuner panel mounts, sliders work.

- [ ] **Step 8: Two `data-lg-tuner` elements warns and picks first**

```js
document.body.insertAdjacentHTML('beforeend',
  '<div class="liquid-glass" data-lg-tuner style="position:fixed;left:20px;top:80px;width:120px;height:80px;border-radius:16px;">T1</div>' +
  '<div class="liquid-glass" data-lg-tuner style="position:fixed;left:160px;top:80px;width:120px;height:80px;border-radius:16px;">T2</div>'
);
location.reload();
```

After reload (so DOMContentLoaded fires fresh): only one tuner panel; console shows `liquid-glass: 2 elements have data-lg-tuner; only the first will receive a tuner panel.`

(Note: this step requires markup that survives reload. If the sandbox HTML doesn't persist, simulate by adding `data-lg-tuner` to two test elements in a temporary scratch page or by editing the homepage source temporarily and reverting after. Skip this step if the verification is hard to set up; the warn behavior is straightforward and unlikely to regress.)

- [ ] **Step 9: Safari/Firefox graceful fallback**

If macOS with Safari available: load http://localhost:4321 in Safari. The pill renders as plain frosted glass (Safari ignores the SVG-URL filter on backdrop-filter). No console errors. (Firefox: same expected behavior. Optional if no Firefox install.)

- [ ] **Step 10: No console warnings on a normal page load**

Hard-reload the homepage in a clean Chrome session (incognito if needed). Devtools console: no warnings or errors. The only `liquid-glass:` console messages should be the deliberate `console.warn` in `initElement`'s catch block, which fires only on physics-build failures and shouldn't fire here.

- [ ] **Step 11: No automated tests, no test commits**

This step is a no-op. The repo has no test runner; verification is manual. If any regressions surfaced in steps 2-10, fix them and commit with a descriptive message before marking the task done.

- [ ] **Step 12: Final commit (if any fixes were made in this task)**

If steps 2-10 surfaced no issues: skip this step.
If fixes were made: commit them with a clear message.

```bash
git status
git diff
# If any changes:
git add <files>
git commit -m "Fix <specific issue> found during liquid-glass module verification"
```

---

## Self-review

After writing the plan, the author ran the spec-coverage / placeholder / type-consistency self-review and confirmed:

- **Spec coverage**: every section of the spec maps to at least one task.
  - Architecture (3 files in `src/scripts/` + `src/styles/`) → Tasks 1, 3, 5, 8.
  - Public API (class + CSS vars + `data-lg-mobile` + `data-lg-tuner`) → Tasks 1 (CSS vars), 5 (read at init), 6 (pill class), 8 (data-lg-tuner), 9 Step 6 (`data-lg-mobile` verification).
  - Internals (defs container, discovery, ResizeObserver, MQ listener, random IDs) → Tasks 3, 5.
  - Module tuner → Task 8.
  - Nav.astro migration → Tasks 6, 7.
  - Acceptance criteria → Task 9 manual verification.
- **Placeholder scan**: no TBDs, TODOs, or vague "implement X" steps. Each step has the actual code or the actual command.
- **Type consistency**: `Instance.filterId/filterEl/dispImageEl/dispMapEl/satMatrixEl/specImageEl/specAlphaEl/observer/resizeTimer` and the `window.__lg.refresh` signature are stable across tasks. The tuner module's `mountTuner(target: HTMLElement)` matches the dynamic-import call in the runtime. Slider keys in the tuner `SLIDERS` array map to the same `--lg-*` vars the runtime reads.
