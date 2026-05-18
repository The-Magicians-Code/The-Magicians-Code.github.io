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
  appendedBodyWrap: HTMLElement | null;
  closing: boolean;
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

// ── Body scroll lock + shift compensation (body + fixed elements) ───────
// Locking body scroll hides the html scrollbar, which widens the viewport
// by the scrollbar width (~15px). Two visual side-effects:
//   1. Body's flow content (e.g. centered .page wrapper) re-centers within
//      the wider body and shifts right by sbw/2.
//   2. position:fixed elements anchored via `right: …` shift right by sbw.
// Both need compensation to avoid visible motion at lock/unlock.
//   - Body fix: add padding-right: sbw to body so its content stays put.
//   - Fixed-element fix: query [data-scroll-lock-compensate] elements and
//     bump their inline `right` by sbw. Opt-in via the attribute.
function getScrollLockEls(): NodeListOf<HTMLElement> {
  return document.querySelectorAll<HTMLElement>('[data-scroll-lock-compensate]');
}

function lockBodyScroll(): void {
  const sbw = window.innerWidth - document.documentElement.clientWidth;
  if (sbw > 0) {
    // Body padding compensation for flow / centered content.
    const currentBodyPad = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
    document.body.dataset.bentoPrevPaddingRight = document.body.style.paddingRight || '';
    document.body.style.paddingRight = `${currentBodyPad + sbw}px`;

    // Per-element `right` compensation for fixed-positioned ancestors of
    // the viewport (nav, blur layer, tuners).
    getScrollLockEls().forEach((el) => {
      const currentRight = parseFloat(getComputedStyle(el).right) || 0;
      el.dataset.bentoPrevRight = el.style.right;
      el.style.right = `${currentRight + sbw}px`;
    });
  }
  document.body.classList.add('bento-open');
}

function unlockBodyScroll(): void {
  document.body.classList.remove('bento-open');
  if ('bentoPrevPaddingRight' in document.body.dataset) {
    document.body.style.paddingRight = document.body.dataset.bentoPrevPaddingRight ?? '';
    delete document.body.dataset.bentoPrevPaddingRight;
  }
  getScrollLockEls().forEach((el) => {
    if ('bentoPrevRight' in el.dataset) {
      el.style.right = el.dataset.bentoPrevRight ?? '';
      delete el.dataset.bentoPrevRight;
    }
  });
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

// ── Pretext title rendering ──────────────────────────────────────────────
// Replace each card-title's text node with absolutely-positioned <span class="word">
// elements pre-computed at TWO widths: the card's rest width and the modal target
// width. Each span carries data-sx/sy/mx/my (source/modal x,y) and starts with
// transform: translate(sx, sy). On open we set transforms to (mx, my); on close
// back to (sx, sy). The CSS transition on .is-expanding .word interpolates them.
//
// Visual payoff: when a multi-word title's line breaks differ between rest and
// modal widths, each word slides to its new home rather than the whole title
// reflowing mid-morph. For single-word titles it's a no-op (positions match).
//
// Port of docs/ideas/bento-mchiu.html's pretext machinery. Font-size stays
// constant at 24px throughout — "growth" comes from horizontal layout changes.

interface WordMetric {
  word: string;
  width: number;
  spaceWidth: number;
}

interface WordPosition {
  word: string;
  x: number;
  y: number;
  line: number;
}

interface LayoutResult {
  positions: WordPosition[];
  lineWidths: number[];
}

const TITLE_FONT_SIZE = 24;
const TITLE_LINE_HEIGHT_RATIO = 1.15;
const PRETEXT_FONT = `400 ${TITLE_FONT_SIZE}px 'Fraunces', Georgia, serif`;

const _measureCanvas: HTMLCanvasElement | null =
  typeof document !== 'undefined' ? document.createElement('canvas') : null;
const _measureCtx: CanvasRenderingContext2D | null = _measureCanvas?.getContext('2d') ?? null;

function pretextMeasureWords(text: string): WordMetric[] {
  if (!_measureCtx) return [];
  _measureCtx.font = PRETEXT_FONT;
  const spaceWidth = _measureCtx.measureText(' ').width;
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      word,
      width: _measureCtx!.measureText(word).width,
      spaceWidth,
    }));
}

function pretextLayout(words: WordMetric[], maxWidth: number, lineHeight: number): LayoutResult {
  const positions: WordPosition[] = [];
  const lineWidths: number[] = [];
  if (words.length === 0) return { positions, lineWidths };
  let x = 0;
  let line = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (x > 0 && x + w.width > maxWidth) {
      lineWidths[line] = positions[positions.length - 1].x + words[i - 1].width;
      line++;
      x = 0;
    }
    positions.push({ word: w.word, x, y: line * lineHeight, line });
    x += w.width + w.spaceWidth;
  }
  lineWidths[line] = positions[positions.length - 1].x + words[words.length - 1].width;
  return { positions, lineWidths };
}

function pretextCenterPositions(
  positions: WordPosition[],
  lineWidths: number[],
  containerWidth: number,
): WordPosition[] {
  return positions.map((p) => ({
    ...p,
    x: p.x + (containerWidth - lineWidths[p.line]) / 2,
  }));
}

function pretextOriginalTitle(titleEl: HTMLElement): string {
  // Cache the original text so re-renders don't accumulate "WordWordWord" (no spaces).
  if (titleEl.dataset.pretextOrig) return titleEl.dataset.pretextOrig;
  const text = (titleEl.textContent ?? '').trim();
  titleEl.dataset.pretextOrig = text;
  return text;
}

// Set to false to disable per-word pretext layout interpolation.
// When disabled, project-card titles flow as normal text and rely solely
// on the container's translateY(rest-y → 0) for the vertical animation —
// matches the stack card's "title doesn't morph" feel while still moving
// from rest-centered to expanded-top. Disabled by default because the
// per-word transforms produced a diagonal "wiggle" against card-body
// padding interpolation and text-align:center re-centering.
const PRETEXT_ENABLED = false;

function pretextRenderCard(card: HTMLElement): void {
  if (!PRETEXT_ENABLED) return;
  if (!_measureCtx) return;
  if (!card.classList.contains('cs-card')) return;
  const titleEl = card.querySelector<HTMLElement>('.card-title');
  if (!titleEl) return;
  const titleText = pretextOriginalTitle(titleEl);
  if (!titleText) return;

  // Source width: actual card width minus its body's horizontal padding.
  const body = card.querySelector<HTMLElement>('.card-body');
  if (!body) return;
  const bodyStyles = getComputedStyle(body);
  const bodyPadX =
    (parseFloat(bodyStyles.paddingLeft) || 0) + (parseFloat(bodyStyles.paddingRight) || 0);
  const sourceWidth = card.getBoundingClientRect().width - bodyPadX;

  // Modal width: viewport-centered target minus the expanded body's horizontal padding.
  const vr = getViewportRect();
  const modalHPad = window.innerWidth <= 540 ? 22 : 48;
  const modalWidth = vr.width - modalHPad * 2;

  if (sourceWidth <= 0 || modalWidth <= 0) return;

  const metrics = pretextMeasureWords(titleText);
  if (metrics.length === 0) return;

  const lineHeight = TITLE_FONT_SIZE * TITLE_LINE_HEIGHT_RATIO;
  const sourceLayout = pretextLayout(metrics, sourceWidth, lineHeight);
  const modalLayout = pretextLayout(metrics, modalWidth, lineHeight);
  const sourcePositions = pretextCenterPositions(
    sourceLayout.positions,
    sourceLayout.lineWidths,
    sourceWidth,
  );
  const modalPositions = pretextCenterPositions(
    modalLayout.positions,
    modalLayout.lineWidths,
    modalWidth,
  );

  titleEl.replaceChildren();
  for (let i = 0; i < sourcePositions.length; i++) {
    const sp = sourcePositions[i];
    const mp = modalPositions[i];
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = sp.word;
    span.style.transform = `translate(${sp.x.toFixed(2)}px, ${sp.y}px)`;
    span.dataset.sx = sp.x.toFixed(2);
    span.dataset.sy = String(sp.y);
    span.dataset.mx = mp.x.toFixed(2);
    span.dataset.my = String(mp.y);
    titleEl.appendChild(span);
  }

  // Title container must be tall enough to hold the taller of the two layouts.
  const sourceMaxLine =
    sourceLayout.positions.length > 0
      ? sourceLayout.positions[sourceLayout.positions.length - 1].line
      : 0;
  const modalMaxLine =
    modalLayout.positions.length > 0
      ? modalLayout.positions[modalLayout.positions.length - 1].line
      : 0;
  const tallestLine = Math.max(sourceMaxLine, modalMaxLine);
  titleEl.style.height = `${(tallestLine + 1) * lineHeight}px`;

  card.classList.add('pretext-title');
}

function pretextAnimateCard(card: HTMLElement, toModal: boolean): void {
  card.querySelectorAll<HTMLElement>('.card-title .word').forEach((span) => {
    const x = toModal ? span.dataset.mx : span.dataset.sx;
    const y = toModal ? span.dataset.my : span.dataset.sy;
    if (x == null || y == null) return;
    span.style.transform = `translate(${x}px, ${y}px)`;
  });
}

function pretextRenderAll(skipCard?: HTMLElement | null): void {
  document.querySelectorAll<HTMLElement>('[data-bento-card]').forEach((card) => {
    if (card === skipCard) return;
    // Skip cards mid-lifecycle — their rect reflects the modal, not rest.
    if (
      card.classList.contains('is-expanding') ||
      card.classList.contains('is-expanded') ||
      card.classList.contains('is-collapsing')
    ) {
      return;
    }
    pretextRenderCard(card);
  });
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
    originalInline,
    appendedBodyWrap: null,
    closing: false,
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
  if (e.key === 'Escape') closeCaseStudy();
}

// ── Close ────────────────────────────────────────────────────────────────
function closeCaseStudy(): void {
  if (!openState || openState.closing) return;
  openState.closing = true;
  const state = openState;
  const { card, placeholder, closeBtn, backdrop, originalInline, appendedBodyWrap } = state;

  // Blur BEFORE the morph so the UA focus outline doesn't trace the shrink.
  card.blur();

  // Fade out appended body content (CSS handles the 180ms tail via the
  // .is-collapsing rule that immediately follows).
  if (appendedBodyWrap) {
    [...appendedBodyWrap.children].forEach((el) => el.classList.remove('in'));
  }

  // Reverse pretext word transforms back to source positions. .is-expanding
  // is still on the card, so the transition rule animates the change.
  if (card.classList.contains('pretext-title')) {
    pretextAnimateCard(card, false);
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
  backdrop.removeEventListener('click', closeCaseStudy);
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
      // Belt-and-suspenders re-blur. Focus is intentionally NOT restored to
      // the card on keyboard close — restoring focus triggers :focus-visible
      // and the browser draws a default focus outline that reads as a white
      // boundary line around the card. Permanent visual cleanliness wins
      // over keyboard place-keeping for v1.
      card.blur();
      // Re-render pretext + re-measure rest-y in case viewport changed
      // during the open. Order matters: pretext sets the title height,
      // rest-y depends on that height.
      pretextRenderCard(card);
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
  void body.offsetHeight;
  // Vertically center the title within the body: translate by the delta
  // between body's vertical center and title's natural-flow vertical center.
  const bodyRect = body.getBoundingClientRect();
  const titleRect = title.getBoundingClientRect();
  const yOffset =
    bodyRect.top + bodyRect.height / 2 - (titleRect.top + titleRect.height / 2);
  card.style.setProperty('--title-rest-y', `${yOffset}px`);
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

    // Re-render pretext for all idle cards (their card width changed with
    // the viewport via the 4:1 aspect ratio), then re-measure rest-y.
    pretextRenderAll(openState?.card ?? null);
    syncAllTitleRestY();

    if (!openState || openState.closing) return;
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

  // Pretext word measurement + title rest-y both depend on the rendered
  // font (Fraunces, loaded from Google Fonts). Gate on document.fonts.ready
  // so the measurement uses actual serif metrics rather than the fallback.
  // Order matters: pretext sets the title's height (multi-line layouts can
  // be taller than a single line); rest-y depends on that final height.
  const measureWhenFontsReady = (): void => {
    const run = (): void => {
      pretextRenderAll();
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
