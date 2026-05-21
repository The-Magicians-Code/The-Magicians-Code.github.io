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
