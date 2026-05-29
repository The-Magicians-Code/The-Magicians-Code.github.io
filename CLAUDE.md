# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Astro dev server at `http://localhost:4321/`
- `npm run build` — Production build into `dist/`
- `npm run check` — TypeScript + Astro diagnostics (`astro check`); the project's only static-analysis gate
- `npm run preview` — Preview the production build locally

There is no automated test suite. Verification on changes is `npm run check` + `npm run build` + manual browser checks. Do not claim "tests pass" — say so explicitly when verification is build-only.

## Debugging engine-specific visual bugs

When a visual or animation bug reproduces on one engine only (e.g. Safari/iOS but not Chromium), capture visual evidence **before** the first speculative fix — ask the user for a screen recording and inspect it frame-by-frame (ffmpeg montage / high-fps extraction). Code-reading cannot distinguish "size leads position" from "position leads size"; frames can. And never let a fix for one symptom silently change unrelated behavior (scroll position, focus state) — if it must, call it out.

Precedent: the bento card morph-jump ("expands right, then jumps to center", Safari/iOS only) was misdiagnosed three times — scroll-lock, `position:fixed` body lock, then removing the morph delay — before frame extraction from a user screen recording revealed the real cause was the card's `aspect-ratio` desyncing WebKit's `width`/`height` interpolation from `top`/`left`. Two of those wrong fixes also broke scroll position. See `memory/project_cover_parallax.md` for the full gotcha.

## Deployment

- GitHub Actions workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs on push to `main` and uses `withastro/action@v6` + `actions/deploy-pages@v5`.
- Custom domain `themagicianscode.dev` is bound via repo Settings → Pages — read directly by `actions/deploy-pages`. There is intentionally no `public/CNAME`; do not re-add one.
- Workflow convention from recent history: feature branch → PR → `chatgpt-codex-connector` bot auto-reviews on PR open → merge with a merge commit + branch delete. Match that pattern; don't push directly to `main`.

## Liquid Glass Nav Module

The nav pill's refraction effect is the most non-obvious system in the repo. It's a custom CSS+SVG+Canvas pipeline (Snell's-law refraction + specular highlight) that runs on Chromium and gracefully falls back on Safari/Firefox.

**Three layers, one signal:**

| Layer | File | Role |
|------|------|------|
| Pre-paint UA sniff | [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro) (`<script is:inline>`) | Sets `html.lg-no-svg-backdrop` on Safari/Firefox before any styled HTML paints |
| Runtime | [src/scripts/liquid-glass.ts](src/scripts/liquid-glass.ts) | Discovers `.liquid-glass` elements on `DOMContentLoaded`, builds per-instance SVG `<filter>` chains, rasterizes displacement + specular PNGs via Canvas, sets `backdrop-filter` inline. Skips entirely if the html class is present. |
| Stylesheet | [src/styles/liquid-glass.css](src/styles/liquid-glass.css) + the `html.lg-no-svg-backdrop` block in [src/styles/global.css](src/styles/global.css) | Default `:root` token values, `.glass`-equivalent fallback rule, and the Safari/Firefox swap to mobile-icon-style frosted glass |

**Public API for new consumers:**

- Add `class="liquid-glass"` to any element. Eight CSS custom properties tune the effect: `--lg-thickness`, `--lg-bezel`, `--lg-ior`, `--lg-uniform-shift`, `--lg-blur`, `--lg-saturate`, `--lg-svg-saturate`, `--lg-spec-alpha`. They cascade via `getComputedStyle`, so set on a parent and descendants inherit.
- `data-lg-mobile` opts an element into the effect below the 641px breakpoint (default is desktop-only).
- `data-lg-tuner` mounts a dynamically-imported dev panel ([src/scripts/liquid-glass-tuner.ts](src/scripts/liquid-glass-tuner.ts)) targeting that element. **Do not put `data-lg-tuner` on `#nav-pill`** — the nav has its own tuner in `Nav.astro` that competes for the same vars. One module tuner per page; subsequent ones are warned and ignored.
- Imperative: `window.__lg.refresh(el)` re-rasterizes after CSS-var changes. The runtime publishes this synchronously at script-eval time; consumers can guard with `window.__lg?.refresh?.(el)`.

**Why CSS @supports isn't enough:** Safari's parser accepts `url()` in `backdrop-filter` syntactically but doesn't render SVG filters that way. `@supports not ((backdrop-filter: url(#x)) or ...)` returns false on Safari → the rule never fires. The UA sniff in BaseLayout is the reliable signal; both the CSS fallback and the runtime gate read it.

**Design context:** [docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md](docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md) captures the architectural decisions, the codex-rescue review findings that shaped the spec (the original `var(--lg-filter, none)` chain was invalid CSS that would have dropped the whole declaration), explicit non-goals (no dynamic-mount support, no per-element filter cleanup on DOM removal), and acceptance criteria. Read this before refactoring the module.

**Nav-specific tuner:** [src/components/Nav.astro](src/components/Nav.astro) renders a sliders panel inside `{isDev && (...)}` (only in `import.meta.env.DEV`). It writes the eight module CSS vars to `#nav-pill`'s inline style and calls `window.__lg.refresh(pill)`, plus mutates two nav-only knobs (`glassBg`, `progBlur`) that the module itself doesn't know about.

## Content Collections

[src/content.config.ts](src/content.config.ts) defines two collections:

- `projects` — Markdown under [src/content/projects/](src/content/projects/) with `title`, `description`, `repoUrl`, `order` (int, used for sort), and `draft` (bool, filtered out). Rendered by [src/pages/projects/[slug].astro](src/pages/projects/%5Bslug%5D.astro) for detail pages and listed on the homepage via [src/components/ProjectsSection.astro](src/components/ProjectsSection.astro).
- `blog` — Markdown under [src/content/blog/](src/content/blog/) with `title`, `description`, `pubDate`, `draft`. No public route currently consumes this collection; it is wired but unused on the rendered site.

## Project Process Conventions

The `docs/superpowers/` folder retains the design specs and implementation plans for substantive features (the Astro migration and liquid-glass module). They are not built into `dist/` and do not affect the deployed site, but they are the "why" trail behind recent merges. Keep them current when revising the systems they describe — a stale spec is worse than no spec.

The user's global CLAUDE.md establishes a pre-implementation Codex review convention for any work introducing new logic or new integrations: hand the plan to `codex:codex-rescue` before touching code, apply feedback you agree with, then implement. Skip only for one-line config flips, comment-only fixes, typo fixes, doc updates, or pinpointed mechanical bugfixes.
