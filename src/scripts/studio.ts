// ARCANA /studio motion engine.
//
// One module owns every scroll- and pointer-coupled behaviour on the page:
//   - Lenis smooth scroll (wheel only; native momentum on touch)
//   - parallax: [data-parallax] / [data-parallax-img] → writes --py per frame
//   - reveals:  [data-reveal] (+ stagger inside [data-reveal-group]) → .in
//   - counters: [data-counter] count up on first sight
//   - manifesto: [data-words] lights word spans by section scroll progress
//   - magnetic hover: [data-magnetic] → writes --mx/--my
//   - custom cursor ring/dot (fine pointers only)
//   - nav glass state + Tallinn clock
//
// Motion gating: html.studio-motion is set pre-paint by StudioLayout only
// when the visitor doesn't prefer reduced motion. Without it this module
// limits itself to the clock + nav state — the page is already fully visible
// because every entrance style in studio.css is scoped under .studio-motion.
//
// NO-TEARDOWN: same MPA assumption as smooth-scroll.ts — observers, rAF loops
// and Lenis are wiped by the full page reload on navigation. Don't add a
// client-side router without wiring teardown here.

import Lenis from 'lenis';

const motionOK = document.documentElement.classList.contains('studio-motion');
const finePointer = window.matchMedia('(pointer: fine)').matches;

// ── Clock (always on) ────────────────────────────────────────────────────────

function startClock(): void {
  const slots = document.querySelectorAll<HTMLElement>('[data-clock]');
  if (!slots.length) return;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Tallinn',
    hour: '2-digit',
    minute: '2-digit',
  });
  const tick = () => {
    const now = fmt.format(new Date());
    slots.forEach((slot) => {
      slot.textContent = now;
    });
  };
  tick();
  setInterval(tick, 30_000);
}
startClock();

// ── Nav glass state (always on; cheap class toggle) ──────────────────────────

const nav = document.getElementById('studio-nav');
let navScrolled = false;

function syncNav(scrollY: number): void {
  const should = scrollY > 40;
  if (should !== navScrolled && nav) {
    navScrolled = should;
    nav.classList.toggle('is-scrolled', should);
  }
}
syncNav(window.scrollY);

if (!motionOK) {
  // Reduced motion: nav state still tracks native scroll, nothing else runs.
  window.addEventListener('scroll', () => syncNav(window.scrollY), { passive: true });
} else {
  // ── Smooth scroll ──────────────────────────────────────────────────────────

  const lenis = new Lenis({ smoothWheel: true, syncTouch: false });

  // Same-page anchors ride Lenis (scroll-padding-top is honoured).
  document.addEventListener('click', (event) => {
    const link = (event.target as Element)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    let target: Element | null = null;
    try {
      target = document.querySelector(link.hash);
    } catch {
      return;
    }
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target as HTMLElement);
    history.pushState(null, '', link.hash);
  });

  // ── Parallax registry ──────────────────────────────────────────────────────
  // Each entry caches its un-transformed document position (the engine only
  // ever writes --py, never `transform`, so getBoundingClientRect stays an
  // honest measurement of layout position + current --py; we subtract the
  // applied offset when re-measuring).

  interface ParallaxItem {
    el: HTMLElement;
    speed: number;
    center: number; // document-space Y of the element's center, untransformed
    applied: number;
  }

  const parallaxItems: ParallaxItem[] = [];

  function collectParallax(): void {
    parallaxItems.length = 0;
    const els = document.querySelectorAll<HTMLElement>('[data-parallax], [data-parallax-img]');
    els.forEach((el) => {
      const raw = el.dataset.parallax ?? el.dataset.parallaxImg ?? '0';
      const speed = parseFloat(raw);
      if (!Number.isFinite(speed) || speed === 0) return;
      const rect = el.getBoundingClientRect();
      const applied = parseFloat(el.style.getPropertyValue('--py')) || 0;
      parallaxItems.push({
        el,
        speed,
        center: rect.top + window.scrollY + rect.height / 2 - applied,
        applied,
      });
    });
  }

  function runParallax(scrollY: number, vh: number): void {
    const viewCenter = scrollY + vh / 2;
    for (const item of parallaxItems) {
      const delta = (item.center - viewCenter) * item.speed;
      // Quantize to 0.1px so we skip style writes on sub-visible changes.
      const next = Math.round(delta * 10) / 10;
      if (next !== item.applied) {
        item.applied = next;
        item.el.style.setProperty('--py', `${next}px`);
      }
    }
  }

  // ── Manifesto word lighting ────────────────────────────────────────────────

  const manifesto = document.querySelector<HTMLElement>('[data-words]');
  const words = manifesto ? Array.from(manifesto.querySelectorAll<HTMLElement>('.w')) : [];
  let litCount = 0;

  function runManifesto(vh: number): void {
    if (!manifesto || !words.length) return;
    const rect = manifesto.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) return;
    // 0 → text top enters the lower quarter; 1 → text bottom clears mid-view.
    const span = rect.height + vh * 0.45;
    const progress = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / span));
    const next = Math.round(progress * words.length);
    if (next === litCount) return;
    const lo = Math.min(next, litCount);
    const hi = Math.max(next, litCount);
    for (let i = lo; i < hi; i++) {
      words[i]?.classList.toggle('lit', next > litCount);
    }
    litCount = next;
  }

  // ── Frame loop: Lenis + every scroll-coupled read/write in one place ──────

  let vh = window.innerHeight;

  const frame = (time: number) => {
    lenis.raf(time);
    const y = window.scrollY;
    syncNav(y);
    runParallax(y, vh);
    runManifesto(vh);
    requestAnimationFrame(frame);
  };

  collectParallax();
  requestAnimationFrame(frame);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    vh = window.innerHeight;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(collectParallax, 150);
  });

  // ── Reveals ────────────────────────────────────────────────────────────────

  // Stagger siblings inside a reveal group via transition-delay (--rd).
  document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
    group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) => {
      el.style.setProperty('--rd', `${Math.min(i * 0.09, 0.45)}s`);
    });
  });

  const revealIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        revealIO.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => revealIO.observe(el));

  // ── Counters ───────────────────────────────────────────────────────────────

  function animateCounter(el: HTMLElement): void {
    const target = parseInt(el.dataset.counter ?? '0', 10);
    const pad = parseInt(el.dataset.pad ?? '0', 10);
    const dur = 1600;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(2, -10 * t); // easeOutExpo
      const value = t >= 1 ? target : Math.round(target * eased);
      el.textContent = String(value).padStart(pad, '0');
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const counterIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        animateCounter(entry.target as HTMLElement);
        counterIO.unobserve(entry.target);
      }
    },
    { threshold: 0.6 },
  );
  document.querySelectorAll('[data-counter]').forEach((el) => counterIO.observe(el));

  // ── Magnetic hover + custom cursor (fine pointers only) ───────────────────

  if (finePointer) {
    document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
      const strength = 0.28;
      el.addEventListener('pointermove', (e) => {
        const rect = el.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        el.style.setProperty('--mx', `${(dx * strength).toFixed(1)}px`);
        el.style.setProperty('--my', `${(dy * strength).toFixed(1)}px`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });

    const ring = document.createElement('div');
    ring.className = 's-cursor-ring is-hidden';
    const dot = document.createElement('div');
    dot.className = 's-cursor-dot is-hidden';
    document.body.append(ring, dot);

    let cx = -100;
    let cy = -100;
    let rx = -100;
    let ry = -100;

    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        cx = e.clientX;
        cy = e.clientY;
        ring.classList.remove('is-hidden');
        dot.classList.remove('is-hidden');
        const over = (e.target as Element)?.closest?.('a, button, [data-magnetic]');
        ring.classList.toggle('is-active', !!over);
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => {
      ring.classList.add('is-hidden');
      dot.classList.add('is-hidden');
    });

    const cursorFrame = () => {
      rx += (cx - rx) * 0.16;
      ry += (cy - ry) * 0.16;
      ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
      dot.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      requestAnimationFrame(cursorFrame);
    };
    requestAnimationFrame(cursorFrame);
  }
}
