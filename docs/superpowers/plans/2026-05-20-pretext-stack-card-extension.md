# Pretext Stack-Card Extension — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Pretext per-word title morph to the stack card (`.stack-card`), preserving its current visual contract: title stays left-aligned at rest AND in modal, subtitle (`.card-text`) remains below the title in both states. Smallest scope of three options considered; user-selected on 2026-05-20.

**Architecture:** Generalize the existing `pretext.ts` module's `.cs-card` gate to include `.stack-card`. Read font-size dynamically from each title element instead of using a hardcoded `TITLE_FONT_SIZE = 24`. Branch on card type for one decision: project cards center their modal title positions; stack card does NOT (keeps left-aligned). All other Pretext infrastructure (DOM mirror measurement, word DOM mutation, animate hooks, kill switch) stays intact.

**Tech Stack:** TypeScript (Astro v6 client scripts), CSS-in-Astro `<style>` blocks.

**Visible payoff:** Mobile wrap-reflow on `Tools I *actually* reach for` smoothed during expand/close. On desktop where the title fits one line both at rest and in modal, the change is a no-op visually but the architecture matches.

---

## Constraints (driving requirements)

1. **Stack card resting visual unchanged.** Currently at rest: title at top-left of card-body, `Tools I` then italic accent `actually` then `reach for`, with `Languages, ML frameworks, infra.` subtitle on the next line. Must remain identical.
2. **Stack card modal title stays left-aligned.** No horizontal centering. (Project cards still center.)
3. **No regression on project-card Pretext behavior.** Existing tests + verifications continue to pass.
4. **No regression on stack-card open/close lifecycle.** The recent perf wins (marquee pause, blur strip unmount, body fade loop drop) all stay.
5. **Both engines.** Chromium + WebKit (Safari macOS, iOS Safari) must produce visually equivalent results.

## Codex pre-implementation review

Per global CLAUDE.md, work introducing new branching logic should be Codex-reviewed before code touches disk. The decisions to validate:

- **Font-size dynamic read.** Switch from `TITLE_FONT_SIZE = 24` to per-card `parseFloat(getComputedStyle(titleEl).fontSize)`. Affects mirror element CSS (font-size match for accurate measurement), `lineHeight = fontSize * TITLE_LINE_HEIGHT_RATIO`, and the `.word` CSS (must inherit from parent title instead of hardcoded 24px).
- **Centering decision.** Project cards run `pretextCenterPositions` on modal layout; stack card doesn't. Branch on `card.classList.contains('cs-card')`. Alternative: card-shape data attribute. Codex's call.
- **CSS contract.** `.pretext-title .card-title { width: 100% }` applies to both card types. Stack card title at modal had `transform: none`; Pretext's `.pretext-title.is-expanded .card-title { transform: translateY(0) }` would override that with the same effective result (no translate). Verify no specificity conflict.
- **The mirror element font-size.** Currently created once with hardcoded `24px`. With dynamic font-size, the mirror needs re-styling per measurement OR per-card mirror instances. Per-render restyle is cheaper.

---

## File Structure

| File | Change |
|---|---|
| `src/scripts/pretext.ts` | Read `fontSize` from `titleEl` per call. Restyle mirror per call. Branch `pretextCenterPositions` on card type. Generalize scope guards from `.cs-card` to also accept `.stack-card`. |
| `src/components/BentoGrid.astro` | `.word` font-size → `inherit` (from parent `.card-title`) instead of hardcoded `24px`. Verify the rest of `.pretext-title` CSS works on both card types. |
| `src/components/BentoStackCard.astro` | If specificity needs adjustment, add a `.stack-card.pretext-title.is-expanded .card-title { transform: translateY(0) }` override (identical visual effect to `transform: none`, but consistent with Pretext's title-block translate model). |

---

## Tasks

### Task 1: Make Pretext font-size dynamic + accept `.stack-card`

**Files:**
- Modify: `src/scripts/pretext.ts`

- [ ] **Step 1: Replace the hardcoded `TITLE_FONT_SIZE` with a per-render value**

In `pretext.ts`, the constant `const TITLE_FONT_SIZE = 24;` becomes a measured-per-call value. The places it's used:
1. Mirror element CSS (font-size match for accurate width measurement)
2. Line-height computation
3. Title height inline style at end of `pretextRenderCard`

`pretextRenderCard` reads the title's computed font-size:
```ts
const fontSize = parseFloat(getComputedStyle(titleEl).fontSize) || 24;
```
and passes it to `pretextMeasureWords(words, fontSize)`. The signature changes to accept the font size; the function sets `mirror.style.fontSize` ONCE at the top (alongside the existing space-width measurement setup), not per word. Per Codex's Q9: per-word mutation is only needed for `fontStyle` (italic toggle).

`pretextRenderCard` also uses `fontSize` in place of `TITLE_FONT_SIZE` when computing `lineHeight` and the inline `titleEl.style.height`.

- [ ] **Step 2: Generalize the scope guard**

Change:
```ts
if (!card.classList.contains('cs-card')) return;
```
to:
```ts
if (!card.classList.contains('cs-card') && !card.classList.contains('stack-card')) return;
```

Apply this in both `pretextRenderCard` and `pretextRenderAll` (the latter's `querySelectorAll`).

`pretextRenderAll`'s selector:
```ts
document.querySelectorAll<HTMLElement>('.cs-card[data-bento-card]').forEach((card) => {
```
becomes:
```ts
document.querySelectorAll<HTMLElement>(':is(.cs-card, .stack-card)[data-bento-card]').forEach((card) => {
```

- [ ] **Step 3: Branch the centering for modal positions**

In `pretextRenderCard`:
```ts
const modalPositions = pretextCenterPositions(
  modalLayout.positions,
  modalLayout.lineWidths,
  modalWidth,
);
```

becomes:
```ts
const modalPositions = card.classList.contains('cs-card')
  ? pretextCenterPositions(
      modalLayout.positions,
      modalLayout.lineWidths,
      modalWidth,
    )
  : modalLayout.positions;
```

Stack card uses natural-flow left-aligned positions at modal too. Source layout was already left-aligned for both (already not centered).

- [ ] **Step 4: Verify types**

Run: `npm run check`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/scripts/pretext.ts
git commit -m "$(cat <<'EOF'
Generalize pretext: dynamic font-size, accept stack-card

Replaces hardcoded TITLE_FONT_SIZE=24 with per-render
parseFloat(getComputedStyle(titleEl).fontSize). The stack card's
title uses clamp(1.5rem, 1vw + 1rem, 1.75rem) — Pretext now measures
each card with its actual rendered font-size.

Adds .stack-card to the scope (was .cs-card-only). Stack card keeps
its left-aligned modal title via skipping the pretextCenterPositions
call — project cards still center.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: CSS adjustments for shared `.pretext-title` rules

**Files:**
- Modify: `src/components/BentoGrid.astro`
- Possibly: `src/components/BentoStackCard.astro`

- [ ] **Step 1: Update `.word` font-size to inherit**

In `BentoGrid.astro`, the `.bento-card.pretext-title .card-title .word` rule currently has:
```css
font-size: 24px;
```

Change to:
```css
font-size: inherit;
```

The `.card-title` parent has its own font-size (24px for project cards, clamp() for stack card). Words inherit.

Same for `line-height`:
```css
line-height: 1.15;
```
stays — both cards use 1.15. No change needed there.

- [ ] **Step 2: Test if `.stack-card` needs the `.is-expanded` transform override**

CSS specificity check:
- `.bento-card.pretext-title.is-expanded .card-title` — (0,4,0)
- `.bento-card.stack-card .card-title { transform: none }` — (0,3,0)

Pretext's rule wins; it sets `transform: translateY(0)`. For the stack card we want no translate. `translateY(0)` is the same visual as `transform: none` for layout purposes — both prevent vertical shift. Should be a no-op visually.

If a subtle issue surfaces (e.g. compositing layer change), add:
```css
:global(.bento-card.stack-card.pretext-title.is-expanded .card-title) {
  transform: none;
}
```
specificity (0,4,0), tied with Pretext's rule but later in cascade order via the BentoStackCard.astro scoped style ordering.

- [ ] **Step 3: Verify**

Run: `npm run check`. Then manually expand the stack card in Chrome via chrome-devtools-mcp:
- Title appears at top-left at its computed font-size (matches the `clamp()` value for the current viewport — no visible font-size change vs. baseline).
- Words render with correct italic on "actually" (accent color preserved).
- Subtitle "Languages, ML frameworks, infra." stays left-aligned at modal (preserved via existing `.stack-card .card-body { text-align: left }` rule overriding `.is-expanded .card-body { text-align: center }` by cascade order).
- Open + close run without jank.

- [ ] **Step 4: Commit**

```bash
git add src/components/BentoGrid.astro src/components/BentoStackCard.astro
git commit -m "$(cat <<'EOF'
Make .pretext-title .word font-size inherit from parent title

Pretext's word spans previously hardcoded font-size: 24px. With
.stack-card now in scope (which uses clamp(1.5rem, 1vw + 1rem,
1.75rem)), words need to inherit their parent title's font-size
to render at the correct size.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Cross-browser verification

- [ ] **Step 1: Chrome desktop**

Manual: load homepage, expand stack card, close. Title should morph smoothly. Inspect `.pretext-title` class on stack card (should be present). Inspect `.word` elements (should have correct font-size from inherit).

- [ ] **Step 2: Chrome mobile emulation (clamped at 500px)**

Same checks. Watch for any visual regressions on the resting card.

- [ ] **Step 3: User-driven Safari + iOS Safari verification**

Run `npm run dev:lan`. User opens http://localhost:4321/ on Safari Mac and http://192.168.1.65:4321/ on iOS Safari. Verify:
- Resting stack card looks identical to current branch.
- Expand: smooth title morph (or no-op if title fits same way at rest+modal — that's fine).
- Close: smooth reverse morph.
- TL;DR ↔ Detailed toggle: no positional shift.
- Project cards still work as before.

- [ ] **Step 4: Push**

```bash
git push origin editorial-redesign
```

---

## Rollback strategy

The kill switch (`PRETEXT_ENABLED = false` in `pretext.ts`) disables Pretext entirely — for BOTH card types. There's no per-card-type kill switch. If only the stack card regresses, revert Task 1's scope guard generalization (change `:is(.cs-card, .stack-card)` back to `.cs-card`).

Full revert (if both card types regress somehow): `git revert <commit-range>` over Tasks 1 and 2.

---

## Self-review checklist (run before dispatching to implementer)

1. **Spec coverage:** Three constraints (resting visual unchanged, modal stays left-aligned, no project-card regression) → handled by left-aligned source AND left-aligned modal (skip centering for stack card). ✓
2. **No placeholders:** Every code block is concrete. ✓
3. **Type consistency:** `pretextMeasureWords` signature changes (gains `fontSize` parameter). Callers updated in same task. ✓
4. **Cross-engine plan:** Task 3 covers Chromium + WebKit. User-driven for Safari. ✓
5. **Reversibility:** Kill switch covers both. Scope-guard revert is two-line. ✓
