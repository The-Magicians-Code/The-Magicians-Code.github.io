# Pretext Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reintroduce per-word title morph animation on `.cs-card` case-study cards, addressing all Codex-flagged design issues from the spec at [docs/superpowers/specs/2026-05-20-pretext-redesign-design.md](../specs/2026-05-20-pretext-redesign-design.md).

**Architecture:** New `src/scripts/pretext.ts` module owns measurement + layout + DOM mutation. `bento-expand.ts` orchestrates lifecycle. CSS scaffolding in `BentoGrid.astro`. Accessibility fix in `BentoCard.astro`. Source layout left-aligned (preserves idle visual), modal layout centered. DOM-mirror measurement (not Canvas) accounts for `letter-spacing`.

**Tech Stack:** TypeScript (Astro v6 client scripts), CSS-in-Astro `<style>` blocks, Vite bundling.

**Verification model:** This project has no automated tests (per [CLAUDE.md](../../../CLAUDE.md)). Each task's verification = `npm run check` for type/syntax + manual browser check (Chrome via chrome-devtools-mcp, then explicit Safari/iOS confirm per [feedback_cross_browser_parity.md](../../../memory/feedback_cross_browser_parity.md) — though that path is in user memory, not the repo).

---

## File Structure

| File | Change |
|---|---|
| `src/scripts/pretext.ts` | **NEW.** Self-contained measurement + layout + DOM mutation module. ~180 LOC. |
| `src/components/BentoGrid.astro` | Add `.pretext-title` + `.word` CSS scaffolding. |
| `src/components/BentoCard.astro` | Add `aria-label={titleToText(title)}` to the card button. |
| `src/scripts/bento-expand.ts` | Import pretext, call from init / open / close / resize. Branch `syncTitleRestY` for pretext cards. |

---

### Task 1: Create `src/scripts/pretext.ts`

**Files:**
- Create: `src/scripts/pretext.ts`

- [ ] **Step 1: Create the module with all helpers in one file**

```ts
// src/scripts/pretext.ts
// Per-word title morph animation for .cs-card case-study cards.
// Replaces the title's text with absolutely-positioned word spans
// pre-computed at TWO widths (card rest + modal expanded). Each span
// carries data-sx/sy/mx/my so the open / close lifecycle hooks can
// translate between them without re-measuring.
//
// Design spec: docs/superpowers/specs/2026-05-20-pretext-redesign-design.md
//
// Measurement uses a hidden DOM mirror (not Canvas) so CSS letter-spacing,
// kerning, and font features are all accounted for. Each engine measures
// with its own paint pipeline → engine-local layouts that line up exactly
// with what each engine paints.

export const PRETEXT_ENABLED = true;

interface WordWithEm {
  word: string;
  isEm: boolean;
}

interface WordMetric {
  word: string;
  width: number;
  spaceWidth: number;
  isEm: boolean;
}

interface WordPosition {
  word: string;
  x: number;
  y: number;
  line: number;
  isEm: boolean;
}

interface LayoutResult {
  positions: WordPosition[];
  lineWidths: number[];
}

const TITLE_FONT_SIZE = 24;
const TITLE_LINE_HEIGHT_RATIO = 1.15;
const MIRROR_ID = 'pretext-mirror';

function getMirror(): HTMLSpanElement {
  const existing = document.getElementById(MIRROR_ID) as HTMLSpanElement | null;
  if (existing) return existing;
  const mirror = document.createElement('span');
  mirror.id = MIRROR_ID;
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.cssText = [
    'position: fixed',
    'top: -9999px',
    'left: -9999px',
    'visibility: hidden',
    'pointer-events: none',
    'white-space: nowrap',
    "font-family: var(--font-serif)",
    `font-size: ${TITLE_FONT_SIZE}px`,
    'font-weight: 400',
    `line-height: ${TITLE_LINE_HEIGHT_RATIO}`,
    'letter-spacing: -0.01em',
  ].join('; ');
  document.body.appendChild(mirror);
  return mirror;
}

function extractWordsWithEm(el: HTMLElement): WordWithEm[] {
  const result: WordWithEm[] = [];
  const walk = (node: Node, inEm: boolean): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      for (const word of text.split(/\s+/).filter(Boolean)) {
        result.push({ word, isEm: inEm });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const isInEm = inEm || (node as Element).tagName === 'EM';
      for (const child of Array.from(node.childNodes)) {
        walk(child, isInEm);
      }
    }
  };
  walk(el, false);
  return result;
}

function pretextOriginalWords(titleEl: HTMLElement): WordWithEm[] {
  if (titleEl.dataset.pretextWords) {
    try {
      const parsed = JSON.parse(titleEl.dataset.pretextWords) as WordWithEm[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through and re-extract */
    }
  }
  const words = extractWordsWithEm(titleEl);
  titleEl.dataset.pretextWords = JSON.stringify(words);
  return words;
}

function pretextMeasureWords(words: WordWithEm[]): WordMetric[] {
  const mirror = getMirror();
  mirror.style.fontStyle = 'normal';
  mirror.textContent = ' ';
  const spaceWidth = mirror.getBoundingClientRect().width;
  return words.map((w) => {
    mirror.style.fontStyle = w.isEm ? 'italic' : 'normal';
    mirror.textContent = w.word;
    return {
      word: w.word,
      width: mirror.getBoundingClientRect().width,
      spaceWidth,
      isEm: w.isEm,
    };
  });
}

function pretextLayout(words: WordMetric[], maxWidth: number, lineHeight: number): LayoutResult {
  const positions: WordPosition[] = [];
  const lineWidths: number[] = [];
  if (words.length === 0) return { positions, lineWidths };
  let x = 0;
  let line = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (x > 0 && x + w.width > maxWidth) {
      lineWidths[line] = positions[positions.length - 1].x + words[i - 1].width;
      line++;
      x = 0;
    }
    positions.push({ word: w.word, x, y: line * lineHeight, line, isEm: w.isEm });
    x += w.width + w.spaceWidth;
  }
  lineWidths[line] = positions[positions.length - 1].x + words[words.length - 1].width;
  return { positions, lineWidths };
}

function pretextCenterPositions(
  positions: WordPosition[],
  lineWidths: number[],
  containerWidth: number,
): WordPosition[] {
  return positions.map((p) => ({
    ...p,
    x: p.x + (containerWidth - lineWidths[p.line]) / 2,
  }));
}

export interface ViewportRect {
  width: number;
}

// Render a single .cs-card's title with word spans + source-modal transforms.
// getViewportRect returns the modal's target rect (provided by bento-expand.ts).
export function pretextRenderCard(card: HTMLElement, getViewportRect: () => ViewportRect): void {
  if (!PRETEXT_ENABLED) return;
  if (!card.classList.contains('cs-card')) return;
  const titleEl = card.querySelector<HTMLElement>('.card-title');
  if (!titleEl) return;
  const words = pretextOriginalWords(titleEl);
  if (words.length === 0) return;

  const body = card.querySelector<HTMLElement>('.card-body');
  if (!body) return;
  const bodyStyles = getComputedStyle(body);
  const bodyPadX =
    (parseFloat(bodyStyles.paddingLeft) || 0) + (parseFloat(bodyStyles.paddingRight) || 0);
  const sourceWidth = card.getBoundingClientRect().width - bodyPadX;

  const vr = getViewportRect();
  const modalHPad = window.innerWidth <= 540 ? 22 : 48;
  const modalWidth = vr.width - modalHPad * 2;

  if (sourceWidth <= 0 || modalWidth <= 0) return;

  const metrics = pretextMeasureWords(words);
  if (metrics.length === 0) return;

  const lineHeight = TITLE_FONT_SIZE * TITLE_LINE_HEIGHT_RATIO;
  const sourceLayout = pretextLayout(metrics, sourceWidth, lineHeight);
  const modalLayout = pretextLayout(metrics, modalWidth, lineHeight);

  // Source positions are NOT centered — natural-flow left-aligned positions
  // preserve the resting visual (cards look identical to today at rest).
  const sourcePositions = sourceLayout.positions;
  const modalPositions = pretextCenterPositions(
    modalLayout.positions,
    modalLayout.lineWidths,
    modalWidth,
  );

  titleEl.replaceChildren();
  for (let i = 0; i < sourcePositions.length; i++) {
    const sp = sourcePositions[i];
    const mp = modalPositions[i];
    const el = document.createElement(sp.isEm ? 'em' : 'span');
    el.className = 'word';
    el.textContent = sp.word;
    el.style.transform = `translate(${sp.x.toFixed(2)}px, ${sp.y}px)`;
    el.dataset.sx = sp.x.toFixed(2);
    el.dataset.sy = String(sp.y);
    el.dataset.mx = mp.x.toFixed(2);
    el.dataset.my = String(mp.y);
    titleEl.appendChild(el);
  }

  // Title container must be tall enough to hold the taller of the two layouts.
  const sourceMaxLine =
    sourceLayout.positions.length > 0
      ? sourceLayout.positions[sourceLayout.positions.length - 1].line
      : 0;
  const modalMaxLine =
    modalLayout.positions.length > 0
      ? modalLayout.positions[modalLayout.positions.length - 1].line
      : 0;
  const tallestLine = Math.max(sourceMaxLine, modalMaxLine);
  titleEl.style.height = `${(tallestLine + 1) * lineHeight}px`;

  card.classList.add('pretext-title');
}

// Animate all .word spans on a single card between source and modal positions.
// Called from the open / close morph lifecycle in bento-expand.ts.
export function pretextAnimateCard(card: HTMLElement, toModal: boolean): void {
  card.querySelectorAll<HTMLElement>('.card-title .word').forEach((el) => {
    const x = toModal ? el.dataset.mx : el.dataset.sx;
    const y = toModal ? el.dataset.my : el.dataset.sy;
    if (x == null || y == null) return;
    el.style.transform = `translate(${x}px, ${y}px)`;
  });
}

// Re-measure every idle .cs-card. Skip cards mid-lifecycle (their geometry
// reflects the modal, not the rest position).
export function pretextRenderAll(
  getViewportRect: () => ViewportRect,
  skipCard?: HTMLElement | null,
): void {
  document.querySelectorAll<HTMLElement>('.cs-card[data-bento-card]').forEach((card) => {
    if (card === skipCard) return;
    if (
      card.classList.contains('is-expanding') ||
      card.classList.contains('is-expanded') ||
      card.classList.contains('is-collapsing')
    ) {
      return;
    }
    pretextRenderCard(card, getViewportRect);
  });
}
```

- [ ] **Step 2: Verify types compile**

Run: `npm run check`
Expected: PASS — 0 errors. (The 1 hint from `Nav.astro` re: `document.execCommand` is pre-existing and unrelated.)

- [ ] **Step 3: Commit**

```bash
git add src/scripts/pretext.ts
git commit -m "Add pretext module: per-word title layout for case-study cards

Self-contained measurement + layout + DOM mutation. DOM-mirror measurement
(not Canvas) so CSS letter-spacing is accounted for. Source layout
left-aligned (preserves resting visual), modal layout centered. Scoped to
.cs-card. No integration yet — that follows in subsequent commits.

Spec: docs/superpowers/specs/2026-05-20-pretext-redesign-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add `.pretext-title` + `.word` CSS scaffolding to `BentoGrid.astro`

**Files:**
- Modify: `src/components/BentoGrid.astro` (insert after the existing `.bento-card .card-title em` rule, around line 186)

- [ ] **Step 1: Locate the insertion point**

Find the `:global(.bento-card .card-title em)` rule (currently at `BentoGrid.astro:186-189`). Insert the new block immediately after the closing `}` of that rule.

- [ ] **Step 2: Add the CSS block**

```css
  /* ── Pretext: per-word title layout (for .cs-card only) ───────────────
     When pretext.ts runs at init, it replaces the title's text with
     absolutely-positioned <span class="word"> / <em class="word"> spans
     pre-computed at two widths (card rest + modal expanded). The card
     gets .pretext-title; these rules apply only once it's set.

     Idle visual is preserved: source positions are natural-flow
     left-aligned. Only the modal layout centers each line. */
  :global(.bento-card.pretext-title .card-title) {
    position: relative;
    width: 100%;
    /* No font-size: 0, no min-height — flex-shrink: 0 on header
       siblings (already in place) keeps the inline style.height
       intact under iOS Safari's flex algorithm. */
  }
  :global(.bento-card.pretext-title .card-title .word) {
    position: absolute;
    top: 0;
    left: 0;
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
  /* Accent words render as <em class="word"> so .card-title em styling
     applies via the existing rule. Pin specificity here in case the
     plain .word color rule wins under cascade tie. */
  :global(.bento-card.pretext-title .card-title em.word) {
    font-style: italic;
    color: var(--accent);
  }
  /* During the morph, each word transitions between its source and
     modal transforms in lockstep with the card morph. */
  :global(.bento-card.is-expanding.pretext-title .card-title .word) {
    transition: transform var(--morph-dur) var(--ease-snappy);
  }
  /* When expanded, words own horizontal centering (their target mx
     positions already include the modal-width centering offset).
     Override the parent's translate(var(--title-center-x), 0) — Y only. */
  :global(.bento-card.pretext-title.is-expanded .card-title) {
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.bento-card.is-expanding.pretext-title .card-title .word) {
      transition: none;
    }
  }
```

- [ ] **Step 3: Verify types + manual visual**

Run: `npm run check`
Expected: PASS.

Manual: load the dev server (`npm run dev`), open homepage in Chrome. No card has `.pretext-title` class yet (we haven't wired pretext.ts in), so the CSS is dead code. Idle visual MUST be identical to current state.

- [ ] **Step 4: Commit**

```bash
git add src/components/BentoGrid.astro
git commit -m "Scaffold .pretext-title CSS for per-word title layout

Adds .pretext-title + .word rules + is-expanded translate override
+ prefers-reduced-motion short-circuit. No card has the class yet
— wiring follows in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add `aria-label` to the card root in `BentoCard.astro`

**Files:**
- Modify: `src/components/BentoCard.astro`

> **Important:** the card root is `<article role="button">` (not `<button>`). `aria-label` goes on the article. The existing import line uses a relative path (`../lib/title`); there is no `~/` alias configured in `tsconfig.json` — use the same relative path for consistency.

- [ ] **Step 1: Extend the existing `titleToHtml` import to also pull in `titleToText`**

In the frontmatter at the top of `BentoCard.astro:2`, change:

```ts
import { titleToHtml } from '../lib/title';
```

to:

```ts
import { titleToHtml, titleToText } from '../lib/title';
```

- [ ] **Step 2: Add `aria-label={titleToText(title)}` to the `<article>` root**

The article at `BentoCard.astro:23-38` currently looks like:

```astro
<article
  class:list={[ ... ]}
  data-bento-card
  data-slug={slug}
  data-deepwiki-url={deepwikiUrl ?? undefined}
  role="button"
  tabindex="0"
  aria-haspopup="dialog"
  aria-expanded="false"
>
```

Add an `aria-label` attribute (place it adjacent to the other ARIA attributes for readability):

```astro
<article
  class:list={[ ... ]}
  data-bento-card
  data-slug={slug}
  data-deepwiki-url={deepwikiUrl ?? undefined}
  role="button"
  tabindex="0"
  aria-haspopup="dialog"
  aria-expanded="false"
  aria-label={titleToText(title)}
>
```

- [ ] **Step 3: Verify types + a11y tree**

Run: `npm run check`
Expected: PASS.

Manual: open Chrome DevTools → Accessibility tab → inspect the Yolo card root `<article>`. The accessible name should be "Vision pipeline for edge inference" (plain text, no markers).

- [ ] **Step 4: Commit**

```bash
git add src/components/BentoCard.astro
git commit -m "Set explicit aria-label on case-study card root

Card root <article role=\"button\">'s accessible name is currently
derived from descendant text. Future pretext.ts integration will
replace the title's text with absolute-positioned word spans;
without explicit aria-label the screen-reader name would degrade
to a run-on glyph stream. titleToText(title) gives the readable
plain-text title — independent of the visible DOM.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Branch `syncTitleRestY` for pretext cards

**Files:**
- Modify: `src/scripts/bento-expand.ts` (the `syncTitleRestY` function, around line 449)

- [ ] **Step 1: Locate the centerX calculation block in `syncTitleRestY`**

Find the section that computes `centerX` and calls `card.style.setProperty('--title-center-x', ...)`. At time of writing, this is around lines 480–491.

- [ ] **Step 2: Insert the pretext branch BEFORE the centerX calc**

Add immediately after `card.style.setProperty('--title-rest-y', ...)` and before the existing centerX block:

```ts
  card.style.setProperty('--title-rest-y', `${yOffset}px`);

  // For pretext cards, word transforms own horizontal centering — the
  // container's --title-center-x must be 0 so the title block doesn't
  // double-translate. The existing centerX math below would also
  // collapse anyway because .pretext-title sets width: 100%, making
  // titleRect.width = body width and centerX ≈ 0. Branch explicitly
  // for clarity.
  if (card.classList.contains('pretext-title')) {
    card.style.setProperty('--title-center-x', '0px');
    return;
  }

  // Horizontal center offset for the .is-expanded state. Title text doesn't
  // change between rest and expanded, so titleRect.width is stable. The
  // expanded body's inner width is derived from getViewportRect() ...
```

- [ ] **Step 3: Verify types**

Run: `npm run check`
Expected: PASS. No card has `.pretext-title` class yet so the branch is dead code; nothing visual changes.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/bento-expand.ts
git commit -m "Branch syncTitleRestY for pretext cards (--title-center-x: 0)

When pretext is active, word transforms own horizontal centering;
the title block's own --title-center-x must be 0 to avoid double
translation. Existing centerX math would collapse to ~0 anyway
under .pretext-title's width:100%, but explicit branch is clearer.
Dead code until pretext is wired in.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wire pretext into `bento-expand.ts` lifecycle

**Files:**
- Modify: `src/scripts/bento-expand.ts`

- [ ] **Step 1: Add import**

At the top of `bento-expand.ts` (after existing imports), add:

```ts
import {
  pretextRenderCard,
  pretextAnimateCard,
  pretextRenderAll,
  type ViewportRect,
} from './pretext';
```

- [ ] **Step 2: Confirm `getViewportRect` is available in the file**

`getViewportRect()` already exists in `bento-expand.ts` (called by the open morph). Confirm it returns `{ top, left, width, height }`. The pretext module only reads `.width`, so the existing signature is compatible.

- [ ] **Step 3: Wire `pretextRenderAll` into init (after fonts ready)**

Find the `measureWhenFontsReady` block in `init()`. Modify the `run` callback to also call `pretextRenderAll` before `syncAllTitleRestY`. Order matters: pretext sets each card's title height, and rest-y depends on that height.

Replace:
```ts
  const measureWhenFontsReady = (): void => {
    if (document.fonts?.ready) {
      document.fonts.ready.then(syncAllTitleRestY).catch(syncAllTitleRestY);
    } else {
      syncAllTitleRestY();
    }
  };
  measureWhenFontsReady();
```

With:
```ts
  const measureWhenFontsReady = (): void => {
    const run = (): void => {
      // Belt-and-suspenders: even after document.fonts.ready, double-check
      // Fraunces specifically. If not loaded, skip pretext entirely so
      // measurements don't fall back to Georgia metrics.
      if (document.fonts?.check?.('24px Fraunces')) {
        pretextRenderAll(getViewportRect);
      }
      syncAllTitleRestY();
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(run).catch(run);
    } else {
      run();
    }
  };
  measureWhenFontsReady();
```

- [ ] **Step 4: Wire `pretextAnimateCard(card, true)` into expand morph**

Find the RAF block in `openCaseStudy` that sets `card.style.top / left / width / height` (currently at `bento-expand.ts:262-269`). Add the pretext animate call inside the same RAF, AFTER the rect assignments:

```ts
  requestAnimationFrame(() => {
    card.style.transition = '';
    card.classList.add('is-expanded');
    card.style.top = `${vr.top}px`;
    card.style.left = `${vr.left}px`;
    card.style.width = `${vr.width}px`;
    card.style.height = `${vr.height}px`;
    // Animate pretext word spans to modal positions in lockstep with the morph.
    if (card.classList.contains('pretext-title')) {
      pretextAnimateCard(card, true);
    }
  });
```

- [ ] **Step 5: Wire `pretextAnimateCard(card, false)` into close morph**

Find `closeCaseStudy()`. After `card.blur()` and BEFORE `card.classList.add('is-collapsing')`, add:

```ts
  // Reverse pretext word transforms back to source positions. .is-expanding
  // is still on the card, so the transition rule animates the change.
  if (card.classList.contains('pretext-title')) {
    pretextAnimateCard(card, false);
  }
```

- [ ] **Step 6: Wire `pretextRenderAll` into resize handler**

Find `onResize()` (currently at `bento-expand.ts:504`). Inside its `requestAnimationFrame` callback at `:506`, add a pretext re-render BEFORE the existing `syncAllTitleRestY()`:

```ts
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;

    // Re-measure pretext for idle cards (their rest width changed with
    // the viewport via the 4:1 aspect ratio). Skip the open card —
    // its geometry reflects the modal, not the rest position.
    if (document.fonts?.check?.('24px Fraunces')) {
      pretextRenderAll(getViewportRect, openState?.card ?? null);
    }
    syncAllTitleRestY();

    if (!openState || openState.closing) return;
    // ... existing modal-snap-to-new-viewport logic
  });
```

- [ ] **Step 7: Wire `pretextRenderCard` into close cleanup (post-morph)**

Find the `doCleanup` block in `closeCaseStudy` (currently at `bento-expand.ts:386`). The relevant insertion point is inside its `requestAnimationFrame` callback (currently at `:413-428`), just before the existing `syncTitleRestY(card)` call at `:427`:

```ts
      card.classList.remove('is-expanding', 'is-collapsing', 'is-resizing');
      card.blur();
      // Re-measure pretext + rest-y in case viewport changed during the
      // open. Order matters: pretext sets the title height; rest-y
      // depends on that height.
      if (document.fonts?.check?.('24px Fraunces')) {
        pretextRenderCard(card, getViewportRect);
      }
      syncTitleRestY(card);
```

- [ ] **Step 8: Verify types + manual cross-engine check**

Run: `npm run check`
Expected: PASS.

Manual verification matrix:

| Engine | Idle visual | Expand morph | Close morph | TL;DR ↔ Detailed toggle | Resize |
|---|---|---|---|---|---|
| Chrome desktop (via chrome-devtools-mcp) | identical to baseline | smooth word slide | smooth reverse | no shift | re-measures |
| Chrome mobile emulation (390×844) | identical | smooth | smooth | no shift | re-measures |
| Safari macOS (user-driven) | identical | smooth | smooth | no shift | re-measures |
| iOS Safari via LAN URL (user-driven) | identical | smooth | smooth | **no shift** (the bug we're guarding against) | re-measures |

For each engine, also verify:
- VoiceOver / screen reader: card button announces "Vision pipeline for edge inference" (not the run-on form).
- macOS System Preferences → Accessibility → Reduce Motion ON: words appear at final positions instantly (no transition), morph still completes.

- [ ] **Step 9: Commit**

```bash
git add src/scripts/bento-expand.ts
git commit -m "Wire pretext into bento-expand lifecycle (init / open / close / resize)

Activates per-word title morph for case-study cards. Belt-and-suspenders
fonts.check('24px Fraunces') gate at each pretext call site so a Fraunces
load failure cleanly falls back to natural-flow titles instead of
measuring with Georgia metrics. Cross-engine verified: Chrome desktop +
mobile-emu, Safari macOS, iOS Safari via LAN.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Final cross-browser verification + push

- [ ] **Step 1: Run full verification matrix from Task 5 Step 8 one more time**

Specifically focus on the iOS Safari TL;DR ↔ Detailed toggle — this is the regression that originally killed Pretext. If it shifts, set `PRETEXT_ENABLED = false` in `pretext.ts` and re-verify that disables cleanly.

- [ ] **Step 2: Run `npm run build`**

Run: `npm run build`
Expected: build succeeds. Verifies the production bundle treeshakes pretext.ts correctly with Vite.

- [ ] **Step 3: Push the branch**

```bash
git push origin editorial-redesign
```

---

## Rollback strategy

If iOS regresses after merge:
1. Edit `src/scripts/pretext.ts`: change `export const PRETEXT_ENABLED = true;` to `false`.
2. Commit + push.
3. All cards revert to natural-flow titles (current `da641ee` baseline behavior). The `.pretext-title` class is never applied, all CSS scaffolding is dead.

Full revert (if the kill switch isn't enough): `git revert <commit-range>` from the most recent pretext commit back through Task 1.

---

## Self-review checklist (run before dispatching to implementer)

1. **Spec coverage:** Each spec section maps to a task above. The 8 Codex findings → response table in the spec is fully implemented (transform override in Task 2, source-left-aligned in Task 1, syncTitleRestY branch in Task 4, scope-tightened-to-`.cs-card` in Task 1's `pretextRenderAll`, etc.). ✓
2. **No placeholders:** Every code block is concrete. No "implement here." ✓
3. **Type consistency:** `ViewportRect` is exported from pretext.ts (Task 1) and imported in bento-expand.ts (Task 5). Function signatures match. ✓
4. **Verification:** Manual cross-engine matrix per task. No automated tests (consistent with project convention). ✓
5. **Reversibility:** Kill switch is one-line. ✓
