// Machine-readability gate for dist/Tanel_Treuberg_Software_Engineer.pdf, using poppler (pdfinfo + pdftotext).
// Asserts the PDF is A4, has selectable text, and that key content extracts in the
// correct reading order. Exits non-zero (fails CI) on any miss. Run AFTER the generator.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const PDF = path.join(ROOT, 'dist', 'Tanel_Treuberg_Software_Engineer.pdf');

// Substrings that must be present, in this extraction order (reading order).
const ORDERED = ['Tanel', 'EXPERIENCE', 'EDUCATION', 'SKILLS'];
// Must be present (order-independent) — e.g. the portfolio link as selectable text.
const PRESENT = ['themagicianscode.dev'];

function fail(msg) {
  console.error(`✗ verify-resume-pdf: ${msg}`);
  process.exit(1);
}

if (!existsSync(PDF)) fail(`${PDF} not found — run \`npm run resume:pdf\` first.`);

// --- pdfinfo: A4 + page count ---
let info;
try {
  info = execFileSync('pdfinfo', [PDF], { encoding: 'utf8' });
} catch {
  fail('`pdfinfo` failed or poppler-utils is not installed.');
}
const pageMatch = info.match(/^Pages:\s+(\d+)/m);
const pages = pageMatch ? Number(pageMatch[1]) : 0;
if (pages < 1) fail('PDF reports zero pages.');
const sizeMatch = info.match(/^Page size:\s+([\d.]+) x ([\d.]+)/m);
if (!sizeMatch) fail('could not read page size from pdfinfo.');
const [w, h] = [Number(sizeMatch[1]), Number(sizeMatch[2])];
const A4 = { w: 595.28, h: 841.89 };
if (Math.abs(w - A4.w) > 2 || Math.abs(h - A4.h) > 2) {
  fail(`page size not A4: ${w} x ${h} pt.`);
}

// --- pdftotext: text present + in reading order ---
let text;
try {
  text = execFileSync('pdftotext', ['-layout', PDF, '-'], { encoding: 'utf8' });
} catch {
  fail('`pdftotext` failed or poppler-utils is not installed.');
}
const upper = text.toUpperCase();

for (const needle of PRESENT) {
  if (!text.includes(needle)) fail(`expected text "${needle}" not found in extraction.`);
}

let prev = -1;
let prevLabel = '(start)';
for (const needle of ORDERED) {
  const idx = upper.indexOf(needle.toUpperCase());
  if (idx === -1) fail(`expected text "${needle}" not found in extraction.`);
  if (idx < prev) fail(`reading order wrong: "${needle}" appears before "${prevLabel}".`);
  prev = idx;
  prevLabel = needle;
}

console.log(`✓ verify-resume-pdf: ${pages} page(s), A4, text extractable in order.`);
