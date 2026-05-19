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
  const root = document.createElement('div');
  root.className = 'cs-mode-toggle';
  root.setAttribute('role', 'tablist');
  root.setAttribute('aria-label', 'Reading mode');

  const makeTab = (mode: CaseStudyMode, label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.mode = mode;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(mode === initialMode));
    btn.tabIndex = mode === initialMode ? 0 : -1;
    btn.textContent = label;
    return btn;
  };

  const tldrBtn = makeTab('tldr', 'TL;DR');
  const detailBtn = makeTab('detailed', 'Detailed');
  root.appendChild(tldrBtn);
  root.appendChild(detailBtn);

  const setActive = (next: CaseStudyMode): void => {
    if (wrap.dataset.mode === next) return;
    wrap.classList.add('is-swapping');
    window.setTimeout(() => {
      applyMode(wrap, next);
      writeMode(next);
      [tldrBtn, detailBtn].forEach((b) => {
        const isActive = b.dataset.mode === next;
        b.setAttribute('aria-selected', String(isActive));
        b.tabIndex = isActive ? 0 : -1;
      });
      // Trigger fade-in on the next frame so the browser commits the
      // data-mode swap before the opacity transition kicks back in.
      requestAnimationFrame(() => wrap.classList.remove('is-swapping'));
    }, SWAP_OUT_MS);
  };

  tldrBtn.addEventListener('click', () => setActive('tldr'));
  detailBtn.addEventListener('click', () => setActive('detailed'));

  // Keyboard: Left/Right arrows move focus + activate (standard ARIA
  // tablist pattern: roving tabindex).
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: CaseStudyMode = wrap.dataset.mode === 'tldr' ? 'detailed' : 'tldr';
    setActive(next);
    (next === 'tldr' ? tldrBtn : detailBtn).focus();
  });

  return root;
}
