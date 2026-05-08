# Liquid Glass Module — Design

**Date:** 2026-05-08
**Status:** Approved (brainstorming + codex-rescue review complete; awaiting plan)

## Goal

Extract the liquid-glass refraction/specular effect currently embedded in
`src/components/Nav.astro` into a standalone module that any element on the
site can opt into via a CSS class, with no per-call ceremony and no shared-state
coupling between instances.

## Non-Goals

- Generalizing nav-specific tuner knobs (`glassBg`, `progBlur`) into the module
  tuner. Those stay in Nav.astro's existing tuner as nav scaffolding. The
  module tuner covers only the 8 module-owned CSS vars.
- Multiple module tuners visible simultaneously on the same page. Only one
  element per page may have `data-lg-tuner`; if more than one is found, the
  first wins and others are warned to console.
- Supporting elements that mount dynamically after `DOMContentLoaded`. The site
  is static Astro; revisit if a use case appears.
- Cleaning up per-element filter defs when elements leave the DOM. Bounded leak
  on a static site; revisit if churn appears.
- Observing runtime mutations to the `data-lg-mobile` attribute. The attribute
  is build-time. Runtime toggling requires an explicit `window.__lg.refresh(el)`
  call.

## Architecture

Four artifacts; no new components:

```
src/
├── scripts/
│   ├── liquid-glass.ts          ← runtime: physics, auto-discovery, per-instance setup
│   └── liquid-glass-tuner.ts    ← dev tuner UI (loaded only when data-lg-tuner is present)
├── styles/
│   └── liquid-glass.css         ← .liquid-glass fallback CSS, default tokens on :root
└── layouts/
    └── BaseLayout.astro         ← imports the runtime + stylesheet site-wide
```

The runtime and stylesheet are imported once from `BaseLayout.astro`, picked up
by Astro's standard CSS/script bundling. The tuner is dynamically imported
(`import('./liquid-glass-tuner')`) only when the runtime sees a
`data-lg-tuner` attribute, so it lands in its own chunk and adds zero bytes to
pages without one. The script becomes a deferred ES module (vs. today's
`is:inline` IIFE in Nav.astro), so first paint lands before init. The module
compensates by giving `.liquid-glass` a fallback identical to `.glass`, so the
pre-init frame shows plain frosted glass — same as Safari and Firefox see
permanently today.

## Public API

**Opt-in via class:**

```html
<!-- Minimal -->
<div class="liquid-glass">…</div>

<!-- Per-instance overrides (CSS custom properties) -->
<div class="liquid-glass" style="--lg-thickness: 60; --lg-bezel: 10;">…</div>

<!-- Force-on below 641px (opt out of the desktop gate) -->
<div class="liquid-glass" data-lg-mobile>…</div>

<!-- Open the module tuner targeting this element (dev-only) -->
<div class="liquid-glass" data-lg-tuner>…</div>

<!-- Parent override cascades to descendants -->
<section style="--lg-blur: 2;">
  <div class="liquid-glass">…</div>
  <div class="liquid-glass">…</div>
</section>
```

`.liquid-glass` is now self-contained — it includes a `.glass`-equivalent
fallback (`blur(18px) saturate(140%)`) so consumers no longer need to also add
`class="glass"`. Stacking both is harmless but redundant.

**Tunable CSS custom properties (defaults on `:root`):**

| Var                  | Default | Purpose                                                       |
|----------------------|---------|---------------------------------------------------------------|
| `--lg-thickness`     | `80`    | Bezel surface depth (Snell's-law refraction strength)         |
| `--lg-bezel`         | `20`    | Bezel ring width in px                                        |
| `--lg-ior`           | `1.5`   | Index of refraction                                           |
| `--lg-uniform-shift` | `-4.5`  | Uniform vertical shift of refracted rays                      |
| `--lg-blur`          | `4`     | Pre-filter backdrop blur (px) — applied with the SVG filter   |
| `--lg-saturate`      | `100`   | Pre-filter backdrop saturate (%) — applied with the SVG filter|
| `--lg-svg-saturate`  | `4`     | Internal `feColorMatrix saturate` value                       |
| `--lg-spec-alpha`    | `0.4`   | Specular highlight alpha (`feFuncA slope`)                    |

Defaults live on `:root` so they cascade by inheritance — set on a parent and
all `.liquid-glass` descendants pick them up. Inline element-style overrides
beat both `:root` defaults and parent inheritance.

**Imperative refresh:**

`window.__lg.refresh(el)` forces re-rasterization and re-applies all CSS-var
values to the element's per-instance filter chain. Used by both the module
tuner and Nav.astro's tuner when sliders move; not expected in ordinary
consumer code. The module guards
`window.__lg` to be defined synchronously at script-eval time so guarded calls
(`window.__lg?.refresh?.(el)`) work safely from any later script.

## Internals

### Discovery + init

On `DOMContentLoaded`, the module:

1. Creates a single hidden defs container appended to `<body>`:

   ```html
   <svg class="liquid-glass-defs" aria-hidden="true" focusable="false">
     <defs><!-- per-element <filter> chains appended here --></defs>
   </svg>
   ```

2. Queries `document.querySelectorAll('.liquid-glass')` and inits each element:
   - **Mobile gate:** if `!matchMedia('(min-width: 641px)').matches` and the
     element does not have `data-lg-mobile`, skip — the `.glass`-equivalent
     CSS fallback continues to show.
   - **Read computed config** via `getComputedStyle(el)`: thickness, bezel,
     IOR, uniform-shift, blur, saturate, svg-saturate, spec-alpha. Per-instance
     and parent-cascaded overrides apply automatically.
   - **Read geometry:** `getBoundingClientRect()` for `w`, `h`; computed
     `border-radius` clamped to `min(h/2, …)`.
   - **Build refraction profile** (existing physics, unchanged: `heightAt`,
     `refractRay`, `buildRefractionProfile`).
   - **Rasterize displacement + specular maps** (existing physics, unchanged).
   - **Append a per-element filter chain** to the defs SVG. ID is
     `lg-filter-{8-char-random-hex}` (generated via `crypto.getRandomValues`)
     — random IDs avoid collision under any future script re-execution
     scenario where a monotonic counter would reset and clash with stale defs.
     The chain mirrors today's filter, with `--lg-svg-saturate` and
     `--lg-spec-alpha` interpolated into the `feColorMatrix values` and
     `feFuncA slope` attributes respectively, and the per-element PNGs in the
     `feImage` hrefs.
   - **Apply the upgrade:** the module sets the element's inline
     `backdrop-filter` (and `-webkit-backdrop-filter`) to
     `blur(<lg-blur>px) saturate(<lg-saturate>%) url(#lg-filter-<id>)`. Inline
     style wins over the class fallback, so refraction kicks in.

3. **Per-element ResizeObserver** with debounced (100ms) re-init on size
   change.

4. **MediaQueryList listener** on `(min-width: 641px)`:
   - **Crossing into desktop:** init any `.liquid-glass` elements that were
     skipped earlier (mobile-skipped elements have no inline backdrop-filter
     and no per-instance filter chain yet).
   - **Crossing into mobile:** for every `.liquid-glass` element that does
     *not* have `data-lg-mobile`, clear its inline `backdropFilter` /
     `webkitBackdropFilter` so the class fallback (`blur(18px) saturate(140%)`)
     takes over. The per-instance filter chain in the defs SVG stays — it's
     unused but cheap, and re-init on next desktop crossing reuses or replaces
     it. (This is necessary because, unlike the nav pill's `!important` mobile
     CSS, generic `.liquid-glass` elements have no nav-specific override to
     defeat the inline style.)

### Stylesheet

```css
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

/* Always-on fallback. Identical to today's .glass primitive. Shown:
   - On Safari/Firefox without SVG-backdrop support
   - Below 641px (when not opted in via data-lg-mobile)
   - During the brief window between HTML parse and module init
   The module replaces this via inline backdrop-filter on each upgraded
   element. Inline > class, so the upgrade wins when present. */
.liquid-glass {
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
}

.liquid-glass-defs {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
  overflow: hidden;
}
```

The fallback CSS values (`18px` / `140%`) match `.glass` so opting into
`.liquid-glass` doesn't visually regress unsupported browsers. The
`--lg-blur: 4` and `--lg-saturate: 100` defaults apply only on the upgraded
inline-style path — they are intentionally *weaker* because the SVG filter
adds its own internal `feGaussianBlur` and `feColorMatrix saturate` on top.

### Module tuner

Loaded only when the runtime finds at least one `data-lg-tuner` attribute on
a `.liquid-glass` element. Dynamic-imported to keep the production bundle
clean for pages that don't use it.

**Behavior:**

- The runtime picks the **first** `[data-lg-tuner]` element it encounters.
  Subsequent ones are ignored with a single console warning.
- The chosen element receives a tuner panel mounted to `<body>`, positioned
  fixed in a corner (top-right by default; movable later if needed).
- Panel exposes 8 sliders, one per module CSS var:
  `--lg-thickness`, `--lg-bezel`, `--lg-ior`, `--lg-uniform-shift`,
  `--lg-blur`, `--lg-saturate`, `--lg-svg-saturate`, `--lg-spec-alpha`. Each
  slider's initial value is the element's current computed value (so reload
  preserves prior tuning if it's been written into source).
- On slider change: the tuner writes the value to the target element's
  `style` (e.g., `el.style.setProperty('--lg-thickness', val)`) and calls
  `window.__lg.refresh(el)`. The module re-reads computed CSS vars and
  updates both the rasterized PNGs and the per-instance filter chain.
- Reset button: clears all module-owned inline CSS vars on the target so
  `:root` defaults take over again, then refreshes.
- Close button: removes the panel; does NOT clear the inline overrides.
- Output panel below sliders: shows the current values as a block of
  `:root { --lg-thickness: …; … }` CSS, copy-paste-able into source.

**Scope discipline:** the tuner only knows about the 8 module CSS vars.
It does not handle nav-specific concerns like `glassBg` or `progBlur`, and
it does not let consumers register custom knobs. If a target element has
non-module knobs that need tuning, the consumer ships its own dev tuner
alongside (e.g., Nav.astro keeps its existing tuner — see "Nav.astro
Migration").

**Coexistence with Nav.astro's tuner:** because the nav pill keeps its own
tuner, the pill should NOT also have `data-lg-tuner` — otherwise both
panels mount and compete on the same CSS vars. This is undocumented
behavior; the Nav-side spec is "use the nav tuner for the pill, use the
module tuner for everything else."

### Why inline backdrop-filter, not `var(--lg-filter)`

Earlier draft used `backdrop-filter: blur(...) saturate(...) var(--lg-filter, none)`.
That breaks: when `--lg-filter` is unset, the value resolves to
`blur(...) saturate(...) none`, which is not a valid `backdrop-filter` value
(`none` is a top-level alternative in the grammar, not a list element). The
entire declaration drops, and there's no fallback to fall back to.

Setting backdrop-filter inline at JS init time avoids this entirely: the class
provides a complete, valid fallback; the inline upgrade is a complete, valid
overlay; nothing relies on the fallback chain inside a single declaration.

## Nav.astro Migration

**Removed (~270 lines):**

- The inline `<svg class="liquid-glass-defs">` filter-defs block — script
  generates a per-instance one.
- The full liquid-glass IIFE.
- The `#nav-pill`-specific desktop CSS that hardcoded
  `url(#liquid-glass-distort)` in `backdrop-filter`.

**Kept:**

- Pill structural CSS: background, `::before` sheen, `isolation: isolate`,
  drop shadow.
- Tuner panel UI + slider event handlers, simplified (~30 lines smaller).

**Tuner simplification:**

Today's tuner has three integration paths:
1. Writes `:root` CSS vars + dispatches `navlens:reinit`.
2. Mutates global SVG-element attributes by ID
   (`#liquid-glass-saturate`, `#liquid-glass-spec-alpha`).
3. Writes a `<style id="nav-tuner-overrides">` with `!important` rules to
   override `#nav-pill` background and backdrop-filter.

After the module ships, the tuner converges on a single integration path for
everything physics-related:

1. Write **all** CSS vars on `pill.style` (not `:root`):
   `--lg-thickness`, `--lg-bezel`, `--lg-ior`, `--lg-uniform-shift`, `--lg-blur`,
   `--lg-saturate`, `--lg-svg-saturate`, `--lg-spec-alpha`.
2. Call `window.__lg?.refresh?.(pill)` once per change. The module re-reads
   computed CSS vars and updates both the rasterized PNGs and the
   `feColorMatrix` / `feFuncA` attributes on the pill's instance-specific
   filter — no global IDs to mutate.
3. Path 3 stays for nav-only knobs that aren't module concerns: `glassBg`
   (pill background opacity) and `progBlur` (progressive-blur strip). The
   tuner's injected `<style>` block keeps those rules but no longer needs the
   `!important backdrop-filter` override (the module sets backdrop-filter
   inline, which already wins over class CSS without needing `!important`).

**Markup change:**

```html
<!-- before -->
<div id="nav-pill" class="glass">

<!-- after -->
<div id="nav-pill" class="liquid-glass">
```

(`.liquid-glass` now includes the `.glass` fallback, so `class="glass"` is
redundant. Drop it from the pill to keep the markup clean.)

The pill must NOT also carry `data-lg-tuner` — the nav has its own tuner
covering both module CSS vars and nav-specific knobs (`glassBg`, `progBlur`).
Adding the module tuner attribute would mount a competing panel that fights
the nav tuner on the same CSS vars. Tune the pill via the nav tuner; tune
other glass elements via `data-lg-tuner`.

**`global.css` cleanup:**

- The `--lg-thickness`, `--lg-bezel`, `--lg-ior`, `--lg-uniform-shift` defaults
  currently on `:root` are removed — they move to `:root` in the new
  `liquid-glass.css` (alongside the new `--lg-blur` / `--lg-saturate` /
  `--lg-svg-saturate` / `--lg-spec-alpha` defaults).
- `.glass` stays unchanged for any non-liquid consumers (currently: nothing
  else imports `.glass` directly, but the primitive is harmless to keep).
- `.liquid-glass-defs` selector moves from global.css to liquid-glass.css.
- The `#nav-pill` desktop block that includes `backdrop-filter ... url(...)`
  loses its backdrop-filter declaration; the rest (background, ::before sheen,
  shadow) stays.
- The mobile media query (`max-width: 640px`) that strips `#nav-pill`
  backdrop-filter / background / border / radius / shadow with `!important`
  stays unchanged. It continues to defeat the module's inline backdrop-filter
  on the pill below the breakpoint, which is the desired behavior.

## Acceptance Criteria

- Nav pill renders identically to current `main` after migration (visually
  unchanged on desktop and mobile, in light and dark themes).
- Adding `class="liquid-glass"` to any other element produces the refraction
  effect on desktop with no further configuration.
- Per-instance CSS-var overrides on a single element do not affect any other
  `.liquid-glass` element on the same page.
- Parent-element CSS-var overrides cascade to `.liquid-glass` descendants.
- Tuner sliders continue to mutate the pill in real time and do not affect any
  other glass elements that happen to be on the page.
- No regression in mobile rendering (effect remains gated unless
  `data-lg-mobile` is set).
- No console warnings under normal operation.
- Safari/Firefox (no SVG-backdrop) render the pill as plain frosted glass,
  identical to today's fallback.
- Adding `data-lg-tuner` to any `.liquid-glass` element opens a tuner panel
  that mutates that element's 8 module CSS vars in real time and ships zero
  bytes to pages without the attribute.
- A page with no `data-lg-tuner` attributes does not load the tuner chunk.

## Risks / Open Questions

- **Future client routing:** if Astro view transitions or a client router are
  later adopted, the module's DOMContentLoaded-only discovery and
  no-cleanup-on-unmount become incorrect. Random filter IDs prevent
  collision-on-reset, but the module would need a re-discovery pass on route
  change. Out of scope until a router exists.
- **First-paint flash:** between HTML parse and module init, all
  `.liquid-glass` elements show plain `.glass`-style fallback before the
  refraction upgrade applies. Visible only on slow devices/connections.
  Acceptable trade-off vs. the current `is:inline` IIFE approach (which has
  the same flash but slightly shorter on first load).
- **Tuner-bound refresh API surface:** the module exposes `refresh(el)` as the
  only post-init mutation hook. If the tuner ever needs to mutate something
  the module doesn't read from CSS vars (e.g., direct attribute knobs),
  that's a module-API change, not a tuner-side workaround. Acceptable; flag
  if it happens.
- **Tuner panel design quality:** the panel is utility-grade dev UI, not site
  design. Expect inline styles and minimal polish — same posture as today's
  nav tuner. If the tuner becomes user-facing later, that's a follow-up.
- **Multiple `data-lg-tuner` on one page:** silently picks the first match
  with a console warning. Not a hard error because the warning is enough
  signal during dev, and the module shouldn't crash a page over it.
