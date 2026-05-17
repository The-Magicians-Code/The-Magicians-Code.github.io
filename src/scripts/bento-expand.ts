// Bento expand/collapse runtime.
//
// Discovers [data-bento-card] elements at DOMContentLoaded and wires the
// click-to-expand morphing modal. Port of docs/ideas/bento-mchiu.html — see
// docs/superpowers/specs/2026-05-17-bento-projects-section-design.md for the
// design rationale and "Carried-over fixes from the prototype" for the why
// behind the non-obvious bits (focus-outline suppression via card.blur(),
// cleanup ordering to avoid the one-frame silver snap, etc.).

interface OpenState {
  card: HTMLElement;
  placeholder: HTMLElement;
  closeBtn: HTMLButtonElement;
  backdrop: HTMLElement;
  originalInline: string;
  originalRect: DOMRect;
  appendedBodyWrap: HTMLElement | null;
  closing: boolean;
  triggeredByKeyboard: boolean;
}

const MORPH_DUR = 520; // must match --morph-dur in CSS

let openState: OpenState | null = null;

// ── Viewport rect computation ────────────────────────────────────────────
function getViewportRect(): DOMRect {
  const isMobile = window.innerWidth < 540;
  const pad = isMobile ? 16 : Math.max(24, Math.min(48, window.innerWidth * 0.05));
  const maxW = 920;
  const maxH = isMobile ? window.innerHeight - pad * 2 : 720;
  const w = Math.min(window.innerWidth - pad * 2, maxW);
  const h = Math.min(window.innerHeight - pad * 2, maxH);
  return new DOMRect(
    (window.innerWidth - w) / 2,
    (window.innerHeight - h) / 2,
    w,
    h,
  );
}

// ── Body scroll lock with scrollbar-width compensation ───────────────────
function lockBodyScroll(): void {
  const sbw = window.innerWidth - document.documentElement.clientWidth;
  if (sbw > 0) {
    const current = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.dataset.bentoPrevPaddingRight = document.body.style.paddingRight || '';
    document.body.style.paddingRight = `${current + sbw}px`;
  }
  document.body.classList.add('bento-open');
}

function unlockBodyScroll(): void {
  document.body.classList.remove('bento-open');
  if ('bentoPrevPaddingRight' in document.body.dataset) {
    document.body.style.paddingRight = document.body.dataset.bentoPrevPaddingRight ?? '';
    delete document.body.dataset.bentoPrevPaddingRight;
  }
}

// ── Close-button SVG (Lucide "minimize-2" / "shrink" glyph) ──────────────
function makeCloseIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const shapes: Array<[string, Record<string, string>]> = [
    ['polyline', { points: '4 14 10 14 10 20' }],
    ['polyline', { points: '20 10 14 10 14 4' }],
    ['line', { x1: '14', y1: '10', x2: '21', y2: '3' }],
    ['line', { x1: '3', y1: '21', x2: '10', y2: '14' }],
  ];
  for (const [name, attrs] of shapes) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}

// ── Open ─────────────────────────────────────────────────────────────────
function openCaseStudy(card: HTMLElement, triggeredByKeyboard: boolean): void {
  if (openState) return;

  const backdrop = document.querySelector<HTMLElement>('[data-bento-backdrop]');
  if (!backdrop) return;

  // Finish any in-flight card-enter animation so its transform doesn't fight
  // our position:fixed lift and the captured rect reflects the settled pose.
  card.getAnimations().forEach((a) => {
    if ((a as CSSAnimation).animationName === 'card-enter') {
      try { a.finish(); } catch { /* ignore */ }
    }
  });

  const rect = card.getBoundingClientRect();
  const vr = getViewportRect();
  const originalInline = card.getAttribute('style') ?? '';

  // Grid placeholder preserves the bento layout while the card lifts.
  const cs = getComputedStyle(card);
  const placeholder = document.createElement('div');
  placeholder.className = 'bento-card-placeholder';
  placeholder.style.gridColumnStart = cs.gridColumnStart;
  placeholder.style.gridColumnEnd = cs.gridColumnEnd;
  placeholder.style.gridRowStart = cs.gridRowStart;
  placeholder.style.gridRowEnd = cs.gridRowEnd;
  card.parentNode?.insertBefore(placeholder, card);

  // Lift the card. Transition is forced off so the position swap doesn't
  // animate — only the subsequent rAF target change does.
  card.style.transition = 'none';
  card.style.position = 'fixed';
  card.style.top = `${rect.top}px`;
  card.style.left = `${rect.left}px`;
  card.style.width = `${rect.width}px`;
  card.style.height = `${rect.height}px`;
  card.style.margin = '0';
  card.style.transform = 'none';

  // Close button as a child of the card.
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cs-close';
  closeBtn.setAttribute('aria-label', 'Close case study');
  closeBtn.appendChild(makeCloseIcon());
  card.appendChild(closeBtn);

  card.classList.add('is-expanding');
  card.setAttribute('aria-expanded', 'true');
  backdrop.classList.add('is-open');
  lockBodyScroll();

  void card.offsetHeight; // commit lift before re-enabling transitions

  requestAnimationFrame(() => {
    card.style.transition = ''; // CSS-defined transitions apply now
    card.classList.add('is-expanded');
    card.style.top = `${vr.top}px`;
    card.style.left = `${vr.left}px`;
    card.style.width = `${vr.width}px`;
    card.style.height = `${vr.height}px`;
  });

  openState = {
    card,
    placeholder,
    closeBtn,
    backdrop,
    originalInline,
    originalRect: rect,
    appendedBodyWrap: null,
    closing: false,
    triggeredByKeyboard,
  };

  // After the morph lands, clone the hidden body content into the visible
  // card-body and fade it in with a per-paragraph stagger. Guard against
  // close-during-open: if user esc'd before this fires, drop it.
  window.setTimeout(() => {
    if (!openState || openState.closing) return;
    const body = card.querySelector<HTMLElement>('.card-body');
    const source = card.querySelector<HTMLElement>('.bento-card-body');
    if (!body || !source) return;

    const wrap = document.createElement('div');
    wrap.className = 'bento-card-body-rendered';
    // Clone children so the original hidden source stays intact for a
    // potential re-open (state isn't destroyed; only inline copies are).
    for (const child of source.children) {
      const cloned = child.cloneNode(true) as HTMLElement;
      wrap.appendChild(cloned);
    }
    body.appendChild(wrap);
    openState.appendedBodyWrap = wrap;

    // Per-child stagger via inline custom property.
    [...wrap.children].forEach((el, idx) => {
      (el as HTMLElement).style.setProperty('--stagger-idx', String(idx));
      (el as HTMLElement).classList.add('body-para', 'appended');
    });
    void wrap.offsetHeight;
    requestAnimationFrame(() => {
      [...wrap.children].forEach((el) => el.classList.add('in'));
    });
  }, MORPH_DUR);

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCaseStudy();
  });
  backdrop.addEventListener('click', closeCaseStudy, { once: true });
  document.addEventListener('keydown', escClose);
}

function escClose(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (openState) openState.triggeredByKeyboard = true;
    closeCaseStudy();
  }
}

// ── Close ────────────────────────────────────────────────────────────────
function closeCaseStudy(): void {
  if (!openState || openState.closing) return;
  openState.closing = true;
  const state = openState;
  const { card, placeholder, closeBtn, backdrop, originalInline, originalRect, appendedBodyWrap } = state;

  // Blur BEFORE the morph so the UA focus outline doesn't trace the shrink.
  card.blur();

  // Fade out appended body content (CSS handles the 180ms tail via the
  // .is-collapsing rule that immediately follows).
  if (appendedBodyWrap) {
    [...appendedBodyWrap.children].forEach((el) => el.classList.remove('in'));
  }

  // Clear is-resizing in case a resize snap was mid-flight; otherwise the
  // close transition would inherit `transition: none !important`.
  card.classList.remove('is-expanded', 'is-resizing');
  card.classList.add('is-collapsing');
  card.setAttribute('aria-expanded', 'false');

  // Re-measure the placeholder; resize may have moved it.
  const slotRect = placeholder.getBoundingClientRect();
  card.style.top = `${slotRect.top}px`;
  card.style.left = `${slotRect.left}px`;
  card.style.width = `${slotRect.width}px`;
  card.style.height = `${slotRect.height}px`;

  backdrop.classList.remove('is-open');
  document.removeEventListener('keydown', escClose);

  let cleanedUp = false;
  const doCleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.clearTimeout(fallbackTimer);
    card.removeEventListener('transitionend', onTransitionEnd);

    // 1) Remove appended children + close button.
    if (appendedBodyWrap) appendedBodyWrap.remove();
    closeBtn.remove();

    // 2) Apply guarded style (originalInline + transition:none) so the
    //    inline-style swap doesn't animate. THEN remove placeholder.
    //    THEN force layout. THEN in rAF, restore originalInline, THEN
    //    remove lifecycle classes. The ordering is critical — inverting
    //    causes a one-frame silver snap when the resting border CSS rule
    //    re-applies before the inline transition:none lifts.
    const trimmed = originalInline.trim();
    const guarded = trimmed
      ? `${trimmed}${trimmed.endsWith(';') ? '' : ';'} transition: none;`
      : 'transition: none;';
    card.setAttribute('style', guarded);
    placeholder.remove();
    void card.offsetHeight;

    requestAnimationFrame(() => {
      if (originalInline) {
        card.setAttribute('style', originalInline);
      } else {
        card.removeAttribute('style');
      }
      card.classList.remove('is-expanding', 'is-collapsing', 'is-resizing');
      // Belt-and-suspenders re-blur.
      card.blur();
      // Restore focus to the card only if close was triggered by keyboard
      // (esc); mouse-driven close keeps focus detached.
      if (state.triggeredByKeyboard) {
        card.focus({ preventScroll: true });
      }
    });

    unlockBodyScroll();
    openState = null;
  };

  const onTransitionEnd = (e: TransitionEvent): void => {
    if (e.target !== card) return;
    if (e.propertyName !== 'width') return;
    doCleanup();
  };
  card.addEventListener('transitionend', onTransitionEnd);
  const fallbackTimer = window.setTimeout(doCleanup, MORPH_DUR + 280);
}

// ── Resize while open ────────────────────────────────────────────────────
let resizeRaf: number | null = null;
function onResize(): void {
  if (!openState || openState.closing) return;
  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    if (!openState || openState.closing) return;
    const { card, placeholder } = openState;

    card.classList.add('is-resizing');
    const vr = getViewportRect();
    card.style.transition = 'none';
    card.style.top = `${vr.top}px`;
    card.style.left = `${vr.left}px`;
    card.style.width = `${vr.width}px`;
    card.style.height = `${vr.height}px`;
    void card.offsetHeight;
    card.style.transition = '';

    // Update originalRect so close returns to the (possibly moved) slot.
    openState.originalRect = placeholder.getBoundingClientRect();

    requestAnimationFrame(() => {
      if (openState && !openState.closing) openState.card.classList.remove('is-resizing');
    });
  });
}

// ── Card-enter stagger (IntersectionObserver) ────────────────────────────
function initCardEnter(): void {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-bento-card]')];
  cards.forEach((c, i) => {
    c.style.setProperty('--card-enter-delay', `${Math.min(i, 8) * 0.08}s`);
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
  );
  cards.forEach((c) => io.observe(c));
}

// ── Wire-up ──────────────────────────────────────────────────────────────
function init(): void {
  const cards = document.querySelectorAll<HTMLElement>('[data-bento-card]');
  if (cards.length === 0) return;

  cards.forEach((card) => {
    card.addEventListener('click', () => openCaseStudy(card, false));
    card.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCaseStudy(card, true);
      }
    });
  });

  initCardEnter();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export {}; // ensure module scope
