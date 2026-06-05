# Resume PDF Build-Time Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `window.print()` on `/resume/` with a deterministic, device-agnostic single-page A4 PDF rendered by a pinned headless Chromium at build time, served as a static `/resume.pdf`.

**Architecture:** A build-agnostic Node script (`scripts/render-resume-pdf.mjs`) serves the built `dist/` over a local static server (`sirv`), drives pinned Playwright Chromium to render the existing `/resume/` URL (print media → the existing `@media print` CSS), asserts correctness + single-A4-page (`pdf-lib`), and writes `dist/resume.pdf`. CI runs the same script after `astro build`. Fonts are self-hosted (prerequisite) so rendering has no CDN dependency.

**Tech Stack:** Astro v6, Playwright (Chromium), sirv, pdf-lib, Fontsource variable fonts, GitHub Actions.

**Verification model:** No unit-test runner exists in this repo. Gates are `npm run check`, `npm run build`, running the render script (its assertions are the test), and reading the produced PDF. Do **not** claim "tests pass" — say "build + check + render gate pass" with evidence.

**Branch:** `feat/resume-pdf-export` (already created; spec committed at `adecd0b`).

**Spec:** `docs/superpowers/specs/2026-06-05-resume-pdf-build-time-generation-design.md`

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/layouts/BaseLayout.astro` | Remove Google Fonts CDN links; import self-hosted Fontsource fonts | Modify (`:77-82`) |
| `package.json` | Pin font + render devDependencies; add `resume:pdf` script | Modify |
| `scripts/render-resume-pdf.mjs` | Serve `dist`, render `/resume/`, assert correctness + single A4 page, write `dist/resume.pdf` | Create |
| `.gitignore` | Ignore the opt-in dev copy `public/resume.pdf` | Modify |
| `src/pages/resume.astro` | Swap print `<button>` for a download `<a>`; delete `window.print()` script | Modify |
| `public/robots.txt` | Disallow `/resume.pdf` + `/resume/` | Create |
| `.github/workflows/deploy.yml` | Unbundle `withastro/action`; insert render step before Pages upload | Modify |
| `CLAUDE.md` | Document the explicit deploy pipeline | Modify |

---

## Task 1: Self-host the three fonts (Phase 0 prerequisite)

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `src/layouts/BaseLayout.astro:77-82`

- [ ] **Step 1: Install the Fontsource variable packages (pinned)**

Run:
```bash
npm install --save-exact @fontsource-variable/fraunces @fontsource-variable/geist @fontsource-variable/geist-mono
```
Expected: three entries added to `dependencies` with exact versions (no `^`).

- [ ] **Step 2: Discover the exact CSS entry files each package exposes**

The Google Fonts request needs: Fraunces roman **and** italic across opsz 9–144 / wght 300–600; Geist wght 400/500/600; Geist Mono wght 400/500. Inspect what each variable package ships so the correct axis/style CSS files are imported:

Run:
```bash
ls node_modules/@fontsource-variable/fraunces/*.css
ls node_modules/@fontsource-variable/geist/*.css
ls node_modules/@fontsource-variable/geist-mono/*.css
```
Expected: a set of CSS files. For Fraunces note the roman entry (commonly `index.css` / `wght.css` / `opsz.css`) and the italic entry (commonly `*-italic.css` or `wght-italic.css`). For Geist / Geist Mono note the standard `index.css` (wght axis).

> If a package does **not** ship the needed axis (Fraunces `opsz`) or the italic file, abort Fontsource for that family and instead vendor the official upstream variable woff2 into `public/fonts/` with a hand-written `@font-face` using the exact family names `"Fraunces"`, `"Geist"`, `"Geist Mono"`. Record which path was taken in the commit message.

- [ ] **Step 3: Import the self-hosted fonts in BaseLayout and remove the CDN links**

In `src/layouts/BaseLayout.astro`, add to the frontmatter (top `---` block), using the exact filenames discovered in Step 2 (example assuming standard Fontsource layout — adjust to real files):
```astro
import '@fontsource-variable/fraunces';          // roman, full axis
import '@fontsource-variable/fraunces/wght-italic.css'; // italic — use the real italic file from Step 2
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
```

Then delete these three elements from the `<head>` (`:77-82`):
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 4: Verify no CDN font requests remain and the site still renders**

Run:
```bash
npm run check && npm run build
grep -rn "fonts.googleapis\|fonts.gstatic" dist/ || echo "NO CDN font refs in build"
```
Expected: `check` + `build` pass; grep prints "NO CDN font refs in build". Then `npm run dev`, open `/`, `/resume/`, and confirm headings (Fraunces serif), body (Geist), and mono labels look unchanged. The DevTools Network panel shows font requests served from the same origin, none from `googleapis`/`gstatic`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/layouts/BaseLayout.astro
git commit -m "feat(fonts): self-host Fraunces/Geist/Geist Mono, drop Google Fonts CDN

Removes the runtime CDN dependency (determinism for build-time PDF
rendering + a site-wide perf win). Family names unchanged."
```

---

## Task 2: Add render dependencies and gitignore the dev copy

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Modify: `.gitignore`

- [ ] **Step 1: Install render devDependencies (pinned exact)**

Run:
```bash
npm install --save-dev --save-exact playwright pdf-lib sirv
```
Expected: `playwright`, `pdf-lib`, `sirv` added to `devDependencies` with exact versions.

- [ ] **Step 2: Add the `resume:pdf` script**

In `package.json` `scripts`, add:
```json
"resume:pdf": "astro build && node scripts/render-resume-pdf.mjs"
```
(Leave existing scripts untouched. CI calls `node scripts/render-resume-pdf.mjs` directly after its own build — the script never builds, so no double build.)

- [ ] **Step 3: Gitignore the opt-in dev copy**

Append to `.gitignore` under the Astro section:
```
# Build-time generated resume PDF (dev convenience copy; CI writes dist/resume.pdf)
public/resume.pdf
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "build(deps): add playwright/pdf-lib/sirv for resume PDF render"
```

---

## Task 3: Write the render script

**Files:**
- Create: `scripts/render-resume-pdf.mjs`

- [ ] **Step 1: Write the script**

Create `scripts/render-resume-pdf.mjs`:
```js
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
  console.error(`✗ render-resume-pdf: ${msg}`);
  process.exit(1);
}

if (!existsSync(path.join(DIST, 'resume', 'index.html'))) {
  fail('dist/resume/index.html not found — run `astro build` first.');
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

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const response = await page.goto(url, { waitUntil: 'load' });

  if (!response || response.status() !== 200) {
    fail(`expected HTTP 200 at ${url}, got ${response && response.status()}`);
  }
  if ((await page.locator('.resume').count()) < 1) {
    fail('`.resume` element not found in DOM');
  }
  const bodyText = await page.locator('body').innerText();
  for (const needle of REQUIRED_TEXT) {
    if (!bodyText.includes(needle)) fail(`expected text "${needle}" not found`);
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

  // Non-gating fill telemetry: A4 print width ~794px @96dpi; usable height ~1056px.
  const contentPx = await page.evaluate(() => {
    const el = document.querySelector('.resume');
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  });
  console.log(`✓ render-resume-pdf: 1 A4 page; .resume height ~${contentPx}px`);

  if (process.argv.includes('--copy-public')) {
    await copyFile(OUT, path.join(ROOT, 'public', 'resume.pdf'));
    console.log('✓ copied to public/resume.pdf (dev convenience, gitignored)');
  }
} finally {
  await browser.close();
  server.close();
}
```

- [ ] **Step 2: Install the Chromium binary for local runs**

Run:
```bash
npx playwright install chromium
```
Expected: Chromium downloaded for the pinned Playwright version.

- [ ] **Step 3: Run the render against a fresh build (this is the test)**

Run:
```bash
npm run resume:pdf
```
Expected: ends with `✓ render-resume-pdf: 1 A4 page; .resume height ~<N>px` and exit code 0. If any assertion fails, the script exits non-zero with a `✗` message — fix the cause (commonly a font face name mismatch from Task 1, or content overflow).

- [ ] **Step 4: Commit**

```bash
git add scripts/render-resume-pdf.mjs
git commit -m "feat(resume): build-time PDF render script with single-A4-page gate"
```

---

## Task 4: Verify the produced PDF visually

**Files:** none (verification task)

- [ ] **Step 1: Inspect the generated PDF**

Read `dist/resume.pdf` (the Read tool renders PDF pages). Confirm: exactly one A4 page, Fraunces/Geist fonts rendered (not fallback), no content clipped at the bottom margin, no large empty gap, selectable-looking text, contact links present.

- [ ] **Step 2: Confirm determinism inputs**

Run:
```bash
grep -E '"playwright"|@fontsource-variable' package.json
```
Expected: `playwright` and all three font packages pinned to exact versions (no `^`/`~`), so CI Chromium + fonts match local.

No commit (inspection only). If the PDF looks wrong, return to Task 1/Task 3.

---

## Task 5: Swap the Export button to a download link

**Files:**
- Modify: `src/pages/resume.astro` (button markup + the `window.print()` script block)

- [ ] **Step 1: Replace the button markup**

In `src/pages/resume.astro`, replace the `<button id="resume-print" ...> ... </button>` element with an anchor that keeps the same classes/SVG/label:
```astro
<a
  href="/resume.pdf"
  download="Tanel_Treuberg_Software_Engineer.pdf"
  class="resume-print-btn"
  aria-label="Download resume as PDF"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
  <span>Export PDF</span>
</a>
```

- [ ] **Step 2: Delete the `window.print()` script block**

Remove the entire `// ── Export PDF via window.print() ──` block from the page `<script>` (the `const printBtn = document.getElementById('resume-print') ...` through its `requestAnimationFrame(() => window.print())`). Leave the entry expand/collapse script intact.

- [ ] **Step 3: Verify**

Run:
```bash
npm run check
grep -n "window.print\|resume-print" src/pages/resume.astro || echo "print button fully removed"
```
Expected: `check` passes; grep prints "print button fully removed". The `.resume-print-btn` CSS already styles the anchor (anchors accept the same rules); the print CSS still hides `.resume-toolbar`, so the link never appears in the PDF.

- [ ] **Step 4: Commit**

```bash
git add src/pages/resume.astro
git commit -m "feat(resume): download static /resume.pdf instead of window.print()"
```

---

## Task 6: Add robots.txt

**Files:**
- Create: `public/robots.txt`

- [ ] **Step 1: Create the file**

Create `public/robots.txt`:
```
User-agent: *
Disallow: /resume/
Disallow: /resume.pdf
```

- [ ] **Step 2: Verify it ships at the root**

Run:
```bash
npm run build && cat dist/robots.txt
```
Expected: `dist/robots.txt` contains the two Disallow lines (Astro copies `public/` to the site root).

- [ ] **Step 3: Commit**

```bash
git add public/robots.txt
git commit -m "chore(seo): robots.txt disallow /resume/ and /resume.pdf"
```

---

## Task 7: Wire the render into the deploy workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Replace the `build` job with explicit steps**

Replace the `build` job (currently `checkout` + `withastro/action@v6`) with the following, preserving the implicit behaviors the action gave us (package-manager detect → `npm ci`, Node, Pages config, `dist` upload):
```yaml
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - uses: actions/configure-pages@v5
      - run: npm ci
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: node scripts/render-resume-pdf.mjs
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
```
Leave the `deploy` job (`actions/deploy-pages@v5`) and the top-level `permissions`/`concurrency` unchanged.

- [ ] **Step 2: Verify the action major versions pair correctly**

Open GitHub's current "Deploy static content to Pages" starter (`static.yml`) and confirm the majors of `actions/configure-pages` and `actions/upload-pages-artifact` that pair with `actions/deploy-pages@v5`. If newer than `@v5`/`@v3` above, bump them. (`path: dist` is correct.)

- [ ] **Step 3: Validate the workflow file syntactically**

Run:
```bash
npx --yes @action-validator/cli .github/workflows/deploy.yml 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML OK')"
```
Expected: validator passes, or `YAML OK`. (Full validation happens when CI runs on merge to `main`.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: render /resume.pdf at build time before Pages upload

Unbundles withastro/action so the PDF render runs between build and
artifact upload. Render failure fails the job and blocks deploy."
```

---

## Task 8: Update CLAUDE.md deployment docs

**Files:**
- Modify: `CLAUDE.md` (Deployment section)

- [ ] **Step 1: Update the Deployment section**

In `CLAUDE.md`, update the Deployment bullets to describe the explicit pipeline: the `build` job no longer uses `withastro/action@v6`; it runs `setup-node` → `configure-pages` → `npm ci` → `npm run build` → `playwright install chromium` → `node scripts/render-resume-pdf.mjs` → `upload-pages-artifact`, then `deploy-pages@v5`. Note that `/resume.pdf` is generated at build time (not committed), render failure blocks the deploy, and local previews use `npm run resume:pdf` (Chromium required locally; the dev copy `public/resume.pdf` is opt-in via `--copy-public` and gitignored).

- [ ] **Step 2: Verify**

Run:
```bash
grep -n "withastro/action" CLAUDE.md || echo "stale action reference removed"
```
Expected: prints "stale action reference removed" (or only references that are intentionally historical).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update deploy pipeline for build-time resume PDF render"
```

---

## Final verification (before opening the PR)

- [ ] `npm run check` passes.
- [ ] `npm run resume:pdf` exits 0 with the single-A4-page success line.
- [ ] Reading `dist/resume.pdf` confirms one A4 page, correct fonts, no clipping/overflow.
- [ ] `grep -rn "fonts.googleapis" dist/` returns nothing.
- [ ] `dist/robots.txt` and a freshly rendered `dist/resume.pdf` both exist after `npm run build && node scripts/render-resume-pdf.mjs`.
- [ ] `.github/workflows/deploy.yml` validates; action majors confirmed against the current Pages starter.
- [ ] Push the branch and open a PR (do not push to `main`); the `chatgpt-codex-connector` bot auto-reviews on open. After any later push to the PR, comment `@codex review`.

> **Single-page fragility note:** the `@media print` block in `resume.astro` is tuned to *just* fit one A4 page. If resume content grows later, the render gate will start failing the build (page-count ≠ 1). That is intended — adjust the print CSS (or trim content) until it fits again. The gate is the guardrail, not a bug.
