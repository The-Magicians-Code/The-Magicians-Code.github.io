// Generates the brand-logo SVG assets for the tech-stack section from the
// theSVG library (https://github.com/glincker/thesvg, MIT). Every logo is
// sourced from theSVG; SQL/REST use SQLite/OpenAPI marks as the conventional
// stand-ins. All output is committed to src/assets/logos/ so the site ships
// zero runtime or CDN icon dependency. The logos sit directly on the pill, so
// each is sanitised so a page can inline many at once:
//
//   * root width/height stripped (size is CSS-controlled; viewBox stays)
//   * XML declarations / comments dropped (safe to inline into HTML)
//   * every internal id namespaced with the slug, so gradient/clip ids like
//     `#a` can't collide across two inlined logos on the same page
//   * root gets aria-hidden / focusable=false (the pill label is the a11y name)
//
// theSVG variant convention: `light` = artwork for LIGHT backgrounds (dark ink),
// `dark` = artwork for DARK backgrounds (light ink), `mono` = single-colour
// (no fill → we force currentColor so it knocks out white on the dark theme),
// `default` = brand default (usually full colour, reads on either theme).
//
// For each entry we emit `<slug>.svg` (light theme) and, when a `dark` variant
// is given, `<slug>.dark.svg` (dark theme). The component swaps between them on
// the theme toggle; brand-coloured logos that read on both omit the dark file.
//
// Provenance / re-run:
//   git clone --depth 1 https://github.com/glincker/thesvg /tmp/thesvg
//   THESVG_DIR=/tmp/thesvg node scripts/gen-tech-logos.mjs

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = process.env.THESVG_DIR ?? '/tmp/thesvg';
const ICONS = join(SRC, 'public', 'icons');
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'logos');

// slug → { light, dark? }. `light` is shown in the light theme, `dark` (when
// present) in the dark theme. Omit `dark` for full-colour marks legible on both.
const LOGOS = {
  python: { light: 'default' },
  cplusplus: { light: 'default', dark: 'mono' }, // dark blue shield → white knockout on dark
  javascript: { light: 'default' },
  bash: { light: 'light', dark: 'dark' }, // default is white
  swift: { light: 'default' },
  pytorch: { light: 'default' },
  tensorflow: { light: 'default' },
  nvidia: { light: 'light', dark: 'dark' }, // wordmark inverts per background; TensorRT + Jetson
  onnx: { light: 'default' },
  opencv: { light: 'default' },
  gstreamer: { light: 'default' },
  flask: { light: 'light', dark: 'dark' }, // default is white
  postgresql: { light: 'default', dark: 'mono' }, // black elephant → white knockout on dark
  docker: { light: 'default' },
  jenkins: { light: 'default' },
  gitlab: { light: 'default' },
  kubernetes: { light: 'default' },
  grafana: { light: 'default' },
  elasticsearch: { light: 'default', dark: 'mono' }, // dark teal → white knockout on dark
  'aws-amazon-simple-storage-service': { light: 'default' },
  git: { light: 'default' },
  postman: { light: 'default' },
  selenium: { light: 'default' },
  scrapy: { light: 'default' },
  sqlite: { light: 'default', dark: 'mono' }, // SQL — navy mark → white knockout on dark
  openapi: { light: 'default', dark: 'mono' }, // REST APIs — has dark-grey parts
};

function sanitise(svg, slug, { forceCurrentColor = false } = {}) {
  // Drop anything before the root <svg> (XML decl, doctype, editor comments).
  svg = svg.slice(svg.indexOf('<svg')).replace(/<!--[\s\S]*?-->/g, '');
  // Namespace ids so inlined gradients/clips can't collide across logos.
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const ns = `${slug}-${id}`;
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    svg = svg
      .replace(new RegExp(`id="${esc}"`, 'g'), `id="${ns}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${ns})`)
      .replace(new RegExp(`(xlink:href|href)="#${esc}"`, 'g'), `$1="#${ns}"`);
  }
  // Strip root width/height (keep viewBox); add a11y hints; optionally force the
  // root fill to currentColor for mono variants (their paths have no fill).
  svg = svg.replace(/<svg\b[^>]*>/, (tag) => {
    let t = tag.replace(/\s(width|height)="[^"]*"/g, '');
    if (forceCurrentColor) {
      t = /\sfill="/.test(t) ? t.replace(/\sfill="[^"]*"/, ' fill="currentColor"') : t.replace(/<svg\b/, '<svg fill="currentColor"');
    }
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

for (const [slug, { light, dark }] of Object.entries(LOGOS)) {
  for (const [variant, suffix] of [[light, ''], [dark, '.dark']]) {
    if (!variant) continue;
    const file = join(ICONS, slug, `${variant}.svg`);
    if (!existsSync(file)) {
      console.error(`MISSING: ${slug}/${variant}.svg`);
      process.exit(1);
    }
    const out = sanitise(readFileSync(file, 'utf8'), slug, { forceCurrentColor: variant === 'mono' });
    writeFileSync(join(OUT, `${slug}${suffix}.svg`), out);
    n++;
  }
}

console.log(`Wrote ${n} SVGs to src/assets/logos/`);
