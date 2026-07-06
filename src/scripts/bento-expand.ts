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
  // Modal "chrome": mounted at the reveal (morph end), not on the click frame —
  // so null until then. See mountChrome in doOpen.
  closeBtn: HTMLButtonElement | null;
  backdrop: HTMLElement;
  blurTop: HTMLElement | null;
  blurBottom: HTMLElement | null;
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
  /* Resting border-radius captured at open. The card radius is driven inline
     through the morph so it animates (instead of snapping to 0 on mobile under
     the lift's transition:none), and is restored to this on collapse. */
  restRadius: string;
  /* PROTOTYPE: set when this lifecycle was opened via the View Transitions API
     path (doOpenVT) rather than the hand-rolled FLIP (doOpen). Routes the close
     + resize handlers to their VT variants. Undefined on the FLIP path. */
  vt?: boolean;
}

function makeBlurStrip(position: 'top' | 'bottom'): HTMLElement {
  const strip = document.createElement('div');
  strip.className = `card-blur card-blur-${position}`;
  strip.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) strip.appendChild(document.createElement('div'));
  return strip;
}

const MORPH_DUR = 520; // must match --morph-dur in CSS (plain cards)

// Cover cards delay the box morph so the resting title can blur out first.
const COVER_MORPH_DELAY = 180; // ms; matches the choreography overlap

// Cover-card close is a two-beat: content fades out IN PLACE first, then the
// box collapses. This is how long the box waits before collapsing — must match
// --content-close-dur in CSS (the content fade-out duration).
const CONTENT_CLOSE_DUR = 280;

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── View Transitions API prototype (opt-in) ───────────────────────────────
// Enable by adding ?vt or #vt to the URL (mirrors the fps-monitor's ?fps gate),
// so the same Netlify preview build can A/B the compositor-driven VT morph
// against the hand-rolled FLIP on the FPS monitor. Falls back to the FLIP path
// when the browser lacks startViewTransition (Safari < 18.2) or under reduced
// motion (which keeps the existing, well-tested reduced path).
interface ViewTransitionLike {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}
function startViewTransition(update: () => void): ViewTransitionLike | null {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => ViewTransitionLike;
  };
  return doc.startViewTransition ? doc.startViewTransition(update) : null;
}
const VT_NAME = 'bento-expand';
function vtRequested(): boolean {
  return /[?#&]vt\b/.test(location.search + location.hash);
}
function vtEligible(card: HTMLElement): boolean {
  return (
    vtRequested() &&
    typeof (document as { startViewTransition?: unknown }).startViewTransition === 'function' &&
    !prefersReducedMotion()
  );
}

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
  // TEST: full-viewport edge-to-edge expand at ALL widths. Previously gated to
  // window.innerWidth < 540 (mobile edge-to-edge); desktop got a padded 920×720
  // modal centred in the viewport. Flipped globally to evaluate the
  // edge-to-edge treatment on desktop.
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
}

// ── Body scroll lock ─────────────────────────────────────────────────────
// Simple class toggle; CSS sets `body.bento-open { overflow: hidden }`. (An
// earlier attempt to also lock <html> overflow, and then to pin <body> with
// position:fixed, both caused WebKit-specific jank — reverted.)
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

// ── Open ─────────────────────────────────────────────────────────────────
function openCaseStudy(card: HTMLElement): void {
  if (openState) return;
  if (vtEligible(card)) doOpenVT(card);
  else doOpen(card);
}

function doOpen(card: HTMLElement): void {

  const backdrop = document.querySelector<HTMLElement>('[data-bento-backdrop]');
  if (!backdrop) return;

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
  // The card's CSS aspect-ratio (4/1, or 1/1 mobile) makes WebKit interpolate
  // width/height OUT OF SYNC with top/left during the morph — the box reaches
  // full size faster than it travels to center, reading as "expands then jumps
  // to center" (Safari/iOS, open + collapse). Explicit w/h already override
  // aspect-ratio; null it so the four geometry props transition in lockstep.
  card.style.aspectRatio = 'auto';
  // Hold the radius inline at its rest value so the mobile `border-radius: 0`
  // from the .is-expanding CLASS (which lands now, under transition:none) can't
  // snap the corners. applyMorphTarget animates it once the transition is live.
  card.style.borderRadius = cs.borderTopLeftRadius;

  // Modal "chrome" — the close button + the Apple-style progressive edge blur
  // strips — is mounted at the content-reveal moment (when the morph has
  // ended), NOT here on the click frame. Two reasons:
  //   1. Inserting the backdrop-filter strips (12 nodes, 10 filter layers)
  //      forces compositing setup + a warm-up paint that was landing on the
  //      open click frame (part of the ~70-90fps open dip).
  //   2. The strips only frost SCROLLED CONTENT, which doesn't exist until the
  //      reveal; and the close button only needs to be clickable once the box
  //      has settled. Escape + a backdrop click still close during the morph,
  //      so there's no lost affordance.
  // Guarded on openState identity (card) so a stale callback after a close +
  // re-open can't mount chrome onto the wrong lifecycle.
  const mountChrome = (): void => {
    if (!openState || openState.closing || openState.card !== card) return;
    if (openState.closeBtn) return; // idempotent

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'cs-close';
    closeBtn.setAttribute('aria-label', 'Close case study');
    closeBtn.appendChild(makeCloseIcon());
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeCaseStudy();
    });
    card.appendChild(closeBtn);
    openState.closeBtn = closeBtn;

    const blurTop = makeBlurStrip('top');
    const blurBottom = makeBlurStrip('bottom');
    card.appendChild(blurTop);
    card.appendChild(blurBottom);
    openState.blurTop = blurTop;
    openState.blurBottom = blurBottom;

    // Double-rAF before flipping .is-on so the browser fully paints the
    // backdrop-filter layers at opacity:0 first. Without the warm-up frame the
    // GPU rasterizes the filter as the opacity transition starts and the blur
    // visibly "pops" instead of fading.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!openState || openState.closing || openState.card !== card) return;
        blurTop.classList.add('is-on');
        blurBottom.classList.add('is-on');
      });
    });
  };

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
    // TEST: square corners at all widths to match the full-viewport edge-to-edge
    // expand (was: 0 ≤540px, rest radius on desktop). Driven inline (transition
    // now live) so it animates instead of snapping.
    card.style.borderRadius = '0px';
    // Animate pretext word spans to modal positions in lockstep with the morph.
    if (card.classList.contains('pretext-title')) {
      pretextAnimateCard(card, true);
    }
  };

  // Cover cards delay the box morph by COVER_MORPH_DELAY so the resting-title
  // blur-out + cover frost lead the box expand ("frost-first"). The WebKit jump
  // this once seemed to cause was actually the aspect-ratio desync (fixed at
  // the lift above), so the delay is safe again. Plain/reduced-motion morph on
  // the next frame.
  if (hasCover && !reduce) {
    window.setTimeout(() => {
      if (!openState || openState.closing) return;
      requestAnimationFrame(() => {
        if (!openState || openState.closing) return;
        applyMorphTarget();
        // Build the (heavy) modal content ONE FRAME into the morph — the box is
        // now animating on the compositor and the main thread is idle, so the
        // deep content clone no longer competes with the click / first-paint
        // frames (the ~70-80fps open dip). Chaining off applyMorphTarget's rAF
        // (rather than a fixed delay) guarantees the clone lands AFTER the morph
        // has committed, not racing it. mountContent schedules its own reveal at
        // +morphDur — i.e. when the box settles.
        requestAnimationFrame(() => {
          if (openState && !openState.closing) mountContent();
        });
      });
    }, COVER_MORPH_DELAY);
  } else {
    requestAnimationFrame(applyMorphTarget);
    // Plain cards mount after the morph (for the .is-swapping fade); cover +
    // reduced-motion mounts immediately (no morph beat to wait behind).
    window.setTimeout(() => {
      if (openState && !openState.closing) mountContent();
    }, hasCover ? 0 : MORPH_DUR);
  }

  openState = {
    card,
    placeholder,
    closeBtn: null,
    backdrop,
    blurTop: null,
    blurBottom: null,
    originalInline,
    appendedBodyWrap: null,
    pillToggle: null,
    stickyHeader: null,
    detachScrollCollapse: null,
    closing: false,
    openedAt: performance.now(),
    morphDur,
    restRadius: cs.borderTopLeftRadius,
  };

  // Build the modal content: clone the hidden body source into the visible
  // card-body and fade it in. Defined as a function (not an inline timer) so the
  // scheduler above chooses WHEN to run it — cover cards chain it one frame into
  // the morph (keeping the click frame light); plain cards run it after the
  // morph for the .is-swapping fade. Single wrap-level opacity transition, same
  // pattern as the TL;DR ↔ Detailed swap. Guard against close-during-open at the
  // top (openState may be gone, or .closing, before this runs).
  const mountContent = (): void => {
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

    // Reset the scroll container to the top on every open. .card-body is a
    // persistent element (only its appended content is cloned/removed per
    // lifecycle), so its scrollTop survives a close → reopen: scroll down,
    // close, reopen, and the case study would re-open mid-scroll with the
    // eyebrow stranded under the top progressive-blur band. The close-time
    // reset (parent.scrollTop = 0 in doCleanup) only fires inside the
    // disabled sticky-header branch, so it never runs — pin it here once the
    // fresh content is in place so every open starts at the true top.
    body.scrollTop = 0;

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
      // Reveal the content AFTER the box has finished expanding, not during —
      // a distinct second beat (settled box → content fades in), not racing the
      // expand. mountContent is chained one frame INTO the morph for cover
      // cards, so the box settles ~morphDur after this runs; fire the reveal
      // then. (Reduced-motion mounts up front, so reveal immediately.) The
      // reveal's own duration lives in the .is-content-in CSS rule.
      window.setTimeout(() => {
        if (!openState || openState.closing) return;
        card.classList.add('is-content-in');
        // Mount the close button + edge blur strips now that the box has
        // settled and there's content to frost (off the click frame).
        mountChrome();
      }, reduce ? 0 : morphDur);
    } else {
      void wrap.offsetHeight;
      requestAnimationFrame(() => {
        wrap.classList.remove('is-swapping');
        mountChrome();
      });
    }
  };

  // Escape + backdrop-click close even during the morph (before the close
  // button mounts at reveal). The close button's own click handler is wired in
  // mountChrome.
  backdrop.addEventListener('click', closeCaseStudy, { once: true });
  document.addEventListener('keydown', escClose);
}

// ── View Transitions API open path (PROTOTYPE, opt-in via ?vt) ─────────────
// A single-beat compositor cross-fade of the whole card (cover included) via
// document.startViewTransition, instead of the FLIP path's hand-rolled layout-
// property morph. The card carries .vt-open for the duration so its internal
// CSS transitions are suppressed (see src/styles/global.css) — the ONLY motion
// is the VT group morph + root cross-fade.

// Synchronous mirror of doOpen's mountContent body cloning, WITHOUT the
// is-swapping / is-content-in opacity-fade choreography (the VT snapshot cross-
// fades the whole card in one beat). Appends the pill + rendered wrap into
// .card-body and returns them so the close path can remove them.
function buildBodyContentVT(
  card: HTMLElement,
): { wrap: HTMLElement; pillToggle: HTMLElement | null } | null {
  const body = card.querySelector<HTMLElement>('.card-body');
  const source = card.querySelector<HTMLElement>('.bento-card-body');
  if (!body || !source) return null;

  const wrap = document.createElement('div');
  wrap.className = 'bento-card-body-rendered';
  const initialMode = readMode();
  applyMode(wrap, initialMode);
  for (const child of source.children) {
    wrap.appendChild(child.cloneNode(true) as HTMLElement);
  }
  const pillToggle = card.hasAttribute('data-no-mode-toggle')
    ? null
    : buildPillToggle(wrap, initialMode);
  if (pillToggle) body.appendChild(pillToggle);
  body.appendChild(wrap);

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

  for (const child of wrap.children) {
    (child as HTMLElement).classList.add('body-para');
  }
  body.scrollTop = 0;
  return { wrap, pillToggle };
}

// PROTOTYPE: dedupe with the mountChrome closure in doOpen once the VT path is
// proven. Kept as a parallel module-level fn (mountChrome is a doOpen-local
// closure over its own `card`) so refactoring can't destabilise the FLIP path.
function mountChromeVT(card: HTMLElement): void {
  if (!openState || openState.closing || openState.card !== card) return;
  if (openState.closeBtn) return; // idempotent

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'cs-close';
  closeBtn.setAttribute('aria-label', 'Close case study');
  closeBtn.appendChild(makeCloseIcon());
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeCaseStudy();
  });
  card.appendChild(closeBtn);
  openState.closeBtn = closeBtn;

  const blurTop = makeBlurStrip('top');
  const blurBottom = makeBlurStrip('bottom');
  card.appendChild(blurTop);
  card.appendChild(blurBottom);
  openState.blurTop = blurTop;
  openState.blurBottom = blurBottom;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!openState || openState.closing || openState.card !== card) return;
      blurTop.classList.add('is-on');
      blurBottom.classList.add('is-on');
    });
  });
}

function doOpenVT(card: HTMLElement): void {
  const backdrop = document.querySelector<HTMLElement>('[data-bento-backdrop]');
  if (!backdrop) return;

  const vr = getViewportRect();
  setModalWidthVar(card, vr);

  const originalInline = card.getAttribute('style') ?? '';
  const cs = getComputedStyle(card);
  const restRadius = cs.borderTopLeftRadius;
  const morphDur = readMorphDur(card);

  // Build the grid placeholder DETACHED — inserted inside the VT capture
  // callback so it isn't part of the "old" snapshot.
  const rect = card.getBoundingClientRect();
  const placeholder = document.createElement('div');
  placeholder.className = 'bento-card-placeholder';
  placeholder.style.gridColumnStart = cs.gridColumnStart;
  placeholder.style.gridColumnEnd = cs.gridColumnEnd;
  placeholder.style.gridRowStart = cs.gridRowStart;
  placeholder.style.gridRowEnd = cs.gridRowEnd;
  placeholder.style.height = `${rect.height}px`;
  placeholder.style.aspectRatio = 'auto';

  // Drive the pseudo-element animation duration so the VT morph matches the
  // FLIP --morph-dur for a duration-fair A/B.
  document.documentElement.style.setProperty('--vt-dur', `${morphDur}ms`);

  // Suppress the card's internal CSS transitions for the whole VT lifecycle.
  card.classList.add('vt-open');
  // Name the card BEFORE the snapshot capture so the VT engine morphs it as a
  // named group across the old/new states.
  card.style.setProperty('view-transition-name', VT_NAME);

  // Create openState now so the capture callback + later close can see it.
  openState = {
    card,
    placeholder,
    closeBtn: null,
    backdrop,
    blurTop: null,
    blurBottom: null,
    originalInline,
    appendedBodyWrap: null,
    pillToggle: null,
    stickyHeader: null,
    detachScrollCollapse: null,
    closing: false,
    openedAt: performance.now(),
    morphDur,
    restRadius,
    vt: true,
  };

  const vt = startViewTransition(() => {
    // Captured "new" (expanded) state — flushed synchronously.
    card.parentNode?.insertBefore(placeholder, card);
    // VT owns the morph; the live element must NOT re-animate geometry on the
    // main thread, so lift it with transition off to its final fixed box.
    card.style.transition = 'none';
    card.style.position = 'fixed';
    card.style.top = `${vr.top}px`;
    card.style.left = `${vr.left}px`;
    card.style.width = `${vr.width}px`;
    card.style.height = `${vr.height}px`;
    card.style.margin = '0';
    card.style.transform = 'none';
    card.style.aspectRatio = 'auto';
    card.style.borderRadius = '0px';
    // is-content-in is REQUIRED here, not just for the FLIP reveal beat: on
    // has-cover cards the modal content (.card-eyebrow/.card-title/pill/prose)
    // defaults to opacity:0 and is revealed ONLY by .is-content-in (see
    // BentoGrid.astro). Without it the VT "new" snapshot captures an empty
    // cover-only box with all text invisible. .vt-open suppresses the reveal
    // transition, so it lands instantly and VT cross-fades it via the snapshot.
    card.classList.add('is-expanding', 'is-expanded', 'is-content-in');
    card.setAttribute('aria-expanded', 'true');
    backdrop.classList.add('is-open');
    lockBodyScroll();
    const built = buildBodyContentVT(card);
    if (built && openState) {
      openState.appendedBodyWrap = built.wrap;
      openState.pillToggle = built.pillToggle;
    }
  });

  // Escape + backdrop-click close even during the morph.
  backdrop.addEventListener('click', closeCaseStudy, { once: true });
  document.addEventListener('keydown', escClose);

  // After the morph settles, drop the name + mount chrome (close button + blur
  // strips) off the transition.
  const afterOpen = (): void => {
    if (!openState || openState.closing || openState.card !== card) return;
    card.style.removeProperty('view-transition-name');
    mountChromeVT(card);
  };
  if (vt) vt.finished.then(afterOpen).catch(afterOpen);
  else afterOpen();
}

function closeCaseStudyVT(state: OpenState): void {
  const {
    card,
    placeholder,
    backdrop,
    closeBtn,
    blurTop,
    blurBottom,
    originalInline,
    appendedBodyWrap,
    pillToggle,
    restRadius,
  } = state;
  void restRadius; // VT owns the radius morph; unused here (kept for parity).

  // Blur BEFORE the morph so the UA focus outline doesn't trace the shrink.
  card.blur();
  const focused = document.activeElement as HTMLElement | null;
  if (focused && card.contains(focused)) focused.blur();

  card.setAttribute('aria-expanded', 'false');

  backdrop.removeEventListener('click', closeCaseStudy);
  document.removeEventListener('keydown', escClose);

  // Re-assert the name so the collapsed state is captured as the same group.
  card.style.setProperty('view-transition-name', VT_NAME);

  const vt = startViewTransition(() => {
    // Captured "new" (collapsed) state.
    appendedBodyWrap?.remove();
    pillToggle?.remove();
    closeBtn?.remove();
    blurTop?.remove();
    blurBottom?.remove();
    backdrop.classList.remove('is-open');
    // Drop is-content-in too (added in doOpenVT) so the collapsed snapshot
    // hides the has-cover modal content again (opacity:0) and the resting
    // .cover-resttitle shows through — otherwise the card-title stays visible
    // in the collapsed state.
    card.classList.remove('is-expanded', 'is-expanding', 'is-content-in');
    // Restore resting inline styles. This wipes the inline view-transition-name,
    // so re-set it immediately after so the collapsed snapshot keeps the group.
    if (originalInline) card.setAttribute('style', originalInline);
    else card.removeAttribute('style');
    card.style.setProperty('view-transition-name', VT_NAME);
    placeholder.remove();
  });

  const afterClose = (): void => {
    card.classList.remove('vt-open');
    card.style.removeProperty('view-transition-name');
    document.documentElement.style.removeProperty('--vt-dur');
    card.blur();
    if (document.fonts?.check?.('24px Fraunces')) pretextRenderCard(card, getViewportRect);
    syncTitleRestY(card);
    unlockBodyScroll();
    openState = null;
  };
  if (vt) vt.finished.then(afterClose).catch(afterClose);
  else afterClose();
}

function escClose(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeCaseStudy();
}

// ── Close ────────────────────────────────────────────────────────────────
function closeCaseStudy(): void {
  if (!openState || openState.closing) return;
  openState.closing = true;
  const state = openState;
  // PROTOTYPE: route VT-opened lifecycles to the compositor-driven close.
  if (state.vt) { closeCaseStudyVT(state); return; }
  const { card, placeholder, closeBtn, backdrop, blurTop, blurBottom, originalInline, appendedBodyWrap, pillToggle, stickyHeader, detachScrollCollapse } = state;
  detachScrollCollapse?.();

  // Blur BEFORE the morph so the UA focus outline doesn't trace the shrink.
  // Also blur whatever's focused INSIDE the card (e.g. the TL;DR/Detailed pill
  // the user just used) — on keyboard close (Esc) its focus-visible ring would
  // otherwise linger / get stranded as the element is removed during cleanup.
  card.blur();
  const focused = document.activeElement as HTMLElement | null;
  if (focused && card.contains(focused)) focused.blur();

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
  // (May be null if the user closed before the chrome mounted at reveal.)
  blurBottom?.remove();
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
      // NOTE: this scrollTop reset is dead while the sticky header is disabled
      // (stickyHeader is always null, so this branch never runs). It is NOT the
      // reset that keeps every open starting at the top — that lives in
      // mountContent (`body.scrollTop = 0`), which fires once the fresh content
      // is mounted and the container is actually scrollable. Resetting here
      // (at cleanup, after the scrollable content has already been removed)
      // would be a no-op the browser can later undo via scroll restoration.
      // Kept for if/when the sticky header is re-enabled.
      parent.scrollTop = 0;
    }

    // 2) Remove appended children + close button + blur strips. The chrome
    //    (closeBtn / blur strips) is null if the user closed before it mounted
    //    at reveal, so guard each removal.
    if (appendedBodyWrap) appendedBodyWrap.remove();
    if (pillToggle) pillToggle.remove();
    closeBtn?.remove();
    blurTop?.remove();
    blurBottom?.remove();

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
    // Morph the radius back to rest (animates 0 → rest on mobile, instead of
    // staying square then snapping at cleanup).
    card.style.borderRadius = state.restRadius;
    card.addEventListener('transitionend', onTransitionEnd);
    // Fallback anchored to collapse-start (cover cards delay collapse behind
    // the content blur-out, so a close-init anchor would fire too early).
    fallbackTimer = window.setTimeout(doCleanup, morphDur + 280);
  };

  if (hasCover && !reduce) {
    // Two-beat close (mirror of the open's expand → settle → reveal): fade the
    // content out IN PLACE first while the box stays fully expanded, THEN
    // collapse the now-empty box. Without the wait the content fades while the
    // box is shrinking under it, reading as the text sliding/clipping with the
    // collapse. .is-closing-content drives the content opacity fade-out (over
    // --content-close-dur); it persists through the collapse and is cleared in
    // doCleanup, when the resting-title blur-in becomes free.
    card.classList.remove('is-content-in');
    card.classList.add('is-closing-content');
    window.setTimeout(() => {
      // Guard against a teardown having run in the gap (openState is held
      // until doCleanup, which only fires from runCollapse — so this normally
      // holds, but stay defensive).
      if (openState === state && state.closing) runCollapse();
    }, CONTENT_CLOSE_DUR);
  } else {
    runCollapse();
  }
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
  // TEST: full-viewport expand at all widths — expandedCardW must match
  // getViewportRect's full-viewport width. Body padding still follows the CSS
  // (.is-expanded .card-body): 22px ≤540px, else 48px.
  const expandedCardW = window.innerWidth;
  const expandedBodyPadX = window.innerWidth < 540 ? 22 : 48;
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
  // TEST: full-viewport expand at all widths (matches getViewportRect).
  const expandedCardW = window.innerWidth;
  const expandedBodyPadX = window.innerWidth < 540 ? 22 : 48;
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
    // The VT-prototype open keeps the card as a plain fixed full-viewport box;
    // skip the FLIP recenter snap (which assumes the FLIP inline-style regime).
    if (openState.vt) return;
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
