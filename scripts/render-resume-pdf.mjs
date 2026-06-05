// Renders /resume/ from the built dist/ to a deterministic single-page A4 PDF.
// Build-agnostic: assumes `astro build` already produced dist/. Never builds.
// The assertions below ARE the test — any miss exits non-zero and fails CI.
import { chromium } from 'playwright';
import sirv from 'sirv';
import { createServer } from 'node:http';
import { readFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'resume.pdf');

// A4 portrait in PostScript points.
const A4 = { w: 595.28, h: 841.89 };
const TOL = 2;

// [family, weight, style] that must be loaded before rendering.
const REQUIRED_FONTS = [
  ['Fraunces', 400, 'normal'],
  ['Fraunces', 600, 'normal'],
  ['Fraunces', 400, 'italic'],
  ['Geist', 400, 'normal'],
  ['Geist', 500, 'normal'],
  ['Geist', 600, 'normal'],
  ['Geist Mono', 400, 'normal'],
  ['Geist Mono', 500, 'normal'],
];

// Text that must appear — guards against rendering an error page / base-path miss.
const REQUIRED_TEXT = ['Tanel', 'Experience', 'Skills'];

function fail(msg) {
  throw new Error(msg);
}

if (!existsSync(path.join(DIST, 'resume', 'index.html'))) {
  // Nothing is open yet at this point — direct early exit is safe.
  console.error('✗ render-resume-pdf: dist/resume/index.html not found — run `astro build` first.');
  process.exit(1);
}

const serve = sirv(DIST, { dev: false, etag: true });
const server = createServer((req, res) =>
  serve(req, res, () => {
    res.statusCode = 404;
    res.end('Not found');
  })
);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/resume/`;

let code = 0;
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const response = await page.goto(url, { waitUntil: 'load' });

  if (!response || response.status() !== 200) {
    fail(`expected HTTP 200 at ${url}, got ${response && response.status()}`);
  }
  if ((await page.locator('.resume').count()) < 1) {
    fail('`.resume` element not found in DOM');
  }
  // `innerText` reflects CSS text-transform (section <h2>s are uppercased),
  // so compare case-insensitively — the guard is "is this the real page?",
  // not an exact-case check.
  const bodyText = (await page.locator('body').innerText()).toLowerCase();
  for (const needle of REQUIRED_TEXT) {
    if (!bodyText.includes(needle.toLowerCase()))
      fail(`expected text "${needle}" not found`);
  }

  await page.evaluate(() => document.fonts.ready);
  const missing = await page.evaluate(
    (fonts) =>
      fonts.filter(
        ([family, weight, style]) =>
          !document.fonts.check(`${style} ${weight} 12px "${family}"`)
      ),
    REQUIRED_FONTS
  );
  if (missing.length) fail(`fonts not loaded: ${JSON.stringify(missing)}`);

  await page.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true });

  const pdf = await PDFDocument.load(await readFile(OUT));
  const pages = pdf.getPages();
  if (pages.length !== 1) fail(`expected 1 page, got ${pages.length}`);
  const { width, height } = pages[0].getSize();
  if (Math.abs(width - A4.w) > TOL || Math.abs(height - A4.h) > TOL) {
    fail(`page MediaBox not A4: ${width.toFixed(1)}x${height.toFixed(1)}pt`);
  }

  console.log(`✓ render-resume-pdf: 1 A4 page (${width.toFixed(0)}x${height.toFixed(0)}pt) → ${OUT}`);

  if (process.argv.includes('--copy-public')) {
    await copyFile(OUT, path.join(ROOT, 'public', 'resume.pdf'));
    console.log('✓ copied to public/resume.pdf (dev convenience, gitignored)');
  }
} catch (err) {
  console.error(`✗ render-resume-pdf: ${err.message}`);
  code = 1;
} finally {
  await browser?.close();
  server.close();
}
process.exit(code);
