# Pretext Redesign — Design Spec

**Date:** 2026-05-20
**Status:** draft, pending approval
**Branch:** `editorial-redesign`, follow-up to commit `da641ee`

## Goal

Reintroduce per-word title morph animation ("Pretext") on case-study cards in a form that:

1. Respects the existing `--title-rest-y` / `--title-center-x` transform ownership.
2. Preserves the resting visual (titles stay left-aligned at rest).
3. Preserves the card button's accessible name regardless of DOM mutation.
4. Accounts for `letter-spacing: -0.01em` in word placement.
5. Behaves identically on Chromium and WebKit (mac + iOS).
6. Is scoped to `.cs-card` only — stack card untouched.

## Why this redesign (history)

The previous Pretext port (purged in `da641ee`) hit an iOS Safari toggle-shift regression because iOS's flex-column algorithm compressed the title's `min-height` floor when the rendered wrap below it grew. We added `flex-shrink: 0` to the header siblings (still in place) as the parity gate, then purged Pretext to ship.

The user now wants Pretext back. A first redo plan was reviewed by `codex:codex-rescue` in two passes and rejected with eight blocking issues. This spec is the redesign that addresses all of them.

## Codex's blocking findings → this spec's response

| # | Finding | Resolution in this spec |
|---|---|---|
| 1 | Double-translation: parent `.card-title` already has `--title-center-x` / `--title-rest-y` transforms; per-word transforms would stack on top | When `.pretext-title` is active, override `.card-title { transform: translateY(0) }` in `.is-expanded` state — words handle X centering, container handles Y only. `--title-center-x` set to `0` for pretext cards. |
| 2 | Source layout centering would change the resting visual | Source layout uses **natural-flow positions** (left-aligned), only the modal layout centers. Idle cards look identical to today. |
| 3 | `syncTitleRestY()` reads `titleRect.width` to compute `centerX`; collapses to 0 if title becomes `width: 100%` | Branch: for `.pretext-title` cards, skip `centerX` calc and set `--title-center-x: 0`. Words own X. |
| 4 | Card button's accessible name is descendant text; absolute spans with no whitespace produce `"Visionpipelineforedgeinference"` | Add `aria-label={titleToText(title)}` to the card button in `BentoCard.astro`. Accessible name explicitly set, descendant text irrelevant. |
| 5 | Canvas `measureText` ignores CSS `letter-spacing` | Replace Canvas measurement with a hidden DOM mirror element styled identically to the title. Measure each word via `getBoundingClientRect().width`. Letter-spacing, font features, kerning all accounted for. |
| 6 | Scope too broad: `[data-bento-card]` walker would mutate the stack card | Walker selects `.cs-card[data-bento-card]` only. Stack card excluded by design. |
| 7 | `visualViewport.resize` is placebo here (modal rect uses `window.innerWidth`) | Drop it. Keep `window.resize` + `orientationchange`. |
| 8 | RTL / non-Latin scripts | Documented as non-goal for v1. Whitespace splitting is sufficient for current English titles. |

## Architecture

### Files touched

| File | Change |
|---|---|
| `src/scripts/pretext.ts` | **NEW.** Measurement + layout + DOM mutation. No knowledge of the morph lifecycle. |
| `src/scripts/bento-expand.ts` | Imports and orchestrates pretext at 4 lifecycle hooks (init / expand / close / resize). |
| `src/components/BentoGrid.astro` | Adds `.pretext-title` + `.word` CSS scaffolding and the `.is-expanded` translate override. |
| `src/components/BentoCard.astro` | Adds `aria-label={titleToText(title)}` to the card button. |

### Measurement: DOM mirror, not Canvas

A single hidden mirror element is created on first use, styled to match the title's text-rendering properties exactly:

```ts
function getMirror(): HTMLSpanElement {
  let mirror = document.querySelector<HTMLSpanElement>('#pretext-mirror');
  if (mirror) return mirror;
  mirror = document.createElement('span');
  mirror.id = 'pretext-mirror';
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.cssText = [
    'position: fixed',
    'top: -9999px',
    'left: -9999px',
    'visibility: hidden',
    'pointer-events: none',
    'white-space: nowrap',
    "font-family: var(--font-serif)",
    'font-size: 24px',
    'font-weight: 400',
    'line-height: 1.15',
    'letter-spacing: -0.01em',
  ].join('; ');
  document.body.appendChild(mirror);
  return mirror;
}
```

Per-word measurement: set `mirror.textContent = word`, set `mirror.style.fontStyle = isEm ? 'italic' : 'normal'`, read `mirror.getBoundingClientRect().width`. Space width measured once.

This accounts for `letter-spacing`, kerning, font features — everything that affects how the engine paints the word. Each engine measures with its own paint pipeline → each engine produces a layout that lines up exactly with what it will paint.

### Layout

**Source layout (rest):** flow words left-to-right within `sourceWidth = cardRect.width - bodyPadX`. Each word's `(sx, sy)` is its natural-flow position. Lines wrap when next word exceeds available width.

**Modal layout (expanded):** flow words left-to-right within `modalWidth = viewportRect.width - modalPadX`. After flow, center each line:

```
mx = naturalX + (modalWidth - lineWidth) / 2
my = line * lineHeight   // unchanged
```

Source positions are NOT re-centered — resting cards look identical to today.

### Container CSS contract (when `.pretext-title`)

```css
.bento-card.pretext-title .card-title {
  position: relative;
  width: 100%;
  /* No font-size: 0, no min-height — flex-shrink: 0 (already in place) keeps inline style.height intact. */
}
.bento-card.pretext-title.is-expanded .card-title {
  /* Override parent's translate(var(--title-center-x), 0). Words handle X. */
  transform: translateY(0);
}
.bento-card.pretext-title .card-title .word {
  position: absolute;
  top: 0; left: 0;
  display: inline-block;
  white-space: nowrap;
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--ink);
  transform-origin: top left;
  will-change: transform;
}
.bento-card.pretext-title .card-title em.word {
  font-style: italic;
  color: var(--accent);
}
.bento-card.is-expanding.pretext-title .card-title .word {
  transition: transform var(--morph-dur) var(--ease-snappy);
}
@media (prefers-reduced-motion: reduce) {
  .bento-card.is-expanding.pretext-title .card-title .word {
    transition: none;
  }
}
```

### Transform ownership

- **At rest:** `.card-title { transform: translate(0, var(--title-rest-y)) }` translates the entire title block vertically to body-center. Words sit at natural-flow positions within the block.
- **Expanded:** `.card-title { transform: translateY(0) }` (override). Words translate to centered modal positions via their own transforms.
- **During morph:** `.is-expanding .card-title { transition: transform var(--morph-dur) ... }` runs the container's translateY in lockstep with each word's transition.

Container transform: vertical only.
Word transforms: horizontal centering + line break delta.

### `syncTitleRestY()` integration

```ts
function syncTitleRestY(card: HTMLElement): void {
  if (!card.classList.contains('cs-card')) return;
  // ... existing mid-lifecycle early returns
  // ... existing rest-y calculation (uses titleRect.height which now reflects pretext's inline style.height)
  card.style.setProperty('--title-rest-y', `${yOffset}px`);

  if (card.classList.contains('pretext-title')) {
    // Words own horizontal centering; container's center-x is 0.
    card.style.setProperty('--title-center-x', '0px');
    return;
  }
  // ... existing centerX calculation
}
```

### Accessibility

In `src/components/BentoCard.astro`, add to the card button:

```astro
<button
  type="button"
  class="bento-card cs-card"
  data-bento-card
  data-deepwiki-url={deepwikiUrl}
  aria-expanded="false"
  aria-haspopup="dialog"
  aria-label={titleToText(title)}
>
```

`titleToText(title)` returns the plain text without `*` markers (already exists in `src/lib/title.ts`). The card's accessible name becomes the readable title even when the visible title is replaced with absolute word spans.

### Lifecycle hooks

```ts
// init() — after document.fonts.ready
if (document.fonts?.check('24px Fraunces')) {
  document.querySelectorAll<HTMLElement>('.cs-card[data-bento-card]')
    .forEach(pretextRenderCard);
}
syncAllTitleRestY();

// openCaseStudy() — in same RAF as setting modal target rect
if (card.classList.contains('pretext-title')) {
  pretextAnimateCard(card, true);
}

// closeCaseStudy() — before adding .is-collapsing
if (card.classList.contains('pretext-title')) {
  pretextAnimateCard(card, false);
}

// onResize() — re-measure idle cards only
document.querySelectorAll<HTMLElement>('.cs-card[data-bento-card]').forEach(card => {
  if (card.classList.contains('is-expanding') ||
      card.classList.contains('is-expanded') ||
      card.classList.contains('is-collapsing')) return;
  pretextRenderCard(card);
});
syncAllTitleRestY();
```

### Kill switch

```ts
// src/scripts/pretext.ts
export const PRETEXT_ENABLED = true;

export function pretextRenderCard(card: HTMLElement): void {
  if (!PRETEXT_ENABLED) return;
  // ...
}
```

Setting to `false` short-circuits all rendering. Cards revert to current natural-flow title behavior. One-line revert if iOS regresses again.

## Failure modes

| Failure | Mitigation |
|---|---|
| Fraunces not loaded at measurement | Gate on `document.fonts.ready` + `document.fonts.check('24px Fraunces')`. If false, skip pretext; title flows as natural text (current state). |
| Card width 0 at init (offscreen / detached) | `pretextRenderCard` early-returns if `sourceWidth ≤ 0`. |
| Card resized during morph | Lifecycle-state guard skips re-measurement. |
| `prefers-reduced-motion` enabled | CSS media query disables word transition. JS still sets final word transforms, so positions are correct — only the interpolation is skipped. |
| iOS toggle shifts again | `flex-shrink: 0` on header siblings is the gate. If it still happens, set `PRETEXT_ENABLED = false`. |
| Mirror element measurement off | Mirror has explicit inline CSS matching title's text-rendering. Both engines respect their own paint pipeline. |
| Multi-word `*accent*` (e.g. `*electric motors*`) | DOM walk preserves em ancestry; each word individually marked `isEm: true`. Multi-word em renders correctly because each word is its own absolute span. |
| Stack card affected | Walker selects `.cs-card[data-bento-card]` only. Stack card is `[data-bento-card]` without `.cs-card`. |

## Non-goals (explicit)

- RTL / CJK / Thai script handling. Whitespace splitting is sufficient for current English titles. If i18n becomes a requirement, this module needs `Intl.Segmenter` + computed `direction` handling — a separate redesign.
- `visualViewport.resize` listener. Modal rect uses `window.innerWidth`/`window.innerHeight`; visual viewport changes (iOS address bar) don't affect Pretext-relevant geometry (width-only).
- Dynamic title content. Titles are baked into MD frontmatter at build time. No runtime title mutation supported.
- Cleanup on DOM removal. Cards aren't removed in this site's lifecycle; if they were, a per-card `MutationObserver` or `removeChild` hook would be needed. Out of scope.

## Acceptance criteria

1. **Idle visual unchanged.** Each `.cs-card` at rest looks identical to the current `da641ee` baseline. Verified by screenshot diff.
2. **Smooth expand morph.** Long-title cards (Yolo) show word-level slide; no visible wrap snap mid-morph.
3. **Smooth close morph.** Words return to source positions; no flicker.
4. **TL;DR ↔ Detailed toggle stable.** No positional shift on title/pill in Chromium AND iOS Safari.
5. **Accessible name preserved.** Card button announces "Vision pipeline for edge inference" (etc.) in VoiceOver / screen reader.
6. **`prefers-reduced-motion` respected.** Words appear at correct final positions instantly; no transition.
7. **Cross-engine parity.** Chromium desktop, Chromium mobile emulation, Safari macOS, iOS Safari (real device via LAN) all render visually equivalent results.
8. **Stack card untouched.** Tools/skills bento card behavior is identical pre/post change.

## Open questions for user

1. Is `aria-label` on the card button sufficient, or should we also add a visually-hidden `<span class="sr-only">{titleToText(title)}</span>` inside the title for cases where the user inspects the title element directly?
2. Kill-switch convention: keep `PRETEXT_ENABLED` as a const at top of `pretext.ts`, or wire it to an env / build flag (`import.meta.env.PUBLIC_PRETEXT_ENABLED`)?
3. Should the implementation plan be Codex-reviewed before tasks are dispatched, or only the spec?
