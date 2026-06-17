#!/usr/bin/env node
// Deterministic generative artwork for the /studio prototype — drawn in the
// production design language (DESIGN.md): ink hairlines on warm paper with a
// rare ember accent, plus a symmetric dark-mode variant of every asset
// (the Symmetric Dark-Mode Rule — `<name>.dark.svg`, mirroring the
// `src/assets/logos/<slug>.dark.svg` convention).
//
// Fixed-seed PRNG (mulberry32) → two runs produce byte-identical files
// (same no-Date.now/no-Math.random policy as the resume PDF generator).
// Re-run with `node scripts/studio-assets/generate.mjs` and commit.
//
// Assets (each in light + dark):
//   flow.svg / flow.dark.svg    hero backdrop — ink flow-field streamlines
//   sigil.svg / sigil.dark.svg  small concentric contour stamp

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const OUT = join(ROOT, 'src', 'assets', 'studio');
mkdirSync(OUT, { recursive: true });

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

// Smooth pseudo-noise from a fixed bank of random sine waves — organic enough
// for streamline advection, dependency-free, fully seeded.
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
    return v;
  };
}

// Stroke palettes per theme. Backgrounds stay transparent so the artwork sits
// directly on var(--bg) / var(--paper); only stroke colours need variants.
// Ink values match the site tokens; the ember is the artwork-space cousin of
// `oklch(64% 0.18 28)` / `oklch(72% 0.16 28)`.
const THEMES = {
  light: { ink: '#1a1a1c', ember: '#c0573b' },
  dark: { ink: '#f0f0f5', ember: '#dd8568' },
};

function svgDoc(w, h, body) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" ` +
    `width="${w}" height="${h}" role="img">` +
    body +
    `</svg>\n`
  );
}

function write(name, content) {
  writeFileSync(join(OUT, name), content);
  console.log(`✓  ${name}  (${(content.length / 1024).toFixed(1)} KB)`);
}

// ---------------------------------------------------------------------------
// flow — hero backdrop. Quiet ink streamlines drifting across the page with a
// handful of ember lines (the One Ember Rule: rare, small, warm).
// ---------------------------------------------------------------------------

function flow(theme, suffix) {
  const rand = mulberry32(0xf10a7);
  const W = 1600;
  const H = 1000;
  const field = makeField(rand, 4, 0.0028);
  let body = '';
  const N = 110;
  for (let i = 0; i < N; i++) {
    let x = -60 + rand() * (W + 120);
    let y = -60 + rand() * (H + 120);
    const steps = 34 + Math.floor(rand() * 30);
    const pts = [[x, y]];
    for (let s = 0; s < steps; s++) {
      const a = field(x, y) * 1.7 + Math.PI * 0.08;
      x += Math.cos(a) * 11;
      y += Math.sin(a) * 11;
      pts.push([x, y]);
    }
    const ember = rand() < 0.06;
    const opacity = ember ? 0.4 + rand() * 0.25 : 0.05 + rand() * 0.1;
    const width = ember ? 1.3 : 0.7 + rand() * 0.6;
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${f1(p[0])} ${f1(p[1])}`).join(' ');
    body += `<path d="${d}" fill="none" stroke="${ember ? theme.ember : theme.ink}" stroke-opacity="${opacity.toFixed(2)}" stroke-width="${width.toFixed(1)}" stroke-linecap="round"/>`;
  }
  write(`flow${suffix}.svg`, svgDoc(W, H, body));
}

// ---------------------------------------------------------------------------
// sigil — a small wobbled-contour stamp (cabinet maker's mark). One ember
// ring among ink rings.
// ---------------------------------------------------------------------------

function sigil(theme, suffix) {
  const rand = mulberry32(0x5161a);
  const S = 240;
  const c = S / 2;
  let body = '';
  const harms = [];
  for (let h = 0; h < 3; h++) {
    harms.push({ k: 2 + Math.floor(rand() * 4), phase: rand() * Math.PI * 2 });
  }
  const rings = 9;
  const emberRing = 6;
  for (let i = 0; i < rings; i++) {
    const r = 16 + i * 11;
    const segs = 90;
    let d = '';
    for (let s = 0; s <= segs; s++) {
      const t = (s / segs) * Math.PI * 2;
      let wob = 0;
      for (const h of harms) wob += Math.sin(t * h.k + h.phase + i * 0.3) * (r * 0.045);
      const rr = r + wob;
      d += `${s ? 'L' : 'M'}${f1(c + Math.cos(t) * rr)} ${f1(c + Math.sin(t) * rr)}`;
    }
    d += 'Z';
    const isEmber = i === emberRing;
    body += `<path d="${d}" fill="none" stroke="${isEmber ? theme.ember : theme.ink}" stroke-opacity="${isEmber ? 0.8 : (0.16 + rand() * 0.18).toFixed(2)}" stroke-width="${isEmber ? 1.5 : 1}"/>`;
  }
  body += `<circle cx="${c}" cy="${c}" r="2.5" fill="${theme.ember}"/>`;
  write(`sigil${suffix}.svg`, svgDoc(S, S, body));
}

flow(THEMES.light, '');
flow(THEMES.dark, '.dark');
sigil(THEMES.light, '');
sigil(THEMES.dark, '.dark');
console.log('done.');
