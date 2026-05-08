# Liquid Glass Module — Design

**Date:** 2026-05-08
**Status:** Approved (brainstorming complete; awaiting plan)

## Goal

Extract the liquid-glass refraction/specular effect currently embedded in
`src/components/Nav.astro` into a standalone module that any element on the
site can opt into via a CSS class, with no per-call ceremony and no shared-state
coupling between instances.

## Non-Goals

- Generalizing the Nav tuner panel into a reusable dev-tool. The tuner stays in
  Nav.astro as nav-pill-specific dev scaffolding.
- Supporting elements that mount dynamically after `DOMContentLoaded`. The site
  is static Astro; revisit if a use case appears.
- Cleaning up per-element filter defs when elements leave the DOM. Bounded leak
  on a static site; revisit if churn appears.
- Exposing the SVG filter's internal `feColorMatrix saturate` as a per-instance
  knob. The CSS-side `--lg-saturate` stays the only saturate control.

## Architecture

Three artifacts; no new components:

```
src/
├── scripts/
│   └── liquid-glass.ts          ← runtime: physics, auto-discovery, per-instance setup
├── styles/
│   └── liquid-glass.css         ← .liquid-glass class, default tokens, desktop @media gate
└── layouts/
    └── BaseLayout.astro         ← imports both site-wide
```

The runtime and stylesheet are imported once from `BaseLayout.astro`, picked up
by Astro's standard CSS/script bundling. Total line count is roughly the same
as today's IIFE in Nav.astro — this is relocation plus generalization, not a
rewrite.

## Public API

**Opt-in via class:**

```html
<!-- Minimal -->
<div class="liquid-glass glass">…</div>

<!-- Per-instance overrides (CSS custom properties) -->
<div class="liquid-glass glass" style="--lg-thickness: 60; --lg-bezel: 10;">…</div>

<!-- Force-on below 641px (opt out of mobile gate) -->
<div class="liquid-glass glass" data-lg-mobile>…</div>
```

`.glass` continues to live separately as the always-on backdrop-blur fallback.
`.liquid-glass` is the upgrade you stack on top. Browsers without SVG-backdrop
support keep the cheap `.glass` blur, matching today's behavior.

**Tunable CSS custom properties (per-element):**

| Var                  | Default | Purpose                                                       |
|----------------------|---------|---------------------------------------------------------------|
| `--lg-thickness`     | `80`    | Bezel surface depth (Snell's-law refraction strength)         |
| `--lg-bezel`         | `20`    | Bezel ring width in px                                        |
| `--lg-ior`           | `1.5`   | Index of refraction                                           |
| `--lg-uniform-shift` | `-4.5`  | Uniform vertical shift of refracted rays                      |
| `--lg-blur`          | `4`     | Pre-filter backdrop blur (px)                                 |
| `--lg-saturate`      | `100`   | Pre-filter backdrop saturate (%)                              |

Vars are read via `getComputedStyle(el)` so they cascade — set on a parent and
all `.liquid-glass` descendants inherit.

**Imperative refresh:**

`window.__lg.refresh(el)` forces re-rasterization of a specific element. Used
by the Nav tuner when sliders change values; not expected to be needed in
ordinary consumer code.

## Internals

### Discovery + init

On `DOMContentLoaded`, the module:

1. Creates a single hidden defs container appended to `<body>`:

   ```html
   <svg class="liquid-glass-defs" aria-hidden="true" focusable="false">
     <defs><!-- per-element <filter> chains appended here --></defs>
   </svg>
   ```

   No layout-level markup needed.

2. Queries `document.querySelectorAll('.liquid-glass')` and inits each element:
   - **Mobile gate:** if `!matchMedia('(min-width: 641px)').matches` and the
     element does not have `data-lg-mobile`, skip.
   - **Read computed config:** thickness, bezel, IOR, uniform-shift via
     `getComputedStyle(el)`. Per-instance overrides automatically apply.
   - **Read geometry:** `getBoundingClientRect()` for `w`, `h`; computed
     `border-radius` clamped to `min(h/2, …)`.
   - **Build refraction profile** (existing physics, unchanged from current
     IIFE: `heightAt`, `refractRay`, `buildRefractionProfile`).
   - **Rasterize displacement + specular maps** (existing physics, unchanged).
   - **Append a per-element filter chain** to the defs SVG with id
     `lg-filter-{n}` (monotonically increasing). The chain is byte-identical
     to today's `#liquid-glass-distort` modulo IDs and the per-element PNG
     hrefs.
   - **Wire the filter to the element:**
     `el.style.setProperty('--lg-filter', 'url(#lg-filter-{n})')`.

3. **Per-element ResizeObserver** with debounced (100ms) re-rasterization on
   size change.

4. **MediaQueryList listener** on `(min-width: 641px)`: when crossing into
   desktop, init any `.liquid-glass` elements that were skipped earlier.
   Crossing into mobile is a no-op (filters stay defined; CSS suppresses
   `backdrop-filter`).

### Stylesheet

```css
.liquid-glass {
  --lg-thickness: 80;
  --lg-bezel: 20;
  --lg-ior: 1.5;
  --lg-uniform-shift: -4.5;
  --lg-blur: 4;
  --lg-saturate: 100;
}

@media (min-width: 641px) {
  .liquid-glass {
    -webkit-backdrop-filter:
      blur(calc(var(--lg-blur) * 1px))
      saturate(calc(var(--lg-saturate) * 1%))
      var(--lg-filter, none);
    backdrop-filter:
      blur(calc(var(--lg-blur) * 1px))
      saturate(calc(var(--lg-saturate) * 1%))
      var(--lg-filter, none);
  }
}

.liquid-glass[data-lg-mobile] {
  /* Same backdrop-filter rule, no media gate */
}

.liquid-glass-defs {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: hidden;
}
```

`var(--lg-filter, none)` ensures graceful degradation: before the JS runs (or
on browsers that ignore the SVG-url filter), the element falls back to plain
`blur + saturate`, identical to `.glass`.

## Nav.astro Migration

**Removed (~270 lines):**

- The inline `<svg class="liquid-glass-defs">` filter-defs block
- The full liquid-glass IIFE (`heightAt`, `refractRay`, `buildRefractionProfile`,
  `generateDisplacementMap`, `generateSpecularMap`, `init`, `observePill`,
  resize/MQ wiring)
- The `#nav-pill`-specific desktop CSS that hardcoded
  `url(#liquid-glass-distort)` in `backdrop-filter`

**Kept:**

- Pill structural CSS: background, `::before` sheen, `isolation: isolate`,
  drop shadow. These are pill-identity, not module concerns.
- Tuner panel and slider event handlers (~150 lines).

**Tuner changes:**

- Slider event handlers write to **the pill element's** inline style
  (`pill.style.setProperty('--lg-thickness', val)`), not `:root` as today.
- After each change, the tuner calls `window.__lg.refresh(pill)` to force
  re-rasterization (pill ResizeObserver only fires on size change, not on
  CSS-var change, so an explicit hook is needed).

**Markup change:**

```html
<!-- before -->
<div id="nav-pill" class="glass">

<!-- after -->
<div id="nav-pill" class="glass liquid-glass">
```

**`global.css` cleanup:**

- The `--lg-thickness`, `--lg-bezel`, `--lg-ior`, `--lg-uniform-shift` defaults
  currently on `:root` move to `.liquid-glass` (in the new stylesheet). The
  `:root` declarations are removed — nothing else reads them.

## Acceptance Criteria

- Nav pill renders identically to current `main` after migration (visually
  unchanged on desktop and mobile, in light and dark themes).
- Adding `class="liquid-glass"` to any other element produces the refraction
  effect on desktop with no further configuration.
- Per-instance CSS-var overrides on a single element do not affect any other
  `.liquid-glass` element on the same page.
- Tuner sliders continue to mutate the pill in real time and do not affect any
  other glass elements that happen to be on the page.
- No regression in mobile rendering (effect remains gated unless
  `data-lg-mobile` is set).
- No console warnings under normal operation.

## Risks / Open Questions

- **Tuner integration timing:** if `window.__lg` is not yet defined when the
  tuner script binds slider listeners, the first slider move would no-op. The
  module must publish `window.__lg` synchronously at script-eval time (before
  `DOMContentLoaded`), and the tuner's `refresh` calls must guard
  `window.__lg?.refresh?.(pill)`.
- **Filter ID collisions:** `lg-filter-{n}` uses an internal counter. Safe as
  long as no consumer hardcodes that ID elsewhere; we don't expect them to,
  but it's worth flagging.
- **`getComputedStyle` cost:** called once per element on init and once per
  resize-debounce-tick. Negligible at the scale of 1–5 glass elements.
