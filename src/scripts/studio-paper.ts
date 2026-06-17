// /studio prototype motion — deliberately small. The page rides the site's
// existing runtime (BaseLayout already mounts Lenis via smooth-scroll.ts and
// drives native window scroll), so this module only adds:
//   - [data-sp-reveal]  IntersectionObserver entrances (+ --rd group stagger)
//   - [data-sp-parallax] gentle scroll parallax via the --py custom property
//   - [data-sp-counter]  count-up numbers on first sight
//   - [data-sp-words]    scroll-lit manifesto words
//
// Gating: html.sp-js is added up front — entrance-hidden states in
// studio-paper.css only apply under it (plus prefers-reduced-motion:
// no-preference), so no-JS visitors never see hidden content. Under reduced
// motion this module exits after the class flip and the page is static.
//
// NO-TEARDOWN: same MPA full-reload assumption as smooth-scroll.ts.

const docEl = document.documentElement;
docEl.classList.add('sp-js');

const motionOK = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

if (motionOK) {
  // ── Reveals ────────────────────────────────────────────────────────────────

  document.querySelectorAll<HTMLElement>('[data-sp-reveal-group]').forEach((group) => {
    group.querySelectorAll<HTMLElement>('[data-sp-reveal]').forEach((el, i) => {
      el.style.setProperty('--rd', `${Math.min(i * 0.08, 0.4)}s`);
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
  document.querySelectorAll('[data-sp-reveal]').forEach((el) => revealIO.observe(el));

  // ── Counters ───────────────────────────────────────────────────────────────

  function animateCounter(el: HTMLElement): void {
    const target = parseInt(el.dataset.spCounter ?? '0', 10);
    const pad = parseInt(el.dataset.pad ?? '0', 10);
    const dur = 1400;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(2, -10 * t);
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
  document.querySelectorAll('[data-sp-counter]').forEach((el) => counterIO.observe(el));

  // ── Parallax + word lighting (one rAF loop, reads scroll once) ────────────

  interface ParallaxItem {
    el: HTMLElement;
    speed: number;
    center: number;
    applied: number;
  }
  const parallaxItems: ParallaxItem[] = [];

  function collectParallax(): void {
    parallaxItems.length = 0;
    document.querySelectorAll<HTMLElement>('[data-sp-parallax]').forEach((el) => {
      const speed = parseFloat(el.dataset.spParallax ?? '0');
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

  const notes = document.querySelector<HTMLElement>('[data-sp-words]');
  const words = notes ? Array.from(notes.querySelectorAll<HTMLElement>('.w')) : [];
  let litCount = 0;

  function runWords(vh: number): void {
    if (!notes || !words.length) return;
    const rect = notes.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) return;
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

  let vh = window.innerHeight;

  const frame = () => {
    const viewCenter = window.scrollY + vh / 2;
    for (const item of parallaxItems) {
      const next = Math.round((item.center - viewCenter) * item.speed * 10) / 10;
      if (next !== item.applied) {
        item.applied = next;
        item.el.style.setProperty('--py', `${next}px`);
      }
    }
    runWords(vh);
    requestAnimationFrame(frame);
  };

  collectParallax();
  if (parallaxItems.length || words.length) requestAnimationFrame(frame);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    vh = window.innerHeight;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(collectParallax, 150);
  });
}
