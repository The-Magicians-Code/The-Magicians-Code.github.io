# Anchored-spine TL;DR ↔ Detailed transition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the whole-wrap cross-fade for TL;DR ↔ Detailed with a transition that animates only the detail-only content (opacity + tiny translateY), leaving the H2 + blockquote "spine" untouched.

**Architecture:** Add two CSS keyframes (`cs-detail-enter`, `cs-detail-leave`) gated by transient classes (`.cs-mode-entering`, `.cs-mode-leaving`) on the rendered wrap. Rewrite `setActive(next)` in `case-study-mode.ts` to apply those classes on each direction and wait for `animationend` (or a fallback timeout) before finalizing the swap. Leave the existing `.is-swapping` open-card fade pattern untouched — `bento-expand.ts` still depends on it.

**Tech Stack:** Astro 6 (scoped `<style>` with `:global()` wrapping), TypeScript, vanilla DOM. No tests (per CLAUDE.md). Verification: `npm run check`, `npm run build`, Chrome via DevTools MCP, manual Safari.

**Spec:** [docs/superpowers/specs/2026-05-21-anchored-spine-mode-transition-design.md](../specs/2026-05-21-anchored-spine-mode-transition-design.md)

**File map:**

- Modify: [src/components/BentoGrid.astro](../../../src/components/BentoGrid.astro) — add keyframes + transient-class selectors + reduced-motion guard inside the existing `<style>` block.
- Modify: [src/scripts/case-study-mode.ts](../../../src/scripts/case-study-mode.ts) — rewrite the body of `setActive(next)`; drop `SWAP_OUT_MS`.
- Untouched: [src/scripts/bento-expand.ts](../../../src/scripts/bento-expand.ts) — still uses `.is-swapping` for open-card fade.

---

### Task 1: Create feature branch

**Files:** none

- [ ] **Step 1: Start from a clean `main`**

```bash
git checkout main
git status   # expect: clean tree, or only unrelated WIP files
```

- [ ] **Step 2: Create the feature branch**

```bash
git checkout -b mode-transition-anchored-spine
```

- [ ] **Step 3: Confirm branch**

```bash
git branch --show-current   # expect: mode-transition-anchored-spine
```

---

### Task 2: Add CSS keyframes + transient-class selectors

**Files:**
- Modify: `src/components/BentoGrid.astro` — insert new rules immediately after the existing `.is-swapping` rule (after line 600).

- [ ] **Step 1: Read the insertion site**

Open [src/components/BentoGrid.astro](../../../src/components/BentoGrid.astro) and locate the block ending at line 600 (`:global(.bento-card-body-rendered.is-swapping) { opacity: 0; }`). The new rules go on the line after this rule's closing brace, before the `/* Authoring contract in TL;DR mode: ... */` comment block.

- [ ] **Step 2: Insert the keyframes + selectors**

After the `.is-swapping` rule's closing brace, insert:

```css
  /* ── Anchored-spine mode transition ─────────────────────────────
     Detail-only elements (everything after each `h2 + blockquote`
     pair that is not itself an h2 or blockquote) fade + slide in or
     out while the spine stays untouched. Forward and reverse use
     different durations / curves; classes are toggled by
     case-study-mode.ts. See docs/superpowers/specs/2026-05-21-
     anchored-spine-mode-transition-design.md. */
  @keyframes cs-detail-enter {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes cs-detail-leave {
    from { opacity: 1; transform: none; }
    to   { opacity: 0; transform: translateY(-4px); }
  }
  :global(.bento-card-body-rendered.cs-mode-entering[data-mode="detailed"] h2 + blockquote ~ *:not(h2):not(blockquote)) {
    animation: cs-detail-enter 220ms ease-out both;
  }
  :global(.bento-card-body-rendered.cs-mode-leaving[data-mode="detailed"] h2 + blockquote ~ *:not(h2):not(blockquote)) {
    animation: cs-detail-leave 180ms ease-in forwards;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.bento-card-body-rendered.cs-mode-entering[data-mode="detailed"] h2 + blockquote ~ *:not(h2):not(blockquote)),
    :global(.bento-card-body-rendered.cs-mode-leaving[data-mode="detailed"] h2 + blockquote ~ *:not(h2):not(blockquote)) {
      animation: none;
    }
  }
```

- [ ] **Step 3: Verify the file still parses**

```bash
npm run check
```

Expected: `Result (34 files): - 0 errors - 0 warnings` (1 unrelated pre-existing hint in Nav.astro is fine).

- [ ] **Step 4: Commit**

```bash
git add src/components/BentoGrid.astro
git commit -m "$(cat <<'EOF'
Add cs-detail-enter / cs-detail-leave keyframes for mode transition

Gated by transient .cs-mode-entering / .cs-mode-leaving classes on
the rendered wrap. Selector mirrors the existing TL;DR hide rule so
spine elements (h2 + blockquote) are never animated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Rewrite `setActive(next)` in `case-study-mode.ts`

**Files:**
- Modify: `src/scripts/case-study-mode.ts` — replace lines 9-10 (constant) and lines 87-126 (`setActive` body).

- [ ] **Step 1: Remove the `SWAP_OUT_MS` constant**

Delete line 10 in [src/scripts/case-study-mode.ts](../../../src/scripts/case-study-mode.ts):

```ts
const SWAP_OUT_MS = 160; // matches BentoGrid.astro .is-swapping opacity transition
```

- [ ] **Step 2: Replace the body of `setActive(next)`**

Find the existing `setActive` declaration starting at line 87:

```ts
  const setActive = (next: CaseStudyMode): void => {
    if (wrap.dataset.mode === next) return;
    // Move the pill IMMEDIATELY on click — the thumb should respond to
    // the input the instant it lands, not 160ms later. The body
    // content's fade-out/swap still runs on its own schedule below.
    root.dataset.active = next;
    [tldrBtn, detailBtn].forEach((b) => {
      const isActive = b.dataset.mode === next;
      b.setAttribute('aria-selected', String(isActive));
      b.tabIndex = isActive ? 0 : -1;
    });
    wrap.setAttribute('aria-labelledby', (next === 'tldr' ? tldrBtn : detailBtn).id);
    // Trigger the squash-stretch keyframe animation on the thumb's
    // inner element. Remove then force a reflow then re-add so the
    // animation restarts cleanly on rapid toggles.
    thumbInner.classList.remove('is-squashing');
    void thumbInner.offsetWidth;
    thumbInner.classList.add('is-squashing');
    writeMode(next);
    // Body content swap runs after the fade-out window.
    wrap.classList.add('is-swapping');
    window.setTimeout(() => {
      // If the modal closed mid-swap (user hit Escape during the fade),
      // the wrap is no longer in the DOM. Bail out before touching it —
      // no-op'ing harmlessly today, but defensive against future code
      // inside this callback that might read mutated state.
      if (!wrap.isConnected) return;
      // Reset the modal's scroll position to top before the layout
      // change lands. Going Detailed → TL;DR shrinks the wrap
      // dramatically; without this, the browser snaps the scroll
      // offset to fit the shorter content and the swap reads as a
      // jarring "jump". Resetting inside the opacity-0 window means
      // the user never sees the scroll change happen.
      wrap.parentElement?.scrollTo({ top: 0 });
      applyMode(wrap, next);
      // Trigger fade-in on the next frame so the browser commits the
      // data-mode swap before the opacity transition kicks back in.
      requestAnimationFrame(() => wrap.classList.remove('is-swapping'));
    }, SWAP_OUT_MS);
  };
```

Replace it with:

```ts
  const setActive = (next: CaseStudyMode): void => {
    if (wrap.dataset.mode === next) return;
    // Move the pill IMMEDIATELY on click — the thumb should respond to
    // the input the instant it lands, not after the body animation
    // completes. The body content's animation runs on its own schedule
    // below.
    root.dataset.active = next;
    [tldrBtn, detailBtn].forEach((b) => {
      const isActive = b.dataset.mode === next;
      b.setAttribute('aria-selected', String(isActive));
      b.tabIndex = isActive ? 0 : -1;
    });
    wrap.setAttribute('aria-labelledby', (next === 'tldr' ? tldrBtn : detailBtn).id);
    // Trigger the squash-stretch keyframe on the thumb. Remove → reflow
    // → re-add so the animation restarts cleanly on rapid toggles.
    thumbInner.classList.remove('is-squashing');
    void thumbInner.offsetWidth;
    thumbInner.classList.add('is-squashing');
    writeMode(next);

    // Defensive: clear any leftover transient class from an
    // in-flight transition in the opposite direction. Either class
    // being stale would corrupt the keyframe selector match.
    wrap.classList.remove('cs-mode-entering', 'cs-mode-leaving');

    // animationend bubbles to the wrap; one-shot listener + fallback
    // timeout cover the case where no detail element exists (e.g. a
    // section with only h2 + blockquote and no prose) or reduced-motion
    // is active (animation suppressed → no animationend fires).
    const armCleanup = (cleanup: () => void, fallbackMs: number) => {
      let ran = false;
      const run = (): void => {
        if (ran) return;
        ran = true;
        window.clearTimeout(timerId);
        wrap.removeEventListener('animationend', run);
        if (!wrap.isConnected) return;
        cleanup();
      };
      wrap.addEventListener('animationend', run, { once: true });
      const timerId = window.setTimeout(run, fallbackMs);
    };

    if (next === 'detailed') {
      // Forward: add the entering class BEFORE flipping data-mode so the
      // browser sees the combined state on first composite — keyframe
      // starts at frame 0 with opacity:0 + translateY(-4px). Both
      // mutations land in the same synchronous tick (no paint between).
      wrap.classList.add('cs-mode-entering');
      applyMode(wrap, next);
      armCleanup(() => {
        wrap.classList.remove('cs-mode-entering');
      }, 260);
    } else {
      // Reverse: add leaving class while data-mode is still "detailed"
      // so the leave keyframe runs on visible elements. After the fade
      // (or fallback), scroll-reset inside the invisible window and
      // flip data-mode to "tldr" — display:none kicks in then, so the
      // spine reflow happens with nothing visibly moving.
      wrap.classList.add('cs-mode-leaving');
      armCleanup(() => {
        wrap.parentElement?.scrollTo({ top: 0 });
        applyMode(wrap, next);
        wrap.classList.remove('cs-mode-leaving');
      }, 220);
    }
  };
```

- [ ] **Step 3: Type-check the change**

```bash
npm run check
```

Expected: 0 errors, 0 warnings (1 pre-existing hint in Nav.astro).

- [ ] **Step 4: Commit**

```bash
git add src/scripts/case-study-mode.ts
git commit -m "$(cat <<'EOF'
Rewrite setActive for anchored-spine mode transition

Split into forward / reverse branches; each arms an animationend
listener with a fallback timeout. Forward adds .cs-mode-entering
before flipping data-mode so the keyframe starts at frame 0;
reverse waits for the leave animation before flipping data-mode
and scroll-resetting, hiding the spine reflow inside the invisible
window.

Drops SWAP_OUT_MS and the .is-swapping class manipulation on the
wrap — the .is-swapping CSS rule stays for bento-expand.ts's
open-card fade.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Static verification

**Files:** none modified.

- [ ] **Step 1: Run full type/content check**

```bash
npm run check
```

Expected output ends with:
```
Result (34 files):
- 0 errors
- 0 warnings
- 1 hint
✓  content-check: all project sections have a leading blockquote.
```

- [ ] **Step 2: Run production build**

```bash
npm run build 2>&1 | tail -20
```

Expected: `[build] Complete!` and 6 page(s) built. No new warnings (the existing empty-chunk warning from the pick-mode dev-gate is acceptable).

- [ ] **Step 3: Confirm `is-swapping` is no longer in `case-study-mode.ts`**

```bash
grep -n "is-swapping\|SWAP_OUT_MS" src/scripts/case-study-mode.ts
```

Expected: no output (empty match).

- [ ] **Step 4: Confirm `is-swapping` still survives in `bento-expand.ts`**

```bash
grep -n "is-swapping" src/scripts/bento-expand.ts
```

Expected: matches on lines around 233, 242, 272, 278 (the open-card fade pattern is preserved).

- [ ] **Step 5: Confirm the new selectors and keyframes exist in the rendered CSS**

```bash
grep -n "cs-mode-entering\|cs-mode-leaving\|cs-detail-enter\|cs-detail-leave" src/components/BentoGrid.astro
```

Expected: at least 6 matches (two keyframes + two selectors + two reduced-motion selectors).

---

### Task 5: Browser smoke — forward direction (TL;DR → Detailed)

**Files:** none modified. Verification via Chrome DevTools MCP against the running dev server.

- [ ] **Step 1: Ensure the dev server is up**

If `npm run dev` is not already running:
```bash
npm run dev
```
Wait until output contains `Local    http://localhost:4321/`.

- [ ] **Step 2: Open a project page and expand a card with detail content**

Navigate the existing browser tab (or open one) to `http://localhost:4321/`. Click into a project card so the case-study modal opens. The mode toggle (TL;DR / Detailed pill) should be visible above the rendered body.

- [ ] **Step 3: Programmatically toggle TL;DR → Detailed and capture the wrap state across the animation**

Run the following via `mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script`:

```js
() => {
  const wrap = document.querySelector('.bento-card-body-rendered');
  const detail = document.querySelector('.cs-mode-toggle [data-mode="detailed"]');
  if (!wrap || !detail) return { ok: false, reason: 'modal not open or wrap missing' };

  // Force TL;DR baseline
  document.querySelector('.cs-mode-toggle [data-mode="tldr"]').click();
  return new Promise((resolve) => {
    setTimeout(() => {
      const before = { mode: wrap.dataset.mode, classes: Array.from(wrap.classList) };
      detail.click();
      const atClick = { mode: wrap.dataset.mode, classes: Array.from(wrap.classList) };
      setTimeout(() => {
        const mid = { mode: wrap.dataset.mode, classes: Array.from(wrap.classList) };
        setTimeout(() => {
          const after = { mode: wrap.dataset.mode, classes: Array.from(wrap.classList) };
          resolve({ before, atClick, mid, after });
        }, 300);
      }, 80);
    }, 250);
  });
}
```

Expected:
- `before.mode` = `"tldr"`, no transient classes.
- `atClick.mode` = `"detailed"`, classes include `cs-mode-entering`.
- `mid.mode` = `"detailed"`, classes still include `cs-mode-entering` (animation still running at 80ms).
- `after.mode` = `"detailed"`, no transient classes (cleanup ran).

- [ ] **Step 4: Confirm spine elements are NOT animating during the transition**

```js
() => {
  const wrap = document.querySelector('.bento-card-body-rendered');
  document.querySelector('.cs-mode-toggle [data-mode="tldr"]').click();
  return new Promise((resolve) => {
    setTimeout(() => {
      document.querySelector('.cs-mode-toggle [data-mode="detailed"]').click();
      // Inspect mid-animation
      setTimeout(() => {
        const h2s = Array.from(wrap.querySelectorAll('h2')).map(el => getComputedStyle(el).animationName);
        const blockquotes = Array.from(wrap.querySelectorAll('blockquote')).map(el => getComputedStyle(el).animationName);
        const detailEls = Array.from(wrap.querySelectorAll('h2 + blockquote ~ *:not(h2):not(blockquote)')).map(el => getComputedStyle(el).animationName);
        resolve({ h2s, blockquotes, detailEls });
      }, 60);
    }, 250);
  });
}
```

Expected:
- `h2s` and `blockquotes` arrays contain only `"none"` (spine elements have no active animation).
- `detailEls` contains `"cs-detail-enter"` for each detail element (animation is running on the right targets only).

---

### Task 6: Browser smoke — reverse direction (Detailed → TL;DR)

**Files:** none modified.

- [ ] **Step 1: Toggle Detailed → TL;DR and confirm leave behavior**

```js
() => {
  const wrap = document.querySelector('.bento-card-body-rendered');
  document.querySelector('.cs-mode-toggle [data-mode="detailed"]').click();
  return new Promise((resolve) => {
    setTimeout(() => {
      const before = { mode: wrap.dataset.mode, classes: Array.from(wrap.classList) };
      document.querySelector('.cs-mode-toggle [data-mode="tldr"]').click();
      const atClick = { mode: wrap.dataset.mode, classes: Array.from(wrap.classList) };
      setTimeout(() => {
        const mid = { mode: wrap.dataset.mode, classes: Array.from(wrap.classList) };
        setTimeout(() => {
          const after = { mode: wrap.dataset.mode, classes: Array.from(wrap.classList) };
          resolve({ before, atClick, mid, after });
        }, 250);
      }, 80);
    }, 350);
  });
}
```

Expected:
- `before.mode` = `"detailed"`, no transient classes.
- `atClick.mode` = `"detailed"` (unchanged — data-mode flips AFTER the leave animation). Classes include `cs-mode-leaving`.
- `mid.mode` = still `"detailed"` at 80ms (animation in flight). Classes still include `cs-mode-leaving`.
- `after.mode` = `"tldr"`, no transient classes (cleanup ran, data-mode flipped, scroll reset).

- [ ] **Step 2: Confirm rapid double-toggle leaves no leftover classes**

```js
() => {
  const wrap = document.querySelector('.bento-card-body-rendered');
  const tldr = document.querySelector('.cs-mode-toggle [data-mode="tldr"]');
  const detail = document.querySelector('.cs-mode-toggle [data-mode="detailed"]');
  tldr.click();
  return new Promise((resolve) => {
    setTimeout(() => {
      detail.click();
      // Immediately click back — within the entering animation window
      setTimeout(() => tldr.click(), 40);
      setTimeout(() => {
        resolve({
          mode: wrap.dataset.mode,
          classes: Array.from(wrap.classList),
          leftover: Array.from(wrap.classList).filter(c => c.startsWith('cs-mode-')),
        });
      }, 400);
    }, 200);
  });
}
```

Expected: `leftover` is `[]` (the defensive `wrap.classList.remove('cs-mode-entering', 'cs-mode-leaving')` cleared the in-flight class at the start of the second click).

- [ ] **Step 3: Confirm reduced-motion emulation produces an instant swap**

```js
() => {
  // Chrome's media-query emulation isn't directly available via evaluate_script,
  // so verify the CSS rule itself: ask for the resolved animation-name on a
  // detail element WITH reduced-motion forced.
  // Easiest path: use matchMedia to confirm rule exists; visual emulation is
  // done via DevTools Rendering tab manually if needed.
  const styles = Array.from(document.styleSheets).flatMap((s) => {
    try { return Array.from(s.cssRules || []); } catch { return []; }
  });
  const reducedMotionRules = styles
    .filter((r) => r instanceof CSSMediaRule && r.media.mediaText.includes('reduced-motion'))
    .flatMap((r) => Array.from(r.cssRules))
    .filter((r) => r.cssText.includes('cs-mode-entering') || r.cssText.includes('cs-mode-leaving'));
  return {
    reducedMotionRulesFound: reducedMotionRules.length,
    sampleRule: reducedMotionRules[0]?.cssText.slice(0, 200) || null,
  };
}
```

Expected: `reducedMotionRulesFound` ≥ 1; `sampleRule` mentions `animation: none`. (Full visual verification of reduced-motion requires the DevTools Rendering tab, which is out of scope for the MCP automation — note it for the manual Safari pass.)

---

### Task 7: Open PR

**Files:** none modified.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin mode-transition-anchored-spine
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Anchor spine during TL;DR ↔ Detailed transition" --body "$(cat <<'EOF'
## Summary
- Replaces the whole-wrap cross-fade for TL;DR ↔ Detailed with a per-element animation that only touches detail-only content (everything after each `h2 + blockquote` pair that isn't itself an h2 or blockquote). Spine elements stay anchored.
- Two new keyframes (`cs-detail-enter`, `cs-detail-leave`) gated by transient `.cs-mode-entering` / `.cs-mode-leaving` classes. `setActive()` arms an `animationend` listener + fallback timeout on each direction; forward flips `data-mode` immediately, reverse flips it inside the invisible end-of-leave window so the spine reflow is hidden.
- `prefers-reduced-motion: reduce` suppresses both animations.
- The `.is-swapping` CSS rule stays — `bento-expand.ts` still uses it for the open-card body fade.

## Spec & plan
- Spec: [docs/superpowers/specs/2026-05-21-anchored-spine-mode-transition-design.md](docs/superpowers/specs/2026-05-21-anchored-spine-mode-transition-design.md)
- Plan: [docs/superpowers/plans/2026-05-21-anchored-spine-mode-transition.md](docs/superpowers/plans/2026-05-21-anchored-spine-mode-transition.md)

## Test plan
- [x] `npm run check` — 0 errors, 0 warnings (pre-existing hint in Nav.astro).
- [x] `npm run build` — clean.
- [x] Chrome smoke via DevTools MCP: forward toggle adds `cs-mode-entering` + flips `data-mode` in the same tick; reverse toggle adds `cs-mode-leaving` and waits for animation before flipping `data-mode`; cleanup leaves no transient classes; spine elements (h2, blockquote) have `animation-name: none`; detail elements have `cs-detail-enter` / `cs-detail-leave` during their respective transitions; rapid double-toggle leaves no leftover classes.
- [ ] Manual Safari (16+) smoke: toggle in both directions; reduced-motion (System Preferences → Accessibility → Display → Reduce Motion) produces an instant swap.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Capture the PR URL**

Note the URL printed by `gh pr create`. Surface it to the user along with any remaining manual-verification items (Safari + reduced-motion).

---

## Post-merge follow-up (out of scope here)

- If the spine snap reads as jarring once shipped, revisit with FLIP-based smooth spine motion (the Hybrid / Option B path from brainstorming).
- The `mid.classes` check in Task 5 Step 3 / Task 6 Step 1 catches the transient class at 80ms; if the animation duration is ever shortened below 80ms, those assertions need adjustment.
