// Morphing digital clock. Each digit is 29 SVG circles tweened onto points
// sampled along a hidden numeral path, blended by an SVG "gooey" filter so the
// circles read as one liquid glyph. Ported from docs/ideas/morph-clock.html
// (clock only). Spec: docs/superpowers/specs/2026-06-01-morph-clock-component-design.md
//
// <morph-digit> is self-contained (numeral paths baked in, per-instance filter
// id); a controller drives any number of [data-morph-clock] wrappers with
// per-wrapper timing. Honors prefers-reduced-motion (read live per morph);
// pauses the per-second animation when offscreen or the tab is hidden. No deps.

const CIRCLE_COUNT = 29;
const SVG_NS = 'http://www.w3.org/2000/svg';

// Numeral outlines (viewBox 0 0 256 256), ported verbatim from the demo. Index
// == digit. path 4 and 7 use implicit-lineto polyline form, which is valid SVG
// and samples fine with getPointAtLength.
const PATHS: readonly string[] = [
  'M185,131.2c0,25.5-5.1,45.6-15.4,60.3c-10.3,14.7-24.1,22-41.7,22c-17.5,0-31.4-7.3-41.5-22 c-10.1-14.7-15.2-34.8-15.2-60.3v-6.6c0-25.5,5.1-45.7,15.2-60.4C96.6,49.4,110.4,42,128,42c17.5,0,31.4,7.4,41.7,22.1 c10.3,14.8,15.4,34.9,15.4,60.4V131.2z',
  'M87.9,79.2c1.1-0.4,53.7-39.2,54.9-39.1v180.5',
  'M81.7,85.7c-1.4-67,112.3-55.1,90.2,11.6c-12.6,32-70.6,83.7-88.8,113.7h105.8',
  'M74.8,178.5c3,39.4,63.9,46.7,88.6,23.7c34.3-35.1,5.4-75.8-41.7-77c29.9,5.5,68.7-43.1,36.5-73.7 c-23.4-21.5-76.5-11.1-78.6,25',
  'M161.9,220.8 161.9,41 72.6,180.9 210.2,180.9',
  'M183.2,43.7H92.1l-10,88.3c0,0,18.3-21.9,51-21.9s49.4,32.6,49.4,48.2c0,22.2-9.5,57-52.5,57 s-51.4-36.7-51.4-36.7',
  'M177.4,71.6c0,0-4.3-30.3-44.9-30.3s-57.9,45.6-57.9,88.8s9,86.5,56.2,86.5 c38.9,0,50.9-22.3,50.9-60.9c0-17.6-21-44.9-48.2-44.9c-36.2,0-55.2,29.6-55.2,58.2',
  'M73.3,43.7 177.7,43.7 97.9,220.6',
  'M126.8,122.8c0,0,48.2-1.3,48.2-42.2s-48.2-39.9-48.2-39.9s-45.9,0-45.9,40.9 c0,20.5,18.8,41.2,46.9,41.2c29.6,0,54.9,18,54.9,47.2c0,0,2,44.9-54.2,44.9c-55.5,0-54.2-43.9-54.2-43.9s-0.3-47.9,53.6-47.9',
  'M78.9,186.3c0,0,4.3,30.3,44.9,30.3s57.9-45.6,57.9-88.8s-9-86.5-56.2-86.5 c-38.9,0-50.9,22.3-50.9,60.9c0,17.6,21,44.9,48.2,44.9c36.2,0,55.2-29.6,55.2-58.2',
];

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
let gooCounter = 0;

function expoOut(t: number): number {
  return t === 1 ? 1 : 1 - 2 ** (-10 * t);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

interface MorphOpts {
  duration: number;
  stagger: number;
  immediate?: boolean;
}

class MorphDigit extends HTMLElement {
  private circles: SVGCircleElement[] = [];
  private pathEl!: SVGPathElement;
  private gen = 0;
  private raf = 0;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const gooId = `morph-goo-${(gooCounter += 1)}`;

    const style = document.createElement('style');
    style.textContent =
      ':host{display:block;aspect-ratio:1;color:inherit}' +
      'svg{width:100%;height:100%;display:block;overflow:visible}' +
      'circle{fill:currentColor}' +
      // Numeral paths exist only to be sampled (getPointAtLength). Keep them
      // rendered — NOT display:none, which can zero out geometry on WebKit — but
      // paint nothing. (The HTML [hidden] UA rule does not apply to SVG in a
      // shadow root, so the demo's `hidden` attribute left a black glyph here.)
      '.paths{fill:none;stroke:none}';

    // Parse the SVG via a <template> (HTML parser handles the SVG namespace
    // correctly — more reliable than innerHTML on a created <svg>). Content is
    // static + an internal counter; no user input.
    const tpl = document.createElement('template');
    tpl.innerHTML =
      `<svg viewBox="0 0 256 256" role="presentation">` +
      `<defs><filter id="${gooId}" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">` +
      `<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"></feGaussianBlur>` +
      `<feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 38 -21" result="goo"></feColorMatrix>` +
      `<feComposite in="SourceGraphic" in2="goo" operator="atop"></feComposite>` +
      `</filter></defs>` +
      `<g class="paths" aria-hidden="true"><path d="${PATHS[0]}"></path></g>` +
      `<g class="circles" filter="url(#${gooId})"></g>` +
      `</svg>`;
    const svg = tpl.content.firstElementChild as SVGSVGElement;
    this.pathEl = svg.querySelector('path') as SVGPathElement;
    const group = svg.querySelector('.circles') as SVGGElement;

    for (let i = 0; i < CIRCLE_COUNT; i += 1) {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('r', '17');
      c.setAttribute('cx', '128');
      c.setAttribute('cy', '128');
      group.append(c);
      this.circles.push(c);
    }

    root.append(style, svg);
  }

  disconnectedCallback(): void {
    this.cancel();
  }

  // Stop any in-flight tween; bump the generation so queued frames bail.
  cancel(): void {
    this.gen += 1;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  morphTo(value: string, opts: MorphOpts): void {
    const idx = Number(value);
    if (!Number.isInteger(idx) || idx < 0 || idx > 9) return;

    this.pathEl.setAttribute('d', PATHS[idx]!);
    const length = this.pathEl.getTotalLength();
    const stepLen = length / CIRCLE_COUNT;
    const targets = this.circles.map((_, i) => this.pathEl.getPointAtLength(i * stepLen));

    this.cancel();

    if (opts.immediate || reduceMQ.matches) {
      this.circles.forEach((c, i) => {
        c.setAttribute('cx', String(targets[i]!.x));
        c.setAttribute('cy', String(targets[i]!.y));
      });
      return;
    }

    const gen = this.gen;
    const from = this.circles.map((c) => ({
      x: Number(c.getAttribute('cx')),
      y: Number(c.getAttribute('cy')),
    }));
    const start = performance.now();
    const { duration, stagger } = opts;

    const loop = (now: number): void => {
      if (gen !== this.gen) return; // superseded by a newer morph / cancel
      let done = true;
      for (let i = 0; i < this.circles.length; i += 1) {
        const t = Math.min(Math.max((now - start - i * stagger) / duration, 0), 1);
        const e = expoOut(t);
        const x = from[i]!.x + (targets[i]!.x - from[i]!.x) * e;
        const y = from[i]!.y + (targets[i]!.y - from[i]!.y) * e;
        this.circles[i]!.setAttribute('cx', x.toFixed(2));
        this.circles[i]!.setAttribute('cy', y.toFixed(2));
        if (t < 1) done = false;
      }
      this.raf = done ? 0 : requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
}

interface ClockConfig {
  format: 12 | 24;
  seconds: boolean;
  duration: number;
  stagger: number;
}

class Clock {
  private digitsHost: HTMLElement;
  private srTime: HTMLElement | null;
  private cfg: ClockConfig;
  private digits: MorphDigit[] = [];
  private value = '';
  private timer = 0;
  private visible = true;

  constructor(private wrap: HTMLElement) {
    this.digitsHost =
      wrap.querySelector<HTMLElement>('[data-morph-digits]') ?? wrap;
    this.srTime = wrap.querySelector<HTMLElement>('[data-morph-time]');
    this.cfg = {
      format: wrap.dataset.format === '12' ? 12 : 24,
      seconds: wrap.dataset.seconds !== 'false',
      duration: Number(wrap.dataset.duration) || 640,
      stagger: Number(wrap.dataset.stagger) || 12,
    };

    this.build();
    this.observe();
    this.syncRunning();
  }

  private build(): void {
    const now = new Date();
    for (const ch of this.format(now)) {
      if (ch === ':') {
        const colon = document.createElement('span');
        colon.className = 'morph-colon';
        colon.setAttribute('aria-hidden', 'true');
        this.digitsHost.append(colon);
      } else {
        const d = document.createElement('morph-digit') as MorphDigit;
        this.digitsHost.append(d);
        this.digits.push(d);
      }
    }
    this.render(this.format(now), this.a11y(now), true); // initial snap
  }

  private format(now: Date): string {
    let h = now.getHours();
    if (this.cfg.format === 12) h = h % 12 || 12;
    const parts = [pad(h), pad(now.getMinutes())];
    if (this.cfg.seconds) parts.push(pad(now.getSeconds()));
    return parts.join(':');
  }

  private a11y(now: Date): string {
    const base = this.format(now);
    return this.cfg.format === 12 ? `${base} ${now.getHours() < 12 ? 'AM' : 'PM'}` : base;
  }

  private render(value: string, a11y: string, immediate = false): void {
    if (value === this.value && !immediate) return;
    this.value = value;
    if (this.srTime) this.srTime.textContent = a11y;

    let di = 0;
    for (const ch of value) {
      if (ch === ':') continue;
      this.digits[di]?.morphTo(ch, {
        duration: this.cfg.duration,
        stagger: this.cfg.stagger,
        immediate,
      });
      di += 1;
    }
  }

  private tick(immediate = false): void {
    const now = new Date();
    this.render(this.format(now), this.a11y(now), immediate);
  }

  private pause(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = 0;
    for (const d of this.digits) d.cancel();
  }

  private resume(): void {
    if (this.timer) return;
    this.tick(true); // snap to current time, no morph from a stale value
    this.timer = window.setInterval(() => this.tick(), 250);
  }

  private syncRunning(): void {
    if (this.visible && document.visibilityState === 'visible') this.resume();
    else this.pause();
  }

  private observe(): void {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        this.visible = entries[0]!.isIntersecting;
        this.syncRunning();
      }).observe(this.wrap);
    }
    document.addEventListener('visibilitychange', () => this.syncRunning());
  }
}

if (!customElements.get('morph-digit')) {
  customElements.define('morph-digit', MorphDigit);
}

function init(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-morph-clock]')) {
    new Clock(el);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

export {}; // module scope — avoid top-level name collisions with other global scripts
