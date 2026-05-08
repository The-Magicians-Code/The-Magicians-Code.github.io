/**
 * Liquid-glass runtime.
 *
 * Spec: docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md
 *
 * Auto-discovers `.liquid-glass` elements at DOMContentLoaded, builds a
 * per-instance SVG filter for each, and applies the inline backdrop-filter.
 *
 * Originally ported from
 * github.com/The-Magicians-Code/prototypes/liquid-glass-pill (pill.js).
 */

declare global {
  interface Window {
    __lg?: {
      refresh: (el: Element) => void;
    };
  }
}

const DESKTOP_MQ = '(min-width: 641px)';
const SAMPLES = 128;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

interface Instance {
  filterId: string;
  filterEl: SVGFilterElement;
  dispImageEl: SVGFEImageElement;
  dispMapEl: SVGFEDisplacementMapElement;
  satMatrixEl: SVGFEColorMatrixElement;
  specImageEl: SVGFEImageElement;
  specAlphaEl: SVGFEFuncAElement;
  observer: ResizeObserver;
  resizeTimer: number | null;
}

const instances = new WeakMap<Element, Instance>();
let defsContainer: SVGSVGElement | null = null;

// Safari/Firefox don't actually render url(#filter) inside backdrop-filter,
// even though Safari's CSS parser accepts the syntax (so CSS.supports lies).
// The reliable signal is the `lg-no-svg-backdrop` class set pre-paint by
// BaseLayout's inline UA-sniff script. When that class is present, skip the
// upgrade and let the global.css fallback styling provide a frosted-glass
// treatment instead.
const supportsSvgBackdropFilter =
  typeof document !== 'undefined' &&
  !document.documentElement.classList.contains('lg-no-svg-backdrop');

// ---------- Physics (verbatim from Nav.astro lines 71-212) ----------

function heightAt(t: number): number {
  return Math.pow(1 - Math.pow(1 - t, 4), 0.25);
}

function refractRay(nx: number, ny: number, ior: number): [number, number] | null {
  const eta = 1 / ior;
  const dot = ny;
  const k = 1 - eta * eta * (1 - dot * dot);
  if (k < 0) return null;
  const sq = Math.sqrt(k);
  return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
}

function buildRefractionProfile(thickness: number, bezelWidth: number, ior: number, samples = SAMPLES): Float64Array {
  const profile = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const y = heightAt(t);
    const dt = t < 1 ? 0.0001 : -0.0001;
    const y2 = heightAt(t + dt);
    const deriv = (y2 - y) / dt;
    const mag = Math.sqrt(deriv * deriv + 1);
    const nx = -deriv / mag;
    const ny = -1 / mag;
    const ref = refractRay(nx, ny, ior);
    if (!ref) { profile[i] = 0; continue; }
    profile[i] = ref[0] * ((y * bezelWidth + thickness) / ref[1]);
  }
  return profile;
}

function generateDisplacementMap(
  w: number, h: number, radius: number, bezelWidth: number,
  profile: Float64Array, maxDisp: number, uniformShiftPx: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) * (r + 1);
  const rBSq = Math.max(r - bezelWidth, 0) * Math.max(r - bezelWidth, 0);
  const wB = w - r * 2;
  const hB = h - r * 2;
  const samples = profile.length;
  const uniformR = -((uniformShiftPx || 0) / maxDisp) * 255;

  // Phase 1 — uniform slab fill inside pill, neutral outside
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const x = cx < r ? cx - r : (cx >= w - r ? cx - r - wB : 0);
      const y = cy < r ? cy - r : (cy >= h - r ? cy - r - hB : 0);
      const dSq = x * x + y * y;
      const idx = (py * w + px) * 4;
      const insidePill = dSq <= rSq;
      data[idx] = 128 + (insidePill ? Math.round(uniformR) : 0);
      data[idx + 1] = 128;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  // Phase 2 — bezel rim curl combined with the uniform shift
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const x = cx < r ? cx - r : (cx >= w - r ? cx - r - wB : 0);
      const y = cy < r ? cy - r : (cy >= h - r ? cy - r - hB : 0);
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      if (dist === 0) continue;
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0) continue;
      const t = Math.max(0, Math.min(1, fromSide / bezelWidth));
      const sampleIdx = Math.min((t * samples) | 0, samples - 1);
      const disp = profile[sampleIdx] || 0;
      const dirX = x / dist;
      const dirY = y / dist;
      const dX = (-dirX * disp) / maxDisp;
      const dY = (-dirY * disp) / maxDisp;
      const baseR = 128 + uniformR * (dSq <= rSq ? 1 : op);
      const idx = (py * w + px) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(baseR + dX * 127 * op)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + dY * 127 * op)));
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function generateSpecularMap(w: number, h: number, radius: number, bezelWidth: number, angle: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  data.fill(0);

  const r = radius;
  const rSq = r * r;
  const r1Sq = (r + 1) * (r + 1);
  const rBSq = Math.max(r - bezelWidth, 0) * Math.max(r - bezelWidth, 0);
  const wB = w - r * 2;
  const hB = h - r * 2;
  const lightX = Math.cos(angle);
  const lightY = Math.sin(angle);

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const x = cx < r ? cx - r : (cx >= w - r ? cx - r - wB : 0);
      const y = cy < r ? cy - r : (cy >= h - r ? cy - r - hB : 0);
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      if (dist === 0) continue;
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0) continue;
      const dirX = x / dist;
      const dirY = -y / dist;
      const dot = Math.abs(dirX * lightX + dirY * lightY);
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) * (1 - fromSide)));
      const coeff = dot * edge;
      const col = (255 * coeff) | 0;
      const alpha = (255 * coeff * coeff * op) | 0;
      const idx = (py * w + px) * 4;
      data[idx] = col;
      data[idx + 1] = col;
      data[idx + 2] = col;
      data[idx + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

// ---------- DOM helpers ----------

function ensureDefsEl(): SVGDefsElement {
  if (defsContainer && defsContainer.isConnected) {
    return defsContainer.querySelector('defs')!;
  }
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('class', 'liquid-glass-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('color-interpolation-filters', 'sRGB');
  const defs = document.createElementNS(SVG_NS, 'defs') as SVGDefsElement;
  svg.appendChild(defs);
  document.body.appendChild(svg);
  defsContainer = svg;
  return defs;
}

function randomFilterId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return 'lg-filter-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function readCssNumber(el: Element, prop: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(prop).trim();
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

function buildFilterChain(): { filter: SVGFilterElement; refs: Pick<Instance, 'dispImageEl' | 'dispMapEl' | 'satMatrixEl' | 'specImageEl' | 'specAlphaEl'> } {
  const filter = document.createElementNS(SVG_NS, 'filter') as SVGFilterElement;
  filter.setAttribute('x', '0%');
  filter.setAttribute('y', '0%');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', '1.5');
  blur.setAttribute('result', 'blurred_source');
  filter.appendChild(blur);

  const dispImage = document.createElementNS(SVG_NS, 'feImage') as SVGFEImageElement;
  dispImage.setAttribute('result', 'disp_map');
  filter.appendChild(dispImage);

  const dispMap = document.createElementNS(SVG_NS, 'feDisplacementMap') as SVGFEDisplacementMapElement;
  dispMap.setAttribute('in', 'blurred_source');
  dispMap.setAttribute('in2', 'disp_map');
  dispMap.setAttribute('scale', '0');
  dispMap.setAttribute('xChannelSelector', 'R');
  dispMap.setAttribute('yChannelSelector', 'G');
  dispMap.setAttribute('result', 'displaced');
  filter.appendChild(dispMap);

  const satMatrix = document.createElementNS(SVG_NS, 'feColorMatrix') as SVGFEColorMatrixElement;
  satMatrix.setAttribute('in', 'displaced');
  satMatrix.setAttribute('type', 'saturate');
  satMatrix.setAttribute('values', '4');
  satMatrix.setAttribute('result', 'displaced_sat');
  filter.appendChild(satMatrix);

  const specImage = document.createElementNS(SVG_NS, 'feImage') as SVGFEImageElement;
  specImage.setAttribute('result', 'spec_layer');
  filter.appendChild(specImage);

  const specComposite = document.createElementNS(SVG_NS, 'feComposite');
  specComposite.setAttribute('in', 'displaced_sat');
  specComposite.setAttribute('in2', 'spec_layer');
  specComposite.setAttribute('operator', 'in');
  specComposite.setAttribute('result', 'spec_masked');
  filter.appendChild(specComposite);

  const componentTransfer = document.createElementNS(SVG_NS, 'feComponentTransfer');
  componentTransfer.setAttribute('in', 'spec_layer');
  componentTransfer.setAttribute('result', 'spec_faded');
  const specAlpha = document.createElementNS(SVG_NS, 'feFuncA') as SVGFEFuncAElement;
  specAlpha.setAttribute('type', 'linear');
  specAlpha.setAttribute('slope', '0.4');
  componentTransfer.appendChild(specAlpha);
  filter.appendChild(componentTransfer);

  const blendSat = document.createElementNS(SVG_NS, 'feBlend');
  blendSat.setAttribute('in', 'spec_masked');
  blendSat.setAttribute('in2', 'displaced');
  blendSat.setAttribute('mode', 'normal');
  blendSat.setAttribute('result', 'with_sat');
  filter.appendChild(blendSat);

  const blendFinal = document.createElementNS(SVG_NS, 'feBlend');
  blendFinal.setAttribute('in', 'spec_faded');
  blendFinal.setAttribute('in2', 'with_sat');
  blendFinal.setAttribute('mode', 'normal');
  filter.appendChild(blendFinal);

  return {
    filter,
    refs: {
      dispImageEl: dispImage,
      dispMapEl: dispMap,
      satMatrixEl: satMatrix,
      specImageEl: specImage,
      specAlphaEl: specAlpha,
    },
  };
}

// ---------- Per-element init ----------

function initElement(el: Element): void {
  if (!supportsSvgBackdropFilter) return;

  const htmlEl = el as HTMLElement;
  const isMobile = !window.matchMedia(DESKTOP_MQ).matches;
  const optInMobile = htmlEl.hasAttribute('data-lg-mobile');

  if (isMobile && !optInMobile) {
    return;
  }

  const rect = htmlEl.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w <= 0 || h <= 0) return;

  const radius = Math.min(parseFloat(getComputedStyle(htmlEl).borderRadius) || h / 2, h / 2);

  const thickness = readCssNumber(htmlEl, '--lg-thickness', 80);
  const bezelWidth = readCssNumber(htmlEl, '--lg-bezel', 20);
  const ior = readCssNumber(htmlEl, '--lg-ior', 1.5);
  const uniformShift = readCssNumber(htmlEl, '--lg-uniform-shift', -4.5);
  const blur = readCssNumber(htmlEl, '--lg-blur', 4);
  const saturate = readCssNumber(htmlEl, '--lg-saturate', 100);
  const svgSaturate = readCssNumber(htmlEl, '--lg-svg-saturate', 4);
  const specAlpha = readCssNumber(htmlEl, '--lg-spec-alpha', 0.4);

  const clampedBezel = Math.min(bezelWidth, radius - 1, Math.min(w, h) / 2 - 1);

  try {
    const profile = buildRefractionProfile(thickness, clampedBezel, ior, SAMPLES);
    const maxRimDisp = Math.max.apply(null, Array.from(profile).map(Math.abs)) || 1;
    const maxDisp = (maxRimDisp + 2 * Math.abs(uniformShift)) || 1;

    const dispUrl = generateDisplacementMap(w, h, radius, clampedBezel, profile, maxDisp, uniformShift);
    const specBezel = clampedBezel * 2.5;
    const specUrl = generateSpecularMap(w, h, radius, specBezel, Math.PI / 2);

    const defs = ensureDefsEl();

    let inst = instances.get(htmlEl);
    if (!inst) {
      const filterId = randomFilterId();
      const { filter, refs } = buildFilterChain();
      filter.setAttribute('id', filterId);
      defs.appendChild(filter);

      const observer = new ResizeObserver(() => {
        const i = instances.get(htmlEl);
        if (!i) return;
        if (i.resizeTimer !== null) clearTimeout(i.resizeTimer);
        i.resizeTimer = window.setTimeout(() => initElement(htmlEl), 100);
      });
      observer.observe(htmlEl);

      inst = {
        filterId,
        filterEl: filter,
        ...refs,
        observer,
        resizeTimer: null,
      };
      instances.set(htmlEl, inst);
    }

    inst.dispImageEl.setAttribute('href', dispUrl);
    inst.dispImageEl.setAttributeNS(XLINK_NS, 'href', dispUrl);
    inst.dispImageEl.setAttribute('width', String(w));
    inst.dispImageEl.setAttribute('height', String(h));

    inst.dispMapEl.setAttribute('scale', String(maxDisp));

    inst.satMatrixEl.setAttribute('values', String(svgSaturate));

    inst.specImageEl.setAttribute('href', specUrl);
    inst.specImageEl.setAttributeNS(XLINK_NS, 'href', specUrl);
    inst.specImageEl.setAttribute('width', String(w));
    inst.specImageEl.setAttribute('height', String(h));

    inst.specAlphaEl.setAttribute('slope', String(specAlpha));

    const filterUrl = `url(#${inst.filterId})`;
    const declaration = `blur(${blur}px) saturate(${saturate}%) ${filterUrl}`;
    htmlEl.style.setProperty('backdrop-filter', declaration);
    htmlEl.style.setProperty('-webkit-backdrop-filter', declaration);
  } catch (err) {
    console.warn('liquid-glass: filter generation failed; .glass fallback remains active.', err);
  }
}

function clearElementUpgrade(el: Element): void {
  const htmlEl = el as HTMLElement;
  htmlEl.style.removeProperty('backdrop-filter');
  htmlEl.style.removeProperty('-webkit-backdrop-filter');
}

function refresh(el: Element): void {
  initElement(el);
}

function discoverAndInit(): void {
  ensureDefsEl();
  document.querySelectorAll<HTMLElement>('.liquid-glass').forEach(initElement);

  const tunerTargets = document.querySelectorAll<HTMLElement>('.liquid-glass[data-lg-tuner]');
  if (tunerTargets.length === 0) return;
  if (tunerTargets.length > 1) {
    console.warn(`liquid-glass: ${tunerTargets.length} elements have data-lg-tuner; only the first will receive a tuner panel.`);
  }
  const target = tunerTargets[0];
  import('./liquid-glass-tuner').then((mod) => mod.mountTuner(target)).catch((err) => {
    console.warn('liquid-glass: tuner failed to load', err);
  });
}

// Crossing the desktop breakpoint: init skipped elements, or strip inline
// upgrades from non-data-lg-mobile elements when going down to mobile.
const desktopMQ = window.matchMedia(DESKTOP_MQ);
desktopMQ.addEventListener('change', (e) => {
  const elements = document.querySelectorAll<HTMLElement>('.liquid-glass');
  if (e.matches) {
    elements.forEach(initElement);
  } else {
    elements.forEach((el) => {
      if (!el.hasAttribute('data-lg-mobile')) clearElementUpgrade(el);
    });
  }
});

window.__lg = { refresh };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', discoverAndInit);
} else {
  discoverAndInit();
}

export {};
