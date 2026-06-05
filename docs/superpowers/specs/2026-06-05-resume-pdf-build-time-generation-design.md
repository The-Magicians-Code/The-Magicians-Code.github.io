# Resume PDF — Build-Time Generation Design

> **⚠️ Superseded (2026-06-05):** the headless-Chromium render approach described below was implemented, then replaced by a direct `pdf-lib` ATS-minimal generator (non-embedded Helvetica, no browser). See [docs/superpowers/plans/2026-06-05-resume-pdf-ats-rework.md](../plans/2026-06-05-resume-pdf-ats-rework.md) for the current pipeline. This document is retained for historical context only.

**Date:** 2026-06-05
**Status:** Approved design, pending implementation plan
**Supersedes:** `docs/resume/cv-to-pdf-handover.md` (a rejected alternative — standalone Cloudflare Worker + on-demand headless render; see "Rejected alternatives")

## Goal

Replace the current client-side `window.print()` "Export PDF" flow on `/resume/` with a **deterministic, device-agnostic, single-page A4 PDF generated at build time** and served as a static `/resume.pdf`. Every visitor downloads byte-identical output regardless of device, OS, browser, or screen — rendered once by a pinned headless Chromium in CI, not by the visitor's machine.

## Non-goals

- No second component or `cv.json`. `src/data/resume.ts` stays the single source of truth and `src/pages/resume.astro`'s existing `@media print` CSS stays the PDF stylesheet.
- No runtime/on-demand PDF generation (no Worker, no external render service). Content lives in a committed file; every change already triggers a rebuild, so build-time generation is never stale relative to the deployed site.
- No multi-page resume support. The single-page A4 constraint is a hard, asserted invariant.
- No history rewrite or unrelated repo cleanup.

## Background — current state (verified)

- `/resume/` (`src/pages/resume.astro`, `noindex,nofollow`) renders from `src/data/resume.ts`. It has Interactive/Formal toggle modes and a carefully tuned `@media print` block: `@page { size: A4; margin: 12mm 10mm 7mm 10mm }`, forces all entries open, forces light tokens, 2-col skills, `break-inside: avoid`, hides nav/toolbar/footer. Tuned to fit **one** A4 page.
- The Export button is currently a `<button id="resume-print">` that swaps `document.title` then calls `window.print()` — non-deterministic, device-dependent. This is what we replace.
- **Fonts load from Google Fonts CDN** (`BaseLayout.astro:77-82`): Fraunces (serif, roman+italic, opsz 9–144, wght 300–600), Geist (sans, 400/500/600), Geist Mono (400/500). There is **no** `public/fonts/` directory today. A single-page resume is acutely font-metric sensitive, so CDN dependence at render time is a determinism risk and a prerequisite to fix.
- Deploy: `.github/workflows/deploy.yml` `build` job is a single `withastro/action@v6` step (builds **and** uploads the Pages artifact together); a separate `deploy` job runs `actions/deploy-pages@v5`. Public repo → free unlimited Actions minutes.
- No `public/robots.txt` exists.

## Architecture & data flow

```
src/data/resume.ts  (SSOT, unchanged)
   │  astro build
   ▼
dist/resume/index.html  + self-hosted fonts in dist/  ──┐
                                                         │  scripts/render-resume-pdf.mjs
                                                         │    1. serve dist/ on 127.0.0.1 (sirv)
                                                         │    2. Chromium → /resume/  (print media = @media print CSS)
                                                         │    3. assert load OK + DOM + fonts loaded
                                                         │    4. page.pdf({ printBackground, preferCSSPageSize })
                                                         │    5. assert single A4 page (pdf-lib)
                                                         ▼
                                                 dist/resume.pdf  ──► uploaded with Pages artifact
```

The same script runs locally (for verification) and in CI (to produce the shipped file). Because the Chromium version is pinned via Playwright and fonts are self-hosted in-repo, the locally-rendered PDF is byte-faithful to the shipped one.

## Phased changes

### Phase 0 — Self-host the three fonts (prerequisite)

Determinism requires removing the runtime CDN dependency. This is a site-wide change (benefits all pages: removes render-blocking external CDN + the headless font-load race).

- Vendor **Fraunces** (variable, incl. opsz + italic), **Geist** (variable wght), **Geist Mono** (variable wght) as self-hosted woff2.
- **Mechanism (preferred):** Fontsource variable packages (`@fontsource-variable/fraunces`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`), pinned to exact versions, imported once (global CSS / layout). Npm-managed + version-pinned = deterministic.
  - **Verify during implementation** that Fontsource exposes the needed axes — specifically Fraunces `opsz` (9–144) and the italic file. If any axis/style is missing, fall back to vendoring the official variable woff2 from the upstream font source into `public/fonts/` with hand-written `@font-face` (matching the current `font-family` names exactly: `"Fraunces"`, `"Geist"`, `"Geist Mono"`).
- Remove the two `<link rel="preconnect">` and the Google Fonts `<link rel="stylesheet">` from `BaseLayout.astro:77-82`.
- Keep `font-display: swap` semantics; ensure the `--font-serif/-sans/-mono` token names in `global.css` continue to resolve to the same family names so nothing else changes visually.
- Verify the whole site (not just `/resume/`) still renders correctly after the swap.

> Note: Phase 0 may be landed as its own commit/PR ahead of the pipeline, since it stands on its own as a perf + determinism improvement. The PDF pipeline depends on it.

### Phase 1 — `scripts/render-resume-pdf.mjs` (new, build-agnostic)

The script **never builds**. It assumes `dist/` exists and fails fast if `dist/resume/index.html` is missing.

1. Serve `dist/` over `127.0.0.1` on an ephemeral port using `sirv` (static, directory-index so `/resume/` → `dist/resume/index.html`, correct MIME types — closer to how GitHub Pages serves than the experimental Astro `preview()` API). Always shut the server down in a `finally`.
2. Launch pinned Playwright Chromium. `page.goto('http://127.0.0.1:<port>/resume/', { waitUntil: 'load' })` — **not** `networkidle` (discouraged by Playwright as a readiness signal).
3. **Strong readiness/correctness gate** (fail the run on any miss — a one-page PDF of the *wrong* content must not pass):
   - Navigation response status `=== 200`.
   - `.resume` element exists in the DOM.
   - Expected content present (e.g. `resume.name` and a known section heading text) — guards against rendering an error page or a base-path miss.
   - **Fonts actually loaded**, via `document.fonts.check(...)` for each face/weight/style used in print: Fraunces roman + italic, Geist 400/500/600, Geist Mono 400/500. (`document.fonts.ready` alone is insufficient — it resolves even after a failed load.)
4. `page.pdf({ path: 'dist/resume.pdf', printBackground: true, preferCSSPageSize: true })`. No `format`/`margin` passed via API — the `@page` rule in `resume.astro` is authoritative (CSS = SSOT for page geometry).
5. **Single-page gate** with `pdf-lib`: load the output and assert `getPageCount() === 1` **and** the page MediaBox ≈ A4 (≈595.28 × 841.89 pt, small tolerance). The MediaBox check catches a silently-dropped `@page` rule that would otherwise still yield one page at the wrong size.
6. **Fill-ratio telemetry (non-gating):** log a rough "content fills ~N% of usable page height" hint for early overflow warning. Explicitly **not** a gate — print emulation does not model paged fragmentation, so the PDF page-count + MediaBox checks remain the only authoritative overflow gate.
7. Optional `--copy-public` flag copies the result to `public/resume.pdf` for local dev-server convenience only. Documented as **stale-by-design**; gitignored (see Phase 2). Default behavior writes only `dist/resume.pdf`.

### Phase 2 — `package.json` + deps + gitignore

- Add devDependencies, **pinned to exact versions** (no `^`) for determinism: `playwright`, `pdf-lib`, `sirv`, and the three `@fontsource-variable/*` packages (Phase 0).
- Scripts:
  - `"resume:pdf": "astro build && node scripts/render-resume-pdf.mjs"` — local one-shot: build then render into `dist/resume.pdf` for inspection.
  - (CI calls `node scripts/render-resume-pdf.mjs` directly after its own build step — no double build.)
- `.gitignore`: add `public/resume.pdf` (the optional dev-convenience copy is never committed; `dist/` is already ignored). SSOT remains `resume.ts`.

### Phase 3 — `.github/workflows/deploy.yml`

Replace the single `withastro/action@v6` build step with explicit steps (the action bundles build+upload, so we must unbundle to insert the render). Preserve the behaviors the action gave us implicitly:

- `actions/checkout`
- `actions/setup-node` with explicit `node-version` (pin; align with local dev) and npm cache.
- `actions/configure-pages` (GitHub's custom Pages workflow includes it; don't drop it).
- `npm ci`
- `npm run build`
- `npx playwright install --with-deps chromium` (installs the Chromium matching the pinned Playwright version).
- `node scripts/render-resume-pdf.mjs` → writes `dist/resume.pdf`. **Render failure fails the job**, blocking deploy (production never serves a `/resume.pdf` 404).
- `actions/upload-pages-artifact` with `path: dist` — **verify the current major that pairs with `deploy-pages@v5`** at implementation time and align them.
- `deploy` job (`actions/deploy-pages@v5`) unchanged.

This diverges from the documented `withastro/action` convention — update `CLAUDE.md`'s Deployment section to describe the explicit pipeline.

### Phase 4 — `src/pages/resume.astro` button

- Replace `<button id="resume-print">…</button>` with `<a class="resume-print-btn" href="/resume.pdf" download="Tanel_Treuberg_Software_Engineer.pdf">` — same SVG, label, and `.resume-print-btn` styling.
- Delete the `window.print()` + title-swap inline script.
- Keep the entry expand/collapse script untouched.
- The print CSS already hides `.resume-toolbar`, so the button never appears in the rendered PDF (no recursion concern).

### Phase 5 — `public/robots.txt` (new)

- Add `public/robots.txt` with `Disallow: /resume.pdf` and `Disallow: /resume/` (best available lever on GitHub Pages, which can't set `X-Robots-Tag` on a static file). Consistent with the page's existing `noindex` intent. (Acknowledged: weaker than a true noindex header.)

## Determinism guarantees

- **Single render, static distribution:** one CI Chromium produces `/resume.pdf`; all visitors download identical bytes.
- **Pinned engine:** exact-pinned `playwright` ⇒ identical Chromium build in CI and locally ⇒ my local verification equals the shipped file.
- **Self-hosted, pinned fonts:** no CDN dependency, no cross-deploy drift, no per-machine font availability differences. Embedded (subsetted) into the PDF ⇒ identical in any PDF viewer; text selectable; links clickable.
- **CSS = page-geometry SSOT:** `@page` rule honored via `preferCSSPageSize`; no API/CSS conflict.

## Failure handling

- Any readiness/correctness assertion miss, font-load miss, page-count ≠ 1, or non-A4 MediaBox ⇒ script throws ⇒ CI job fails ⇒ deploy blocked. Never ship a wrong/oversized/broken PDF.
- Local `npm run dev` does not generate `/resume.pdf`; the dev button 404s unless `resume:pdf --copy-public` was run. Accepted, documented.

## Acceptance criteria

- [ ] `/resume/` renders identically after font self-hosting (whole-site visual check; no CDN font requests in network).
- [ ] `node scripts/render-resume-pdf.mjs` against a fresh `dist/` produces `dist/resume.pdf` that is exactly one A4 page with correct fonts, selectable text, working links.
- [ ] Reading the generated PDF confirms single-page fit (manual + automated gate agree).
- [ ] All readiness assertions fire correctly (verified by temporarily breaking one).
- [ ] CI deploy produces a live `/resume.pdf`; render failure blocks the deploy.
- [ ] `/resume.pdf` button downloads the file from the live site.
- [ ] `robots.txt` served at `/robots.txt` with the Disallow entries.
- [ ] `CLAUDE.md` Deployment section updated to the explicit pipeline.

## Rejected alternatives

- **Standalone Cloudflare Worker + on-demand headless render** (the `cv-to-pdf-handover.md` plan): runtime generation, a second domain, external render service (Browserless/Gotenberg), secrets, CORS, 502 handling, and a `?print=true`/`CVPrint`/`cv.json` split. Rejected: content is a committed file (every change rebuilds anyway), so runtime generation buys nothing; build-time render is more deterministic (frozen per-deploy), cheaper, and needs no second component or service.
- **Astro `astro:build:done` integration hook:** would pull Chromium into every local `npm run build`. Rejected per user preference (kept render explicit; local browser is opt-in via `resume:pdf`).
- **Author-time committed PDF:** manual, drift-prone, requires local browser to be the source. Rejected.

## Codex pre-implementation review — incorporated

Key findings folded into this design: (1) page-count alone is insufficient — added HTTP-200 + DOM + expected-text + font-`check()` + A4-MediaBox assertions; (2) font self-hosting is a real prerequisite (CDN premise was wrong); (3) `waitUntil: 'load'` not `networkidle`; (4) keep `configure-pages` and align `upload-pages-artifact` major to `deploy-pages@v5`; (5) script is build-agnostic (no double build); (6) fill-ratio is a non-gating hint; (7) `public/resume.pdf` is stale-by-design and opt-in; (8) `/resume.pdf` crawlability addressed via `robots.txt`; (9) prefer a small static server (`sirv`) over experimental `preview()`.
