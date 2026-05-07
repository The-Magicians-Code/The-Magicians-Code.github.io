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
| Deploy target | Cloudflare Workers Static Assets (CF-recommended for new projects; Pages is in maintenance) |
| CI/CD | Cloudflare Workers Builds (push-to-deploy from repo) |
| Old URL handling | Keep GH Pages alive with a CNAME-only stub artifact so `the-magicians-code.github.io` issues a 301 to the new domain |
| Output target | Static (`output: 'static'`, the default) |

## Architecture

### File structure

```
.
├── .github/workflows/redirect-stub.yml (only — main deploy is via Workers Builds)
├── .gitignore                          (extended)
├── astro.config.mjs
├── wrangler.jsonc                      (Cloudflare Workers Static Assets config)
├── package.json
├── package-lock.json                   (committed; pin deps for reproducible Workers Builds)
├── tsconfig.json
├── public/
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

**Primary target: Cloudflare Workers Static Assets** (CF's recommended hosting for new static sites; Pages is in maintenance for new projects, per [Workers best practices docs](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)).

**Why Workers Static Assets over GH Pages or CF Pages**:
- Domain is already in your Cloudflare account → automatic DNS + cert; no SSL/TLS mode dance, no Let's Encrypt timing window, no `public/CNAME` for the live site
- Workers Builds = native CF push-to-deploy CI; no GitHub secrets to manage
- Workers is where CF is investing; Pages gets bug fixes only
- Edge-distributed, observability built in, free tier ample for a personal portfolio

**`wrangler.jsonc`**:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "themagicianscode",
  "compatibility_date": "2026-05-01",
  "assets": {
    "directory": "./dist"
  },
  "routes": [
    { "pattern": "themagicianscode.dev", "custom_domain": true }
  ]
}
```

No Worker script (no `main`) — purely static. The `routes` entry with `custom_domain: true` lets `wrangler deploy` create/maintain the custom domain attachment automatically; Cloudflare handles DNS + cert.

**CI: Cloudflare Workers Builds**

One-time setup (manual, dashboard):
1. Cloudflare dashboard → Workers & Pages → Create → Connect to Git → select this repo → branch `master`
2. Build command: `npm run build`
3. Deploy command: `npx wrangler deploy` (default; auto-detected from `wrangler.jsonc`)
4. Custom domain: confirmed via the `routes` entry on first deploy, OR set in Workers → portfolio → Settings → Domains & Routes

After this, every push to `master` builds and deploys automatically. No GitHub Actions, no secrets, no workflow YAML for the primary deploy.

**`.github/workflows/redirect-stub.yml`** (the *only* GH Actions workflow — exists solely to keep the old `the-magicians-code.github.io` URL alive with a 301):

```yaml
name: Publish 301 redirect stub to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Build CNAME-only stub
        run: |
          mkdir -p stub
          echo "themagicianscode.dev" > stub/CNAME
          cat > stub/index.html <<'EOF'
          <!doctype html>
          <html lang="en">
            <head>
              <meta charset="utf-8">
              <title>Moved to themagicianscode.dev</title>
              <meta http-equiv="refresh" content="0; url=https://themagicianscode.dev/">
              <link rel="canonical" href="https://themagicianscode.dev/">
            </head>
            <body>
              <p>This site has moved to <a href="https://themagicianscode.dev/">themagicianscode.dev</a>.</p>
            </body>
          </html>
          EOF
      - uses: actions/upload-pages-artifact@v3
        with:
          path: stub
      - id: deployment
        uses: actions/deploy-pages@v5
```

The `CNAME` file in the artifact triggers GitHub Pages' built-in 301 from `<user>.github.io` → custom domain (server-side, before any DNS lookup of the destination). The `index.html` is a meta-refresh fallback for path-specific links (`/projects/...`) that the apex 301 might not cover, and as a defense in depth.

**Repo settings (one-time)**: Settings → Pages → Source: **GitHub Actions**. Custom domain field in GH Pages settings: leave blank (the `CNAME` in the deployed artifact tells GH what to redirect to).

**Cloudflare DNS for `themagicianscode.dev`**: handled automatically when the Worker custom domain is attached. No manual A/CNAME records needed.

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
10. Move static assets to `public/`
11. Local verify: `npm run dev` smoke test, `npm run build` zero-warning build, `npm run preview` spot-check
12. Add `wrangler.jsonc`
13. Add `.github/workflows/redirect-stub.yml`
14. Extend `.gitignore`
15. Commit `package-lock.json`
16. Push to `master`
17. Cloudflare dashboard: Workers & Pages → Create → Connect to Git → select repo, branch `master`, build command `npm run build`, deploy `npx wrangler deploy`. Confirm first deploy succeeds; custom domain `themagicianscode.dev` attaches automatically via the `routes` entry in `wrangler.jsonc`
18. Repo Settings → Pages → Source: GitHub Actions (so the redirect-stub workflow can publish)
19. Verify production: `https://themagicianscode.dev/` renders; `https://the-magicians-code.github.io/` 301s to `themagicianscode.dev`; `/projects/yolo-dualdev/` and `/projects/strato-pi/` reachable; dark mode + theme persistence + mobile menu all work; canonicals correct on each route
20. Delete the old root `index.html`, `favicon.ico`, `icon.svg`, `apple-touch-icon.png` from the repo (their copies now live in `public/` and `dist/`)

## Risks / gotchas

- **GH Pages source flip**: switching from "Deploy from branch" to "GitHub Actions" causes a brief offline window for the *.github.io URL between the flip and first successful redirect-stub deploy. Land all code first, verify CF Worker is live at `themagicianscode.dev`, then flip — so the stub is the only thing offline during the window, not the real site.
- **Dark-mode FOUC**: inline script must run before any styled HTML paints. Test in Safari + Firefox + Chrome.
- **Cross-route hash anchors**: must be root-absolute. Easy to forget.
- **Font fallback flash**: with `@fontsource/inter`, ensure `font-display: swap` (Fontsource default) so text isn't invisible during font load.
- **Old `index.html` at repo root**: delete from the repo source as part of this migration. Astro builds from `src/`; leftover root-level static files will confuse contributors and clutter `git status` permanently.
- **Wrangler authentication for first deploy**: Workers Builds runs server-side at CF, so no local `wrangler login` is needed *after* the dashboard connects the repo. But if testing `wrangler deploy` from a local machine before then, that machine needs `wrangler login` first. Don't accidentally push a deploy from a personal laptop bypassing CI.
- **`.dev` TLD**: the `.dev` TLD is on the [HSTS preload list](https://hstspreload.org/), meaning all browsers will *only* connect over HTTPS. Cloudflare auto-issues the cert; just don't accidentally configure HTTP-only somewhere.
- **`CNAME` in `public/`**: do **NOT** put a `CNAME` file in the Astro project's `public/` folder. That file belongs only in the GH Pages redirect-stub artifact, generated inside the workflow. Putting it in `public/` would ship it via the CF Worker too, where it's pointless noise.

## Testing checklist

- `npm run build` — zero warnings, zero errors
- `npm run dev` — home + `/projects/` + `/projects/yolo-dualdev/` + `/projects/strato-pi/` all render
- Theme toggle persists across reload, no FOUC
- Mobile menu opens/closes, links navigate and close menu
- Hash links from nav work from `/projects/` (jumps to home + scrolls to anchor)
- Canonical URLs correct on each route, all using `https://themagicianscode.dev` host
- JSON-LD only on home, not on `/projects/*`
- `https://themagicianscode.dev/` resolves and serves the Astro build (HTTPS, valid cert)
- `https://the-magicians-code.github.io/` returns a 301 to `https://themagicianscode.dev/` (verify with `curl -sI`)
- Lighthouse: ≥95 on perf / SEO / best-practices / accessibility (matches or beats current)

## Out of scope

- Blog routes, blog index, blog posts, RSS
- Image optimization beyond Astro defaults
- Search, analytics, comments
- View transitions API
- i18n
- Custom Catppuccin icon redesign
