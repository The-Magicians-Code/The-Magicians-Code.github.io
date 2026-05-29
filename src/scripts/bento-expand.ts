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
  stickyHeader: HTMLElement | null;
  detachScrollCollapse: (() => void) | null;
  closing: boolean;
  /* ms timestamp (performance.now()) when the open morph started. Used by
     onResize to skip the in-place snap during the morph window — without
     this, an address-bar collapse on iOS Safari (or any window.resize
     fired between open click and morph end) would yank the card to the
     new viewport-centered target with `transition: none`, reading as the
     animation "skipping to the end". */
  openedAt: number;
  /* Effective box-morph duration for this card, parsed from --morph-dur
     (520ms plain, 760ms for .has-cover). Drives the JS schedule so it stays
     in lockstep with the CSS geometry transition. */
  morphDur: number;
}

function makeBlurStrip(position: 'top' | 'bottom'): HTMLElement {
  const strip = document.createElement('div');
  strip.className = `card-blur card-blur-${position}`;
  strip.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 5; i++) strip.appendChild(document.createElement('div'));
  return strip;
}

const MORPH_DUR = 520; // must match --morph-dur in CSS (plain cards)

// Cover cards delay the box morph so the resting title can blur out first.
const COVER_MORPH_DELAY = 180; // ms; matches the choreography overlap

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Effective morph duration for a card from its computed --morph-dur token
// (handles both "760ms" and "0.76s"). Falls back to MORPH_DUR.
function readMorphDur(card: HTMLElement): number {
  const raw = getComputedStyle(card).getPropertyValue('--morph-dur').trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return MORPH_DUR;
  return raw.endsWith('ms') ? n : raw.endsWith('s') ? n * 1000 : n;
}

// Pre-size .has-cover modal content to the EXPANDED inner width so it doesn't
// reflow during the morph (the growing box masks it). --modal-w = the morph
// target width minus the expanded card-body horizontal padding (must match the
// CSS: 22px ≤540px, else 48px — use matchMedia so the breakpoint matches CSS
// exactly, not a strict `< 540`).
function setModalWidthVar(card: HTMLElement, vr: DOMRect): void {
  const padX = window.matchMedia('(max-width: 540px)').matches ? 22 : 48;
  card.style.setProperty('--modal-w', `${Math.max(0, Math.round(vr.width - 2 * padX))}px`);
}

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
  // Mobile: edge-to-edge. The phone display's rounded corners frame the
  // modal; the CSS drops .bento-card.is-expanded border-radius to 0 at
  // the same breakpoint so the square modal corners meet the display
  // corners cleanly. Desktop: padded modal centred in the viewport.
  const pad = isMobile ? 0 : Math.max(24, Math.min(48, window.innerWidth * 0.05));
  const maxW = isMobile ? window.innerWidth : 920;
  const maxH = isMobile ? window.innerHeight : 720;
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
// iOS/Safari-safe lock: pin <body> with position:fixed at -scrollY rather than
// toggling html/body `overflow`. On WebKit, changing root overflow re-resolves
// the positions of in-flight position:fixed elements — which yanked the
// morphing card to the side before it centered, on BOTH open and collapse.
// position:fixed leaves fixed descendants (the card, the nav) alone, locks the
// page, and preserves the visual position with no reflow; we restore the scroll
// offset on unlock. Scrollbars are hidden globally so there's no gutter shift.
let lockedScrollY = 0;
function lockBodyScroll(): void {
  lockedScrollY = window.scrollY;
  document.body.classList.add('bento-open');
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockBodyScroll(): void {
  document.body.classList.remove('bento-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, lockedScrollY);
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
function openCaseStudy(card: HTMLElement): void {
  if (openState) return;
  doOpen(card);
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
  // Pre-size the modal content to this exact morph target before it reveals,
  // so it lays out at the final width and never reflows during the morph.
  setModalWidthVar(card, vr);
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

  const hasCover = card.classList.contains('has-cover');
  const reduce = prefersReducedMotion();
  const morphDur = readMorphDur(card);

  const applyMorphTarget = (): void => {
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
  };

  // Cover cards (motion on) delay the box morph by COVER_MORPH_DELAY so the
  // resting-title blur-out (driven by .is-expanding in CSS) overlaps the start
  // of the morph. Plain cards and reduced-motion morph on the next frame.
  if (hasCover && !reduce) {
    window.setTimeout(() => {
      if (!openState || openState.closing) return;
      requestAnimationFrame(applyMorphTarget);
    }, COVER_MORPH_DELAY);
  } else {
    requestAnimationFrame(applyMorphTarget);
  }

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
    stickyHeader: null,
    detachScrollCollapse: null,
    closing: false,
    openedAt: performance.now(),
    morphDur,
  };

  // After the morph lands, clone the hidden body content into the visible
  // card-body and fade it in. Single wrap-level opacity transition (no
  // per-paragraph stagger) — same pattern as the TL;DR ↔ Detailed mode
  // swap (.is-swapping on the wrap → opacity 0 → 1 over 160ms). Guard
  // against close-during-open: if user esc'd before this fires, drop it.
  window.setTimeout(() => {
    if (!openState || openState.closing) return;
    const body = card.querySelector<HTMLElement>('.card-body');
    const source = card.querySelector<HTMLElement>('.bento-card-body');
    if (!body || !source) return;

    const wrap = document.createElement('div');
    // Cover cards reveal each item via the .is-content-in stagger (below), not
    // the wrap-level is-swapping fade.
    wrap.className = 'bento-card-body-rendered' + (hasCover ? '' : ' is-swapping');
    const initialMode = readMode();
    applyMode(wrap, initialMode);
    // Clone children so the original hidden source stays intact for a
    // potential re-open (state isn't destroyed; only inline copies are).
    for (const child of source.children) {
      const cloned = child.cloneNode(true) as HTMLElement;
      wrap.appendChild(cloned);
    }
    // Cards can opt out of the TL;DR ↔ Detailed pill via
    // data-no-mode-toggle (e.g. the stack card, which has a single
    // content mode — rendering the pill would be a no-op control).
    const pillToggle = card.hasAttribute('data-no-mode-toggle')
      ? null
      : buildPillToggle(wrap, initialMode);
    if (pillToggle) body.appendChild(pillToggle);
    body.appendChild(wrap);
    openState.appendedBodyWrap = wrap;
    openState.pillToggle = pillToggle;

    // STICKY HEADER DISABLED — eyebrow + title + pill flow as normal
    // scroll content (their natural positions inside .card-body) and
    // scroll with the body. Keeping the code commented intentionally so
    // restoring is a one-block change. To re-enable: uncomment and the
    // existing CSS + close-time snap will pick up from there.
    //
    //   const eyebrow = body.querySelector<HTMLElement>(':scope > .card-eyebrow');
    //   const title = body.querySelector<HTMLElement>(':scope > .card-title');
    //   if (eyebrow || title || pillToggle) {
    //     const stickyHeader = document.createElement('div');
    //     stickyHeader.className = 'cs-sticky-header';
    //     if (eyebrow) stickyHeader.appendChild(eyebrow);
    //     if (title) stickyHeader.appendChild(title);
    //     if (pillToggle) stickyHeader.appendChild(pillToggle);
    //     body.insertBefore(stickyHeader, body.firstChild);
    //     openState.stickyHeader = stickyHeader;
    //
    //     // Scroll listener that drives --scroll-progress for the title
    //     // shrink + travel CSS. rAF-throttled.
    //     const THRESHOLD = 60;
    //     let rafId = 0;
    //     let lastProgress = -1;
    //     const onScroll = (): void => {
    //       if (rafId) return;
    //       rafId = requestAnimationFrame(() => {
    //         rafId = 0;
    //         const p = Math.max(0, Math.min(1, body.scrollTop / THRESHOLD));
    //         if (Math.abs(p - lastProgress) < 0.005) return;
    //         lastProgress = p;
    //         stickyHeader.style.setProperty('--scroll-progress', String(p));
    //       });
    //     };
    //     body.addEventListener('scroll', onScroll, { passive: true });
    //     openState.detachScrollCollapse = () => {
    //       body.removeEventListener('scroll', onScroll);
    //       if (rafId) cancelAnimationFrame(rafId);
    //     };
    //   }

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

    // Children keep .body-para for paragraph-structural CSS (margins,
    // list-item formatting). The fade is now driven by the wrap's
    // .is-swapping class via the existing opacity transition rule.
    for (const child of wrap.children) {
      (child as HTMLElement).classList.add('body-para');
    }
    if (hasCover) {
      void wrap.offsetHeight;
      // Reveal the content (blur/fade/rise) CONCURRENT with the box morph and
      // lasting its full duration — mirrors the close (content blurs out over
      // the whole collapse). Fires at the morph start, not after it.
      window.setTimeout(() => {
        if (!openState || openState.closing) return;
        card.classList.add('is-content-in');
      }, reduce ? 0 : COVER_MORPH_DELAY);
    } else {
      void wrap.offsetHeight;
      requestAnimationFrame(() => {
        wrap.classList.remove('is-swapping');
      });
    }
  }, hasCover ? 0 : MORPH_DUR);

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
  const { card, placeholder, closeBtn, backdrop, blurTop, blurBottom, originalInline, appendedBodyWrap, pillToggle, stickyHeader, detachScrollCollapse } = state;
  detachScrollCollapse?.();

  // Blur BEFORE the morph so the UA focus outline doesn't trace the shrink.
  card.blur();

  // Snap --scroll-progress back to 0 BEFORE pretext runs. The big title
  // has a transform: scale + translateY driven by the var; pretext
  // animates word spans inside the title and the parent transform
  // would compose with the span transforms, landing them in the wrong
  // place. Setting the var to 0 in this synchronous tick puts the
  // title at identity before the next paint, then pretext takes over.
  // The one-frame title pop is masked by pretext's immediate word
  // animations and the close morph kicking in.
  if (stickyHeader) {
    stickyHeader.style.setProperty('--scroll-progress', '0');
  }
  // (detachScrollCollapse was already called above the close handler so
  // a stray scroll event during the close morph can't raise progress
  // again and re-engage the transform.)

  // Reverse pretext word transforms back to source positions. .is-expanding
  // is still on the card, so the transition rule animates the change.
  if (card.classList.contains('pretext-title')) {
    pretextAnimateCard(card, false);
  }

  const hasCover = card.classList.contains('has-cover');
  const reduce = prefersReducedMotion();
  const morphDur = state.morphDur || readMorphDur(card);

  // Unmount the bottom blur strip immediately — backdrop-filter computes
  // regardless of opacity, so leaving it through the close morph eats GPU.
  blurBottom.remove();
  card.setAttribute('aria-expanded', 'false');

  // Note: the backdrop's `is-open` is dropped in runCollapse (not here) so its
  // blur fades in step with the box collapse rather than at close-init — for
  // cover cards the collapse is delayed behind the content blur-out.
  backdrop.removeEventListener('click', closeCaseStudy);
  document.removeEventListener('keydown', escClose);

  let cleanedUp = false;
  let fallbackTimer = 0;
  const doCleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.clearTimeout(fallbackTimer);
    card.removeEventListener('transitionend', onTransitionEnd);

    // 1) Unwrap the sticky header back into .card-body so the resting
    //    DOM matches what BentoGrid.astro renders. Deferred until here
    //    (rather than at close-start) so the pill + content stay
    //    visually in place through the close morph instead of snapping
    //    to scrollTop=0 + losing the pill the moment the user clicks
    //    close. The morph already fades the pill + body via the
    //    is-collapsing CSS rules, so by this point everything inside
    //    the wrapper is at opacity 0.
    if (stickyHeader && stickyHeader.parentElement) {
      const parent = stickyHeader.parentElement;
      const eyebrow = stickyHeader.querySelector<HTMLElement>(':scope > .card-eyebrow');
      const title = stickyHeader.querySelector<HTMLElement>(':scope > .card-title');
      if (eyebrow) parent.insertBefore(eyebrow, stickyHeader);
      if (title) parent.insertBefore(title, stickyHeader);
      stickyHeader.remove();
      parent.scrollTop = 0;
    }

    // 2) Remove appended children + close button + blur strips.
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
      card.classList.remove(
        'is-expanding',
        'is-collapsing',
        'is-resizing',
        'is-content-in',
        'is-closing-content',
      );
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

  // Collapse the box back to the placeholder slot. Shared by both paths.
  const runCollapse = (): void => {
    // Fade the backdrop blur in step with the box collapse (kept until now so
    // it doesn't vanish ahead of the content blur-out + collapse).
    backdrop.classList.remove('is-open');
    card.classList.remove('is-expanded', 'is-resizing');
    card.classList.add('is-collapsing');
    // Re-measure the placeholder; a resize may have moved it.
    const slotRect = placeholder.getBoundingClientRect();
    card.style.top = `${slotRect.top}px`;
    card.style.left = `${slotRect.left}px`;
    card.style.width = `${slotRect.width}px`;
    card.style.height = `${slotRect.height}px`;
    card.addEventListener('transitionend', onTransitionEnd);
    // Fallback anchored to collapse-start (cover cards delay collapse behind
    // the content blur-out, so a close-init anchor would fire too early).
    fallbackTimer = window.setTimeout(doCleanup, morphDur + 280);
  };

  if (hasCover && !reduce) {
    // Blur the content + modal title out AT THE SAME TIME as the box collapses
    // — content (340ms) and box (760ms) run concurrently. .is-closing-content
    // persists through the collapse (cleared in doCleanup); the resting-title
    // blur-in is free once doCleanup strips the lifecycle classes.
    card.classList.remove('is-content-in');
    card.classList.add('is-closing-content');
  }
  runCollapse();
}

// ── Title rest-y measurement ─────────────────────────────────────────────
// The card-title CSS uses translateY(var(--title-rest-y, 0)) to sit at the
// bottom of the body at rest, and translateY(0) when expanded. The rest-y
// value depends on the card's height (which depends on viewport width via
// the 4:1 aspect ratio), so it has to be measured per card at init and
// re-measured on resize / after each close.
function syncTitleRestY(card: HTMLElement): void {
  // Scoped to project case-study cards only. The stack card's title
  // sits top-left at rest (so it doesn't overlap the marquee strip
  // anchored to the card's bottom) — leaving --title-rest-y at 0
  // keeps it in its natural-flow position.
  if (!card.classList.contains('cs-card')) return;
  // Cover cards: the resting title is the .cover-resttitle overlay; the real
  // .card-title is the modal heading and lives in natural top-flow. No rest-y
  // centering — leave it at the top so the blur cross-dissolve lands there.
  if (card.classList.contains('has-cover')) {
    card.style.setProperty('--title-rest-y', '0px');
    card.style.setProperty('--title-center-x', '0px');
    // Keep the pre-sized content width current for idle cards. Skip the OPEN
    // card — its --modal-w is owned by doOpen / the resize snap, and this runs
    // (via syncAllTitleRestY) before the open-card resize guard.
    if (card !== openState?.card) {
      setModalWidthVar(card, getViewportRect());
    }
    return;
  }
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
  // Match getViewportRect: mobile is edge-to-edge (pad: 0), desktop padded.
  const expandPad = isMobile ? 0 : Math.max(24, Math.min(48, window.innerWidth * 0.05));
  const expandedCardW = isMobile
    ? window.innerWidth
    : Math.min(window.innerWidth - expandPad * 2, 920);
  const expandedBodyPadX = isMobile ? 22 : 48;
  const expandedBodyInnerW = expandedCardW - 2 * expandedBodyPadX;
  const centerX = Math.max(0, (expandedBodyInnerW - titleRect.width) / 2);
  card.style.setProperty('--title-center-x', `${centerX}px`);
}

// Stack card carries a one-line subtitle (.card-text) under the title. The
// title's words morph to centered modal positions via pretext, but the
// subtitle is a regular block — without this measurement it would stay
// left-aligned in the modal while the title slides to center. Measure the
// subtitle's natural width and compute the horizontal offset that lands it
// centered inside the modal body. The CSS uses --subtitle-center-x on
// .is-expanding / .is-expanded (transitioned), reverts on .is-collapsing.
function syncStackSubtitleX(card: HTMLElement): void {
  if (!card.classList.contains('stack-card')) return;
  if (
    card.classList.contains('is-expanding') ||
    card.classList.contains('is-expanded') ||
    card.classList.contains('is-collapsing')
  ) {
    return;
  }
  const subtitle = card.querySelector<HTMLElement>('.card-text');
  if (!subtitle) return;
  // Reset before measuring so width reflects natural-flow geometry.
  card.style.setProperty('--subtitle-center-x', '0px');
  void subtitle.offsetHeight;
  const subtitleRect = subtitle.getBoundingClientRect();
  // Same modal-width math as syncTitleRestY's centerX calc above —
  // keep these in sync if the expanded-body padding ever changes.
  const isMobile = window.innerWidth < 540;
  // Match getViewportRect: mobile is edge-to-edge (pad: 0), desktop padded.
  const expandPad = isMobile ? 0 : Math.max(24, Math.min(48, window.innerWidth * 0.05));
  const expandedCardW = isMobile
    ? window.innerWidth
    : Math.min(window.innerWidth - expandPad * 2, 920);
  const expandedBodyPadX = isMobile ? 22 : 48;
  const expandedBodyInnerW = expandedCardW - 2 * expandedBodyPadX;
  const centerX = Math.max(0, (expandedBodyInnerW - subtitleRect.width) / 2);
  card.style.setProperty('--subtitle-center-x', `${centerX}px`);
}

function syncAllTitleRestY(): void {
  document.querySelectorAll<HTMLElement>('[data-bento-card]').forEach((card) => {
    syncTitleRestY(card);
    syncStackSubtitleX(card);
  });
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
    const guardWindow =
      openState.morphDur +
      (openState.card.classList.contains('has-cover') ? COVER_MORPH_DELAY : 0);
    if (performance.now() - openState.openedAt < guardWindow) return;
    const { card } = openState;

    card.classList.add('is-resizing');
    const vr = getViewportRect();
    // Re-size the pre-laid content to the new modal target (open-card path —
    // deliberately not done in the bulk syncAllTitleRestY loop above).
    setModalWidthVar(card, vr);
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
