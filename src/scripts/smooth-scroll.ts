// Lenis smooth scroll — the lerp-based "can't-slam-it" easing (same lib as the
// reference site). Scope: smooth WHEEL/pointer only; native momentum on touch
// (syncTouch: false), and fully disabled under prefers-reduced-motion. Lenis
// drives the real window scroll (no transform), so the MorphNav progress ring,
// the scrollspy IntersectionObserver, and scroll-parallax — all of which read
// window.scrollY / getBoundingClientRect — follow the smoothed position with no
// changes of their own.
//
// MPA note: every navigation is a full reload, so Lenis re-inits per page; no
// teardown/destroy needed.
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

  // Route same-page hash links through Lenis (it owns smooth scroll now that the
  // native `scroll-behavior: smooth` is gone). Lenis honours the page's
  // `scroll-padding-top: 7rem`, so targets clear the fixed nav with no extra
  // offset needed.
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
