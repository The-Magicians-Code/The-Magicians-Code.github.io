// Reading-mode toggle (TL;DR ↔ Detailed) for the expanded bento card modal.
// Mounted by bento-expand.ts; persists choice in sessionStorage so a reader
// who opts into Detailed on one card sees Detailed on the next card opened
// in the same visit. See docs/superpowers/specs/2026-05-19-case-study-dual-
// mode-design.md.

export type CaseStudyMode = 'tldr' | 'detailed';

const SS_KEY = 'cs-mode';
const SWAP_OUT_MS = 160; // matches BentoGrid.astro .is-swapping opacity transition

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
