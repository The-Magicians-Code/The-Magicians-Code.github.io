# Resume PDF — ATS-Minimal Rework (pdf-lib) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the Chromium-rendered resume PDF with a bare-minimum, machine-readable (ATS) PDF generated directly from `src/data/resume.ts` using `pdf-lib` and the non-embedded base-14 **Helvetica** family. Black & white, copyable text, clickable links, special characters normalized to ASCII.

**Why the pivot:** `page.pdf()` always embeds font subsets (Type-3/image bloat, ~273 KB) and risks ATS reading-order scrambling. Direct generation with base-14 fonts yields ~5–15 KB, clean linear text order, and zero embedded fonts.

**Tech Stack:** pdf-lib (kept), tsx (new, runs the TS generator), poppler-utils (CI verification: `pdftotext`/`pdfinfo`). **Removed:** playwright, sirv, headless Chromium.

**Branch:** `feat/resume-pdf-ats` (off `main`, which carries the now-superseded Chromium pipeline; never pushed).

**Verification model:** No unit-test runner. Gates: `npm run check`, the generator's own assertions, a poppler-based extraction/order gate, and a visual `Read` of the produced PDF.

---

## Decisions (locked)
- Font: **Helvetica / Helvetica-Bold / Helvetica-Oblique** (StandardFonts, non-embedded).
- Special chars: **normalize to ASCII** (`10⁻³`→`10^-3`, `×`→`x`, curly quotes→straight; en/em dash + middle dot are WinAnsi-OK but ASCII policy may still simplify them).
- Pages: **natural multi-page flow** (ATS-safe); one page is a soft target with a logged page count, not a hard gate.
- Self-hosted website fonts (Fraunces/Geist/Geist Mono) **stay** — they serve the live site; only the PDF stops using them.
- `@media print` block in `resume.astro` **stays** (browser Ctrl+P fallback). Button stays `<a href="/resume.pdf" download>`. `robots.txt` stays.

## Codex-hardened requirements (acceptance criteria)
1. **Two-pass text handling.** Pass 1 = ASCII normalization (product policy, explicit map). Pass 2 = safety gate: run every drawn string through `helvetica.encodeText(s)` inside try/catch; on ANY failure, **throw** with the field path + offending code point + char (never ship "?"). Bold/oblique variants validated against their own font objects.
2. **Correct link annotations.** Build `/Link` annotations with `/A << /S /URI /URI (…) >>` where the URI is a proper **PDF string** (hex-encoded ASCII), URLs **percent-encoded**, parens/backslashes escaped. Names only for `/Type`,`/Subtype`,`/S`. Rser rects in bottom-left coords from measured baseline/ascent/descent. One rect per wrapped line fragment of a link.
3. **Visible URL text in the stream.** Draw the contact/repo URLs as real selectable text (annotations are overlays only — ATS reads the text stream).
4. **Reading order = draw order.** Draw strictly: name → title → location → contact → summary → experience (each: role, company·location, dates, bullets) → education → skills → interests. Extraction order must match.
5. **Safe wrapping.** Word-wrap via `font.widthOfTextAtSize`. For a single token wider than the content width (URLs, `x86_64`), **force-split** with a guaranteed-progress guard (no infinite loop).
6. **Page-break safety.** Break only at safe boundaries; keep a section header / role header with at least its first following line (no orphaned header at page bottom) unless a single item exceeds a full page.
7. **Determinism.** `PDFDocument.create()` then set ALL metadata explicitly: Title, Author, Creator, Producer, and CreationDate/ModDate = a **fixed UTC instant** derived from `resume.meta.updatedAt` (month-level → first day, `00:00:00Z`; do not parse via locale-sensitive `new Date(string)` — construct from explicit year/month). No `Date.now()`/`Math.random()`. Deterministic object-creation order. Goal: stable semantic output first (extracted text + page count + metadata), byte-identical as a bonus.
8. **Generate after build.** In CI: checkout → setup-node → configure-pages → `npm ci` → `npm run build` → generate (writes `dist/resume.pdf`) → poppler verify → upload. Astro owns `dist/`, so generate AFTER build.

---

## File structure

| File | Responsibility | Action |
|---|---|---|
| `scripts/resume-pdf/sanitize.ts` | ASCII-normalization map + WinAnsi/encodeText safety assertion | Create |
| `scripts/resume-pdf/generate.ts` | pdf-lib layout: fonts, sections, wrapping, links, determinism; writes `dist/resume.pdf` | Create |
| `scripts/verify-resume-pdf.mjs` | poppler gate: `pdfinfo` (A4, page count) + `pdftotext` (expected text present + in order) | Create |
| `scripts/render-resume-pdf.mjs` | Old Chromium renderer | **Delete** |
| `package.json` | Remove playwright+sirv; add tsx (exact); `resume:pdf` runs tsx generator; keep pdf-lib | Modify |
| `.github/workflows/deploy.yml` | Drop chromium install; `npm i`→build→generate→poppler verify→upload | Modify |
| `CLAUDE.md` | Document the pdf-lib pipeline | Modify |
| `src/styles/fonts.css`, `public/fonts/*`, `src/pages/resume.astro` button, `public/robots.txt` | Unchanged (kept) | — |

---

## Task 1: Branch + plan (this doc)
- [ ] Commit this plan on `feat/resume-pdf-ats`.

## Task 2: Text sanitizer (`scripts/resume-pdf/sanitize.ts`)
**Files:** Create `scripts/resume-pdf/sanitize.ts`

- [ ] **Step 1:** Implement and export:
  - `normalizeToAscii(input: string): string` — explicit replacement map covering at minimum: superscripts `⁰¹²³⁴⁵⁶⁷⁸⁹⁻` → `^0..^9`/`^-` (collapse a run like `⁻³` → `^-3`), `×`→`x`, `·`→`-` or ` - ` (pick one, document), `–`/`—`→`-`, `’‘`→`'`, `“”`→`"`, `…`→`...`, non-breaking space→space. Anything else outside printable ASCII (0x20–0x7E) → throw (see assertText) rather than silently dropping.
  - `assertEncodable(text: string, font, fieldPath: string): void` — calls `font.encodeText(text)` in try/catch; on throw, re-throw `Error("Un-encodable char in <fieldPath>: U+XXXX '<char>'")`.
- [ ] **Step 2:** Self-check with a tiny inline run (node/tsx) feeding the actual `10⁻³`, `×`, `·` strings; confirm ASCII out and no throw for real resume content.
- [ ] **Step 3:** Commit.

## Task 3: pdf-lib generator (`scripts/resume-pdf/generate.ts`)
**Files:** Create `scripts/resume-pdf/generate.ts`; needs `tsx` (Task 4 installs it — order Task 4 Step 1 before running this).

- [ ] **Step 1:** Implement: import `resume` from `../../src/data/resume`. A4 page (595.28×841.89pt), ~50pt margins. Embed StandardFonts Helvetica/Bold/Oblique. Helper `drawWrapped(text, {font,size,x,maxWidth})` returning lines drawn + advancing a mutable `y`; force-splits over-long tokens; when `y` drops below the bottom margin, add a new page and reset `y` (with the page-break-safety rule for headers). Run every string through `normalizeToAscii` then `assertEncodable` before drawing. Sections in the exact draw order from acceptance criterion 4. Contact + repo URLs drawn as visible text AND given `/Link` annotations (criterion 2). Set deterministic metadata (criterion 7). Write `dist/resume.pdf` (mkdir `dist` if absent). Support `--copy-public` → also write `public/resume.pdf`. Log final page count. Throw (non-zero exit) on any assertion failure with single-cleanup semantics.
- [ ] **Step 2:** Run `npm run resume:pdf`; confirm it writes `dist/resume.pdf`, exit 0, logs page count.
- [ ] **Step 3:** Inspect with `pdffonts dist/resume.pdf` → confirm **no embedded fonts** (Helvetica shows `emb=no`). `pdfinfo` → A4 size. Commit.

## Task 4: Dependencies, scripts, delete old renderer
**Files:** Modify `package.json`; delete `scripts/render-resume-pdf.mjs`

- [ ] **Step 1:** `npm uninstall playwright sirv` ; `npm install --save-dev --save-exact tsx`. Keep `pdf-lib`. (`@fontsource-variable/*` devDeps stay.)
- [ ] **Step 2:** Set `"resume:pdf": "tsx scripts/resume-pdf/generate.ts"` (no `astro build` prefix — generator reads `resume.ts` directly and writes `dist/`; it `mkdir`s `dist`). Add `"resume:pdf:verify": "node scripts/verify-resume-pdf.mjs"`.
- [ ] **Step 3:** `git rm scripts/render-resume-pdf.mjs`.
- [ ] **Step 4:** `npm run check`; commit.

## Task 5: Poppler verification gate (`scripts/verify-resume-pdf.mjs`)
**Files:** Create `scripts/verify-resume-pdf.mjs`

- [ ] **Step 1:** Implement: shell `pdfinfo dist/resume.pdf` → assert page size ≈ A4 and page count ≥ 1; shell `pdftotext -layout dist/resume.pdf -` → assert expected substrings present (`Tanel`, `Experience`, `Skills`, the GitHub/LinkedIn URLs) AND in order (index('Tanel') < index('Experience') < index('Skills')). Exit non-zero with a clear message on any miss. (Uses poppler; CI installs `poppler-utils`.)
- [ ] **Step 2:** Run `npm run resume:pdf && npm run resume:pdf:verify`; confirm pass. Commit.

## Task 6: deploy.yml
**Files:** Modify `.github/workflows/deploy.yml`

- [ ] **Step 1:** In the `build` job, REMOVE the `npx playwright install --with-deps chromium` step. Replace the render step with: install poppler (`- run: sudo apt-get update && sudo apt-get install -y poppler-utils`), then `- run: npm run resume:pdf`, then `- run: npm run resume:pdf:verify`, BEFORE `upload-pages-artifact`. Keep order: checkout → setup-node → configure-pages → npm ci → npm run build → (poppler install) → resume:pdf → resume:pdf:verify → upload. `deploy` job unchanged.
- [ ] **Step 2:** `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML OK')"`. Commit.

## Task 7: Docs
**Files:** Modify `CLAUDE.md`

- [ ] **Step 1:** Update the Deployment → Resume PDF section: PDF is now generated by `pdf-lib` from `resume.ts` (no Chromium/playwright/sirv), non-embedded Helvetica, B&W, ASCII-normalized, links + selectable text, verified via poppler in CI. Update the `npm run resume:pdf` command note (no longer needs a browser). Note self-hosted fonts remain for the website only.
- [ ] **Step 2:** `grep -n "playwright\|chromium\|window.print" CLAUDE.md` — ensure no stale claims. Commit.

## Final verification
- [ ] `npm run check` passes.
- [ ] `npm run resume:pdf` exits 0; `pdffonts dist/resume.pdf` shows **no embedded fonts**; `pdfinfo` shows A4; file is small (≈5–20 KB).
- [ ] `npm run resume:pdf:verify` passes (text present + in order).
- [ ] `Read dist/resume.pdf` — visually B&W, clean, links present, nothing clipped.
- [ ] `pdftotext` output is clean, ordered, ASCII (no tofu/`?`).
- [ ] No `playwright`/`sirv` left in package.json; `scripts/render-resume-pdf.mjs` deleted.
