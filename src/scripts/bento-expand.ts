// Bento expand/collapse runtime.
//
// Discovers [data-bento-card] elements at DOMContentLoaded and wires the
// click-to-expand morphing modal. Port of docs/ideas/bento-mchiu.html — see
// docs/superpowers/specs/2026-05-17-bento-projects-section-design.md for the
// design rationale and "Carried-over fixes from the prototype" for the why
// behind the non-obvious bits (focus-outline suppression via card.blur(),
// cleanup ordering to avoid the one-frame silver snap, etc.).

import { readMode, applyMode, buildPillToggle } from './case-study-mode';
import {
  pretextRenderCard,
  pretextAnimateCard,
  pretextRenderAll,
} from './pretext';

interface OpenState {
  card: HTMLElement;
  placeholder: HTMLElement;
  closeBtn: HTMLButtonElement;
  backdrop: HTMLElement;
  blurTop: HTMLElement;
  blurBottom: HTMLElement;
  originalInline: string;
  appendedBodyWrap: HTMLElement | null;
  pillToggle: HTMLElement | null;
  closing: boolean;
  /* ms timestamp (performance.now()) when the open morph started. Used by
     onResize to skip the in-place snap during the morph window — without
     this, an address-bar collapse on iOS Safari (or any window.resize
     fired between open click and morph end) would yank the card to the
     new viewport-centered target with `transition: none`, reading as the
     animation "skipping to the end". */
  openedAt: number;
}

function makeBlurStrip(position: 'top' | 'bottom'): HTMLElement {
  const strip = document.createElement('div');
  strip.className = `card-blur card-blur-${position}`;
  strip.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i++) strip.appendChild(document.createElement('div'));
  return strip;
}

const MORPH_DUR = 520; // must match --morph-dur in CSS

let openState: OpenState | null = null;

// Note: an earlier iteration pinned the stack-card marquee to position:fixed
// at the placeholder rect during the close morph to avoid the marquee
// sliding with the card's bottom edge. That approach reparented the
// marquee (card → body → card), which restarts the CSS scroll animation
// on the track elements each time the DOM is moved. We rely instead on
// opacity (via body.bento-open) to hide the marquee through the
// lifecycle — the slide still happens, but it's invisible — and the
// placeholder-height fix below guarantees the morph lands at the exact
// rest-state rect so the marquee ends up at its correct bottom:24px
// slot inside the card with no jump at cleanup.

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

// ── Body scroll lock ─────────────────────────────────────────────────────
// Pre-`scrollbar-gutter` versions of this also added padding-right to body
// and bumped [data-scroll-lock-compensate] elements' inline `right` by the
// measured scrollbar width to avoid layout shift when overflow:hidden
// hides the scrollbar. With `scrollbar-gutter: stable both-edges` on html
// (see global.css) the gutter persists whether the scrollbar is rendered
// or not, so the page no longer shifts at lock/unlock and the compensation
// is redundant — removed.
function lockBodyScroll(): void {
  document.body.classList.add('bento-open');
}

function unlockBodyScroll(): void {
  document.body.classList.remove('bento-open');
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

// ── Pre-open scroll: clear the card out from under the nav ──────────────
// The fixed nav (z:40) overlaps any card the user clicks on while scrolled
// near the top of the section. Lifting the card to z:201 instantly would
// produce a visible layer-pop (card escapes from behind the nav-pill blur).
// Instead, smoothly scroll so the card sits below the nav band before the
// open animation starts.
//
// Native window.scrollBy({behavior:'smooth'}) is too fast and uses a fixed
// browser easing curve. Polynomial easings (easeInOutQuint etc.) stutter
// at the start because their first ~30% of duration covers <1% of distance.
//
// Lerp-based smooth scroll — same pattern as Lenis and mchiu.co.uk's
// custom scroll. Each frame: current += (target - current) * factor.
// Distance remaining shrinks exponentially, which naturally produces
// "fast start, smooth decelerating tail" — the physics of a critically-
// damped spring approaching equilibrium. No fixed duration; ends when
// the gap is sub-pixel.
const SCROLL_LERP = 0.12;          // higher = snappier; 0.08-0.18 is the useful band
const SCROLL_EPSILON = 0.5;        // px gap at which we snap to target and finish
const SCROLL_SETTLE_PAUSE = 180;   // ms to wait after scroll lands before the morph
                                   // begins, so the user's eye registers the scroll
                                   // completion before the next motion starts.

function smoothScrollTo(targetY: number): Promise<void> {
  return new Promise((resolve) => {
    const startGap = targetY - window.scrollY;
    if (Math.abs(startGap) < 1) {
      resolve();
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, targetY);
      resolve();
      return;
    }
    let current = window.scrollY;
    const step = (): void => {
      current += (targetY - current) * SCROLL_LERP;
      if (Math.abs(targetY - current) < SCROLL_EPSILON) {
        window.scrollTo(0, targetY);
        resolve();
        return;
      }
      window.scrollTo(0, current);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

async function ensureCardClearOfNav(card: HTMLElement): Promise<void> {
  const nav = document.getElementById('site-nav');
  if (!nav) return;
  const navBottom = nav.getBoundingClientRect().bottom;
  const cardTop = card.getBoundingClientRect().top;
  const margin = 16;
  const safeTop = navBottom + margin;
  if (cardTop >= safeTop) return;
  await smoothScrollTo(window.scrollY + (cardTop - safeTop));
  await new Promise<void>((r) => window.setTimeout(r, SCROLL_SETTLE_PAUSE));
}

// ── Open ─────────────────────────────────────────────────────────────────
let openInProgress = false;

function openCaseStudy(card: HTMLElement): void {
  if (openState || openInProgress) return;
  openInProgress = true;
  ensureCardClearOfNav(card)
    .then(() => {
      if (!openState) doOpen(card);
    })
    .finally(() => {
      openInProgress = false;
    });
}

function doOpen(card: HTMLElement): void {

  const backdrop = document.querySelector<HTMLElement>('[data-bento-backdrop]');
  if (!backdrop) return;

  // Finish any in-flight card-enter animation so its transform doesn't fight
  // our position:fixed lift and the captured rect reflects the settled pose.
  card.getAnimations().forEach((a) => {
    if ((a as CSSAnimation).animationName === 'bento-card-enter') {
      try { a.finish(); } catch { /* ignore */ }
    }
  });

  const rect = card.getBoundingClientRect();
  const vr = getViewportRect();
  const originalInline = card.getAttribute('style') ?? '';

  // Grid placeholder preserves the bento layout while the card lifts.
  // Height is pinned to the card's actual rect rather than relying on the
  // .bento-card-placeholder default aspect-ratio (4/1), because stack-card
  // overrides aspect-ratio to 3/1 — without an explicit height the
  // placeholder is shorter than the card, the close morph lands at the
  // placeholder's wrong size, then the card snaps to its CSS rest height
  // at cleanup. Explicit height keeps morph target === rest geometry.
  const cs = getComputedStyle(card);
  const placeholder = document.createElement('div');
  placeholder.className = 'bento-card-placeholder';
  placeholder.style.gridColumnStart = cs.gridColumnStart;
  placeholder.style.gridColumnEnd = cs.gridColumnEnd;
  placeholder.style.gridRowStart = cs.gridRowStart;
  placeholder.style.gridRowEnd = cs.gridRowEnd;
  placeholder.style.height = `${rect.height}px`;
  placeholder.style.aspectRatio = 'auto';
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

  // Progressive blur strips at the card's top + bottom edges. Apple-style
  // multi-layer stacked blur — mounted dynamically so resting cards pay
  // zero GPU cost. See BentoGrid.astro .card-blur rules for the per-
  // layer blur radii and mask gradients.
  const blurTop = makeBlurStrip('top');
  const blurBottom = makeBlurStrip('bottom');
  card.appendChild(blurTop);
  card.appendChild(blurBottom);

  // Double-rAF before flipping .is-on so the browser fully paints the
  // backdrop-filter layers at opacity:0 first. Without the warm-up
  // frame, the GPU rasterizes the filter as the opacity transition
  // starts and the blur visibly "pops" instead of fading.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!openState || openState.closing) return;
      blurTop.classList.add('is-on');
      blurBottom.classList.add('is-on');
    });
  });

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
    // Animate pretext word spans to modal positions in lockstep with the morph.
    if (card.classList.contains('pretext-title')) {
      pretextAnimateCard(card, true);
    }
  });

  openState = {
    card,
    placeholder,
    closeBtn,
    backdrop,
    blurTop,
    blurBottom,
    originalInline,
    appendedBodyWrap: null,
    pillToggle: null,
    closing: false,
    openedAt: performance.now(),
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
    const initialMode = readMode();
    applyMode(wrap, initialMode);
    // Clone children so the original hidden source stays intact for a
    // potential re-open (state isn't destroyed; only inline copies are).
    for (const child of source.children) {
      const cloned = child.cloneNode(true) as HTMLElement;
      wrap.appendChild(cloned);
    }
    const pillToggle = buildPillToggle(wrap, initialMode);
    body.appendChild(pillToggle);
    body.appendChild(wrap);
    openState.appendedBodyWrap = wrap;
    openState.pillToggle = pillToggle;

    const deepwikiUrl = card.dataset.deepwikiUrl;
    if (deepwikiUrl) {
      const footer = document.createElement('p');
      footer.className = 'cs-nerds-footer';
      const link = document.createElement('a');
      link.href = deepwikiUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'For the nerds — full architecture wiki →';
      footer.appendChild(link);
      wrap.appendChild(footer);
    }

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
  if (e.key === 'Escape') closeCaseStudy();
}

// ── Close ────────────────────────────────────────────────────────────────
function closeCaseStudy(): void {
  if (!openState || openState.closing) return;
  openState.closing = true;
  const state = openState;
  const { card, placeholder, closeBtn, backdrop, blurTop, blurBottom, originalInline, appendedBodyWrap, pillToggle } = state;

  // Blur BEFORE the morph so the UA focus outline doesn't trace the shrink.
  card.blur();

  // Reverse pretext word transforms back to source positions. .is-expanding
  // is still on the card, so the transition rule animates the change.
  if (card.classList.contains('pretext-title')) {
    pretextAnimateCard(card, false);
  }

  // Clear is-resizing in case a resize snap was mid-flight; otherwise the
  // close transition would inherit `transition: none !important`.
  // .is-collapsing also drives the body-para fade-out via CSS (see
  // .bento-card.is-collapsing .body-para.appended rule) — no per-child
  // class loop needed.
  card.classList.remove('is-expanded', 'is-resizing');
  card.classList.add('is-collapsing');

  // Unmount blur strips immediately. Previously they faded out via opacity
  // over 220ms, but backdrop-filter computes regardless of opacity — so the
  // strips were eating GPU through the entire close morph. Removing them
  // from the DOM kills backdrop-filter instantly; the card is also shrinking
  // visibly in the same frame, so the blur disappearance reads as part of
  // the close, not a discrete pop. doCleanup's .remove() becomes a no-op.
  blurTop.remove();
  blurBottom.remove();
  card.setAttribute('aria-expanded', 'false');

  // Re-measure the placeholder; resize may have moved it.
  const slotRect = placeholder.getBoundingClientRect();

  card.style.top = `${slotRect.top}px`;
  card.style.left = `${slotRect.left}px`;
  card.style.width = `${slotRect.width}px`;
  card.style.height = `${slotRect.height}px`;

  backdrop.classList.remove('is-open');
  backdrop.removeEventListener('click', closeCaseStudy);
  document.removeEventListener('keydown', escClose);

  let cleanedUp = false;
  const doCleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.clearTimeout(fallbackTimer);
    card.removeEventListener('transitionend', onTransitionEnd);

    // 1) Remove appended children + close button + blur strips.
    if (appendedBodyWrap) appendedBodyWrap.remove();
    if (pillToggle) pillToggle.remove();
    closeBtn.remove();
    blurTop.remove();
    blurBottom.remove();

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
      // Belt-and-suspenders re-blur. Focus is intentionally NOT restored to
      // the card on keyboard close — restoring focus triggers :focus-visible
      // and the browser draws a default focus outline that reads as a white
      // boundary line around the card. Permanent visual cleanliness wins
      // over keyboard place-keeping for v1.
      card.blur();
      // Re-measure pretext + rest-y in case viewport changed during the
      // open. Order matters: pretext sets the title height; rest-y
      // depends on that height.
      if (document.fonts?.check?.('24px Fraunces')) {
        pretextRenderCard(card, getViewportRect);
      }
      syncTitleRestY(card);
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

// ── Title rest-y measurement ─────────────────────────────────────────────
// The card-title CSS uses translateY(var(--title-rest-y, 0)) to sit at the
// bottom of the body at rest, and translateY(0) when expanded. The rest-y
// value depends on the card's height (which depends on viewport width via
// the 4:1 aspect ratio), so it has to be measured per card at init and
// re-measured on resize / after each close.
function syncTitleRestY(card: HTMLElement): void {
  // Scoped to project case-study cards. Other bento cards (e.g. the
  // stack card) keep their natural-flow title position via a CSS
  // `transform: none` override.
  if (!card.classList.contains('cs-card')) return;
  // Skip cards mid-lifecycle — their geometry isn't the resting geometry.
  if (
    card.classList.contains('is-expanding') ||
    card.classList.contains('is-expanded') ||
    card.classList.contains('is-collapsing')
  ) {
    return;
  }
  const body = card.querySelector<HTMLElement>('.card-body');
  const title = card.querySelector<HTMLElement>('.card-title');
  if (!body || !title) return;
  // Reset to 0 so getBoundingClientRect reflects the natural-flow position.
  card.style.setProperty('--title-rest-y', '0px');
  card.style.setProperty('--title-center-x', '0px');
  void body.offsetHeight;
  // Vertically center the title within the body: translate by the delta
  // between body's vertical center and title's natural-flow vertical center.
  const bodyRect = body.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const yOffset =
    bodyRect.top + bodyRect.height / 2 - (titleRect.top + titleRect.height / 2);
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
  // expanded body's inner width is derived from getViewportRect() (the
  // morph target) minus the expanded-state body padding (48px desktop /
  // 22px mobile, mirroring the .bento-card.is-expanded .card-body rule).
  // The transform from 0 → centerX runs in lockstep with the morph, so
  // intermediate frames sit between left-aligned (rest) and centered
  // (final) — they land precisely centered at morph end.
  const isMobile = window.innerWidth < 540;
  const expandPad = isMobile ? 16 : Math.max(24, Math.min(48, window.innerWidth * 0.05));
  const expandedCardW = Math.min(window.innerWidth - expandPad * 2, 920);
  const expandedBodyPadX = isMobile ? 22 : 48;
  const expandedBodyInnerW = expandedCardW - 2 * expandedBodyPadX;
  const centerX = Math.max(0, (expandedBodyInnerW - titleRect.width) / 2);
  card.style.setProperty('--title-center-x', `${centerX}px`);
}

function syncAllTitleRestY(): void {
  document.querySelectorAll<HTMLElement>('[data-bento-card]').forEach(syncTitleRestY);
}

// ── Resize handler ───────────────────────────────────────────────────────
// Handles two things:
//   1. If a modal is open: snap it to the new viewport-centered target.
//   2. Re-measure title rest-y for all resting cards (their height changed
//      with the viewport).
let resizeRaf: number | null = null;
function onResize(): void {
  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;

    // Re-measure pretext for idle cards (their rest width changed with
    // the viewport via the 4:1 aspect ratio). Skip the open card —
    // its geometry reflects the modal, not the rest position.
    if (document.fonts?.check?.('24px Fraunces')) {
      pretextRenderAll(getViewportRect, openState?.card ?? null);
    }
    // Re-measure rest-y for all idle cards (their card height changed
    // with the viewport via the 4:1 aspect ratio).
    syncAllTitleRestY();

    if (!openState || openState.closing) return;
    // Skip the snap if the open morph is still in flight. Otherwise an
    // address-bar collapse on iOS Safari (or any window.resize fired
    // between click and morph-end) would interrupt the transition by
    // setting `transition: none` and yanking the card to the modal-
    // centered target — reads as the animation "skipping to the end".
    // After the morph completes, resizes continue to recenter normally.
    if (performance.now() - openState.openedAt < MORPH_DUR) return;
    const { card } = openState;

    card.classList.add('is-resizing');
    const vr = getViewportRect();
    card.style.transition = 'none';
    card.style.top = `${vr.top}px`;
    card.style.left = `${vr.left}px`;
    card.style.width = `${vr.width}px`;
    card.style.height = `${vr.height}px`;
    void card.offsetHeight;
    card.style.transition = '';

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
    card.addEventListener('click', () => openCaseStudy(card));
    card.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCaseStudy(card);
      }
    });
  });

  initCardEnter();

  // Title rest-y depends on the rendered font (Fraunces, loaded from
  // Google Fonts). Gate on document.fonts.ready so the measurement uses
  // actual serif metrics rather than the fallback.
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

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export {}; // ensure module scope
