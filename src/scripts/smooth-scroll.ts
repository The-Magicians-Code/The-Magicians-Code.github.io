// Lenis smooth scroll — the lerp-based "can't-slam-it" easing (same lib as the
// reference site). Scope: smooth WHEEL/pointer only; native momentum on touch
// (syncTouch: false), and fully disabled under prefers-reduced-motion. Lenis
// drives the real window scroll (no transform), so scroll-coupled consumers —
// which read window.scrollY / getBoundingClientRect — follow the smoothed
// position with no changes of their own.
//
// ⚠️ NO-TEARDOWN ASSUMPTION (load-bearing). This module — and bento-expand.ts —
// register IntersectionObservers / ResizeObservers / MutationObservers / rAF
// loops / Lenis instances and never tear them down, because every navigation is a full page RELOAD (MPA) that
// wipes them. This holds ONLY while the site has no Astro <ClientRouter> /
// view-transitions. The moment client-side swaps are enabled, navigations stop
// reloading and all of the above LEAK on every navigation (~a dozen observers +
// rAF loops + Lenis instances accumulate). Before adding <ClientRouter>, wire
// astro:before-swap / astro:page-load teardown for each of those consumers.
import Lenis from 'lenis';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion) {
  const lenis = new Lenis({
    smoothWheel: true,
    syncTouch: false, // leave touch scrolling to native momentum
  });
  (window as any).lenis = lenis;

  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  // Mirror the bento card-open page-scroll lock: while `body.bento-open` is set
  // (CSS also applies overflow:hidden), pause Lenis so it can't drive the locked
  // page; resume on close. The CSS lock stays primary — this only gates Lenis.
  const syncLock = () => {
    if (document.body.classList.contains('bento-open')) lenis.stop();
    else lenis.start();
  };
  new MutationObserver(syncLock).observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  });

  // ── Nested smooth scroll for an expanded bento card ──────────────────────
  // The page-level Lenis is stopped while a card is open (above), so the card's
  // own scroll gets its own Lenis bound to `.card-body` (which is both the
  // scroll wrapper and content — overflow-y:auto). One card open at a time.
  // Lifecycle is tied to `.is-expanded`: attach when it appears, detach the
  // instant it's removed (collapse start) — before the morph resets scrollTop.
  let cardLenis: Lenis | null = null;
  let cardLenisRaf = 0;
  let cardLenisFor: HTMLElement | null = null;
  // Keeps the card Lenis's scroll limit in sync with the body's content height.
  // Because the card Lenis is created with wrapper === content === .card-body,
  // its own ResizeObserver watches the body's (fixed 100vh) border-box and
  // never sees the inner content grow. So a TL;DR → Detailed mode swap balloons
  // the scrollable content (e.g. ~800px → ~2000px) without updating Lenis's
  // cached limit — wheel scroll then clamps to the stale TL;DR height and the
  // modal reads as "scroll locked". We watch the actual content children and
  // call lenis.resize() when any of them changes size. (Native scrollTop is
  // unaffected — this bug is wheel/Lenis-only.)
  let cardContentRO: ResizeObserver | null = null;
  let cardChildMO: MutationObserver | null = null;

  const detachCardLenis = () => {
    if (cardLenisRaf) cancelAnimationFrame(cardLenisRaf);
    cardLenisRaf = 0;
    cardContentRO?.disconnect();
    cardContentRO = null;
    cardChildMO?.disconnect();
    cardChildMO = null;
    cardLenis?.destroy();
    cardLenis = null;
    cardLenisFor = null;
  };

  const attachCardLenis = (card: HTMLElement) => {
    const body = card.querySelector<HTMLElement>('.card-body');
    if (!body) return;
    detachCardLenis();
    cardLenis = new Lenis({ wrapper: body, content: body, smoothWheel: true, syncTouch: false });
    cardLenisFor = card;

    // Re-measure Lenis on any content-height change (mode swap, late-cloned
    // modal body, font reflow). ResizeObserver.observe is idempotent, so
    // re-observing existing children when new ones are added is safe.
    cardContentRO = new ResizeObserver(() => cardLenis?.resize());
    const observeChildren = () => {
      for (const child of body.children) cardContentRO?.observe(child);
    };
    observeChildren();
    // The modal content (.bento-card-body-rendered) is cloned in AFTER the
    // morph, so the children present at attach time aren't the final set —
    // bind the observer to whatever gets appended later too.
    cardChildMO = new MutationObserver(observeChildren);
    cardChildMO.observe(body, { childList: true });

    const loop = (time: number) => {
      cardLenis?.raf(time);
      cardLenisRaf = requestAnimationFrame(loop);
    };
    cardLenisRaf = requestAnimationFrame(loop);
  };

  document.querySelectorAll<HTMLElement>('.bento-card').forEach((card) => {
    new MutationObserver(() => {
      const expanded = card.classList.contains('is-expanded');
      if (expanded && cardLenisFor !== card) attachCardLenis(card);
      else if (!expanded && cardLenisFor === card) detachCardLenis();
    }).observe(card, { attributes: true, attributeFilter: ['class'] });
  });

  // Route same-page hash links through Lenis (it owns smooth scroll now that the
  // native `scroll-behavior: smooth` is gone). Lenis honours the page's
  // `scroll-padding-top`, so anchored targets land with a little top breathing
  // room rather than flush against the viewport edge.
  document.addEventListener('click', (event) => {
    const link = (event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link) return;
    // Respect modified clicks / new-tab / downloads / already-handled events.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target === '_blank' ||
      link.hasAttribute('download')
    ) {
      return;
    }
    // Same-document hash links only (e.g. "/#about" on the home page).
    if (link.pathname !== window.location.pathname || !link.hash) return;
    // Must point at a real element — skip toggles like "#tuner".
    let target: Element | null = null;
    try {
      target = document.querySelector(link.hash);
    } catch {
      return; // invalid selector
    }
    if (!target) return;

    event.preventDefault();
    lenis.scrollTo(target as HTMLElement);
    history.pushState(null, '', link.hash);
  });
}
