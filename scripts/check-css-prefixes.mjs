#!/usr/bin/env node
// Fails the build when a `backdrop-filter` declaration is missing its
// `-webkit-backdrop-filter` twin (or vice-versa) WITHIN THE SAME RULE / SCOPE.
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
// It covers BOTH forms:
//   • CSS declarations in .css / .astro <style>:   backdrop-filter: …;
//   • runtime JS in .ts (e.g. liquid-glass.ts):     style.setProperty('backdrop-filter', …)
//
// Scoping is by brace nesting (the enclosing {…} block), not a line window, so
// two unpaired declarations in *different* adjacent rules can't mask each other.
// A tiny tokenizer ignores braces and property names inside comments/strings.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'src');
const EXTS = new Set(['.css', '.astro', '.ts']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

// Tokenize `src`, returning backdrop-filter declarations as {line, block, kind}.
// `block` is an id for the enclosing {…} scope; a pair counts only if both
// halves share the same block. Braces / property tokens inside comments and
// strings are ignored.
function findDeclarations(src) {
  const decls = [];
  const stack = []; // enclosing block ids; top = current scope (0 = file top)
  let blocks = 0;
  let line = 1;
  let state = 'normal'; // normal | line_comment | block_comment | string
  let strDelim = '';
  const curBlock = () => (stack.length ? stack[stack.length - 1] : 0);

  // True if the string literal opening at `q` is the argument of a
  // (set|remove)Property(...) call — i.e. an actual style-property name, not an
  // unrelated log/config string that happens to read "backdrop-filter".
  const isStylePropCall = (q) => {
    let k = q - 1;
    while (k >= 0 && /\s/.test(src[k])) k--;
    if (src[k] !== '(') return false;
    k--;
    while (k >= 0 && /\s/.test(src[k])) k--;
    let end = k;
    while (k >= 0 && /[A-Za-z]/.test(src[k])) k--;
    const ident = src.slice(k + 1, end + 1);
    return ident === 'setProperty' || ident === 'removeProperty';
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i], c2 = src[i + 1];
    if (c === '\n') { line++; if (state === 'line_comment') state = 'normal'; continue; }

    if (state === 'line_comment') continue;
    if (state === 'block_comment') { if (c === '*' && c2 === '/') { state = 'normal'; i++; } continue; }
    if (state === 'string') {
      if (c === '\\') { i++; continue; }
      if (c === strDelim) state = 'normal';
      continue;
    }

    // normal state
    if (c === '/' && c2 === '/') { state = 'line_comment'; i++; continue; }
    if (c === '/' && c2 === '*') { state = 'block_comment'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') {
      // capture the string body and classify if it's a backdrop-filter prop name
      const delim = c; let j = i + 1; let body = '';
      while (j < src.length && src[j] !== delim) {
        if (src[j] === '\\') { body += src[j + 1] ?? ''; j += 2; continue; }
        if (src[j] === '\n') line++;
        body += src[j]; j++;
      }
      if (isStylePropCall(i)) {
        if (body === '-webkit-backdrop-filter') decls.push({ line, block: curBlock(), kind: 'webkit' });
        else if (body === 'backdrop-filter') decls.push({ line, block: curBlock(), kind: 'std' });
      }
      i = j; // sit on the closing delim (loop ++ moves past)
      continue;
    }
    if (c === '{') { stack.push(++blocks); continue; }
    if (c === '}') { stack.pop(); continue; }

    // CSS-declaration form: (-webkit-)?backdrop-filter : …
    if (src.startsWith('-webkit-backdrop-filter', i)) {
      let k = i + '-webkit-backdrop-filter'.length;
      while (src[k] === ' ' || src[k] === '\t') k++;
      if (src[k] === ':') decls.push({ line, block: curBlock(), kind: 'webkit' });
      i += '-webkit-backdrop-filter'.length - 1;
    } else if (src.startsWith('backdrop-filter', i) && (i === 0 || src[i - 1] !== '-')) {
      let k = i + 'backdrop-filter'.length;
      while (src[k] === ' ' || src[k] === '\t') k++;
      if (src[k] === ':') decls.push({ line, block: curBlock(), kind: 'std' });
      i += 'backdrop-filter'.length - 1;
    }
  }
  return decls;
}

const problems = [];
for (const file of walk(SRC)) {
  const decls = findDeclarations(readFileSync(file, 'utf8'));
  if (!decls.length) continue;
  // group by block; each block must have equal std + webkit counts
  const byBlock = new Map();
  for (const d of decls) {
    const g = byBlock.get(d.block) ?? { std: [], webkit: [] };
    g[d.kind].push(d.line);
    byBlock.set(d.block, g);
  }
  for (const { std, webkit } of byBlock.values()) {
    if (std.length === webkit.length) continue;
    const rel = relative(ROOT, file);
    if (std.length > webkit.length) {
      for (const ln of std) problems.push(`${rel}:${ln}  backdrop-filter without a -webkit-backdrop-filter twin in the same rule/scope`);
    } else {
      for (const ln of webkit) problems.push(`${rel}:${ln}  -webkit-backdrop-filter without a standard backdrop-filter twin in the same rule/scope`);
    }
  }
}

if (problems.length) {
  console.error('✗  backdrop-filter prefix check: unpaired declaration(s) found:\n');
  for (const p of problems) console.error('   ' + p);
  console.error(
    '\n   Every backdrop-filter must be paired with -webkit-backdrop-filter in the' +
      ' same rule/scope (there is no autoprefixer; an unpaired prop silently breaks Safari or Chrome).',
  );
  process.exit(1);
}
console.log('✓  backdrop-filter: all declarations paired with the -webkit- prefix (rule-scoped, incl. .ts).');
