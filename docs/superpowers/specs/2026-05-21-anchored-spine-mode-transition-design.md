# Anchored-spine TL;DR ↔ Detailed mode transition

**Date:** 2026-05-21
**Touches:** [src/components/BentoGrid.astro](../../../src/components/BentoGrid.astro), [src/scripts/case-study-mode.ts](../../../src/scripts/case-study-mode.ts)
**Supersedes:** the cross-fade transition described in [docs/superpowers/specs/2026-05-19-case-study-dual-mode-design.md](2026-05-19-case-study-dual-mode-design.md)

## Problem

The current TL;DR ↔ Detailed swap fades the entire `.bento-card-body-rendered` wrap to `opacity: 0` over 160ms, flips `data-mode`, then fades back in over 160ms. Total ~320ms during which the whole body — including the H2 headings and section-leading blockquotes that exist in both modes — disappears and reappears. The mode swap reads as a hard cross-fade rather than a content reveal, and the screen recording at `docs/ideas/screeny.mov` shows a noticeably smoother target behavior where the H2 + blockquote "spine" stays solid and only the detail-only prose animates around it.

## Goal

Detail-only content fades in/out around an unflinching spine. The spine still physically moves (less vertical space between H2s in TL;DR mode, more in Detailed), but the move happens while detail content is invisible — the user never sees a spine element fade or flicker.

## Non-goals

- **Spine motion is not animated.** The H2s and blockquotes snap to their new positions inside the opacity-0 frame of the leaving animation. If the snap reads as jarring in practice, the hybrid path is a follow-up (FLIP-based smooth spine motion), not this change.
- **No per-element stagger.** All detail elements share one animation; they appear/disappear as a group.
- **No mask-gradient wipe.** The video shows hints of one; out of scope for this iteration.
- **No CSS view-transitions API.** Chromium-only; Safari parity is a first-class requirement for this site.

## Behavior

### Spine and detail, defined

- **Spine:** every `<h2>` in `.bento-card-body-rendered`, plus the immediately-following `<blockquote>` (the section's leading TL;DR line). Always visible in both modes. Never animated.
- **Detail:** every sibling that comes after a spine pair and is *not* itself an `<h2>` or `<blockquote>`. Hidden via `display: none` in TL;DR mode (current rule, unchanged). Animated in/out on mode change.

Selector for detail elements: `.bento-card-body-rendered[data-mode="detailed"] h2 + blockquote ~ *:not(h2):not(blockquote)`. Mirrors the existing hide selector at [src/components/BentoGrid.astro:610](../../../src/components/BentoGrid.astro#L610).

### Forward (TL;DR → Detailed)

1. `setActive('detailed')` fires on click.
2. Pill thumb moves immediately (existing squash-stretch keyframe, unchanged).
3. Any leftover `.cs-mode-leaving` class is removed (defensive against rapid re-toggle).
4. `.cs-mode-entering` class is added **before** `data-mode` flips, in the same synchronous tick. Both mutations happen before the next paint, so the browser sees the combined state on first composite: detail elements are `display: block`, the entering selector matches, and the keyframe starts at frame 0 with `opacity: 0; transform: translateY(-4px)`.
5. `data-mode="detailed"` applied. Detail elements flip from `display: none` to `display: block`; spine reflows into Detailed positions.
6. CSS runs the `cs-detail-enter` keyframe on detail elements: `opacity: 0 → 1`, `transform: translateY(-4px) → none`, 220ms, `ease-out`.
7. On `animationend` (or 260ms fallback timeout, whichever fires first), `.cs-mode-entering` is removed.

### Reverse (Detailed → TL;DR)

1. `setActive('tldr')` fires on click.
2. Pill thumb moves immediately.
3. Any leftover `.cs-mode-entering` class is removed (defensive against rapid re-toggle).
4. `.cs-mode-leaving` class applied to wrap **while `data-mode` is still `"detailed"`**. CSS runs `cs-detail-leave` keyframe on detail elements: `opacity: 1 → 0`, `transform: none → translateY(-4px)`, 180ms, `ease-in`, `forwards`.
5. On `animationend` (or 220ms fallback timeout):
   - Scroll-reset the modal scroll container to top (preserved from current code; necessary because the Detailed→TL;DR layout shift can otherwise read as a jump).
   - Apply `data-mode="tldr"` — detail elements `display: none`, spine reflows to TL;DR positions.
   - Remove `.cs-mode-leaving`.

In both directions, the `animationend` handler is registered once with `{ once: true }` and the fallback timeout clears itself when the listener fires; if the timeout fires first (animation suppressed by reduced-motion, or `animationend` swallowed by Safari mid-display-flip), the cleanup still runs. `wrap.isConnected` is checked at the top of the cleanup — if the modal closed mid-transition, the callback bails without touching detached DOM.

### Reduced motion

`@media (prefers-reduced-motion: reduce)` zeros both keyframes' durations (effectively instant swap). The class-add / class-remove sequence still runs but the user perceives an immediate flip.

## Implementation

### CSS — `BentoGrid.astro`

**Keep:**

- The wrap-level `transition: opacity 160ms ease-out; will-change: opacity; transform: translateZ(0)` block at [src/components/BentoGrid.astro:588-597](../../../src/components/BentoGrid.astro#L588-L597).
- The `.bento-card-body-rendered.is-swapping { opacity: 0 }` rule at [src/components/BentoGrid.astro:598-600](../../../src/components/BentoGrid.astro#L598-L600).

These are *also* used by [src/scripts/bento-expand.ts:242,278](../../../src/scripts/bento-expand.ts#L242) to fade the body in on card-open (mounts at `opacity:0` via `.is-swapping`, then removes class to trigger the wrap-level transition). Out of scope here — leaving the open-card fade pattern untouched.

**Add:**

```css
@keyframes cs-detail-enter {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
@keyframes cs-detail-leave {
  from { opacity: 1; transform: none; }
  to   { opacity: 0; transform: translateY(-4px); }
}

.bento-card-body-rendered.cs-mode-entering[data-mode="detailed"]
  h2 + blockquote ~ *:not(h2):not(blockquote) {
  animation: cs-detail-enter 220ms ease-out both;
}
.bento-card-body-rendered.cs-mode-leaving[data-mode="detailed"]
  h2 + blockquote ~ *:not(h2):not(blockquote) {
  animation: cs-detail-leave 180ms ease-in forwards;
}

@media (prefers-reduced-motion: reduce) {
  .bento-card-body-rendered.cs-mode-entering[data-mode="detailed"]
    h2 + blockquote ~ *:not(h2):not(blockquote),
  .bento-card-body-rendered.cs-mode-leaving[data-mode="detailed"]
    h2 + blockquote ~ *:not(h2):not(blockquote) {
    animation: none;
  }
}
```

The `:global(...)` wrapping required by Astro's scoped-style rules is applied identically to the existing selectors in this file.

### JS — `case-study-mode.ts`

Rewrite the body of `setActive(next)` (current implementation at [src/scripts/case-study-mode.ts:87-126](../../../src/scripts/case-study-mode.ts#L87-L126)):

- Move the pill-thumb state changes (`root.dataset.active`, `aria-selected`, `tabIndex`, `aria-labelledby`, `writeMode`) to the top — they happen identically on both forward and reverse.
- Branch on direction:
  - **Forward (going to `'detailed'`):** apply `data-mode = next` immediately, add `.cs-mode-entering`, set a 260ms timeout (and `animationend` listener — whichever fires first) to remove `.cs-mode-entering`.
  - **Reverse (going to `'tldr'`):** add `.cs-mode-leaving` while `data-mode` is still `"detailed"`, set a 220ms timeout / `animationend` listener that scroll-resets, applies `data-mode = next`, and removes `.cs-mode-leaving`.
- Both branches must defensively check `wrap.isConnected` before touching the wrap inside the callback — preserved from current code; protects against modal close mid-transition.

`SWAP_OUT_MS` constant is removed (replaced by per-direction inline values, since the durations now differ).

### Removed code

- `wrap.classList.add('is-swapping')` / `wrap.classList.remove('is-swapping')` calls in `setActive` only — the CSS rules stay (still used by `bento-expand.ts` for the open-card fade).
- `SWAP_OUT_MS` constant in `case-study-mode.ts`.
- The accompanying `setTimeout(..., SWAP_OUT_MS)` block in `setActive`, replaced by the per-direction animationend + fallback-timeout flow.

## Acceptance

- TL;DR ↔ Detailed swap shows detail content fading in/out while H2 + blockquote spine stays solid (no opacity/transform applied to spine).
- `prefers-reduced-motion: reduce` produces an instant swap with no visible animation.
- Modal close mid-transition (Escape during a fade) does not throw or leave residual classes — the `isConnected` guard short-circuits cleanly.
- `npm run check` and `npm run build` pass clean. `is-swapping` is still used by `bento-expand.ts` (open-card fade) but no longer referenced by `case-study-mode.ts`.
- Chrome (via DevTools MCP) renders the new transition; manual Safari check confirms compositor-only properties (opacity, transform) animate smoothly without the prior `translateZ(0)` workaround.

## Open questions

None at design time. Timing values (220ms / 180ms) and translate distance (4px) are starting points and can be tuned post-implementation by editing two constants; structure doesn't change.

---

## Addendum (2026-05-21): Smooth spine motion via FLIP

The original spec listed "spine motion is not animated" as a non-goal and noted FLIP as a follow-up. After shipping the snap-spine version, the H2 + blockquote "jump" at the layout-change moment in each direction was perceptible enough to revisit. This addendum supersedes that non-goal and the related acceptance line.

**Behavior change:** Spine elements (every `h2` plus the immediately-following `blockquote`) slide smoothly to their new layout positions on every mode swap, in parallel with the detail-element fade. Implemented via FLIP: measure positions before swap, apply swap, measure after, invert the delta as an inline `transform: translateY(...)`, then animate transform back to zero over 240ms with `ease-out`.

**Implementation:** A `flipSpine(applySwap, durationMs, easing)` helper closed over `wrap` and a `pendingFlipCancel` handle inside `buildPillToggle`. Both `setActive` branches wrap their layout-mutating ops in `flipSpine`. The reverse branch keeps the `scrollTo({top: 0})` call **outside** `flipSpine` so the FLIP delta reflects layout-only motion, not the scroll distance.

**Notable details:**

- **Reduced-motion early-exit.** Inline `style.transition` would otherwise bypass the existing CSS `prefers-reduced-motion` block. `flipSpine` checks `matchMedia('(prefers-reduced-motion: reduce)').matches` at entry and short-circuits to a synchronous `applySwap()` with no inline styles applied.
- **Continuity on rapid re-toggle.** The current visual position (which may include an in-flight inverted transform from a prior FLIP) is measured *before* clearing inline styles. The next FLIP picks up from wherever the prior one was; the spine never visually jumps when the user toggles mid-animation.
- **`pendingFlipCancel` handle.** Same shape as the existing `pendingCancel` for detail-content cleanup — cancels the prior FLIP's `transitionend` listener and fallback timer before arming a new one, so a stale cleanup can't strip the new FLIP's inline styles mid-animation. The cancel explicitly does *not* clear inline transforms (continuity, above).
- **`transitionend` + fallback timer.** Cleanup prefers the `transitionend` event (filtered to `propertyName === 'transform'` on a spine element); the fallback timer is armed *inside* the rAF so it can't fire before the transition is attached.
- **Spine selector.** `h2, h2 + blockquote` — section-leading blockquotes only. The CSS contract allows multiple blockquotes per section, but only the section-leading ones are FLIP-tracked. Later blockquotes (if any) snap with the surrounding prose; this is acceptable because the perceived "spine" in the existing markup is the H2 + immediate-lede pair.

**Updated acceptance:**

- Spine elements visibly slide (not snap) to their new positions on every mode swap. No flicker on the spine; only `transform` and `transition` are touched.
- Rapid double-toggle preserves continuity: the spine never visually jumps when interrupted mid-FLIP.
- `prefers-reduced-motion: reduce` produces an instant layout swap with no inline FLIP styles applied; `applySwap` still runs.
- All prior acceptance items (no Safari-only artifacts, modal close mid-transition is safe via `isConnected`, `npm run check` + `npm run build` clean) remain in force.
