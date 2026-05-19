# Case Study Dual-Mode (TL;DR ↔ Detailed) — Design

**Date:** 2026-05-19
**Status:** Brainstorming complete; awaiting plan.

## Goal

Let one case-study Markdown file render in two reading modes — TL;DR (skim,
~30s) and Detailed (~3min) — controlled by a pill toggle inside the expanded
bento card modal. One source of truth per case study; one toggle that serves
recruiters, peers, and clients without forcing a choice up front.

## Non-Goals

- Per-section disclosure (Pattern B from the playground at
  [docs/ideas/case-study-patterns.html](../../ideas/case-study-patterns.html)).
  We picked Pattern A (global toggle). Each section renders in lockstep with
  the active mode.
- Progressive-scroll narratives (Pattern C). Same reason.
- Cross-visit mode persistence. Mode is `sessionStorage`-scoped: sticky for the
  visit, resets on a new browser session, deliberately not `localStorage`.
- Per-card persistence. Mode is global across the site within a session — if a
  reader toggles to Detailed on `organic-flow` and opens `strato-pi`, that one
  opens in Detailed too.
- Animation of mode-swap with per-element morphing. We cross-fade the body
  container; sections don't individually animate.
- A third "for the nerds" mode beyond Detailed. Instead, Detailed mode includes
  a footer link to the project's DeepWiki page when `deepwikiUrl` is set in
  frontmatter — an escape hatch, not a mode.

## Architecture

```
src/
├── content/
│   ├── config.ts                 ← add `deepwikiUrl` to projects schema
│   └── projects/<slug>.md        ← author convention: `## H2` + `> [!summary]` + detail
├── components/
│   └── BentoCard.astro           ← render dual-mode wrapper around .bento-card-body
├── scripts/
│   ├── bento-expand.ts           ← already clones .bento-card-body on open;
│   │                               apply current mode to the cloned wrap
│   └── case-study-mode.ts        ← NEW: pill toggle, sessionStorage, cross-fade
└── styles/                       ← (inline in components, no new global file needed)
```

No new dependencies. Astro's content collections already handle Markdown body
rendering; we use plain CSS attribute selectors for mode gating instead of
re-rendering on toggle.

## Authoring contract

Each case study is one Markdown file under
[src/content/projects/<slug>.md](../../../src/content/projects/). The body uses
a fixed three-element pattern per section:

1. **One `## Heading`** per T2 section. Section order is fixed (Context →
   Problem → Approach → Results) but the heading text is freely worded
   ("The problem", "The rebuild", "What changed", etc.).
2. **A `> [!summary]` GitHub-style alert callout** as the first child of each
   section. This is the section's TL;DR — 1–2 sentences, ~25–40 words.
3. **Everything else under the heading** is the Detail prose — paragraphs,
   lists, code, links, all standard Markdown.

Example skeleton:

```markdown
## The problem

> [!summary]
> One- or two-sentence summary with a number in it.

Detailed paragraph or two of the why, the what-broke, the symptoms.

Another paragraph with more depth.
```

**Why this convention:** prose is the natural habitat for both layers. YAML
multi-paragraph strings are awkward to author; structured frontmatter for 8
content blocks (one TL;DR + one Detail × four sections) sacrifices Markdown's
flexibility (no inline code, no lists, no links inside YAML strings). The
`> [!summary]` alert is plain Markdown, renders sensibly even without our
mode-swap logic (e.g. when previewed on GitHub), and parses through Astro's
default remark-gfm pipeline.

## Schema additions

Update [src/content.config.ts](../../../src/content.config.ts):

```ts
projects: defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    repoUrl: z.string().url(),
    order: z.number().int(),
    draft: z.boolean().default(false),
    bentoSpan: z.enum(['wide', 'tall']).optional(),
    coverVariant: z.enum(['alt']).optional(),
    deepwikiUrl: z.string().url().optional(),   // NEW
  }),
}),
```

Only one new optional field: `deepwikiUrl`. If set, the Detailed mode renders a
"For the nerds →" footer link to it. If absent, the footer is omitted.

## Rendering: DOM structure + CSS mode gating

The expanded card already mounts a `.bento-card-body-rendered` wrap into the
modal body via [src/scripts/bento-expand.ts](../../../src/scripts/bento-expand.ts).
We extend that wrap with two structural additions:

1. **The pill toggle**, inserted by the expand script as a fixed first child of
   the rendered wrap (i.e. before the section content), styled to match the
   existing site language.
2. **Mode-gating attribute** on the wrap: `data-mode="tldr"` or
   `data-mode="detailed"`.

Markdown is rendered with the standard Astro pipeline (no remark plugin). The
GFM alert callout `> [!summary]` becomes a `<blockquote class="alert
alert-summary">` (or whatever class Astro's `remark-gfm` produces — verify
during plan-writing). We use CSS to gate visibility based on the body's
`data-mode`:

```css
/* In TL;DR mode: hide everything except the summary callouts. */
.bento-card-body-rendered[data-mode="tldr"] .alert-summary ~ * {
  display: none;
}
/* In Detailed mode: render the summary callout styled as a lede, then
   everything else. */
.bento-card-body-rendered[data-mode="detailed"] .alert-summary {
  border-left: 2px solid var(--ink-3);
  padding-left: 12px;
  margin: 0 0 12px;
  font-style: italic;
  color: var(--ink-dim);
}
```

The CSS uses `~ *` (general sibling combinator) after `.alert-summary` to hide
everything between the summary callout and the next H2 in TL;DR mode. H2s
themselves stay visible in both modes (they're scannable structure).

**Edge case:** if a section is missing the summary callout, `~ *` doesn't fire
and the section renders its raw content in both modes. Visually noisy but
non-fatal. We add an `astro check`-time validator (see "Validation" below) to
warn.

**Edge case:** if a section is missing detail content (summary callout but
nothing after it), Detailed mode shows just the lede. Acceptable — some
sections might genuinely only have a one-line summary worth making.

## Pill toggle UI

**Placement:** centered, directly under the title's centered position when the
card is in `.is-expanded`. Inserted by the expand script as the first child of
`.bento-card-body-rendered`. Not sticky.

**Visual:** matches the existing `.pill-toggle` pattern from the playground
mockup ([docs/ideas/case-study-patterns.html](../../ideas/case-study-patterns.html))
and the Rayo reference image — translucent ink-toned background, paper-toned
active pill with subtle shadow. Reuses the existing site `--ink`, `--ink-dim`,
`--paper` tokens.

**Order:** `TL;DR | Detailed`. TL;DR is the default-active segment on open.

**Behavior:**
- Click → toggle `data-mode` on the rendered wrap.
- Write the new mode to `sessionStorage` under key `cs-mode` (short, unlikely
  to collide).
- The visual swap is a cross-fade: see "Animation" below.

**Accessibility:**
- `role="tablist"` on the pill container; `role="tab"`, `aria-selected`,
  `tabindex` on each button.
- Keyboard: Left/Right arrows move between the two tabs. Space/Enter activates.
  This is the standard ARIA tablist pattern.
- The tabpanel is `.bento-card-body-rendered`, given
  `aria-labelledby="<active-tab-id>"`.

## Mode persistence

`sessionStorage.cs-mode` holds the active mode for the visit.

- **On card open:** the expand script reads `sessionStorage.cs-mode`. If
  present and valid (`tldr` or `detailed`), applies it to the rendered wrap's
  `data-mode` before the wrap is shown. If absent or invalid, defaults to
  `tldr`.
- **On toggle click:** write the new mode immediately.
- **On card close:** state preserved in `sessionStorage`. Next open of any card
  picks it up.
- **Across browser tabs:** `sessionStorage` is per-tab. Each tab manages its
  own mode. Cross-tab sync is not a goal.
- **Across sessions:** new tab/visit defaults back to `tldr`. Deliberately not
  `localStorage` — cross-visit persistence makes the default feel inconsistent
  for casual returners.

## Animation: cross-fade on mode swap

When the toggle is clicked:

1. Apply `.is-swapping` class to the rendered wrap → CSS transitions opacity
   to 0 over 160ms.
2. After 160ms, swap `data-mode` and remove `.is-swapping` → CSS transitions
   opacity back to 1 over 160ms.

Total: ~320ms. No layout-shift suppression needed because the wrap's height
changes naturally when content visibility flips; the modal body scroll
container ([the existing `.card-body { overflow-y: auto }`](../../../src/components/BentoGrid.astro))
absorbs height delta without affecting the surrounding card. Pill toggle
position stays fixed since it's the wrap's first child; only the section
content fades.

The cross-fade uses simple opacity transitions, not the morph easing
(`--ease-snappy`). Default `ease-out` is appropriate; the swap isn't a
position change.

```css
.bento-card-body-rendered {
  transition: opacity 160ms ease-out;
}
.bento-card-body-rendered.is-swapping {
  opacity: 0;
}
```

## "For the nerds" footer

When the frontmatter has `deepwikiUrl`, the rendered wrap appends a small
right-aligned footer link at the end of the case-study content:

```html
<p class="cs-nerds-footer">
  <a href="..." target="_blank" rel="noopener noreferrer">
    For the nerds — full architecture wiki →
  </a>
</p>
```

The footer is visible **only in Detailed mode** (`data-mode="detailed"`). It
would be noise in TL;DR mode where the reader has explicitly opted into the
skim.

Styled muted (uses `--ink-dim`) so it reads as an escape hatch, not a CTA.

## Validation

Add a build-time check inside the existing Astro content collection schema
(via `z.string().transform(...)` or a separate validation pass) that:

1. Parses the body for `## ` H2 sections.
2. For each H2, checks that the first non-whitespace child is a
   `> [!summary]` block.
3. Warns (not fails) on missing summary or missing detail. We don't want a
   missing TL;DR to block the build — we want to know about it during
   `npm run check`.

Implementation choice deferred to plan: simplest path is a remark visitor that
runs during the content collection's load step.

## Trade-offs considered and chosen against

- **Per-section disclosure (Pattern B)** — rejected: forces every reader to
  click N times to read in depth, breaks the "front-door choice" model the
  pill establishes.
- **Progressive scroll (Pattern C)** — rejected: no escape hatch for the
  skim-only reader, and the writing burden is higher.
- **Structured frontmatter for sections** — rejected: Markdown-in-YAML is
  awkward for multi-paragraph prose with inline formatting.
- **Two separate Markdown files per project** (`<slug>.tldr.md`,
  `<slug>.detailed.md`) — rejected: doubles authoring surface, makes
  drift between modes likely, requires two collection entries or composite
  loader logic.
- **Client-side parsing of the rendered HTML to split sections** — rejected:
  fragile (depends on output of Astro's Markdown pipeline staying stable),
  adds runtime cost, and CSS sibling-combinator gating is simpler.
- **Animating each section's visibility independently** — rejected: causes
  layout thrash and visible reflow during the swap. Cross-fading the
  container is calmer.
- **Cross-visit persistence (`localStorage`)** — rejected: surprises casual
  returners with a non-default mode.

## Acceptance criteria

- A new project Markdown file authored per the convention renders the pill
  toggle and both modes correctly inside the expanded bento card.
- Default mode on first card open in a session is `TL;DR`.
- Toggling persists across other card opens within the same session.
- Closing and re-opening a card preserves the active mode.
- New tab → opens in TL;DR (sessionStorage scope).
- `deepwikiUrl` in frontmatter surfaces a footer link visible only in Detailed
  mode.
- Missing summary callout in a section logs a warning during
  `npm run check` but does not block the build.
- Keyboard tab navigation across the pill works (arrow keys, Space/Enter).
- Animation: cross-fade ~320ms total, no layout shift outside the modal
  scroll container.

## Out of scope / deferred

- Migrating Strato_Pi and Yolo-dualdev case studies to the new convention.
  Once organic-flow is live, those two get their own follow-up commits with
  the same schema applied.
- A "share link to a specific mode" feature (URL hash like
  `#mode=detailed`). Reasonable future addition but not part of this spec.
- Print stylesheet for case studies. The resume already has a print stylesheet;
  case studies don't need one yet.
- Analytics on mode toggles. Useful signal eventually; not part of this spec.

## Open questions

None pending implementation. Schema is settled, convention is settled, mode
behavior is settled. Specific class names produced by Astro's remark-gfm for
the `> [!summary]` callout will be verified at plan-writing time and the CSS
selector adjusted to match.
