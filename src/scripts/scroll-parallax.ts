// Scroll-linked parallax + reveal-on-scroll for the homepage.
// Public API (data attributes):
//   data-parallax        on a stage container
//   data-depth="<n>"     on a layer inside a stage (0..2; higher = more travel)
//   data-parallax-mobile on a stage to opt into (reduced) parallax below 641px
// Honors prefers-reduced-motion. Desktop-first. Vanilla rAF, one shared tick.

const RANGE = 120; // px of travel per unit depth
const MOBILE_BP = 641; // px; below this, parallax is off unless stage opts in
const MIN_DELTA = 0.5; // px; skip sub-pixel transform writes

interface Layer {
  el: HTMLElement;
  depth: number;
  lastY: number;
}
interface Stage {
  el: HTMLElement;
  layers: Layer[];
  mobile: boolean;
  // Cached document-relative geometry (top from the document origin, + height).
  // Unlike a viewport-relative getBoundingClientRect(), these change only on
  // layout (resize/fonts/etc.), NOT on scroll — so update() can derive the
  // viewport position from a single window.scrollY read, with zero per-frame
  // layout queries (was the dominant forced-reflow source during scroll).
  docTop: number;
  height: number;
}

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

let stages: Stage[] = [];
let ticking = false;
let listening = false;

function parseDepth(raw: string | undefined): number {
  const n = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(n)) return 0;
  return Math.min(2, Math.max(0, n));
}

function collect(): Stage[] {
  return [...document.querySelectorAll<HTMLElement>('[data-parallax]')].map((el) => ({
    el,
    mobile: el.hasAttribute('data-parallax-mobile'),
    // Only own [data-depth] layers whose NEAREST [data-parallax] ancestor is
    // this stage. Without this, a nested stage (e.g. a parallax card inside a
    // parallax section) would have its layers driven by both stages at once —
    // each keeps its own lastY, so they fight and the drift stutters/freezes.
    layers: [...el.querySelectorAll<HTMLElement>('[data-depth]')]
      .filter((layer) => layer.closest('[data-parallax]') === el)
      .map((layer) => ({
        el: layer,
        depth: parseDepth(layer.dataset.depth),
        lastY: Number.NaN,
      })),
    docTop: 0,
    height: 0,
  }));
}

// Read each stage's resting geometry ONCE and cache it (document-relative, so
// scroll-independent). Skips a stage mid-expand/collapse so a bento card's
// modal (position:fixed) geometry never overwrites its resting cache.
function measure(): void {
  const scrollY = window.scrollY;
  for (const stage of stages) {
    const cl = stage.el.classList;
    if (
      cl.contains('is-expanding') ||
      cl.contains('is-expanded') ||
      cl.contains('is-collapsing')
    ) {
      continue;
    }
    const r = stage.el.getBoundingClientRect();
    stage.docTop = r.top + scrollY;
    stage.height = r.height;
  }
}

function clearTransforms(): void {
  for (const stage of stages) {
    for (const layer of stage.layers) {
      layer.el.style.transform = '';
      layer.lastY = Number.NaN;
    }
  }
}

function update(): void {
  ticking = false;
  if (!listening) return; // disabled (reduced-motion): don't re-apply transforms
  const vh = window.innerHeight;
  const isMobile = window.innerWidth < MOBILE_BP;
  // One layout read for the whole frame (no per-stage getBoundingClientRect),
  // then pure compute + transform writes — transforms are composited, so this
  // never forces a synchronous reflow.
  const scrollY = window.scrollY;
  for (const stage of stages) {
    // Skip a stage mid-expand/collapse (bento cover cards). While the card is
    // position:fixed as a modal, its drift would strand a wrong offset on the
    // (faded-out) cover layer that survives into the close. The body scroll-lock
    // preserves scroll position, so the pre-open transform stays valid; drift
    // resumes once the card returns to rest.
    const cl = stage.el.classList;
    if (
      cl.contains('is-expanding') ||
      cl.contains('is-expanded') ||
      cl.contains('is-collapsing')
    ) {
      continue;
    }
    const top = stage.docTop - scrollY; // viewport-relative, from the cache
    const bottom = top + stage.height;
    if (bottom < -vh * 0.3 || top > vh * 1.3) continue; // off-screen
    const active = !isMobile || stage.mobile;
    const progress = active
      ? Math.max(
          -1.2,
          Math.min(1.2, (top + stage.height / 2 - vh / 2) / (vh / 2 + stage.height / 2)),
        )
      : 0;
    for (const layer of stage.layers) {
      const y = active ? -progress * layer.depth * RANGE : 0;
      if (Math.abs(y - layer.lastY) < MIN_DELTA) continue;
      layer.lastY = y;
      // Always write translate3d — even at y=0 (translate3d(0,0,0)) — rather
      // than clearing to ''. Clearing demotes the compositor layer; the next
      // non-zero offset re-promotes it. That promote/demote churn at every
      // viewport-center crossing re-rasterizes the layer and flips its text
      // between subpixel- and grayscale-AA, reading as a shimmer. Holding a
      // 3d transform keeps the layer promoted and stable. (Paired with
      // will-change:transform in CSS so it's promoted from first paint too.)
      layer.el.style.transform = `translate3d(0, ${y}px, 0)`;
    }
  }
}

function requestTick(): void {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(update);
  }
}

// Layout-affecting events re-measure the cached geometry (rAF-coalesced) then
// repaint. Kept off the scroll path so scrolling stays layout-read-free.
let measuring = false;
function requestMeasure(): void {
  if (measuring) return;
  measuring = true;
  requestAnimationFrame(() => {
    measuring = false;
    if (!listening) return;
    measure();
    update();
  });
}

function startListening(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestMeasure);
  window.addEventListener('orientationchange', requestMeasure);
  window.addEventListener('pageshow', requestMeasure);
  window.addEventListener('hashchange', requestTick);
  requestMeasure(); // initial measure + paint
}

function stopListening(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener('scroll', requestTick);
  window.removeEventListener('resize', requestMeasure);
  window.removeEventListener('orientationchange', requestMeasure);
  window.removeEventListener('pageshow', requestMeasure);
  window.removeEventListener('hashchange', requestTick);
  clearTransforms();
}

function applyMotionPref(): void {
  if (reduceMQ.matches) stopListening();
  else startListening();
}

function setupReveal(): void {
  const targets = [...document.querySelectorAll<HTMLElement>('.reveal-up')];
  if (reduceMQ.matches || !('IntersectionObserver' in window)) {
    for (const t of targets) t.classList.add('in');
    return;
  }
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
  for (const t of targets) io.observe(t);
}

function init(): void {
  stages = collect();
  setupReveal();
  applyMotionPref();
  reduceMQ.addEventListener('change', applyMotionPref);
  // Re-measure once fonts / late resources settle — layout shifts move the
  // cached stage geometry.
  document.fonts?.ready.then(requestMeasure);
  window.addEventListener('load', requestMeasure, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
