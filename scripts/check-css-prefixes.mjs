#!/usr/bin/env node
// Fails the build when a `backdrop-filter` declaration is missing its
// `-webkit-backdrop-filter` twin (or vice-versa) within the same rule.
//
// Why this exists: there is NO autoprefixer in the pipeline. Tailwind v4's
// Lightning CSS pass only prefixes what's in its target matrix, and Astro's
// scoped-style pipeline doesn't add `-webkit-backdrop-filter` either — so the
// Safari/iOS support of every backdrop-filter on this site is upheld by a
// hand-written prefix pair and nothing else. A missing `-webkit-` prefix fails
// Safari/iOS *silently* (no error, just no blur); a missing standard property
// fails Chrome/Firefox. This gate turns either into a hard error so the
// Chromium↔WebKit parity floor can't regress unnoticed.
//
// Convention in this repo: the two declarations are always written adjacent
// (either order), so a small ±line window is enough to find the twin.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'src');
const EXTS = new Set(['.css', '.astro']); // CSS files + scoped <style> in .astro
const WINDOW = 3; // lines to scan around a declaration for its twin

// `-webkit-backdrop-filter:` …
const WEBKIT = /-webkit-backdrop-filter\s*:/;
// standard `backdrop-filter:` NOT preceded by `-webkit-`
const STANDARD = /(^|[^-])backdrop-filter\s*:/;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

const problems = [];
for (const file of walk(SRC)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const isWebkit = WEBKIT.test(line);
    const isStandard = !isWebkit && STANDARD.test(line);
    if (!isWebkit && !isStandard) return;
    const near = lines.slice(Math.max(0, i - WINDOW), i + WINDOW + 1).join('\n');
    const twinPresent = isWebkit ? STANDARD.test(near) : WEBKIT.test(near);
    if (!twinPresent) {
      const missing = isWebkit ? 'standard `backdrop-filter`' : '`-webkit-backdrop-filter`';
      problems.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}  → missing ${missing} twin`);
    }
  });
}

if (problems.length) {
  console.error('✗  backdrop-filter prefix check: unpaired declaration(s) found:\n');
  for (const p of problems) console.error('   ' + p);
  console.error(
    '\n   Every backdrop-filter must be paired with -webkit-backdrop-filter' +
      ' (there is no autoprefixer; an unpaired prop silently breaks Safari or Chrome).',
  );
  process.exit(1);
}
console.log('✓  backdrop-filter: all declarations paired with the -webkit- prefix.');
