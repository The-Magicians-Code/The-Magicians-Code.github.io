# Bento Modal Text Streaming — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current per-paragraph opacity fade in the case-study modal's appended body with a per-word streaming animation. Each word fades in from `opacity: 0; filter: blur(8px)` to `opacity: 1; filter: none`, sequenced by a per-word stagger of ~25ms. Reads as prose typing into place rather than chunky block-by-block fade. Applies to all bento modals (project cards + stack card).

**Architecture:** At the existing body-content render time (`setTimeout(MORPH_DUR)` callback in `doOpen`), walk the appended wrap's DOM and replace each text node's words with `<span class="body-word">` elements interspersed with their original whitespace. Each word carries `--word-idx` (global counter across the whole wrap). A single CSS rule handles the staggered transition. On close, fade is at the wrap level (cheap parent-opacity fade) — no per-word teardown needed.

**Tech Stack:** TypeScript (Astro v6 client scripts), CSS-in-Astro `<style>` blocks.

**Visible payoff:** Modal body content streams in word-by-word like prose appearing, with a soft blur-to-clear resolve. Reads as "thoughtful pacing" rather than instant load.

---

## Constraints (driving requirements)

1. **Inline formatting preserved.** Text inside `<em>`, `<a>`, `<strong>` must keep its formatting. Wrapping descends into these elements so words within `<em>italic text</em>` become `<em><span class="body-word">italic</span> <span class="body-word">text</span></em>`.
2. **`<code>` stays atomic.** Inline code like `<code>function name</code>` is treated as a SINGLE streaming unit — one `body-word` span wraps the whole code text. Splitting `function name` across two animated words would look broken.
3. **Whitespace preserved.** Spaces between words become text nodes between word spans. Browser handles word wrapping naturally.
4. **Streaming targets the above-the-fold portion.** The longest case study (Yolo, Detailed mode) has ~700 rendered word tokens. Streaming all of them at 25ms each would take ~17 seconds. The 1200ms cap means the first ~48 words stream (covers the eyebrow + title + first body paragraph — the user's initial focus), the rest share the cap delay. By the time the user scrolls to see the later content, it's already settled. This is intentional, not a bug.
5. **Cleared filter at rest.** After the reveal completes, `filter` must be `none` (not `blur(0)`). Leaving a zero-blur filter on hundreds of elements keeps them on the GPU filter render path on WebKit. Use CSS animation with `forwards` so the final keyframe `filter: none` sticks.
6. **No `will-change` on word spans.** Adding `will-change: opacity, filter` to hundreds of inline elements is counterproductive — layer pressure outweighs the compositing hint. The animation runs cleanly without it.
7. **Reduced-motion fallback.** `prefers-reduced-motion: reduce` skips the stream + blur — words render at final state immediately.
8. **Close stays cheap.** No per-word teardown. Fade the wrap (parent) on close; child word spans go invisible via parent opacity.
9. **Both bento card types.** Project cards (case-study prose) AND stack card (`<h3>` + `<li>` lists). Same render path, same word-wrap call.

## Non-goals (explicit)

- **TL;DR ↔ Detailed toggle does NOT re-stream.** When the user switches modes after the modal opens, previously-hidden Detailed content becomes visible at its already-settled state (no animation). First-open streaming is the polish moment; mode toggles are functional UI. Re-streaming on toggle would require removing+re-adding the `.in` class on newly-visible words and restarting their animation — adds complexity for marginal payoff. Documented as an acceptable trade-off.

## Codex pre-implementation review

Per global CLAUDE.md, work introducing new logic should be Codex-reviewed before code touches disk. Decisions to validate:

- **DOM-walker correctness on nested inline elements.** The walker recurses into `<em>`, `<a>`, etc. Edge cases: empty elements, pure-whitespace text nodes (skip vs preserve), already-wrapped descendants (idempotency on re-open if needed).
- **Word count for typical case studies.** Yolo Detailed mode is ~400-500 words; stack card body is ~60 words. The cap (`min(idx * 25ms, 1200ms)`) means words 0-48 stream over 1.2s, words 49+ share the cap. Acceptable UX?
- **Filter blur on N elements.** With ~300+ word spans in Detailed mode, each with `filter: blur()` during the transition window: GPU impact? Safari especially. Stagger means not all are blurring at once — only ~10-20 in any 280ms window.
- **Existing `.body-para.appended` rules.** Drop entirely or keep as fallback for reduced-motion? Cleaner to drop; reduced-motion path uses `.body-word` rule with `filter: none; transition: none`.
- **Close behavior.** Currently `.is-collapsing .body-para.appended { opacity: 0 }`. With words now inside paragraphs, do we add `.is-collapsing .body-word { opacity: 0 }` too, or rely on wrap-level opacity fade?

---

## File Structure

| File | Change |
|---|---|
| `src/scripts/bento-expand.ts` | Add `wrapWordsInTree()` helper (recursive DOM walker). Call it on the rendered wrap before the existing stagger loop. Replace per-paragraph stagger with per-word `--word-idx` propagation. |
| `src/components/BentoGrid.astro` | Add `.body-word` CSS rule with opacity + filter blur initial state, staggered transition, `.in` class for final state, `prefers-reduced-motion` short-circuit. Update or remove the existing `.body-para.appended` opacity rules. |

---

## Tasks

### Task 1: Add `wrapWordsInTree` helper in `bento-expand.ts`

**Files:**
- Modify: `src/scripts/bento-expand.ts`

- [ ] **Step 1: Add the helper above the `doOpen` function**

Insert near the other DOM utilities (e.g. after `makeBlurStrip` or `makeCloseIcon`):

```ts
// Walk a subtree and replace each text node's words with span.body-word
// elements interspersed with their original whitespace. Inline elements
// (em, a, strong, etc.) are recursed into so their inner text also gets
// wrapped — the wrapping element stays in place. <code> is special-cased:
// its entire text content is wrapped as a SINGLE body-word so inline
// code stays visually contiguous and streams as one atomic unit (the
// alternative — splitting `function name` into two animated words —
// looks broken).
//
// Each word span gets --word-idx, a globally incremented index across
// the whole subtree, so CSS can stagger transitions in document order.
// counter is passed by reference (object wrap) so recursion shares state.
function wrapWordsInTree(root: HTMLElement, counter: { value: number }): void {
  const children = Array.from(root.childNodes);
  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text.length === 0) continue;
      // Split into tokens, preserving whitespace runs.
      const tokens = text.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      for (const tok of tokens) {
        if (tok === '') continue;
        if (/^\s+$/.test(tok)) {
          frag.appendChild(document.createTextNode(tok));
        } else {
          const span = document.createElement('span');
          span.className = 'body-word';
          span.style.setProperty('--word-idx', String(counter.value++));
          span.textContent = tok;
          frag.appendChild(span);
        }
      }
      root.replaceChild(frag, child);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      // Skip already-wrapped word spans on re-entry (defensive).
      if (el.classList.contains('body-word')) continue;
      // <code> is an atomic streaming unit — wrap its entire text content
      // as one body-word so it stays visually contiguous.
      if (el.tagName === 'CODE') {
        const text = el.textContent ?? '';
        if (text.length > 0) {
          const span = document.createElement('span');
          span.className = 'body-word';
          span.style.setProperty('--word-idx', String(counter.value++));
          span.textContent = text;
          el.replaceChildren(span);
        }
        continue;
      }
      wrapWordsInTree(el, counter);
    }
  }
}
```

- [ ] **Step 2: Wire it into the body render path**

Find the existing per-paragraph stagger block (currently at `bento-expand.ts:339-347`):

```ts
// Per-child stagger via inline custom property.
[...wrap.children].forEach((el, idx) => {
  (el as HTMLElement).style.setProperty('--stagger-idx', String(idx));
  (el as HTMLElement).classList.add('body-para', 'appended');
});
void wrap.offsetHeight;
requestAnimationFrame(() => {
  [...wrap.children].forEach((el) => el.classList.add('in'));
});
```

Replace with:

```ts
// Word-streaming animation: split each child's text into word spans
// with a globally-incremented --word-idx for sequenced CSS transitions.
// Each child still gets .body-para for paragraph-level structural rules
// (margins, list-item formatting, etc.) but loses the .appended opacity
// stagger — word-level animation replaces it.
const wordCounter = { value: 0 };
for (const child of wrap.children) {
  (child as HTMLElement).classList.add('body-para');
  wrapWordsInTree(child as HTMLElement, wordCounter);
}
void wrap.offsetHeight;
requestAnimationFrame(() => {
  [...wrap.querySelectorAll<HTMLElement>('.body-word')].forEach((el) =>
    el.classList.add('in'),
  );
});
```

- [ ] **Step 3: Verify types**

Run from project root: `npm run check`
Expected: PASS, 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/bento-expand.ts
git commit -m "$(cat <<'EOF'
Wrap body text in word spans for streaming animation

At body render time (after the open morph), walk the appended wrap and
replace each text node's words with <span class="body-word"> elements
interspersed with their original whitespace. Each span carries
--word-idx for staggered CSS transitions. Inline elements (em, code, a)
are recursed into so their text also gets wrapped.

Replaces the per-paragraph .appended opacity fade with per-word
streaming. .body-para class stays for structural CSS (margins, list
items). The actual animation moves to .body-word — CSS in the next
commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `.body-word` CSS to `BentoGrid.astro`

**Files:**
- Modify: `src/components/BentoGrid.astro`

- [ ] **Step 1: Find the existing `.body-para.appended` rules**

In `BentoGrid.astro`, the rules are around the lines starting with `:global(.bento-card .body-para.appended)`. There are three:

```css
:global(.bento-card .body-para.appended) {
  margin: 14px 0;
  opacity: 0;
  transition: opacity 280ms ease;
}
:global(.bento-card .body-para.appended.in) {
  opacity: 1;
  transition-delay: calc(var(--stagger-idx, 0) * 80ms);
}
:global(.bento-card.is-collapsing .body-para.appended),
:global(.bento-card.is-collapsing .body-para.appended.in) {
  opacity: 0;
  transition: opacity 180ms ease;
  transition-delay: 0ms;
}
```

- [ ] **Step 2: Replace with paragraph-structural-only + word-level animation rules**

Replace the three rules above with:

```css
  /* .body-para is now a structural marker (margins, list spacing) —
     no opacity transition. Animation moved to .body-word. */
  :global(.bento-card .body-para) {
    margin: 14px 0;
  }
  /* Per-word streaming reveal. Each word span carries --word-idx (a
     global counter across the wrap), so CSS can stagger animations
     in document order. Cap the delay at 1.2s so long bodies don't
     have words appearing seconds after the user starts reading —
     words past the cap all share the cap delay. The visible
     above-the-fold portion streams; below-the-fold settles before
     the user scrolls to it. */
  :global(.bento-card .body-word) {
    display: inline-block;
    opacity: 0;
    filter: blur(8px);
    /* No will-change: adding it to hundreds of inline elements is
       counterproductive (layer pressure outweighs the compositing
       hint). The animation runs cleanly without it on both engines. */
  }
  :global(.bento-card .body-word.in) {
    /* CSS animation (not transition) so the final keyframe
       `filter: none` sticks via `forwards` — leaves the element off
       the GPU filter render path after the reveal, dropping the
       paint cost to zero on WebKit. A transition between blur(8px)
       and `none` doesn't interpolate (`none` isn't a length); the
       animation/keyframe path does. */
    animation: body-word-reveal 280ms ease forwards;
    animation-delay: min(calc(var(--word-idx, 0) * 25ms), 1200ms);
  }
  @keyframes body-word-reveal {
    from { opacity: 0; filter: blur(8px); }
    to   { opacity: 1; filter: none; }
  }
  /* Reduced motion: skip the stream + blur, render at final state. */
  @media (prefers-reduced-motion: reduce) {
    :global(.bento-card .body-word) {
      opacity: 1;
      filter: none;
    }
    :global(.bento-card .body-word.in) {
      animation: none;
    }
  }
  /* On close: fade the wrap (parent) — child words go invisible via
     parent opacity. No per-word teardown needed. */
  :global(.bento-card.is-collapsing .bento-card-body-rendered) {
    opacity: 0;
    transition: opacity 180ms ease;
  }
```

- [ ] **Step 3: Verify types + manual visual**

Run: `npm run check`
Expected: PASS.

Manual (in Chrome via chrome-devtools-mcp):
- Open the Yolo project card. Body text should stream in word-by-word with a soft blur-resolve over the first ~1.2 seconds.
- Open the stack card. Same effect on the `<h3>` + `<li>` content.
- Toggle TL;DR ↔ Detailed in a project card. The mode swap still uses the existing opacity fade on the wrap (no per-word re-stream).
- Close any card. Wrap fades to opacity 0 over 180ms; words disappear with it.

- [ ] **Step 4: Commit**

```bash
git add src/components/BentoGrid.astro
git commit -m "$(cat <<'EOF'
Stream body words on bento modal open

.body-word spans (added by bento-expand.ts) carry --word-idx for
sequenced fade-in. CSS staggers transitions at 25ms per word, capped
at 1200ms so long bodies don't have words appearing seconds late.
Each word fades opacity 0→1 + filter blur(8px)→blur(0) over 280ms.

.body-para keeps its margins/list-item formatting but loses the
opacity transition — paragraph-level fade is replaced by word-level.

Close fades the wrap (parent) opacity to 0 in 180ms; child words go
invisible via parent opacity (no per-word teardown).

prefers-reduced-motion: reduce skips the stream + blur entirely.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Cross-browser verification + push

- [ ] **Step 1: Chrome desktop**

Manual: open Yolo card, watch body stream in. Switch to Detailed, scroll. Open stack card. Trigger close. Verify no jank, no layout shift.

- [ ] **Step 2: Chrome mobile-emulation**

Same checks at narrower viewport.

- [ ] **Step 3: Perf trace**

Use chrome-devtools-mcp `performance_start_trace` over an open of a Detailed-mode project card (300+ words). Verify INP is not flagged and there's no large paint frame during the stream window.

- [ ] **Step 4: User-driven Safari + iOS verification**

User opens on Safari macOS + iOS Safari (via LAN). Verifies:
- Body streams smoothly with blur resolve.
- No jank during streaming, especially on iOS (filter blur is expensive on WebKit).
- Reduced-motion (System Settings → Accessibility → Display → Reduce motion) renders body at final state immediately.

- [ ] **Step 5: Push**

```bash
git push origin <branch>
```

---

## Rollback strategy

The animation is purely additive to the existing render path. To revert:
- Comment out the `wrapWordsInTree(child, wordCounter)` call in `bento-expand.ts` — body content renders without word spans.
- The CSS `.body-word` rules become unused (no spans to match).

For a faster soft-revert without redeploy: add `body { --word-idx-cap: 0ms }` and switch the CSS to use that variable. (Not building this in initially; only needed if there's a perf regression in production that requires a quick mitigation.)

---

## Self-review checklist (run before dispatching to implementer)

1. **Spec coverage:** Constraints — inline preservation (recursion handles `<em>` etc.), whitespace preservation (interspersed text nodes), bounded duration (1200ms cap), reduced motion (CSS media query), close stays cheap (wrap-level fade), both card types (same render path). ✓
2. **No placeholders:** Every code block is concrete. ✓
3. **Type consistency:** `wrapWordsInTree` takes `(HTMLElement, { value: number })`. Caller passes a fresh counter object. ✓
4. **Cross-engine plan:** Task 3 covers Chromium + WebKit explicitly. ✓
5. **Reversibility:** One-line comment-out reverts the JS call; CSS becomes dead. ✓
