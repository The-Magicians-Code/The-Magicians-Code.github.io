# Astro Migration — Design Spec

**Date**: 2026-05-07
**Author**: Tanel + Claude (brainstormed)
**Status**: Awaiting user approval

## Goal

Migrate `the-magicians-code.github.io` from a single hand-rolled `index.html` to an Astro 5 + Tailwind v4 project with content collections and proper build tooling, preserving the current visual language while fixing fragile bits and laying groundwork for future blog posts and project case studies.

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
| Framework | Astro 5 |
| Styling | Tailwind v4 via `@tailwindcss/vite` (NOT deprecated `@astrojs/tailwind`) |
| Content collections | `projects/` (active), `blog/` (schema only, no entries yet) |
| Routes | `/`, `/projects/`, `/projects/[slug]` — `/blog/*` deferred |
| Visual fidelity | Parity-with-judgment: same look, fix fragile bits during the move |
| Deploy | GitHub Actions (`withastro/action` → `actions/deploy-pages`) |
| Output target | Static (`output: 'static'`, the default) |

## Architecture

### File structure

```
.
├── .github/workflows/deploy.yml
├── .gitignore                          (extended)
├── astro.config.mjs
├── package.json
├── package-lock.json                   (committed; required by withastro/action)
├── tsconfig.json
├── public/
│   ├── favicon.ico
│   ├── icon.svg
│   └── apple-touch-icon.png
├── src/
│   ├── content.config.ts               (Astro 5 API; NOT src/content/config.ts)
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

- `index.astro` — composes `Hero`, `ProjectsSection` (home grid view), `SkillsTools`, `Contact`. JSON-LD Person on home only.
- `projects/index.astro` — full projects listing. Title: "Projects · Tanel Treuberg". Canonical: `https://the-magicians-code.github.io/projects/`.
- `projects/[slug].astro` — dynamic detail. Uses `getStaticPaths()` over the projects collection. Renders the project body (Markdown) into the page. Canonical: `https://the-magicians-code.github.io/projects/<slug>/`.

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
import { defineCollection, z } from 'astro:content';
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
    site: 'https://the-magicians-code.github.io/',
    // base intentionally omitted — user/org pages serve from domain root
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

**`.github/workflows/deploy.yml`**:

```yaml
name: Deploy site to GitHub Pages

on:
  push:
    branches: [master]   # NOT main — repo serves from master
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
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
        # withastro/action infers package manager from committed lockfile
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Repo settings (manual, one-time)**: Settings → Pages → Source: **GitHub Actions**.

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
12. Add `.github/workflows/deploy.yml`
13. Extend `.gitignore`
14. Commit `package-lock.json`
15. Push to `master`; flip Pages source to GitHub Actions in repo settings
16. Verify production deploy: site renders, dark mode works, theme persists, mobile menu works, projects detail pages reachable, canonicals correct

## Risks / gotchas

- **Pages source flip**: switching from "Deploy from branch" to "GitHub Actions" causes a brief offline window between the flip and first successful Action deploy. Land all code first, verify build is clean, then flip.
- **Dark-mode FOUC**: inline script must run before any styled HTML paints. Test in Safari + Firefox + Chrome.
- **Cross-route hash anchors**: must be root-absolute. Easy to forget.
- **Font fallback flash**: with `@fontsource/inter`, ensure `font-display: swap` (Fontsource default) so text isn't invisible during font load.
- **Old `index.html` at repo root**: must be deleted from the repo (not just left orphaned), otherwise `actions/deploy-pages` artifact may pick the wrong file. Only `dist/` should ship.

## Testing checklist

- `npm run build` — zero warnings, zero errors
- `npm run dev` — home + `/projects/` + `/projects/yolo-dualdev/` + `/projects/strato-pi/` all render
- Theme toggle persists across reload, no FOUC
- Mobile menu opens/closes, links navigate and close menu
- Hash links from nav work from `/projects/` (jumps to home + scrolls to anchor)
- Canonical URLs correct on each route
- JSON-LD only on home, not on `/projects/*`
- Lighthouse: ≥95 on perf / SEO / best-practices / accessibility (matches or beats current)

## Out of scope

- Blog routes, blog index, blog posts, RSS
- Image optimization beyond Astro defaults
- Search, analytics, comments
- View transitions API
- i18n
- Custom Catppuccin icon redesign
