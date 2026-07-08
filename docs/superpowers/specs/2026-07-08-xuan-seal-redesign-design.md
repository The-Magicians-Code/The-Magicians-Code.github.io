# Xuan & Seal — Site-wide Visual Reskin (Design Spec)

**Date:** 2026-07-08
**Status:** Approved by user (direction: "Xuan & Seal reskin", ornament level: "Whisper")
**Concept name:** The Empty Scroll

## 1. Concept

Reskin the portfolio as a hanging scroll: warm xuan-paper fields, an ink-derived
neutral ladder, and exactly one red mark — a personal seal. Two source studies
inform it:

- **Kung Fu Panda trilogy philosophy** (register, never imagery): Act I
  restraint in the hero (the blank Dragon Scroll — say almost nothing,
  confidently), Act II honesty in projects (the story includes its wrong
  turns), Act III generosity in contact (teacher's voice, not applicant's).
  No pandas, no kung fu references, no film quotes anywhere on the site.
- **Chinese decorative arts at museum restraint** (Song ceramics / literati
  ink painting, not Qing-export ornament): five-ink neutrals, liubai (留白)
  emptiness, seal-as-signature, gold-on-lacquer dark theme.

Guiding motion principle (record for all future motion work): *"move like the
raindrop across the leaf — guided, never shattered."* Asymmetric ease-out,
no bounce, no ambient animation on the light theme.

## 2. Color tokens

All changes flow through the **existing CSS variable names** in
`src/styles/global.css` so bento morph, glass surfaces, and scripts inherit
the new palette with zero JS changes (per the pre-design site audit).

### Light theme — "Xuan"

| Token | New value | Note |
|---|---|---|
| `--bg` | `#f5f1e8` (`oklch(0.955 0.012 90)`) | xuan paper; slightly warmer than current `#f6f3ed` |
| `--paper` | `#faf8f2` | fresh sheet |
| `--ink` | `oklch(0.21 0.005 90)` (~`#1a1a18`) | 焦 — warm near-black, replaces cool `#1a1a1c` |
| `--ink-dim` | `oklch(0.35 0.008 90)` | 濃 |
| `--ink-3` | `oklch(0.52 0.012 90)` | 淡 |
| `--rule` | `oklch(0.86 0.012 90 / 0.9)` or ink at ~12% alpha | 清-tier hairline; keep alpha form if simpler |
| `--accent` | `oklch(0.50 0.16 30)` (~`#b33a2b`) | seal-paste red; near-identical hue to current terracotta (28 → 30) |
| `--accent-soft` | `oklch(0.50 0.16 30 / 0.14)` | |

`::selection` background becomes a pale seal tint `oklch(0.94 0.03 30)`.

### Dark theme — "Lacquer"

| Token | New value | Note |
|---|---|---|
| `--bg` | `#141210` (`oklch(0.17 0.008 40)`) | lacquer black with warm red-brown cast; replaces blue-ish `#0a0a0d` |
| `--paper` | `oklch(0.22 0.010 40)` (~`#1e1a17`) | |
| `--ink` | `oklch(0.93 0.010 85)` (~`#f0ede4`) | porcelain white — never `#fff` |
| `--ink-dim` | `oklch(0.78 0.015 85)` | |
| `--ink-3` | `oklch(0.62 0.015 85)` | keep ≥ AA where used on `--bg` |
| `--rule` | warm white at ~10% alpha | |
| `--accent` | `oklch(0.74 0.09 85)` (~`#c9a961`) | antique gold takes over as accent — never `#FFD700` |
| `--accent-soft` | `oklch(0.74 0.09 85 / 0.18)` | |

### Invariant

- `--vermillion: oklch(0.55 0.17 30)` — defined once, same in both themes.
  Used **only** by the seal SVG and `:focus-visible` rings. Like a physical
  seal, its color does not change with the ground it sits on.
- Glass tokens (`--glass-bg`, `--glass-brd`, `--glass-inner`,
  `--glass-shadow`) re-tinted warm (hue 85–90) to match; same alpha structure.

### Proportion discipline

Paper ~90%, ink ~9%, red ~1% of any viewport. If seal-red appears more than
~3 times in a viewport it stops being a seal — the accent is used for links
and the seal, nothing else.

## 3. The seal component

New `src/components/Seal.astro`: inline SVG chop, "TT" knocked out in the
paper color from a vermillion square (白文 style) with slightly irregular
"worn stone" corners. `role="img"`, `aria-label="Seal of Tanel Treuberg"`.
Sized ~40–56 px. Placed exactly twice:

1. **Hero**, bottom-right, off-grid — the diagonal counterweight in the
   one-corner composition (§4).
2. **Footer**, beside the copyright line.

No other placements at whisper level.

## 4. Hero recomposition (the only layout change)

One-corner (Ma Yuan) composition inside the existing `Hero.astro`:

- Name + a single declarative thesis line anchored **lower-left** of the
  viewport (not centered).
- Seal bottom-right.
- The remaining field is genuinely empty paper — the current radial accent
  gradient (`.hero-back`) is removed or reduced to near-nothing; emptiness is
  the statement.
- Copy: one line of belief about building software. No buzzword list, no
  credentials. (Final wording drafted at implementation, approved by user.)

## 5. Hanzi section numerals (entire ornament budget)

Pale markers above the four homepage sections: 一 About, 二 Projects,
三 Stack, 四 Contact.

- Rendered large-ish (`clamp(2rem, 5vw, 3.25rem)`), color `--ink-3`-or-paler,
  `user-select: none`, positioned in the section heading's airspace.
- Font: self-hosted Source Han Serif SC subset woff2 containing only
  `U+4E00, U+4E8C, U+4E09, U+56DB` (一二三四), ~≤5 KB, declared with
  `unicode-range` in `src/styles/fonts.css`. Never system-fallback CJK.
- Markup: `<span lang="zh-Hans" aria-hidden="true">二</span>` +
  `<span class="sr-only">Section 2</span>`; the Latin heading remains the
  information carrier.

Explicitly **not** included at whisper level: lattice dividers, moon gate,
cloud motifs, cracked-ice borders, paper-grain overlay, vertical margin
labels, brush-stroke reveals.

## 6. Typography

Unchanged: Fraunces (display), Geist (body), Geist Mono (code). Fraunces'
SOFT/WONK variable axes already carry the ink-into-paper quality the research
called for; no font churn.

## 7. Motion

- **Untouched:** bento morph geometry/timing/easing, pretext word
  positioning, liquid-glass module, Lenis smooth scroll, section fade-ins,
  reduced-motion handling.
- **One addition — ink-bloom theme toggle:** where supported, the theme
  switch uses the View Transitions API (`document.startViewTransition`) with
  an expanding `clip-path: circle()` on `::view-transition-new(root)`
  originating at the toggle's coordinates — ink dropping onto paper / gold
  blooming on lacquer. Feature-detected; Safari/Firefox and
  `prefers-reduced-motion` keep the existing instant swap (current behavior
  preserved verbatim as the fallback path).

## 8. Copy touches

- **Contact** shifts to the teacher's voice — what working together gives
  the other party, framed as invitation to collaborate. (The current heading
  "If you have a thoughtful thing to put into the world… so do I" is already
  close; refine, don't replace.)
- **Case studies:** keep/strengthen one honest "wrong turn before the right
  one" beat per project. Several already have this; no forced additions.
- **Footer:** add a quiet "last updated <month year>" line (site as a living
  thing). Sourced at build time from a constant, not `Date.now()`, to keep
  builds deterministic.

## 9. Out of scope

- No layout restructuring beyond the hero. No nav (stays removed).
- No changes to the resume PDF pipeline, robots.txt, or deploy workflow.
- No bento card geometry, duration, or easing changes.
- No Tailwind/Lightning CSS target changes.
- No handscroll/scroll-driven structural features (a possible later phase).

## 10. Files expected to change

`src/styles/global.css` (tokens, selection, focus ring), `src/styles/fonts.css`
(hanzi subset face), `public/fonts/` (new subset woff2),
`src/components/Hero.astro`, new `src/components/Seal.astro`,
`src/components/SiteFooter.astro`, `src/components/ThemeToggle.astro` (+ its
inline script for the bloom), section components for the hanzi markers
(`About.astro`, `BentoProjectsSection.astro`, `BentoStackSection.astro`,
`Contact.astro`), `src/components/Contact.astro` copy. No changes expected under
`src/scripts/` — the bloom logic lives in `ThemeToggle.astro`'s own script.

## 11. Risks & mitigations

1. **Lightning CSS strips fallbacks** when targeting Safari 16.1 — verify the
   final token values and any new prefixed properties in `dist/`, not source.
2. **Gold-on-lacquer contrast** — check WCAG AA for `--accent` as link text on
   `--bg` dark; step the gold's L up if it misses.
3. **View-transition bloom on WebKit** — must never regress the Safari path;
   gate on `document.startViewTransition` existence and keep the current
   toggle code as the untouched fallback branch. Verify on real iOS via the
   Netlify deploy preview.
4. **Warm-neutral drift on covers** — the three photo covers were
   art-directed against the old background; eyeball them against xuan/lacquer
   grounds in both themes.
5. **Figma/Paper mirrors go stale** — the design-tool mirrors
   (`themagicianscode` Paper file, Figma site mirror) will lag the shipped
   site after this lands; log a follow-up to resync tokens there.

## 12. Acceptance criteria

- [ ] `npm run check` and `npm run build` pass; token values verified in `dist/` CSS.
- [ ] Both themes render the new palettes; theme toggle works with bloom on
      Chromium and with the existing swap on Safari/Firefox and under
      reduced motion.
- [ ] Seal renders in hero + footer, red in both themes; focus-visible rings
      are vermillion.
- [ ] Hanzi numerals render in the subset font (verify no system-CJK
      fallback), are `aria-hidden`, and have sr-only equivalents.
- [ ] Hero is one-corner composed, single thesis line, no radial gradient blob.
- [ ] Bento morph, expanded case studies, pretext titles, liquid-glass
      musicplayer page all behave identically to pre-reskin (manual check,
      Chromium + Safari/iOS via Netlify preview).
- [ ] Accent-red appearances per viewport ≤ 3 on the homepage.
- [ ] AA contrast for body text and links in both themes.
