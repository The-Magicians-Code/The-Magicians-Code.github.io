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
  nav-pill:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "64px"
  section-eyebrow:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    typography: "{typography.eyebrow}"
---

# Design System: The Magicians' Code

## 1. Overview

**Creative North Star: "The Cabinet of Working Curiosities"**

The site is a maker's cabinet: an organized exhibition of working artifacts, each one runnable, each one paid for in real engineering. The cabinet is lit by studio light, the type is ink on paper, the accent is the colour of a small ember at the edge of a workbench. Projects are displayed objects. The resume is the curator's notecard. The contact link is the door out. The Liquid Glass nav is the wandering eye that refracts whatever it passes over — it is the cabinet realizing it is also a screen.

The system commits to a warm-paper light surface (with a fully developed dark-mode counterpart), a deep ink ramp for type and structure, and a single ember-warm terracotta accent used sparingly. Typography pairs Fraunces (a contemporary expressive serif) for headlines and `em` emphasis with Geist for body and Geist Mono for technical labels — a three-family system where the families are deliberately on different contrast axes (humanist serif vs. neo-grotesque sans vs. mono) rather than three sans-serifs that fight. Surfaces work in two registers: solid paper (`.bento`) for confident displayed objects, and translucent glass (`.glass`, `.card`, `.pill`) for layered overlays that hint at what's behind them.

The signature is the Liquid Glass module on the nav pill: a custom CSS + SVG + Canvas pipeline that uses `feDisplacementMap` chained into `backdrop-filter` to refract scrolled content through Snell's-law-derived displacement, with a specular sheen across the top edge. The full system is documented in [`docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md`](docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md); Safari and Firefox gracefully fall back to a frosted-glass treatment via pre-paint UA sniff. This is the most explicit statement of the brand: an effect that works because it was engineered, including how it degrades.

This system explicitly rejects two lanes: agency-portfolio-monochrome (pure black, oversized cursor, every interaction over-engineered, scroll-driven choreography for every section — performance as identity) and generic-dev-portfolio (Vercel-template-clone, default neo-grotesque, hero + projects-grid + about + email, identity by absence). The committed warm-paper / terracotta / Fraunces / Liquid Glass identity is the antibody to both; drift toward neutral is the failure mode.

**Key Characteristics:**
- Warm-paper light + ink dark with full token swap for `prefers-color-scheme`.
- One ember-warm accent. Used sparingly on `em`, links, and hover states — never as a fill that dominates a surface.
- Three-family typography: Fraunces (serif, headlines + emphasis) + Geist (sans, body) + Geist Mono (technical labels + eyebrows). Self-hosted via `@fontsource-variable`.
- Two surface registers: solid paper (`.bento`) for displayed objects; glass (`.glass`/`.card`/`.pill`) for overlays. **A documented inconsistency lives here** — see §5.
- Motion is committed: a single ease (`cubic-bezier(0.22, 1, 0.36, 1)`), uniform 220ms hover transitions on cards, scroll-reveal via IntersectionObserver gated to `prefers-reduced-motion`.
- Liquid Glass nav is the signature. Identity-bearing, not decorative.
- A11y is engineered to the level the craft requires: real focus rings, reduced-motion respected, dark-mode complete. Not AAA-pursuing.

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
- **Glass Tint** (`rgba(255, 252, 246, 0.45)` light · `rgba(255, 255, 255, 0.04)` dark) — the translucent surface used by `.glass`, `.card`, `.pill`, and the nav fallback. Saturated 140% so refracted colour reads vivid through the blur.
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

**Note:** Fraunces is named in the brand-register reference's [reflex-reject list](.claude/skills/impeccable/reference/brand.md) — it is a training-data default in 2026. That list applies to *new design choices*; here, Fraunces is part of a committed identity (the variable file has just been added to `package.json` via `@fontsource-variable/fraunces`), and identity-preservation wins. New surfaces stay on this pairing. New unrelated brand briefs (not this project) would skip Fraunces by default.

### Hierarchy
- **Display** (Fraunces 400, `clamp(2.5rem, 6vw, 4.75rem)`, line-height 1.05, tracking -0.015em): hero headlines, primary identity moments. Use `text-wrap: balance` to keep multi-line displays even.
- **Headline** (Fraunces 400, `clamp(1.75rem, 3.5vw, 2.5rem)`, line-height 1.15, tracking -0.01em): section openers, project detail H1, resume section heads.
- **Title** (Fraunces 500, 1.25rem, line-height 1.3, tracking -0.005em): card titles, dialog headers, project card titles.
- **Body** (Geist 400, 1rem, line-height 1.55): all paragraphs. Cap line length at 65–75ch. Use `text-wrap: pretty` on long prose.
- **Body Emphasis** (Fraunces 400 italic, 1rem inheriting from body): the `em` element, *colored with Working Heat*. The most identity-bearing typography rule in the system: italic + ember + serif inside an otherwise sans paragraph creates a distinctive cross-family inflection.
- **Label** (Geist 500, 0.875rem, line-height 1.2): nav links, button labels.
- **Section Eyebrow** (Geist Mono 400, 11px, line-height 1.2, tracking 0.16em, uppercase, Type Black Tertiary): the editorial section marker (`01 · Hero` cadence). Already shipping at `.section-eyebrow`. **This is a deliberate brand system, not the AI-scaffolding eyebrow trope** — it is named, it has one consistent treatment, and it carries section numbering as a real editorial cadence (a cabinet has labeled drawers). The brand-register absolute ban on "tiny uppercase tracked eyebrow above every section" does not apply because (a) the eyebrow has a committed role and named system, and (b) PRODUCT.md commits to editorial voice. Don't repeat the eyebrow without numbering or section logic.
- **Mono** (Geist Mono 400, 0.75rem, line-height 1.2): tech pills, metadata, code spans.

### Named Rules

**The Three-Voice Rule.** Three families, three voices: Fraunces is the writer, Geist is the speaker, Geist Mono is the technician. They never substitute for each other. Headlines never go sans. Body never goes serif (except as `em`). Labels never go serif. The voices are kept distinct so each carries weight when it speaks.

**The Ember-Italic Rule.** `em` is rendered as Fraunces italic in Working Heat. This pairing is the system's most distinctive typographic gesture; it carries identity inline with content. Do not override it. Do not use `em` purely decoratively; use it where emphasis is real.

**The Editorial Eyebrow Rule.** The section eyebrow uses Geist Mono uppercase tracked at 0.16em in Type Black Tertiary. It is paired with section numbering (e.g. `01 · Hero`, `02 · Projects`) to signal sequence. Eyebrows without numbering, or eyebrows that decorate every block regardless of structure, are forbidden — that is the AI-scaffolding lane the editorial system is *defined against*.

## 4. Elevation

Two registers, one signature. The cabinet is mostly flat: paper and ink, on a paper page. Where surfaces lift, they lift specifically, and the lift is part of the affordance. The Liquid Glass module is the one signature elevation move that does more than lift — it refracts.

### Surface Vocabulary
- **Hairline Borders** (`1px solid var(--rule)`): the default. Bento cards, content rows, dividers.
- **Glass Inner + Outer** (`inset 0 1px 0 rgba(255, 255, 255, 0.55); 0 16px 40px -16px rgba(26, 26, 28, 0.18)` light · `inset 0 1px 0 rgba(255, 255, 255, 0.10); 0 20px 60px -20px rgba(0, 0, 0, 0.6)` dark): the `.glass` primitive. An inner highlight at the top edge + a diffuse outer drop. Pairs with backdrop-filter.
- **Bento Lift** (`0 16px 40px -16px rgba(26, 26, 28, 0.10)` light · `0 22px 56px -20px rgba(0, 0, 0, 0.55)` dark): bento hover state. Subtle, on the same warm-shadow palette as the glass primitive.
- **Card Lift** (`0 22px 48px -16px rgba(26, 26, 28, 0.22)` light · `0 24px 60px -20px rgba(0, 0, 0, 0.7)` dark): glass `.card` hover state. Slightly stronger than bento because the glass surface is competing with what's behind it.
- **Liquid Glass Refraction** (custom SVG `feDisplacementMap` chained into `backdrop-filter`, plus a specular `::before` sheen, plus the inner-glow + lifted drop combo on `#nav-pill`): the signature. Documented in [`docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md`](docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md). Eight CSS custom properties tune it (`--lg-thickness`, `--lg-bezel`, `--lg-ior`, `--lg-uniform-shift`, `--lg-blur`, `--lg-saturate`, `--lg-svg-saturate`, `--lg-spec-alpha`).

### Named Rules

**The Flat-Paper Rule.** Most surfaces sit flat on the page. A bento card with a hairline border is the canonical container; cards lift only on hover, and the lift is short (220ms) and subtle (`translateY(-2px)` + a small shadow bump). Heavy ambient shadows on rest-state surfaces are forbidden — the cabinet's identity is paper, not stacked cards.

**The One Signature Rule.** Liquid Glass is the one signature elevation move in the system. New components do not add new signature treatments competing with it. If a surface needs to feel special, it does so through typography, colour, or the existing Liquid Glass module — not through a new effect.

**The Symmetric Shadow Rule.** Every shadow has a dark-mode counterpart with darker, more diffuse parameters. Light-mode shadows use warm grey (`rgba(26, 26, 28, …)`); dark-mode shadows use pure black at higher opacity. Don't ship a shadow without its dark-mode pair.

## 5. Components

The codebase commits to a small inventory of canonical surfaces and chip primitives. **A real inconsistency is documented here:** the system has two card-shaped primitives (`.card` and `.bento`) that overlap in role. The Components section both documents what exists and names the consolidation as a follow-up improvement (see Recommended Consolidation below).

### Buttons (chip-shaped, no committed Button primitive)
The system has no `<button>` primitive in the global stylesheet. Nav links, theme toggle, hamburger, and CTA-style chips are styled per-component. **This is a gap.** A canonical button vocabulary (primary / ghost) would help future surfaces (contact form, project links) avoid drift.

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
- **Role:** translucent panels that float over content (the nav fallback, side-wrap on mobile, pills).

### Drift: `.card` vs. `.bento`
The two card-shaped primitives are doing similar work. `.bento` is solid paper, hairline-bordered, performant on grids, and is the homepage's canonical displayed-object container. `.card` is the older `.glass + 14px radius + 28px padding` combo with a hover lift, but its glass background is heavier (forces backdrop-filter compositing) and it competes with `.bento` for "the card" role.

**Recommended Consolidation (improvement, not implemented in this pass):**
- Keep `.bento` as the canonical solid-paper container.
- Keep `.glass` as the canonical translucent overlay (used by nav fallback, mobile side-wrap, pills).
- Deprecate `.card` as a styled flavor of `.glass` — replace remaining call sites with explicit `.glass` + utility classes when a glass card is genuinely needed.
- Treat `.bento` and `.glass` as the two-tier system; surface should be intentional, not selected from three near-equivalent options.

### Pill (chip)
- **Shape:** pill (`border-radius: 999px`), padding `6px 12px`.
- **Background:** glass tint + `backdrop-filter`.
- **Typography:** Geist Mono 12px in Type Black Dim.
- **Role:** stack pills in the Skills & Tools section (`TechPill.astro`, `SkillIcon.astro`). Inline, never a primary affordance.

### Liquid Glass Nav (signature)
- **Selector:** `#nav-pill` (and any `class="liquid-glass"` consumer).
- **Treatment:** custom SVG `feDisplacementMap` filter chained into `backdrop-filter`; specular sheen via `::before` linear gradient (anchored by `isolation: isolate`); inner glow + lifted drop shadow on the pill itself.
- **Tuning:** eight CSS custom properties (see Elevation §4 list).
- **Fallback:** `html.lg-no-svg-backdrop` (set by pre-paint UA sniff in [`BaseLayout.astro`](src/layouts/BaseLayout.astro)) swaps the pill to the standard `.glass` treatment on Safari and Firefox.
- **Imperative API:** `window.__lg.refresh(el)` re-rasterizes after CSS-var changes.
- **Dev tuner:** `⌘/Ctrl+Shift+G` toggles the in-dev sliders panel (see `Nav.astro`).
- **Mobile (<641px):** nav pill is unstyled (`background: none !important`); a separate `.side-wrap` glass treatment wraps brand + actions instead. The Liquid Glass effect is desktop-only by default; `data-lg-mobile` opts a consumer in.

### Mobile Menu
- **Container:** `#mobile-menu .panel`, `min(680px, 92%)` wide, `border-radius: 16px`.
- **Transition:** transform + opacity + max-height (220ms `var(--ease)` family).
- **Triggered by:** the hamburger button (visible <641px), which animates two `.line` bars into an X via paired translate-then-rotate transitions (slide-together first, rotate second on open; reverse on close).

### Cards (project, bento, reveal)
- **ProjectCard** (`ProjectCard.astro`): displayed-object treatment using the `.bento` primitive.
- **BentoCard** (`BentoCard.astro`): the homepage grid item, with the modal case-study expansion described in the `body.bento-open` rule.
- **`.reveal-up`**: a scroll-reveal opacity + translateY transition gated to `IntersectionObserver`. Respects `prefers-reduced-motion`.

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
- **Do** respect `prefers-reduced-motion` on every new animation. `.reveal-up` already models this; extend the same discipline to any new transitions.
- **Do** keep the Liquid Glass module as the one signature elevation move. Tune its CSS vars; don't replace it; don't add a competing signature effect.
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
- **Don't** scrap the Liquid Glass module's Safari / Firefox fallback. The graceful-degradation contract is part of the brand promise.
- **Don't** drift toward agency-portfolio-monochrome: pure black bg, no colour, oversized cursor, scroll-driven choreography for every section. PRODUCT.md names this as the strongest anti-reference; the committed warm-paper / terracotta identity is the antibody.
- **Don't** drift toward generic-dev-portfolio: black/white minimal, default Geist with no opinion, hero + projects-grid + about + email. Identity comes from being non-default.
- **Don't** remove or invisibility-style focus rings. Even with the looser a11y posture (PRODUCT.md §Accessibility), focus rings are table stakes.
