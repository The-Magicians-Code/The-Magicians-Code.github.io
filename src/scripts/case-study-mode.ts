// Reading-mode toggle (TL;DR ↔ Detailed) for the expanded bento card modal.
// Mounted by bento-expand.ts; persists choice in sessionStorage so a reader
// who opts into Detailed on one card sees Detailed on the next card opened
// in the same visit. See docs/superpowers/specs/2026-05-19-case-study-dual-
// mode-design.md.

export type CaseStudyMode = 'tldr' | 'detailed';

const SS_KEY = 'cs-mode';

export function readMode(): CaseStudyMode {
  try {
    const stored = sessionStorage.getItem(SS_KEY);
    if (stored === 'tldr' || stored === 'detailed') return stored;
  } catch {
    /* sessionStorage may be unavailable (private-mode in some browsers) */
  }
  return 'tldr';
}

export function writeMode(mode: CaseStudyMode): void {
  try {
    sessionStorage.setItem(SS_KEY, mode);
  } catch {
    /* ignore — best-effort persistence */
  }
}

export function applyMode(wrap: HTMLElement, mode: CaseStudyMode): void {
  wrap.dataset.mode = mode;
}

// Build the pill toggle DOM. Returns the root element; the caller is
// responsible for appending it to the modal body before the rendered wrap.
// Updates the wrap's data-mode (with cross-fade) on click and writes the
// new mode to sessionStorage.
export function buildPillToggle(wrap: HTMLElement, initialMode: CaseStudyMode): HTMLElement {
  // Generate IDs scoped to this toggle so aria-controls + aria-labelledby
  // can wire the tabs to the wrap (which acts as the tabpanel).
  const uid = `cs-${Math.random().toString(36).slice(2, 9)}`;
  const wrapId = wrap.id || `${uid}-panel`;
  wrap.id = wrapId;
  wrap.setAttribute('role', 'tabpanel');

  const root = document.createElement('div');
  root.className = 'cs-mode-toggle';
  root.setAttribute('role', 'tablist');
  root.setAttribute('aria-label', 'Reading mode');
  // Sliding thumb behind the buttons. Two-element structure so the
  // translateX slide (on the outer) and the scaleX squash-stretch
  // keyframe animation (on the inner) live on separate transform
  // contexts and don't fight each other. The active button still gets
  // its text-color change via aria-selected; the background fill +
  // shadow live on the inner element.
  const thumb = document.createElement('span');
  thumb.className = 'cs-mode-toggle__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  const thumbInner = document.createElement('span');
  thumbInner.className = 'cs-mode-toggle__thumb-inner';
  thumb.appendChild(thumbInner);
  root.appendChild(thumb);
  root.dataset.active = initialMode;

  const makeTab = (mode: CaseStudyMode, label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `${uid}-${mode}`;
    btn.dataset.mode = mode;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(mode === initialMode));
    btn.setAttribute('aria-controls', wrapId);
    btn.tabIndex = mode === initialMode ? 0 : -1;
    btn.textContent = label;
    return btn;
  };

  const tldrBtn = makeTab('tldr', 'TL;DR');
  const detailBtn = makeTab('detailed', 'Detailed');
  root.appendChild(tldrBtn);
  root.appendChild(detailBtn);

  // Wire the wrap's aria-labelledby to the currently-active tab so screen
  // readers announce the active mode when entering the panel.
  wrap.setAttribute('aria-labelledby', (initialMode === 'tldr' ? tldrBtn : detailBtn).id);

  // Tracks the in-flight transition cleanup so a rapid re-toggle can
  // cancel the prior call's animationend listener + fallback timeout
  // instead of letting it linger and eat the next animationend event.
  let pendingCancel: (() => void) | null = null;

  // Tracks the in-flight FLIP cleanup independently — a rapid re-toggle
  // must cancel the prior FLIP's transitionend listener + fallback timer
  // before a new one arms, otherwise the stale cleanup strips the new
  // FLIP's inline transforms mid-animation.
  let pendingFlipCancel: (() => void) | null = null;

  // FLIP-animate the case-study spine (h2s + section-leading blockquotes)
  // so they slide smoothly to their new positions instead of snapping when
  // `applySwap` flips data-mode and triggers a layout change.
  //
  // Continuity on rapid re-toggle: measure CURRENT visual positions (which
  // may include an in-flight transform from a prior FLIP) BEFORE clearing
  // inline styles. The new FLIP picks up wherever the prior one was, so
  // the spine never visually jumps when the user toggles mid-animation.
  //
  // prefers-reduced-motion is honored at the top — inline `style.transition`
  // would otherwise bypass the CSS @media block on the keyframe selectors.
  const flipSpine = (
    applySwap: () => void,
    durationMs: number,
    easing: string,
  ): void => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applySwap();
      return;
    }
    const spine = Array.from(
      wrap.querySelectorAll<HTMLElement>('h2, h2 + blockquote'),
    );
    if (spine.length === 0) {
      applySwap();
      return;
    }
    // First — measure CURRENT visual positions (may include in-flight
    // transforms from a prior FLIP — that's what gives us continuity).
    const oldTops = spine.map((el) => el.getBoundingClientRect().top);
    // Clear prior FLIP state so post-swap measurement reflects true layout
    // positions and the inverse transforms below aren't compounded.
    for (const el of spine) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
    }
    pendingFlipCancel?.();
    // Last
    applySwap();
    // Compute deltas. If nothing moved, skip the inverse + animation.
    const deltas = spine.map(
      (el, i) => oldTops[i] - el.getBoundingClientRect().top,
    );
    if (deltas.every((d) => d === 0)) return;
    // Invert
    for (let i = 0; i < spine.length; i++) {
      if (deltas[i] === 0) continue;
      spine[i].style.willChange = 'transform';
      spine[i].style.transition = 'none';
      spine[i].style.transform = `translateY(${deltas[i]}px)`;
    }
    // Force reflow so the inverse transform paints before the transition
    // declaration arms in the next frame.
    void wrap.offsetHeight;
    // Play
    requestAnimationFrame(() => {
      for (const el of spine) {
        el.style.transition = `transform ${durationMs}ms ${easing}`;
        el.style.transform = '';
      }
      // Cleanup: prefer transitionend (filtered to `transform` on a spine
      // element). Fallback timer is armed AFTER the rAF so it can't fire
      // before the transition is actually attached.
      let cleaned = false;
      const cleanup = (): void => {
        if (cleaned) return;
        cleaned = true;
        window.clearTimeout(timerId);
        wrap.removeEventListener('transitionend', onEnd);
        pendingFlipCancel = null;
        if (!wrap.isConnected) return;
        for (const el of spine) {
          el.style.transition = '';
          el.style.transform = '';
          el.style.willChange = '';
        }
      };
      const onEnd = (e: TransitionEvent): void => {
        if (e.propertyName !== 'transform') return;
        if (!(e.target instanceof HTMLElement) || !spine.includes(e.target)) return;
        cleanup();
      };
      wrap.addEventListener('transitionend', onEnd);
      const timerId = window.setTimeout(cleanup, durationMs + 80);
      pendingFlipCancel = () => {
        window.clearTimeout(timerId);
        wrap.removeEventListener('transitionend', onEnd);
        // Don't clear inline transforms here — the next FLIP measures
        // them as "current visual state" for continuity.
        pendingFlipCancel = null;
      };
    });
  };

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
    // is active (animation suppressed → no animationend fires). Buffers
    // (260ms / 220ms below) sit ~40ms above the CSS durations so a
    // slightly-slow Safari run doesn't have the timeout fire before
    // animationend; if the event fires first, the timeout is cleared.
    const armCleanup = (cleanup: () => void, fallbackMs: number) => {
      // A rapid re-toggle invalidates any in-flight cleanup — explicit
      // teardown here prevents listener pile-up and stale handlers from
      // stealing animationend events meant for the new direction.
      pendingCancel?.();

      let ran = false;
      const run = (e?: AnimationEvent): void => {
        // Only react to our own keyframes — descendant animations
        // (future code-block fades, progress bars, etc.) would
        // otherwise trip this listener early via event bubbling.
        if (e && !e.animationName.startsWith('cs-detail-')) return;
        if (ran) return;
        ran = true;
        window.clearTimeout(timerId);
        wrap.removeEventListener('animationend', run);
        pendingCancel = null;
        if (!wrap.isConnected) return;
        cleanup();
      };
      wrap.addEventListener('animationend', run);
      const timerId = window.setTimeout(run, fallbackMs);
      pendingCancel = () => {
        wrap.removeEventListener('animationend', run);
        window.clearTimeout(timerId);
        pendingCancel = null;
      };
    };

    if (next === 'detailed') {
      // Forward: add the entering class BEFORE flipping data-mode so the
      // browser sees the combined state on first composite — keyframe
      // starts at frame 0 with opacity:0 + translateY(-4px). Both
      // mutations land in the same synchronous tick (no paint between).
      // FLIP wraps both so the spine slides smoothly to its new layout
      // position instead of snapping when the detail elements push it
      // apart.
      flipSpine(
        () => {
          wrap.classList.add('cs-mode-entering');
          applyMode(wrap, next);
        },
        240,
        'ease-out',
      );
      armCleanup(() => {
        wrap.classList.remove('cs-mode-entering');
      }, 260);
    } else {
      // Reverse: under reduced-motion, CSS suppresses cs-detail-leave so
      // no animationend ever fires — waiting for armCleanup's 220ms
      // fallback would impose a perceptible delay before the swap lands.
      // Apply synchronously instead. flipSpine has its own reduced-motion
      // early-exit so the swap still runs but no spine transform animates.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        wrap.parentElement?.scrollTo({ top: 0 });
        flipSpine(() => applyMode(wrap, next), 240, 'ease-out');
        return;
      }
      // Reverse with motion: add leaving class while data-mode is still
      // "detailed" so the leave keyframe runs on visible elements. After
      // the fade (or fallback), scroll-reset to top (kept outside FLIP so
      // the spine doesn't animate through the scroll delta) then FLIP-flip
      // data-mode + remove leaving class so the spine slides smoothly to
      // its compacted TL;DR position.
      wrap.classList.add('cs-mode-leaving');
      armCleanup(() => {
        wrap.parentElement?.scrollTo({ top: 0 });
        flipSpine(
          () => {
            applyMode(wrap, next);
            wrap.classList.remove('cs-mode-leaving');
          },
          240,
          'ease-out',
        );
      }, 220);
    }
  };

  tldrBtn.addEventListener('click', () => setActive('tldr'));
  detailBtn.addEventListener('click', () => setActive('detailed'));

  // Keyboard: Left/Right arrows toggle to the other tab (with only two
  // tabs, direction has no semantic meaning — either arrow flips).
  // Standard ARIA tablist roving-tabindex pattern.
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: CaseStudyMode = wrap.dataset.mode === 'tldr' ? 'detailed' : 'tldr';
    setActive(next);
    (next === 'tldr' ? tldrBtn : detailBtn).focus();
  });

  return root;
}
