---
name: The Magicians' Code
description: A solo developer's portfolio framed as a cabinet of working curiosities, lit by studio light with ink on paper and ember at the edges.
colors:
  bg: "#f6f3ed"
  paper: "#faf8f3"
  ink: "#1a1a1c"
  ink-dim: "#4d4d52"
  ink-3: "#8e8a82"
  rule: "rgba(26, 26, 28, 0.12)"
  accent: "oklch(64% 0.18 28)"
  accent-soft: "oklch(64% 0.18 28 / 0.14)"
  bg-dark: "#0a0a0d"
  paper-dark: "#14141a"
  ink-dark: "#f0f0f5"
  ink-dim-dark: "#a8a8b3"
  ink-3-dark: "#5c5c68"
  rule-dark: "rgba(255, 255, 255, 0.10)"
  accent-dark: "oklch(72% 0.16 28)"
  glass-bg-light: "rgba(255, 252, 246, 0.45)"
  glass-bg-dark: "rgba(255, 255, 255, 0.04)"
typography:
  display:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.5rem, 6vw, 4.75rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  body-emphasis:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
  eyebrow:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.16em"
  mono:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  pill: "9999px"
  card: "14px"
  bento: "20px"
  panel-md: "16px"
  chip: "999px"
spacing:
  "2xs": "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  card: "28px"
  bento: "24px"
  lg: "32px"
  xl: "48px"
  "2xl": "64px"
components:
  bento:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.bento}"
    padding: "{spacing.bento}"
  bento-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  glass:
    backgroundColor: "{colors.glass-bg-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  pill-stack:
    backgroundColor: "{colors.glass-bg-light}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.chip}"
    padding: "6px 12px"
  link-accent:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
  morph-nav:
    backgroundColor: "rgba(250, 248, 243, 0.82)"
    textColor: "{colors.ink}"
    rounded: "21.5px"
    padding: "0 16px"
    height: "43px"
  section-eyebrow:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    typography: "{typography.eyebrow}"
---

# Design System: The Magicians' Code

## 1. Overview

**Creative North Star: "The Cabinet of Working Curiosities"**

The site is a maker's cabinet: an organized exhibition of working artifacts, each one runnable, each one paid for in real engineering. The cabinet is lit by studio light, the type is ink on paper, the accent is the colour of a small ember at the edge of a workbench. Projects are displayed objects. The resume is the curator's notecard. The contact link is the door out. The nav is a morphing pill that tracks where you are in the cabinet: it opens as a spark, settles into a scrollspy bar naming the current section, and expands into the full index on demand.

The system commits to a warm-paper light surface (with a fully developed dark-mode counterpart), a deep ink ramp for type and structure, and a single ember-warm terracotta accent used sparingly. Typography pairs Fraunces (a contemporary expressive serif) for headlines and `em` emphasis with Geist for body and Geist Mono for technical labels — a three-family system where the families are deliberately on different contrast axes (humanist serif vs. neo-grotesque sans vs. mono) rather than three sans-serifs that fight. Surfaces work in two registers: solid paper (`.bento`) for confident displayed objects, and translucent glass (`.glass`, `.card`, `.pill`) for layered overlays that hint at what's behind them.

The signature is **MorphNav** ([`MorphNav.astro`](src/components/MorphNav.astro)): a fixed, centered pill that morphs between shells driven by classes on its root — a compact 43px bar whose title reel reads out the active section as a scrollspy (`.is-compact`), and an expanded menu of links plus the theme toggle (`.is-open`). (A third `.is-intro` spark shell exists in the component but is disabled in production: `BaseLayout` passes `intro={false}`, so the nav mounts directly in the compact state.) A concentric scroll-progress ring sits on its right cap. It's a frosted translucent-paper panel (`backdrop-filter: blur(14px)`, `background: rgba(250, 248, 243, 0.82)`) floating on a soft drop shadow, with an `aria-live` region announcing the active section. The earlier Liquid Glass refraction module (a custom CSS + SVG + Canvas pipeline using `feDisplacementMap` chained into `backdrop-filter`, documented in [`docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md`](docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md)) still lives in the codebase and powers prototype/demo surfaces, but it is no longer the nav. The signature is the morph and the wayfinding: an effect that works because it was engineered.

This system explicitly rejects two lanes: agency-portfolio-monochrome (pure black, oversized cursor, every interaction over-engineered, scroll-driven choreography for every section — performance as identity) and generic-dev-portfolio (Vercel-template-clone, default neo-grotesque, hero + projects-grid + about + email, identity by absence). The committed warm-paper / terracotta / Fraunces / morphing-pill-nav identity is the antibody to both; drift toward neutral is the failure mode.

**Key Characteristics:**
- Warm-paper light + ink dark with a full token swap driven by the `html.dark` class — `BaseLayout` seeds the initial class from `prefers-color-scheme` when no `localStorage` choice exists, then the theme toggle owns it. New component CSS must key off `html.dark`, not `@media (prefers-color-scheme)`, or it ignores the toggle.
- One ember-warm accent. Used sparingly on `em`, links, and hover states — never as a fill that dominates a surface.
- Three-family typography: Fraunces (serif, headlines + emphasis) + Geist (sans, body) + Geist Mono (technical labels + eyebrows). Self-hosted via `@fontsource-variable`.
- Two surface registers: solid paper (`.bento`) for displayed objects; glass (`.glass`/`.card`/`.pill`) for overlays. **A documented inconsistency lives here** — see §5.
- Motion is committed: a single ease (`cubic-bezier(0.22, 1, 0.36, 1)`), uniform 220ms hover transitions on cards, and a staggered `.section-fade-in` entrance (CSS `fadeIn` with `animation-delay`).
- MorphNav (the morphing pill: compact scrollspy bar ↔ open menu; an intro-spark shell exists but is disabled in production) is the signature. Identity-bearing, not decorative.
- A11y is engineered to the level the craft requires: focus rings on interactive elements — with one deliberate exception, the bento project cards suppress the UA outline and surface focus via the `.cs-expand` reveal instead; reduced-motion honored across the interactive components and motion scripts (Lenis, bento-expand, nav, case-study), though the `.section-fade-in` entrance fade in `global.css` is a known un-gated gap to audit; dark-mode complete via the full token swap. Not AAA-pursuing.

## 2. Colors: The Studio Palette

A working space lit warm, with ink on paper and ember at the edges. Two complete palettes (light, dark) with a coordinated swap so the brand reads consistently in both.

### Primary
- **Working Heat** (`oklch(64% 0.18 28)` light · `oklch(72% 0.16 28)` dark): the ember. Editorial italic `em`, link colour, focus rings, bento hover-border (`--accent-soft`), small accent moments. Never a fill that dominates a surface; the ember reads because it is rare.

### Neutral
- **Studio Light** (`#f6f3ed` light · `#0a0a0d` dark) — the page bg. The light value is warm-paper at a low chroma; the dark value is near-black with a whisper of warmth toward the same hue.
- **Paper** (`#faf8f3` light · `#14141a` dark) — solid `.bento` surfaces. Pulled slightly off the page bg so confident objects sit on the cabinet visibly.
- **Type Black** (`#1a1a1c` light · `#f0f0f5` dark) — body text, headlines, structure. A true near-black with the lightest cool whisper that pairs with the warm paper.
- **Type Black Dim** (`#4d4d52` light · `#a8a8b3` dark) — secondary text, nav link rest state, captions. The "supporting voice."
- **Type Black Tertiary** (`#8e8a82` light · `#5c5c68` dark) — eyebrow text, metadata, the lowest tier of editorial voice.
- **Rule** (`rgba(26, 26, 28, 0.12)` light · `rgba(255, 255, 255, 0.10)` dark) — hairlines, bento borders. Not a tinted fill; a true tonal divider against whatever sits behind it.

### Glass
- **Glass Tint** (`rgba(255, 252, 246, 0.45)` light · `rgba(255, 255, 255, 0.04)` dark) — the translucent surface used by `.glass`, `.card`, and `.pill`. Saturated 140% so colour reads vivid through the blur. (MorphNav uses its own warmer panel tint, `rgba(250, 248, 243, 0.82)`.)
- **Glass Border** (`rgba(255, 255, 255, 0.55)` light · `rgba(255, 255, 255, 0.10)` dark) — the hairline that gives the glass an edge.

### Named Rules

**The One Ember Rule.** Working Heat appears on ≤8% of any given surface. `em` is its canonical home — editorial italic emphasis carries it inline with prose, which is the closest reproduction of an actual ember in a workbench: small, warm, occasional. Filling a button or a section bg with the accent breaks the metaphor.

**The Warm Paper Rule.** Light-mode bg is `#f6f3ed`. The committed warm tint is part of the brand and is deliberately *not* the AI-default warm-cream lane — it lives here as identity, on a site whose whole purpose is to be identity-bearing. New design moves do not retreat toward `#ffffff`; new brand briefs (per [PRODUCT.md](PRODUCT.md) and the impeccable skill's brand register reference) would land differently.

**The Symmetric Dark-Mode Rule.** Every committed token has a dark-mode counterpart in the same role. New components must work in both modes from the first commit; "dark mode pass later" is a deferred bug.

## 3. Typography: The Three Voices

**Display Font:** Fraunces (with Georgia, "Times New Roman", serif fallback) — self-hosted via `@fontsource-variable/fraunces`.
**Body Font:** Geist (with system-ui, -apple-system, sans-serif fallback) — self-hosted via `@fontsource-variable/geist`.
**Technical Font:** Geist Mono (with ui-monospace, SF Mono, Menlo, monospace fallback) — self-hosted via `@fontsource-variable/geist-mono`.

**Character:** Three families on three contrast axes (humanist serif vs. neo-grotesque sans vs. monospace), pairing on difference rather than similarity. The serif carries editorial gravity for headlines and accent emphasis. The sans carries body text without ego. The mono carries technical labels and the section-eyebrow system.

**Note:** Fraunces is named in the brand-register reference's reflex-reject list (the impeccable skill's brand register — a tooling reference, not checked into this repo) — it is a training-data default in 2026. That list applies to *new design choices*; here, Fraunces is part of a committed identity (the variable file has just been added to `package.json` via `@fontsource-variable/fraunces`), and identity-preservation wins. New surfaces stay on this pairing. New unrelated brand briefs (not this project) would skip Fraunces by default.

### Hierarchy
- **Display** (Fraunces 400, `clamp(2.5rem, 6vw, 4.75rem)`, line-height 1.05, tracking -0.015em): hero headlines, primary identity moments. Use `text-wrap: balance` to keep multi-line displays even.
- **Headline** (Fraunces 400, `clamp(1.75rem, 3.5vw, 2.5rem)`, line-height 1.15, tracking -0.01em): section openers, project detail H1, resume section heads.
- **Title** (Fraunces 500, 1.25rem, line-height 1.3, tracking -0.005em): card titles, dialog headers, project card titles.
- **Body** (Geist 400, 1rem, line-height 1.55): all paragraphs. Cap line length at 65–75ch. Use `text-wrap: pretty` on long prose.
- **Body Emphasis** (Fraunces 400 italic, 1rem inheriting from body): the `em` element, *colored with Working Heat*. The most identity-bearing typography rule in the system: italic + ember + serif inside an otherwise sans paragraph creates a distinctive cross-family inflection.
- **Label** (Geist 500, 0.875rem, line-height 1.2): button labels and link labels. *Deviation: the signature `MorphNav` renders its own labels in `Inter` (an artifact of the ported component), a fourth family outside the three-voice system — flagged for reconciliation back to Geist.*
- **Section Eyebrow** (Geist Mono 400, 11px, line-height 1.2, tracking 0.16em, uppercase, Type Black Tertiary): the editorial section marker, shipping at `.section-eyebrow`. **It currently ships as unnumbered single-word labels** (`Project`, `Index` on the project routes); the intended cadence is section numbering (`01 · Hero`, a cabinet with labeled drawers), which is **not yet applied** — that's the gap to close. The brand-register ban on "tiny uppercase tracked eyebrow above every section" is held off only because the eyebrow has a committed named role; until numbering or clear section logic lands, treat the current unnumbered usage as drift toward that trope, not the finished system.
- **Mono** (Geist Mono 400, 0.75rem, line-height 1.2): tech pills, metadata, code spans.

### Named Rules

**The Three-Voice Rule.** Three families, three voices: Fraunces is the writer, Geist is the speaker, Geist Mono is the technician. They never substitute for each other. Headlines never go sans. Body never goes serif (except as `em`). Labels never go serif. The voices are kept distinct so each carries weight when it speaks.

**The Ember-Italic Rule.** `em` is rendered as Fraunces italic in Working Heat. This pairing is the system's most distinctive typographic gesture; it carries identity inline with content. Do not override it. Do not use `em` purely decoratively; use it where emphasis is real.

**The Editorial Eyebrow Rule.** The section eyebrow uses Geist Mono uppercase tracked at 0.16em in Type Black Tertiary. The committed direction is section numbering (`01 · Hero`, `02 · Projects`) to signal sequence, but the current call sites (`Project`, `Index`) ship *unnumbered* — so numbering is an unmet intent, not a shipped fact. Eyebrows that decorate blocks without numbering or sequence logic are the AI-scaffolding lane the editorial system is *defined against*; until numbering lands, the existing eyebrows sit closer to that lane than the finished system.

## 4. Elevation

Two registers, one floating signature. The cabinet is mostly flat: paper and ink, on a paper page. Where surfaces lift, they lift specifically, and the lift is part of the affordance. The one element that floats free of the page is the MorphNav pill, riding a soft, wide, diffuse drop shadow above the scrolling content.

### Surface Vocabulary
- **Hairline Borders** (`1px solid var(--rule)`): the default. Bento cards, content rows, dividers.
- **Glass Inner + Outer** (`inset 0 1px 0 rgba(255, 255, 255, 0.55); 0 16px 40px -16px rgba(26, 26, 28, 0.18)` light · `inset 0 1px 0 rgba(255, 255, 255, 0.10); 0 20px 60px -20px rgba(0, 0, 0, 0.6)` dark): the `.glass` primitive. An inner highlight at the top edge + a diffuse outer drop. Pairs with backdrop-filter.
- **Bento Lift** (`0 16px 40px -16px rgba(26, 26, 28, 0.10)` light · `0 22px 56px -20px rgba(0, 0, 0, 0.55)` dark): bento hover state. Subtle, on the same warm-shadow palette as the glass primitive.
- **Card Lift** (`0 22px 48px -16px rgba(26, 26, 28, 0.22)` light · `0 24px 60px -20px rgba(0, 0, 0, 0.7)` dark): glass `.card` hover state. Slightly stronger than bento because the glass surface is competing with what's behind it.
- **MorphNav Float** (`box-shadow: 0 18px 60px rgba(26, 26, 28, 0.12)` light · deeper in dark, on a `backdrop-filter: blur(14px)` translucent-paper panel): the signature lifted element. The nav pill floats above the page on a soft, wide, diffuse drop; nothing else in the system floats this way.
- **Liquid Glass Refraction** (module, not currently the nav): a custom SVG `feDisplacementMap` chained into `backdrop-filter` with a specular `::before` sheen, tuned by eight CSS custom properties (`--lg-thickness`, `--lg-bezel`, `--lg-ior`, `--lg-uniform-shift`, `--lg-blur`, `--lg-saturate`, `--lg-svg-saturate`, `--lg-spec-alpha`). It still exists ([spec](docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md)) and powers prototype/demo surfaces, but it no longer renders on the production nav.

### Named Rules

**The Flat-Paper Rule.** Most surfaces sit flat on the page. A bento card with a hairline border is the canonical container; cards lift only on hover, and the lift is short (220ms) and subtle (`translateY(-2px)` + a small shadow bump). Heavy ambient shadows on rest-state surfaces are forbidden — the cabinet's identity is paper, not stacked cards.

**The One Signature Rule.** MorphNav is the one signature flourish in the system. New components do not add competing signature treatments. If a surface needs to feel special, it does so through typography, colour, or restrained motion — not through a new bespoke effect.

**The Symmetric Shadow Rule.** Every shadow has a dark-mode counterpart with darker, more diffuse parameters. Light-mode shadows use warm grey (`rgba(26, 26, 28, …)`); dark-mode shadows use pure black at higher opacity. Don't ship a shadow without its dark-mode pair.

## 5. Components

The codebase commits to a small inventory of canonical surfaces and chip primitives. **A real inconsistency is documented here:** the system has two card-shaped primitives (`.card` and `.bento`) that overlap in role. The Components section both documents what exists and names the consolidation as a follow-up improvement (see Recommended Consolidation below).

### Buttons (chip-shaped, no committed Button primitive)
The system has no `<button>` primitive in the global stylesheet. Nav links, the theme toggle, and CTA-style chips are styled per-component. **This is a gap.** A canonical button vocabulary (primary / ghost) would help future surfaces (contact form, project links) avoid drift.

- **Brand Pill** (`brand-pill`): the wordmark container in the nav. Pill-shaped, transparent at rest, hover background `rgba(128,128,128,0.15)`.
- **Theme Toggle**: lives in [`src/components/ThemeToggle.astro`](src/components/ThemeToggle.astro), styles inline. Reuses the chip vocabulary.

### Surface: Bento (solid paper)
- **Shape:** `border-radius: 20px`, padding `24px`.
- **Background:** `var(--paper)` (solid, no backdrop-filter — better paint cost on grids).
- **Border:** `1px solid var(--rule)` hairline.
- **Hover:** `translateY(-2px)` + border shifts to `var(--accent-soft)` + bento-lift shadow. Transitions 220ms via `var(--ease)`.
- **Role:** confident displayed object. Use for the homepage bento grid (`BentoGrid.astro`, `BentoCard.astro`), project cards, anything that should sit as an artifact on the page.

### Surface: Glass (translucent overlay)
- **Shape:** `border-radius: 14px`, padding `28px` (from the `.card` primitive — see drift note below).
- **Background:** `var(--glass-bg)` (`rgba(255, 252, 246, 0.45)` light / `rgba(255, 255, 255, 0.04)` dark) with `backdrop-filter: blur(20px) saturate(140%)`.
- **Border:** `1px solid var(--glass-brd)`.
- **Shadow:** inner highlight + outer diffuse (from `var(--glass-inner)` and `var(--glass-shadow)`).
- **Role:** translucent panels that float over content (mobile side-wrap, pills, and other overlays).

### Drift: `.card` vs. `.bento`
The two card-shaped primitives are doing similar work. `.bento` is solid paper, hairline-bordered, performant on grids, and is the homepage's canonical displayed-object container. `.card` is the older `.glass + 14px radius + 28px padding` combo with a hover lift, but its glass background is heavier (forces backdrop-filter compositing) and it competes with `.bento` for "the card" role.

**Recommended Consolidation (improvement, not implemented in this pass):**
- Keep `.bento` as the canonical solid-paper container.
- Keep `.glass` as the canonical translucent overlay (used by the mobile side-wrap, pills, and overlays).
- Deprecate `.card` as a styled flavor of `.glass` — replace remaining call sites with explicit `.glass` + utility classes when a glass card is genuinely needed.
- Treat `.bento` and `.glass` as the two-tier system; surface should be intentional, not selected from three near-equivalent options.

### Pill (chip)
- **Shape:** pill (`border-radius: 999px`), padding `6px 12px`.
- **Background:** glass tint + `backdrop-filter`.
- **Typography:** Geist Mono 12px in Type Black Dim.
- **Role:** stack pills in the Skills & Tools section (`TechPill.astro`, `SkillIcon.astro`). Inline, never a primary affordance.

### MorphNav (signature)
- **Component:** [`MorphNav.astro`](src/components/MorphNav.astro), rendered once in [`BaseLayout.astro`](src/layouts/BaseLayout.astro). A fixed, centered floating pill: `position: fixed; top: 20px; left: 50%; width: min(350px, calc(100vw - 40px)); border-radius: 21.5px`.
- **Surface:** translucent paper panel (`background: rgba(250, 248, 243, 0.82)`, `backdrop-filter: blur(14px)`) on a soft drop (`0 18px 60px rgba(26, 26, 28, 0.12)`). Tokens derive from the site theme (`--ink`, `--rule`, `--accent`).
- **Shells** (CSS classes on `.morph-nav`): `.is-compact` — the 43px bar showing the active section title + progress glyph (the production resting state); `.is-open` — the expanded panel with the vertical nav links and the theme toggle (height measured at runtime). A third `.is-intro` spark shell exists but is disabled in production (`BaseLayout` passes `intro={false}` / `autoOpen={false}`, so the nav mounts directly in `.is-compact`).
- **Scrollspy + progress:** a title reel (`.morph-title-window`) cross-fades the active section title, driven by an `IntersectionObserver` over page elements carrying `data-nav-section`. A concentric SVG progress ring (`.morph-progress-ring`) on the right cap tracks scroll.
- **A11y:** the title reel is `aria-hidden` (decorative); the active section is announced through a `.morph-live` `aria-live="polite"` region. The trigger carries `aria-expanded` / `aria-controls`; the collapsed panel is `inert`. A `@media (prefers-reduced-motion: reduce)` block tones the morph down.
- **Note:** the older Liquid Glass `#nav-pill` / `Nav.astro` nav has been replaced by MorphNav. The Liquid Glass module (CSS + runtime) still ships and is used on the `musicplayer` demo (`#player-pill.liquid-glass`); `nav-test.astro` is a standalone MorphNav harness that deliberately avoids `BaseLayout` and the liquid-glass runtime, not a Liquid Glass surface.

### Open Menu (mobile and desktop)
There is no separate mobile-menu component — `MobileMenu.astro` / `#mobile-menu` and the hamburger button were removed with the old nav. On every viewport the menu *is* MorphNav's `.is-open` shell: activating the pill expands it into the vertical link list plus the theme toggle, with panel height measured at runtime. See the MorphNav entry above.

### Cards (project, bento, reveal)
- **ProjectCard** (`ProjectCard.astro`): renders `<article class="card project-card">` — it currently sits on the glass `.card` primitive, **not** `.bento`. Treat this as known drift; the intended target for displayed-object cards is `.bento`.
- **BentoCard** (`BentoCard.astro`): the homepage grid item, with the modal case-study expansion described in the `body.bento-open` rule.
- **`.section-fade-in`**: the entrance reveal — opacity + translateY via the `fadeIn` keyframe (0.6s, `animation-delay` stagger), in `global.css`. It is **not** currently gated for `prefers-reduced-motion` (no reduce override) — a known a11y gap to close.

### Editorial Eyebrow
- **Selector:** `.section-eyebrow`.
- **Treatment:** Geist Mono 11px uppercase, tracked 0.16em, Type Black Tertiary, margin-bottom 12px.
- **Pair with section numbering** (`01 · Hero`, `02 · Projects`, `03 · About`, `04 · Contact`). Numbering is the editorial signal that distinguishes this from the AI-eyebrow trope.

## 6. Do's and Don'ts

### Do:
- **Do** keep light-mode bg at `#f6f3ed` (Studio Light, warm paper). This is committed identity, not drift.
- **Do** keep dark-mode parity: every committed token has a dark-mode counterpart and every new component works in both modes from the first commit.
- **Do** use Fraunces italic + Working Heat on `em` for editorial emphasis. It is the system's most distinctive typographic gesture; treat it as voice, not decoration.
- **Do** pair section eyebrows with section numbering (`01 · Hero`, `02 · Projects`, etc). The numbering is what distinguishes this from AI-scaffolding eyebrows.
- **Do** use `.bento` for confident displayed objects (homepage grid, project cards, displayed artifacts).
- **Do** respect `prefers-reduced-motion` on every new animation. The interactive components (BentoGrid, MorphNav, TechPill, ThemeToggle) and motion scripts (Lenis, bento-expand) already model this; the `.section-fade-in` entrance is the outstanding gap — extend the discipline to it and any new transitions.
- **Do** keep MorphNav as the one signature flourish. Extend its disposition; don't add a competing bespoke signature effect. (The Liquid Glass module remains available for prototype/demo surfaces, but it's no longer the nav.)
- **Do** include the dark-mode shadow pair on every new component that has a shadow. Light-mode shadows use warm grey; dark-mode shadows use pure black at higher opacity.

### Don't:
- **Don't** drift the body bg toward pure white (`#ffffff`) or pure off-white (`#fafafa`). The warm-paper tint is part of the brand; backing away from it is reversion to the generic-dev-portfolio template lane.
- **Don't** use Working Heat (the terracotta accent) as a surface fill that dominates more than ~8% of a view. The ember is the ember because it is rare.
- **Don't** introduce a fourth type family. Three voices (Fraunces / Geist / Geist Mono) is the committed system; a fourth reads as indecision.
- **Don't** pair Fraunces with another serif. The serif voice is one voice.
- **Don't** use `em` for purely decorative italics — it carries the ember, which means it carries identity.
- **Don't** ship an eyebrow without numbering or a clear sequence logic. The editorial eyebrow is a system, not a decoration.
- **Don't** introduce a new card-shaped primitive. The system already has `.card` / `.bento` drift to consolidate; a third would compound the problem.
- **Don't** apply `background-clip: text` with a gradient. Gradient text is forbidden globally (cross-register absolute ban).
- **Don't** ship motion without a `prefers-reduced-motion` path. MorphNav, the bento cards, and the motion scripts already model this; new animations must too. (Graceful degradation, the way the Liquid Glass module's Safari/Firefox fallback was built, is part of the brand promise.)
- **Don't** drift toward agency-portfolio-monochrome: pure black bg, no colour, oversized cursor, scroll-driven choreography for every section. PRODUCT.md names this as the strongest anti-reference; the committed warm-paper / terracotta identity is the antibody.
- **Don't** drift toward generic-dev-portfolio: black/white minimal, default Geist with no opinion, hero + projects-grid + about + email. Identity comes from being non-default.
- **Don't** remove or invisibility-style focus rings. Even with the looser a11y posture (PRODUCT.md §Accessibility), focus rings are table stakes.
