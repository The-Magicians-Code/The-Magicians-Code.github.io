# Astro Migration — Design Spec

**Date**: 2026-05-07
**Author**: Tanel + Claude (brainstormed)
**Status**: Awaiting user approval

## Goal

Migrate `the-magicians-code.github.io` from a single hand-rolled `index.html` to an Astro 6 + Tailwind v4 project with content collections and proper build tooling, preserving the current visual language while fixing fragile bits and laying groundwork for future blog posts and project case studies.

## Why now

- CDN Tailwind has runtime cost and is officially not for production
- Adding any new content (blog post, project case study) currently requires editing an 875-line HTML file
- Performance: build-time CSS, self-hosted fonts, compiled-in icons reduce payload and improve CWV
- Modularity: components let future changes touch one section without scrolling through everything
- Foundation for future content: collection schemas + types make new entries trivial

## Non-goals

- Visual redesign — current look (glass nav, rainbow name gradient, rainbow top-glow, fade-in choreography, dark mode) preserved
- Blog routes / blog index page — collection schema only; routes deferred until first post exists
- CMS, search, analytics, comments, i18n, view transitions

## Scope locked (decisions already made with user)

| Decision | Choice |
|---|---|
| Framework | Astro 6 (latest as of 2026-05; was 5 at brainstorm time) |
| Styling | Tailwind v4 via `@tailwindcss/vite` (NOT deprecated `@astrojs/tailwind`) |
| Content collections | `projects/` (active), `blog/` (schema only, no entries yet) |
| Routes | `/`, `/projects/`, `/projects/[slug]` — `/blog/*` deferred |
| Visual fidelity | Parity-with-judgment: same look, fix fragile bits during the move |
| Custom domain | `themagicianscode.dev` (apex; canonical) |
| Deploy target | GitHub Pages on the user/org repo (`The-Magicians-Code.github.io`) |
| CI/CD | GitHub Actions (`withastro/action@v6` → `actions/deploy-pages@v5`) |
| DNS / edge | Cloudflare DNS-only (gray cloud) initially. CNAME at apex → `the-magicians-code.github.io`; GH terminates TLS via auto-issued Let's Encrypt cert. CF proxy can be enabled later for edge caching (requires SSL/TLS mode = Full). |
| Sibling project Pages | Setting a custom domain on the user/org repo auto-routes all owned project Pages (`qr-code`, `play`, future ones) under the same domain — i.e., `themagicianscode.dev/qr-code/`, `themagicianscode.dev/play/`. This is exactly the desired behavior, not a footgun. |
| Old URL redirect | Automatic. GH Pages 301s every `the-magicians-code.github.io/*` path to the corresponding `themagicianscode.dev/*` path once the user-site custom domain is set. No stub workflow needed. |
| Output target | Static (`output: 'static'`, the default) |

## Architecture

### File structure

```
.
├── .github/workflows/deploy.yml        (build + deploy to GH Pages)
├── .gitignore                          (extended)
├── astro.config.mjs
├── package.json
├── package-lock.json                   (committed; required by withastro/action for PM detection)
├── tsconfig.json
├── public/
│   ├── CNAME                           (one line: themagicianscode.dev — tells GH Pages the custom domain)
│   ├── favicon.ico
│   ├── icon.svg
│   └── apple-touch-icon.png
├── src/
│   ├── content.config.ts               (Astro 5+ API; NOT src/content/config.ts)
│   ├── content/
│   │   └── projects/
│   │       ├── yolo-dualdev.md
│   │       └── strato-pi.md
│   ├── styles/global.css
│   ├── layouts/BaseLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   └── projects/
│   │       ├── index.astro
│   │       └── [slug].astro
│   └── components/
│       ├── Nav.astro
│       ├── ThemeToggle.astro
│       ├── MobileMenu.astro
│       ├── Hero.astro
│       ├── ProjectsSection.astro       (home page; reads projects collection)
│       ├── ProjectCard.astro
│       ├── SkillsTools.astro
│       ├── SkillIcon.astro             (single component dispatching on `name` prop)
│       ├── Contact.astro
│       └── SiteFooter.astro
└── docs/superpowers/specs/             (this file)
```

### Layouts

- `BaseLayout.astro` — `<head>` (meta, OG, Twitter, JSON-LD, favicons, canonical), inline theme-FOUC script, `<body>` shell, mounts `Nav`, slot for page content, mounts `SiteFooter`. Accepts props:
  - `title: string`
  - `description: string`
  - `canonical: string` (route-specific URL)
  - `ogTitle?: string`, `ogDescription?: string`, `ogType?: string` (defaults from title/description)
  - `includePersonSchema?: boolean` (default `true` on home only)

### Pages

- `index.astro` — composes `Hero`, `ProjectsSection` (home grid view), `SkillsTools`, `Contact`. JSON-LD Person on home only. Canonical: `https://themagicianscode.dev/`.
- `projects/index.astro` — full projects listing. Title: "Projects · Tanel Treuberg". Canonical: `https://themagicianscode.dev/projects/`.
- `projects/[slug].astro` — dynamic detail. Uses `getStaticPaths()` over the projects collection. Renders the project body (Markdown) into the page. Canonical: `https://themagicianscode.dev/projects/<slug>/`.

Canonical URLs in `BaseLayout` should derive from `Astro.site` (set in `astro.config.mjs`) plus the route path, not be hardcoded — so a future domain change is one config edit.

### Components

| Component | Purpose |
|---|---|
| `Nav` | Glass nav pill: brand, desktop links, theme toggle, hamburger trigger. Links use root-absolute hashes (`/#projects`) so they work cross-route. |
| `MobileMenu` | Hamburger panel with same nav links. Opens/closes via small inline `<script>`. |
| `ThemeToggle` | Sun/moon button. Click handler in component-scoped `<script>`. |
| `Hero` | Name (rainbow gradient) + tagline. |
| `ProjectsSection` | Home page projects view. Reads from `getCollection('projects')`, sorts by `order`, renders `ProjectCard` per entry, plus the "see all on GitHub" footer card. |
| `ProjectCard` | Single project tile. Props: `title`, `description`, `repoUrl`, `slug`. Title links to `/projects/<slug>/`; repo link to GitHub. |
| `SkillsTools` | Skills + Tools two-column grid. Renders `SkillIcon` items. |
| `SkillIcon` | Wraps the hand-tuned inline SVG for a given skill (`python`, `docker`, `bash`, `swift`, `vscode`, `git`). One component, dispatches on prop. |
| `Contact` | LinkedIn + GitHub external links. |
| `SiteFooter` | Copyright. Year via SSR `{new Date().getFullYear()}`. |

### Content collections (`src/content.config.ts`)

```ts
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';   // Astro 6: z is no longer re-exported from astro:content
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    repoUrl: z.string().url(),
    order: z.number(),
    draft: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, blog };
```

Seed entries replace the hard-coded cards in current `index.html`:

- `src/content/projects/yolo-dualdev.md` — title "Yolo-dualdev", description "Develop and deploy TensorRT-optimised YOLOv5 models on Nvidia Jetson", repoUrl, order 1
- `src/content/projects/strato-pi.md` — title "Strato_Pi", description "Motor load machine controller with online interface", repoUrl, order 2

Detail pages can have empty bodies initially; flesh out incrementally.

### Styling

**Tailwind v4** (Vite plugin path):

- `astro.config.mjs`:
  ```js
  import { defineConfig } from 'astro/config';
  import tailwindcss from '@tailwindcss/vite';
  import icon from 'astro-icon';

  export default defineConfig({
    site: 'https://themagicianscode.dev',
    integrations: [icon()],
    vite: { plugins: [tailwindcss()] },
  });
  ```

- `src/styles/global.css` (top of file):
  ```css
  @import "tailwindcss";

  /* Class-based dark mode (Tailwind v4 syntax) */
  @custom-variant dark (&:where(.dark, .dark *));

  /* Map font-sans utility to Inter */
  @theme {
    --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
      "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
      "Segoe UI Symbol", "Noto Color Emoji";
  }

  /* Liquid-glass tokens, name-gradient keyframes, rainbow body::before glow,
     fade-in keyframes, nav layout — port verbatim from current index.html */
  ```

- `BaseLayout.astro` imports `../styles/global.css` once.

**Inter font**: `@fontsource/inter` self-hosted, weights 400/500/600/700 imported from BaseLayout. Drops the Google Fonts CDN preconnect.

### Icons

- **`astro-icon` + `@iconify-json/lucide`** for: home, folder-git-2, terminal-square, mail, github, linkedin, sun, moon, arrow-up-right.
- **Custom inline SVGs** stay as the body of `SkillIcon.astro` — these are hand-tuned Catppuccin-style icons (Python, Docker, BASH, Swift, VS Code, Git), not Lucide icons. `astro-icon` does not replace them.

### JavaScript

No frameworks, no islands. Three small `<script>` blocks:

1. **Theme FOUC** — inline in `<head>` of `BaseLayout` with `is:inline` directive. Reads `localStorage.getItem('theme-preference')` + `prefers-color-scheme`, applies `.dark` class to `<html>` before paint. No imports inside (per `is:inline` constraints).
2. **Theme toggle click** — in `ThemeToggle.astro`. Toggles class, persists preference.
3. **Mobile menu** — in `MobileMenu.astro`. Open/close, ARIA, link-click auto-close.

Year in footer: `{new Date().getFullYear()}` (SSR), drops `document.write`.

### Routing & nav fix

- Brand pill: `href="/"` (was `href="#"`).
- Section anchors used by nav links: must be **root-absolute** (`/#projects`, `/#skills-tools`, `/#contact`) since `Nav` renders on `/projects/` too. Bare `#projects` would point at the wrong page.
- Section fade-in delays: replace fragile `:nth-of-type(N)` selectors with `style="--delay:0.2s"` on each section element + a single `.section-fade-in { animation-delay: var(--delay); }` rule. Order independence.

### Per-route metadata

`BaseLayout` wires:

- `<title>{title}</title>`
- `<meta name="description" content={description}>`
- `<link rel="canonical" href={canonical}>`
- OG: `og:title`, `og:description`, `og:type`, `og:url={canonical}`, `og:site_name`, `og:locale`
- Twitter: card, title, description
- Favicons + apple-touch-icon
- JSON-LD Person schema iff `includePersonSchema` (only home)

### Deploy

**Target: GitHub Pages on the user/org repo (`The-Magicians-Code.github.io`)**, with the custom domain `themagicianscode.dev` set via `public/CNAME`. Cloudflare handles DNS only; GitHub serves and terminates TLS.

**Why GH Pages over Cloudflare Workers Static Assets** (the path we considered first):

The decisive factor is the existing sibling project Pages (`qr-code`, `play`, future). When a user/org Pages site has a custom domain set, GH automatically:

1. Serves that domain at the user/org site root (the portfolio).
2. **Routes all sibling project Pages under the same domain** — `themagicianscode.dev/qr-code/`, `themagicianscode.dev/play/`, etc., with zero per-project configuration.
3. **301-redirects every `<user>.github.io/*` path to the corresponding `<custom-domain>/*` path.** Subpaths preserved, no meta-refresh fallback needed.

CF Workers Static Assets gets none of those for free — each project would need its own subdomain or a Worker proxy. GH Pages solves the multi-site case directly. Cloudflare still earns its keep as the registrar/DNS provider, and the proxy can be flipped on later for edge caching.

**`public/CNAME`** (single line, no trailing newline issues):

```
themagicianscode.dev
```

Astro copies `public/*` to `dist/`; GH Pages reads `dist/CNAME` and treats it as the custom-domain declaration.

**`.github/workflows/deploy.yml`**:

```yaml
name: Deploy site to GitHub Pages

on:
  push:
    branches: [master]   # NOT main — repo's serving branch is master
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: withastro/action@v6
        # withastro/action infers PM from the committed lockfile,
        # runs npm ci + astro build, and uploads dist/ as the Pages artifact
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

**Cloudflare DNS** (one-time, done in CF dashboard):

| Type | Name | Target | Proxy status |
|---|---|---|---|
| CNAME | `themagicianscode.dev` (apex) | `the-magicians-code.github.io` | **DNS only** (gray cloud) |

Cloudflare flattens the apex CNAME automatically. Keep the orange cloud OFF until/unless you want CF as a CDN in front of GH (in which case set SSL/TLS mode to **Full** to avoid redirect loops with GH Pages' enforced HTTPS — never **Flexible**).

`www.themagicianscode.dev` not configured. If desired later, add a 301 via CF Redirect Rule → apex.

**Repo settings (one-time, via dashboard)**:
1. Settings → Pages → Source: **GitHub Actions** (was likely "Deploy from branch")
2. Settings → Pages → Custom domain: `themagicianscode.dev` (sets the value GH uses for cert provisioning; will sync with `public/CNAME` once the workflow first deploys)
3. Settings → Pages → **Enforce HTTPS**: on (after cert is issued; takes a few minutes after DNS first resolves)

### `.gitignore`

Append:

```
node_modules/
dist/
.astro/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
```

(Existing `**/.DS_Store` and `.env` retained.)

## Migration steps (high level)

1. Scaffold: `npm create astro@latest .` (current dir, minimal template, TypeScript strict)
2. Add deps: `tailwindcss @tailwindcss/vite astro-icon @iconify-json/lucide @fontsource/inter`
3. Configure `astro.config.mjs` (site, integrations, vite plugins)
4. Write `src/styles/global.css` (Tailwind import, `@custom-variant dark`, `@theme` font, ported custom CSS)
5. Define `src/content.config.ts`
6. Seed `src/content/projects/{yolo-dualdev,strato-pi}.md`
7. Build `BaseLayout.astro` with FOUC script (`is:inline`)
8. Build component tree
9. Build pages: `index.astro`, `projects/index.astro`, `projects/[slug].astro`
10. Move static assets to `public/` (favicon.ico, icon.svg, apple-touch-icon.png) — and add `public/CNAME` with `themagicianscode.dev`
11. Local verify: `npm run dev` smoke test, `npm run build` zero-warning build (confirm `dist/CNAME` exists), `npm run preview` spot-check
12. Add `.github/workflows/deploy.yml`
13. Extend `.gitignore`
14. Commit `package-lock.json`
15. Delete the old root `index.html`, `favicon.ico`, `icon.svg`, `apple-touch-icon.png` (their canonical copies now live under `public/` → `dist/`)
16. Cloudflare dashboard → DNS → add CNAME `themagicianscode.dev` → `the-magicians-code.github.io`, **proxy off (gray cloud)**
17. Repo Settings → Pages: flip Source from "Deploy from branch" to **GitHub Actions**, set Custom domain to `themagicianscode.dev`
18. Push to `master` — the workflow runs, builds, and publishes; `dist/CNAME` lands at the user-site root
19. Wait for GH Pages cert issuance (typically a few minutes after DNS resolves), then enable **Enforce HTTPS** in Pages settings
20. Verify production:
    - `https://themagicianscode.dev/` → portfolio
    - `https://themagicianscode.dev/projects/` and `/projects/yolo-dualdev/` and `/projects/strato-pi/` → reachable
    - `https://themagicianscode.dev/qr-code/` and `/play/` → sibling project Pages render correctly
    - `https://the-magicians-code.github.io/` and `/qr-code/` and `/play/` → 301 to corresponding paths under the new domain
    - Dark mode, theme persistence, mobile menu all work
    - Canonicals on each route point at the new domain

## Risks / gotchas

- **GH Pages source flip**: switching from "Deploy from branch" to "GitHub Actions" briefly takes the user-site URL offline between the flip and the first successful Actions deploy. **Sibling project Pages sites (`/qr-code/`, `/play/`) are unaffected** by this flip — each has its own Pages settings. Mitigation: have the deploy workflow + `public/CNAME` ready in the branch before flipping; push immediately after.
- **GH cert provisioning timing**: GH issues the Let's Encrypt cert for the custom domain only after DNS resolves correctly. Typically a few minutes after the CF CNAME goes live. Until issued, Enforce HTTPS will be greyed out and the site will work on HTTP only. Wait for the dashboard to confirm cert is active before enforcing HTTPS.
- **`.dev` TLD HSTS-preload**: every modern browser refuses HTTP for `.dev`. The window between cert issuance and Enforce-HTTPS being toggled on is the only fragile period — during it, browsers will get an HTTPS-only error if hitting the bare domain. Acceptable since it's a minutes-long, one-time window.
- **Cloudflare proxy mode**: keep proxy OFF (gray cloud) for now. If turned on later for CF edge caching, set SSL/TLS to **Full** (not Flexible — Flexible loops with GH's HTTPS-required setting; not Strict only because GH's cert subject may not match what CF Strict expects). Don't flip it on the same day as the migration; layer it on after baseline is verified.
- **Apex CNAME**: traditional DNS forbids apex CNAMEs, but Cloudflare flattens them transparently. Don't try to "fix" this with A records — the CF flattening is the correct setup.
- **Sibling project Pages auto-routing**: the moment the user-site custom domain is set, *all* of your existing project Pages sites (`qr-code`, `play`, plus any others) start serving at `themagicianscode.dev/<project>/`. This is the desired outcome, but worth knowing — there is no "opt-out" per project unless that project sets its own custom domain. Future-proofing: don't name a future project repo something that collides with an Astro route (`projects`, `blog`, etc.) on the user site.
- **Dark-mode FOUC**: inline script must run before any styled HTML paints. Test in Safari + Firefox + Chrome.
- **Cross-route hash anchors**: must be root-absolute. Easy to forget.
- **Font fallback flash**: with `@fontsource/inter`, ensure `font-display: swap` (Fontsource default) so text isn't invisible during font load.
- **Old `index.html` at repo root**: must be deleted from the repo as part of this migration. Astro builds from `src/`; leftover root-level static files will confuse contributors and clutter `git status` permanently.
- **`public/CNAME` is required, not forbidden** (this changed mid-design as we pivoted from CF Workers back to GH Pages — the prior version of this spec said the opposite). The single line `themagicianscode.dev` in `public/CNAME` is what makes everything work.

## Testing checklist

- `npm run build` — zero warnings, zero errors
- `npm run dev` — home + `/projects/` + `/projects/yolo-dualdev/` + `/projects/strato-pi/` all render
- Theme toggle persists across reload, no FOUC
- Mobile menu opens/closes, links navigate and close menu
- Hash links from nav work from `/projects/` (jumps to home + scrolls to anchor)
- Canonical URLs correct on each route, all using `https://themagicianscode.dev` host
- JSON-LD only on home, not on `/projects/*`
- `https://themagicianscode.dev/` resolves and serves the Astro build (HTTPS, valid cert)
- `https://themagicianscode.dev/qr-code/` and `/play/` resolve and serve their respective interactive sites (auto-routed sibling project Pages)
- `https://the-magicians-code.github.io/` returns a 301 to `https://themagicianscode.dev/` (verify with `curl -sI`)
- `https://the-magicians-code.github.io/qr-code/` returns a 301 to `https://themagicianscode.dev/qr-code/` (subpaths preserved)
- `https://the-magicians-code.github.io/play/` returns a 301 to `https://themagicianscode.dev/play/`
- Lighthouse: ≥95 on perf / SEO / best-practices / accessibility (matches or beats current)

## Out of scope

- Blog routes, blog index, blog posts, RSS
- Image optimization beyond Astro defaults
- Search, analytics, comments
- View transitions API
- i18n
- Custom Catppuccin icon redesign
