#!/usr/bin/env node
// Deterministic generative artwork for the /studio page.
//
// Writes SVG assets into src/assets/studio/. Every drawing decision flows from
// a fixed-seed PRNG (mulberry32), so two runs produce byte-identical files —
// same policy as the resume PDF generator (no Date.now(), no Math.random()).
// Re-run with `node scripts/studio-assets/generate.mjs` after tweaking the
// composition constants below, then commit the regenerated SVGs.
//
// Assets:
//   aurora.svg          hero backdrop — blurred gradient ribbons/blobs
//   cover-signal.svg    case study 01 — flow-field streamlines
//   cover-meridian.svg  case study 02 — wobbled cartographic contour rings
//   cover-helios.svg    case study 03 — eclipse disc + orbital arcs + starfield
//   cover-lattice.svg   case study 04 — perspective wave lattice
//   grain.svg           tiling film-grain texture (feTurbulence)

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const OUT = join(ROOT, 'src', 'assets', 'studio');
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Seeded PRNG + helpers
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (n) => (Math.round(n * 10) / 10).toString();

// Smooth pseudo-noise: a fixed bank of sine waves with random frequency and
// phase. Not Perlin, but plenty organic for streamline advection and contour
// wobble, and dependency-free.
function makeField(rand, octaves = 4, baseFreq = 0.004) {
  const waves = [];
  for (let i = 0; i < octaves; i++) {
    waves.push({
      fx: baseFreq * (0.5 + rand() * 1.6),
      fy: baseFreq * (0.5 + rand() * 1.6),
      phase: rand() * Math.PI * 2,
      amp: 1 / (i + 1),
    });
  }
  return (x, y) => {
    let v = 0;
    for (const w of waves) v += w.amp * Math.sin(x * w.fx + y * w.fy + w.phase);
    return v; // roughly in [-2, 2]
  };
}

// ---------------------------------------------------------------------------
// SVG scaffolding
// ---------------------------------------------------------------------------

const PALETTE = {
  bone: '#e9e4d8',
  amber: '#d8a24a',
  amberHot: '#edc27a',
  violet: '#6a55d6',
  teal: '#3f8f8a',
};

function grainFilter(id) {
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.9 0 0 0 0 0.88 0 0 0 0 0.84 0 0 0 0.6 0"/>` +
    `<feComposite operator="in" in2="SourceGraphic"/>` +
    `</filter>`
  );
}

function grainRect(w, h, filterId, opacity) {
  return `<rect width="${w}" height="${h}" filter="url(#${filterId})" opacity="${opacity}"/>`;
}

function vignette(id, w, h) {
  return {
    def:
      `<radialGradient id="${id}" cx="50%" cy="46%" r="72%">` +
      `<stop offset="58%" stop-color="#000" stop-opacity="0"/>` +
      `<stop offset="100%" stop-color="#000" stop-opacity="0.55"/>` +
      `</radialGradient>`,
    rect: `<rect width="${w}" height="${h}" fill="url(#${id})"/>`,
  };
}

function svgDoc(w, h, body) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `width="${w}" height="${h}" role="img">` +
    body +
    `</svg>\n`
  );
}

function write(name, content) {
  const p = join(OUT, name);
  writeFileSync(p, content);
  console.log(`✓  ${name}  (${(content.length / 1024).toFixed(1)} KB)`);
}

// ---------------------------------------------------------------------------
// aurora.svg — hero backdrop. Soft blurred colour fields on transparency,
// meant to sit behind the hero type with mix-blend / low opacity in CSS.
// ---------------------------------------------------------------------------

function aurora() {
  const rand = mulberry32(0xa17c0de);
  const W = 1600;
  const H = 1000;
  const blobs = [
    { c: PALETTE.violet, cx: 0.24, cy: 0.34, r: 360, o: 0.5 },
    { c: PALETTE.amber, cx: 0.74, cy: 0.26, r: 300, o: 0.42 },
    { c: PALETTE.teal, cx: 0.55, cy: 0.74, r: 330, o: 0.34 },
    { c: PALETTE.violet, cx: 0.86, cy: 0.66, r: 240, o: 0.3 },
    { c: PALETTE.amberHot, cx: 0.38, cy: 0.6, r: 200, o: 0.26 },
  ];
  let defs = '';
  let body = '';
  blobs.forEach((b, i) => {
    const id = `au${i}`;
    defs +=
      `<radialGradient id="${id}">` +
      `<stop offset="0%" stop-color="${b.c}" stop-opacity="${b.o}"/>` +
      `<stop offset="100%" stop-color="${b.c}" stop-opacity="0"/>` +
      `</radialGradient>`;
    // Wobble each blob into an organic closed blob path instead of a circle.
    const cx = b.cx * W;
    const cy = b.cy * H;
    const pts = [];
    const n = 10;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const r = b.r * (0.78 + rand() * 0.5);
      pts.push([cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r]);
    }
    let d = `M ${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for (let k = 0; k < n; k++) {
      const p0 = pts[k];
      const p1 = pts[(k + 1) % n];
      const mx = (p0[0] + p1[0]) / 2;
      const my = (p0[1] + p1[1]) / 2;
      d += ` Q ${f1(p0[0])} ${f1(p0[1])} ${f1(mx)} ${f1(my)}`;
    }
    d += ' Z';
    body += `<path d="${d}" fill="url(#${id})"/>`;
  });
  const doc =
    `<defs>${defs}<filter id="soft" x="-40%" y="-40%" width="180%" height="180%">` +
    `<feGaussianBlur stdDeviation="64"/></filter></defs>` +
    `<g filter="url(#soft)">${body}</g>`;
  write('aurora.svg', svgDoc(W, H, doc));
}

// ---------------------------------------------------------------------------
// cover-signal.svg — flow-field streamlines.
// ---------------------------------------------------------------------------

function coverSignal() {
  const rand = mulberry32(0x51641a7);
  const W = 1200;
  const H = 900;
  const field = makeField(rand, 4, 0.0035);
  const lines = [];
  const N = 150;
  for (let i = 0; i < N; i++) {
    let x = -40 + rand() * (W + 80);
    let y = -40 + rand() * (H + 80);
    const steps = 30 + Math.floor(rand() * 26);
    const pts = [[x, y]];
    for (let s = 0; s < steps; s++) {
      const a = field(x, y) * 1.9 + Math.PI * 0.12;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9;
      pts.push([x, y]);
    }
    const amber = rand() < 0.09;
    lines.push({
      pts,
      color: amber ? PALETTE.amber : PALETTE.bone,
      opacity: amber ? 0.55 + rand() * 0.3 : 0.12 + rand() * 0.3,
      width: amber ? 1.3 : 0.7 + rand() * 0.7,
    });
  }
  const vg = vignette('vg', W, H);
  let body = `<rect width="${W}" height="${H}" fill="#0c0b11"/>`;
  body += `<circle cx="920" cy="180" r="380" fill="url(#glow)"/>`;
  for (const l of lines) {
    const d = l.pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join(' ');
    body += `<path d="${d}" fill="none" stroke="${l.color}" stroke-opacity="${l.opacity.toFixed(2)}" stroke-width="${l.width.toFixed(1)}" stroke-linecap="round"/>`;
  }
  body += vg.rect + grainRect(W, H, 'gr', 0.05);
  const defs =
    `<defs>` +
    `<radialGradient id="glow"><stop offset="0%" stop-color="${PALETTE.amber}" stop-opacity="0.14"/><stop offset="100%" stop-color="${PALETTE.amber}" stop-opacity="0"/></radialGradient>` +
    vg.def +
    grainFilter('gr') +
    `</defs>`;
  write('cover-signal.svg', svgDoc(W, H, defs + body));
}

// ---------------------------------------------------------------------------
// cover-meridian.svg — wobbled contour rings, cartographic ticks.
// ---------------------------------------------------------------------------

function coverMeridian() {
  const rand = mulberry32(0x3e41d1a4);
  const W = 1200;
  const H = 900;
  const cx = 620;
  const cy = 460;
  const vg = vignette('vg', W, H);
  let body = `<rect width="${W}" height="${H}" fill="#0d0c12"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="430" fill="url(#core)"/>`;

  const rings = 42;
  // Per-ring harmonics, fixed up front so neighbouring rings stay coherent.
  const harms = [];
  for (let h = 0; h < 3; h++) {
    harms.push({ k: 2 + Math.floor(rand() * 5), phase: rand() * Math.PI * 2 });
  }
  const highlight = 29;
  for (let i = 0; i < rings; i++) {
    const r = 26 + i * 12.6;
    const segs = 110;
    let d = '';
    for (let s = 0; s <= segs; s++) {
      const t = (s / segs) * Math.PI * 2;
      let wob = 0;
      for (const h of harms) {
        wob += Math.sin(t * h.k + h.phase + i * 0.16) * (r * 0.028);
      }
      const rr = r + wob;
      const x = cx + Math.cos(t) * rr;
      const y = cy + Math.sin(t) * rr * 0.96;
      d += `${s ? 'L' : 'M'}${f1(x)} ${f1(y)}`;
    }
    d += 'Z';
    const isHi = i === highlight;
    const op = isHi ? 0.85 : 0.1 + rand() * 0.22;
    const col = isHi ? PALETTE.amber : PALETTE.bone;
    const wd = isHi ? 1.7 : 0.8;
    body += `<path d="${d}" fill="none" stroke="${col}" stroke-opacity="${op.toFixed(2)}" stroke-width="${wd}"/>`;
  }
  // Radial tick marks on an outer orbit.
  const tickR = 26 + 36 * 12.6;
  for (let t = 0; t < 72; t++) {
    const a = (t / 72) * Math.PI * 2;
    const long = t % 6 === 0;
    const r0 = tickR - (long ? 16 : 7);
    const x0 = cx + Math.cos(a) * r0;
    const y0 = cy + Math.sin(a) * r0 * 0.96;
    const x1 = cx + Math.cos(a) * tickR;
    const y1 = cy + Math.sin(a) * tickR * 0.96;
    body += `<line x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="${PALETTE.bone}" stroke-opacity="${long ? 0.5 : 0.22}" stroke-width="1"/>`;
  }
  // Crosshair.
  body += `<line x1="${cx}" y1="40" x2="${cx}" y2="${H - 40}" stroke="${PALETTE.bone}" stroke-opacity="0.1" stroke-width="1"/>`;
  body += `<line x1="60" y1="${cy}" x2="${W - 60}" y2="${cy}" stroke="${PALETTE.bone}" stroke-opacity="0.1" stroke-width="1"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${PALETTE.amber}"/>`;
  body += vg.rect + grainRect(W, H, 'gr', 0.05);
  const defs =
    `<defs>` +
    `<radialGradient id="core"><stop offset="0%" stop-color="${PALETTE.violet}" stop-opacity="0.13"/><stop offset="100%" stop-color="${PALETTE.violet}" stop-opacity="0"/></radialGradient>` +
    vg.def +
    grainFilter('gr') +
    `</defs>`;
  write('cover-meridian.svg', svgDoc(W, H, defs + body));
}

// ---------------------------------------------------------------------------
// cover-helios.svg — eclipse disc, orbital arcs, starfield.
// ---------------------------------------------------------------------------

function coverHelios() {
  const rand = mulberry32(0x8e1105);
  const W = 1200;
  const H = 900;
  const cx = 600;
  const cy = 440;
  const vg = vignette('vg', W, H);
  let body = `<rect width="${W}" height="${H}" fill="#0b0b10"/>`;

  // Starfield.
  for (let i = 0; i < 110; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 0.5 + rand() * 1.1;
    body += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r.toFixed(1)}" fill="${PALETTE.bone}" fill-opacity="${(0.1 + rand() * 0.45).toFixed(2)}"/>`;
  }
  // Concentric faint orbits.
  for (let i = 0; i < 6; i++) {
    const r = 230 + i * 56;
    body += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE.bone}" stroke-opacity="${(0.16 - i * 0.02).toFixed(2)}" stroke-width="1"/>`;
  }
  // Orbital arcs: partial circles at random radii/sweeps.
  for (let i = 0; i < 13; i++) {
    const r = 215 + rand() * 330;
    const a0 = rand() * Math.PI * 2;
    const sweep = 0.35 + rand() * 1.7;
    const a1 = a0 + sweep;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const large = sweep > Math.PI ? 1 : 0;
    const amber = rand() < 0.38;
    body +=
      `<path d="M ${f1(x0)} ${f1(y0)} A ${f1(r)} ${f1(r)} 0 ${large} 1 ${f1(x1)} ${f1(y1)}" fill="none" ` +
      `stroke="${amber ? PALETTE.amber : PALETTE.bone}" stroke-opacity="${(amber ? 0.5 + rand() * 0.35 : 0.2 + rand() * 0.25).toFixed(2)}" ` +
      `stroke-width="${(1 + rand() * 1.4).toFixed(1)}" stroke-linecap="round"/>`;
    if (rand() < 0.5) {
      body += `<circle cx="${f1(x1)}" cy="${f1(y1)}" r="3" fill="${amber ? PALETTE.amberHot : PALETTE.bone}" fill-opacity="0.85"/>`;
    }
  }
  // Eclipse disc: glowing rim, dark core.
  body += `<circle cx="${cx}" cy="${cy}" r="195" fill="url(#halo)"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="150" fill="url(#rim)"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="142" fill="#0b0b10"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="142" fill="url(#sheen)"/>`;
  body += vg.rect + grainRect(W, H, 'gr', 0.05);
  const defs =
    `<defs>` +
    `<radialGradient id="halo"><stop offset="55%" stop-color="${PALETTE.amber}" stop-opacity="0"/><stop offset="78%" stop-color="${PALETTE.amber}" stop-opacity="0.32"/><stop offset="100%" stop-color="${PALETTE.amber}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="rim"><stop offset="80%" stop-color="${PALETTE.amberHot}" stop-opacity="0.9"/><stop offset="100%" stop-color="${PALETTE.amber}" stop-opacity="0.25"/></radialGradient>` +
    `<radialGradient id="sheen" cx="38%" cy="30%" r="80%"><stop offset="0%" stop-color="${PALETTE.violet}" stop-opacity="0.2"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    vg.def +
    grainFilter('gr') +
    `</defs>`;
  write('cover-helios.svg', svgDoc(W, H, defs + body));
}

// ---------------------------------------------------------------------------
// cover-lattice.svg — perspective wave lattice with glowing nodes.
// ---------------------------------------------------------------------------

function coverLattice() {
  const rand = mulberry32(0x1a771ce);
  const W = 1200;
  const H = 900;
  const horizon = 300;
  const vp = 600; // vanishing point x
  const field = makeField(rand, 3, 0.006);
  const vg = vignette('vg', W, H);
  let body = `<rect width="${W}" height="${H}" fill="#0c0c11"/>`;
  body += `<rect width="${W}" height="${horizon + 60}" fill="url(#sky)"/>`;

  const rows = 17;
  const rowPts = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const y = horizon + Math.pow(t, 1.75) * (H - horizon - 24);
    const amp = 6 + Math.pow(t, 1.5) * 58;
    const pts = [];
    const cols = 64;
    for (let c = 0; c <= cols; c++) {
      const x = (c / cols) * W;
      const dy = field(x * (0.6 + t), i * 70) * amp * 0.5;
      pts.push([x, y + dy]);
    }
    rowPts.push(pts);
    const op = 0.08 + t * 0.3;
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join(' ');
    body += `<path d="${d}" fill="none" stroke="${PALETTE.bone}" stroke-opacity="${op.toFixed(2)}" stroke-width="${(0.7 + t * 0.8).toFixed(1)}"/>`;
  }
  // Converging columns: connect matching sample indices across rows.
  for (let c = 0; c <= 64; c += 4) {
    let d = '';
    for (let i = 0; i <= rows; i++) {
      const t = i / rows;
      // Pull x toward the vanishing point as rows recede (t→0).
      const px = rowPts[i][c][0];
      const x = vp + (px - vp) * (0.35 + 0.65 * t);
      d += `${i ? 'L' : 'M'}${f1(x)} ${f1(rowPts[i][c][1])}`;
    }
    body += `<path d="${d}" fill="none" stroke="${PALETTE.bone}" stroke-opacity="0.13" stroke-width="0.8"/>`;
  }
  // Glow nodes on random near-field intersections.
  for (let n = 0; n < 13; n++) {
    const i = 6 + Math.floor(rand() * (rows - 6));
    const c = Math.floor(rand() * 16) * 4;
    const t = i / rows;
    const px = rowPts[i][c][0];
    const x = vp + (px - vp) * (0.35 + 0.65 * t);
    const y = rowPts[i][c][1];
    body += `<circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="url(#node)"/>`;
    body += `<circle cx="${f1(x)}" cy="${f1(y)}" r="2.4" fill="${PALETTE.amberHot}"/>`;
  }
  // Low moon above horizon.
  body += `<circle cx="868" cy="170" r="64" fill="url(#moon)"/>`;
  body += vg.rect + grainRect(W, H, 'gr', 0.05);
  const defs =
    `<defs>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${PALETTE.violet}" stop-opacity="0.12"/><stop offset="100%" stop-color="${PALETTE.violet}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="node"><stop offset="0%" stop-color="${PALETTE.amber}" stop-opacity="0.55"/><stop offset="100%" stop-color="${PALETTE.amber}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="moon"><stop offset="60%" stop-color="${PALETTE.bone}" stop-opacity="0.5"/><stop offset="100%" stop-color="${PALETTE.bone}" stop-opacity="0"/></radialGradient>` +
    vg.def +
    grainFilter('gr') +
    `</defs>`;
  write('cover-lattice.svg', svgDoc(W, H, defs + body));
}

// ---------------------------------------------------------------------------
// grain.svg — small tiling film-grain texture for the full-page overlay.
// ---------------------------------------------------------------------------

function grain() {
  const body =
    `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="11" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0"/></filter>` +
    `<rect width="240" height="240" filter="url(#g)"/>`;
  write('grain.svg', svgDoc(240, 240, body));
}

aurora();
coverSignal();
coverMeridian();
coverHelios();
coverLattice();
grain();
console.log('done.');
