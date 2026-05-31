// Generates the brand-logo SVG assets for the tech-stack section from the
// theSVG library (https://github.com/glincker/thesvg, MIT). It copies the
// chosen per-brand variant into src/assets/logos/, sanitising each file so a
// page can inline many of them at once without breaking:
//
//   * root width/height are stripped (size is controlled by CSS; viewBox stays)
//   * every internal id is namespaced with the slug, so gradient/clip ids like
//     `#a` can't collide across two inlined logos on the same page
//   * the root gets aria-hidden/focusable=false (the pill label is the a11y name)
//
// Brand marks remain trademarks of their owners; theSVG's code is MIT. We commit
// the raw .svg output so the site ships zero runtime/CDN icon dependencies.
//
// Provenance / re-run:
//   git clone --depth 1 https://github.com/glincker/thesvg /tmp/thesvg
//   THESVG_DIR=/tmp/thesvg node scripts/gen-tech-logos.mjs
//
// theSVG variant convention: `light` = artwork for LIGHT backgrounds (dark ink),
// `dark` = artwork for DARK backgrounds (white ink), `default` = brand default.
// The pills sit the logo on a constant light plate, so we want dark/colourful
// artwork — hence `light` for the otherwise-white bash/flask defaults.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = process.env.THESVG_DIR ?? '/tmp/thesvg';
const ICONS = join(SRC, 'public', 'icons');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'logos');

// slug → { variant }. Distinct slugs only; the data file maps tech names to slugs.
const LOGOS = {
  python: 'default',
  cplusplus: 'default',
  javascript: 'default',
  bash: 'light', // default is white
  swift: 'default',
  pytorch: 'default',
  tensorflow: 'default',
  nvidia: 'default', // TensorRT + Jetson
  onnx: 'default',
  opencv: 'default',
  gstreamer: 'default',
  flask: 'light', // default is white
  postgresql: 'default',
  docker: 'default',
  jenkins: 'default',
  gitlab: 'default',
  kubernetes: 'default',
  grafana: 'default',
  elasticsearch: 'default',
  'aws-amazon-simple-storage-service': 'default',
  git: 'default',
  postman: 'default',
  selenium: 'default',
  scrapy: 'default',
};

function sanitise(svg, slug) {
  // Drop anything before the root <svg> (XML decl, doctype, editor comments) and
  // any comments, so the markup is safe to inline directly into HTML.
  svg = svg.slice(svg.indexOf('<svg')).replace(/<!--[\s\S]*?-->/g, '');
  // Collect ids, then namespace both definitions and references.
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const ns = `${slug}-${id}`;
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    svg = svg
      .replace(new RegExp(`id="${esc}"`, 'g'), `id="${ns}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${ns})`)
      .replace(new RegExp(`(xlink:href|href)="#${esc}"`, 'g'), `$1="#${ns}"`);
  }
  // Strip root width/height (keep viewBox); add a11y hints on the root <svg>.
  svg = svg.replace(/<svg\b[^>]*>/, (tag) => {
    let t = tag.replace(/\s(width|height)="[^"]*"/g, '');
    if (!/aria-hidden=/.test(t)) t = t.replace(/<svg\b/, '<svg aria-hidden="true" focusable="false"');
    return t;
  });
  return svg.trim() + '\n';
}

if (!existsSync(ICONS)) {
  console.error(`theSVG icons not found at ${ICONS}.\nClone it first:\n  git clone --depth 1 https://github.com/glincker/thesvg ${SRC}`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const [slug, variant] of Object.entries(LOGOS)) {
  const file = join(ICONS, slug, `${variant}.svg`);
  if (!existsSync(file)) {
    console.error(`MISSING: ${slug}/${variant}.svg`);
    process.exit(1);
  }
  writeFileSync(join(OUT, `${slug}.svg`), sanitise(readFileSync(file, 'utf8'), slug));
  n++;
}
console.log(`Wrote ${n} logo SVGs to src/assets/logos/`);
