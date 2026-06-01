// Eased scroll-driven hero for the homepage.
//
// Two scroll signals, on purpose:
//   • NATIVE window.scrollY drives the structural reveal (clip-path + opacity)
//     so the clip edges stay glued to the real scroll position — no lag.
//   • An EASED value (current) drives decorative motion (backdrop zoom, card
//     drift) for a Lenis-like feel without hijacking the page scroll.
//
// All math is section-local (scrollY - sectionTop). Honors prefers-reduced-
// motion: the rAF loop never runs and inline styles are cleared, leaving the
// CSS static fallback in charge. Vanilla rAF, one shared tick.

const SECTION = 1100; // px of local scroll over which the clip fully opens
const FADE_END = 1600; // px of local scroll at which the backdrop is fully gone
const CLIP_START = 12; // % inset at rest (a centered window)
const ZOOM_START = 1.25; // backdrop scale at rest
const DRIFT = 0.5; // card translateY multiplier
const LERP = 0.08; // eased-scroll smoothing factor
const SETTLE = 0.1; // px; snap + stop the loop once eased ≈ native

interface Card {
  el: HTMLElement;
  start: number;
  end: number;
  baseTop: number; // untransformed document-space top
  h: number;
}

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

function lerp(x: number, ix0: number, ix1: number, oy0: number, oy1: number): number {
  const t = Math.min(1, Math.max(0, (x - ix0) / (ix1 - ix0)));
  return oy0 + (oy1 - oy0) * t;
}

function init(): void {
  const section = document.querySelector<HTMLElement>('[data-scroll-hero]');
  if (!section) return;
  const centerWrap = section.querySelector<HTMLElement>('[data-psh-center]');
  const centerImg = section.querySelector<HTMLElement>('[data-psh-center-img]');
  if (!centerWrap || !centerImg) return;

  const cards: Card[] = [...section.querySelectorAll<HTMLElement>('[data-psh-card]')].map(
    (el) => ({
      el,
      start: Number.parseFloat(el.dataset.start ?? '0') || 0,
      end: Number.parseFloat(el.dataset.end ?? '0') || 0,
      baseTop: 0,
      h: 0,
    }),
  );

  let sectionTop = 0;
  let viewportH = 0;
  let target = 0;
  let current = 0;
  let running = false;
  let inView = true;
  let raf = 0;

  // Measure positions with transforms cleared, in document space, so the card
  // progress invariant never feeds its own transform back into the measurement.
  // viewportH comes from the sticky element's box (which is 100svh) rather than
  // window.innerHeight — the two diverge on iOS Safari when the toolbar
  // collapses without firing a resize event.
  function measure(): void {
    sectionTop = section!.getBoundingClientRect().top + window.scrollY;
    viewportH = centerWrap!.getBoundingClientRect().height || window.innerHeight;
    for (const c of cards) {
      const prev = c.el.style.transform;
      c.el.style.transform = 'none';
      const r = c.el.getBoundingClientRect();
      c.baseTop = r.top + window.scrollY;
      c.h = r.height;
      c.el.style.transform = prev;
    }
  }

  function render(): void {
    const vh = viewportH;
    const rect = section!.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) return; // off-screen: don't paint

    const nativeLocal = window.scrollY - sectionTop;
    const easedLocal = current - sectionTop;

    // structural reveal — native scroll
    centerWrap!.style.clipPath = `inset(${lerp(nativeLocal, 0, SECTION, CLIP_START, 0)}%)`;
    centerWrap!.style.opacity = String(lerp(nativeLocal, SECTION, FADE_END, 1, 0));

    // decorative zoom — eased
    centerImg!.style.transform = `scale(${lerp(easedLocal, 0, FADE_END, ZOOM_START, 1)})`;

    // card drift — eased; progress over each card's own viewport transit
    for (const c of cards) {
      const top = c.baseTop - current;
      const prog = Math.min(1, Math.max(0, (vh - top) / (vh + c.h)));
      const ty = (c.start + (c.end - c.start) * prog) * DRIFT;
      const exit = Math.min(1, Math.max(0, (prog - 0.75) / 0.25));
      c.el.style.transform = `translate3d(0, ${ty}px, 0) scale(${1 - exit * 0.15})`;
      c.el.style.opacity = String(1 - exit);
    }
  }

  function frame(): void {
    current += (target - current) * LERP;
    if (Math.abs(target - current) < SETTLE) current = target;
    render();
    if (current !== target) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
    }
  }

  function requestTick(): void {
    if (reduceMQ.matches || !inView) return;
    target = window.scrollY;
    if (!running) {
      running = true;
      raf = requestAnimationFrame(frame);
    }
  }

  function clearInline(): void {
    centerWrap!.style.clipPath = '';
    centerWrap!.style.opacity = '';
    centerImg!.style.transform = '';
    for (const c of cards) {
      c.el.style.transform = '';
      c.el.style.opacity = '';
    }
  }

  function onResize(): void {
    measure();
    requestTick();
  }

  function applyMotionPref(): void {
    if (reduceMQ.matches) {
      if (running) cancelAnimationFrame(raf);
      running = false;
      clearInline();
    } else {
      measure();
      current = target = window.scrollY;
      requestTick();
    }
  }

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('pageshow', onResize);
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(section);

  // Gate the eased loop to when the hero is on screen. On the homepage the
  // section sits above a long page; without this the loop would keep spinning
  // while the user reads About/Bento/Contact. Snap on exit so re-entry is clean.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[0]!.isIntersecting;
      if (inView) requestTick();
      else current = target = window.scrollY;
    }).observe(section);
  }
  document.fonts?.ready.then(onResize);
  for (const c of cards) {
    const img = c.el.querySelector('img');
    if (img && !img.complete) img.addEventListener('load', onResize, { once: true });
  }

  reduceMQ.addEventListener('change', applyMotionPref);
  applyMotionPref();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

export {}; // ensure module scope so top-level names don't collide with other global scripts

