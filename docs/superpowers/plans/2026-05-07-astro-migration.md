# Astro Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `the-magicians-code.github.io` as an Astro 6 + Tailwind v4 site with content collections, deploy via GitHub Actions to GitHub Pages, and serve under the custom domain `themagicianscode.dev` with automatic propagation to existing sibling project Pages (`qr-code`, `play`).

**Architecture:** Static Astro 6 build. Tailwind v4 via the `@tailwindcss/vite` plugin (NOT the deprecated `@astrojs/tailwind` integration). Content collections defined with the Astro 5+ `glob` loader and the new `astro/zod` import path. Theme toggle, mobile menu, and theme-FOUC handled by small inline `<script>` blocks — no UI framework, no islands. GH Pages deploy via `withastro/action@v6` → `actions/deploy-pages@v5`. Custom domain set via `public/CNAME`. Cloudflare DNS-only (gray cloud) at the apex.

**Tech Stack:** Astro 6, Tailwind v4 (`@tailwindcss/vite`), `astro-icon` + `@iconify-json/lucide`, `@fontsource/inter`, GitHub Actions, GitHub Pages, Cloudflare DNS.

**Reference spec:** [docs/superpowers/specs/2026-05-07-astro-migration-design.md](../specs/2026-05-07-astro-migration-design.md)

**Reference current site (for visual parity):** `index.html` at the repo root — port styling and structure verbatim except where the spec calls out a fix.

---

## Approach Notes

This is a static-site visual port. Strict TDD doesn't apply cleanly — there is no business logic to drive with unit tests. Instead, each task is verified by:

1. **`npx astro check`** — TypeScript + content-collection schema validation
2. **`npm run build`** — full production build with zero warnings
3. **`npm run dev` / `npm run preview`** — visual smoke test in a browser
4. **Targeted command output** — file existence, git status, version output

Treat the verification step as the test. Don't skip it — passing means "this task didn't break anything observable." Failing means stop and fix before moving on.

**Commit cadence:** every task ends with a commit. ~22 commits expected over the migration.

**Branch strategy:** the user has been pushing directly to `master` throughout this design phase; continue on `master`. If the user requests a feature branch, create it before Task 1.

---

## File Structure (target end-state)

```
.
├── .github/workflows/deploy.yml
├── .gitignore                          (extended)
├── astro.config.mjs
├── package.json
├── package-lock.json
├── tsconfig.json
├── public/
│   ├── CNAME                           (one line: themagicianscode.dev)
│   ├── favicon.ico
│   ├── icon.svg
│   └── apple-touch-icon.png
├── src/
│   ├── env.d.ts
│   ├── content.config.ts
│   ├── content/projects/
│   │   ├── yolo-dualdev.md
│   │   └── strato-pi.md
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
│       ├── ProjectsSection.astro
│       ├── ProjectCard.astro
│       ├── SkillsTools.astro
│       ├── SkillIcon.astro
│       ├── Contact.astro
│       └── SiteFooter.astro
└── docs/superpowers/                   (specs + plans, untouched)
```

The legacy root files `index.html`, `favicon.ico`, `icon.svg`, `apple-touch-icon.png` are deleted in Task 18.

---

## Task 1: Bootstrap Astro project

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/env.d.ts`

**Approach:** manual init rather than `npm create astro@latest` to avoid file-overwrite drama with the legacy root files. The scaffold is just five small files.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "themagicianscode",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "check": "astro check"
  }
}
```

- [ ] **Step 2: Install Astro**

Run: `npm install astro@latest`
Expected: lockfile created, `node_modules/astro` exists, no errors.

Verify the version:

```bash
npx astro --version
```

Expected: `6.x.y` (≥ 6.2.2).

- [ ] **Step 3: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://themagicianscode.dev',
});
```

(Integrations and Vite plugins added in Task 2.)

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 5: Create `src/env.d.ts`**

```ts
/// <reference types="astro/client" />
```

- [ ] **Step 6: Verify Astro recognises the project**

Run: `npx astro sync`
Expected: prints "Generated X.XXs", creates `.astro/` folder, no errors. (`astro sync` generates content/types stubs.)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src/env.d.ts
git commit -m "Bootstrap Astro 6 project skeleton"
```

---

## Task 2: Add Tailwind v4 and integrations

**Files:**
- Modify: `package.json` (deps added by npm install)
- Modify: `astro.config.mjs`

- [ ] **Step 1: Install styling and icon dependencies**

```bash
npm install tailwindcss @tailwindcss/vite astro-icon @iconify-json/lucide @fontsource/inter
```

Expected: all five packages added to `dependencies`. Versions ≥ tailwindcss@4.2, astro-icon@1.1, @iconify-json/lucide@1.2, @fontsource/inter@5.2.

- [ ] **Step 2: Update `astro.config.mjs` to wire integrations + Vite plugin**

Replace contents with:

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

export default defineConfig({
  site: 'https://themagicianscode.dev',
  integrations: [icon()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: Verify Astro still loads the config**

Run: `npx astro check`
Expected: completes without errors. (May warn about no pages yet — that's fine.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json astro.config.mjs
git commit -m "Add Tailwind v4, astro-icon, and Inter font dependencies"
```

---

## Task 3: Author `src/styles/global.css`

**Files:**
- Create: `src/styles/global.css`

This file owns:
1. Tailwind import
2. Class-based dark mode (Tailwind v4 syntax)
3. `@theme` block mapping `font-sans` → Inter
4. Liquid-glass tokens (light + dark)
5. Glass primitive
6. Nav layout (pill, links, brand, actions, theme toggle, hamburger, mobile menu, side wraps)
7. Name-gradient animation
8. Section fade-in animation (using `--delay` CSS variable, NOT `:nth-of-type`)
9. Rainbow `body::before` glow
10. Body base styles + transitions

- [ ] **Step 1: Create `src/styles/global.css`**

```css
@import "tailwindcss";

/* ===== Class-based dark mode (Tailwind v4) ===== */
@custom-variant dark (&:where(.dark, .dark *));

/* ===== Theme tokens ===== */
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
    "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
    "Segoe UI Symbol", "Noto Color Emoji";
}

/* ===== Base body ===== */
body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* ===== Liquid Glass Tokens ===== */
:root {
  --glass-bg: rgba(255, 255, 255, 0.28);
  --glass-brd: rgba(255, 255, 255, 0.45);
  --glass-inner: inset 0 1px 0 rgba(255, 255, 255, .35);
  --glass-shadow: 0 8px 24px rgba(0, 0, 0, .18);
  --ink: #1f2937;
  --ink-dim: #4b5563;
  --glow-fade-opaque: rgba(255, 255, 255, 1);
  --glow-fade-transparent: rgba(255, 255, 255, 0);
  --glow-alpha: 0.35;
}

html.dark {
  --glass-bg: rgba(23, 23, 23, 0.42);
  --glass-brd: rgba(255, 255, 255, 0.12);
  --glass-inner: inset 0 1px 0 rgba(255, 255, 255, .07);
  --glass-shadow: 0 10px 28px rgba(0, 0, 0, .6);
  --ink: #f5f5f5;
  --ink-dim: #a3a3a3;
  --glow-fade-opaque: rgba(0, 0, 0, 1);
  --glow-fade-transparent: rgba(0, 0, 0, 0);
  --glow-alpha: 0.40;
}

/* ===== Glass Primitive ===== */
.glass {
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  box-shadow: var(--glass-inner), var(--glass-shadow);
  border: 1px solid var(--glass-brd);
}

/* ===== Nav Layout ===== */
#site-nav {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 40;
}

#nav-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
  height: 64px;
  padding: 0 1rem;
  margin: 16px 0;
  width: 100%;
  border-radius: 999px;
  transition: background-color .35s ease, border-color .35s ease, box-shadow .4s ease, transform .35s ease, padding .3s ease;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.nav-links a {
  color: var(--ink-dim);
  padding: .5rem .75rem;
  border-radius: 999px;
  transition: color 0.2s ease, background-color 0.2s ease;
  font-size: 0.875rem;
}

.nav-links a:hover {
  color: var(--ink);
  background: rgba(128, 128, 128, .15);
}

.brand-pill {
  padding: .5rem .75rem;
  border-radius: 999px;
  transition: background-color 0.2s ease;
}

.brand-pill:hover {
  background-color: rgba(128, 128, 128, .15);
}

.brand-name {
  font-weight: 600;
  font-size: 1.125rem;
  color: var(--ink);
}

.brand-home-icon {
  display: none;
  width: 20px;
  height: 20px;
  color: var(--ink);
}

.brand-text {
  display: inline;
}

/* Animated rainbow gradient name */
.name-gradient {
  background: linear-gradient(to right, #8a2be2, #4169e1, #00ced1, #3cb371, #8a2be2);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  display: inline-block;
  animation: gradient-shift 8s linear infinite;
}

@keyframes gradient-shift {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

/* ===== Nav Actions ===== */
.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

#theme-toggle-button {
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-dim);
  transition: color 0.2s ease, background-color 0.2s ease;
  line-height: 0;
  cursor: pointer;
}

#theme-toggle-button:hover {
  color: var(--ink);
  background-color: rgba(128, 128, 128, .15);
}

#theme-toggle-button .icon-moon { display: none; }
#theme-toggle-button .icon-sun  { display: inline-block; }
html.dark #theme-toggle-button .icon-moon { display: inline-block; }
html.dark #theme-toggle-button .icon-sun  { display: none; }

#theme-toggle-button > svg,
#theme-toggle-button > i > svg {
  width: 20px;
  height: 20px;
}

.hamburger-button {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--ink);
}

.hamburger-lines {
  width: 24px;
  height: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
}

.line {
  display: block;
  height: 2px;
  width: 100%;
  background-color: currentColor;
  border-radius: 1px;
  transition: transform 0.3s ease-in-out, opacity 0.2s ease-in-out;
  transform-origin: center;
}

.hamburger-button.open .line1 { transform: translateY(8px) rotate(45deg); }
.hamburger-button.open .line2 { opacity: 0; transform: scaleX(0); }
.hamburger-button.open .line3 { transform: translateY(-8px) rotate(-45deg); }

/* ===== Mobile Menu Panel ===== */
#mobile-menu {
  position: fixed;
  inset: 84px 0 auto 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

#mobile-menu .panel {
  width: min(680px, 92%);
  border-radius: 16px;
  padding: .5rem;
  transform: translateY(-8px);
  opacity: 0;
  transition: transform .3s ease, opacity .3s ease, max-height .35s ease;
  max-height: 0;
  overflow: hidden;
}

#mobile-menu.show { pointer-events: auto; }

#mobile-menu.show .panel {
  transform: translateY(0);
  opacity: 1;
  max-height: 440px;
}

.panel a {
  display: block;
  padding: .875rem 1rem;
  border-radius: 12px;
  font-weight: 600;
  color: var(--ink);
}

.panel a:hover { background: rgba(128, 128, 128, .15); }

/* ===== Responsive Layout ===== */
@media (max-width: 640px) {
  .nav-links { display: none; }
  .hamburger-button { display: inline-flex; }

  #nav-pill {
    background: none !important;
    border: none !important;
    box-shadow: none !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    border-radius: 0 !important;
    height: auto !important;
    width: 100% !important;
    padding: 0;
    gap: 12px;
    margin: 10px 0 0;
  }

  .brand-pill {
    background: transparent;
    box-shadow: none;
    border: none;
    width: auto;
    height: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
  }

  .brand-pill:hover { background-color: transparent; }
  .brand-pill:hover .brand-home-icon { color: var(--ink); filter: brightness(1.05); }

  .brand-text { display: none; }

  .brand-home-icon {
    display: inline-block;
    color: var(--ink-dim);
    transition: color 0.2s ease, filter 0.2s ease;
  }

  .nav-actions {
    background: none !important;
    -webkit-backdrop-filter: none !important;
    backdrop-filter: none !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0;
    padding: 0;
    gap: 8px;
  }

  #theme-toggle-button,
  .hamburger-button {
    background-color: transparent !important;
    color: var(--ink-dim);
    opacity: .85;
  }

  #theme-toggle-button:hover,
  .hamburger-button:hover {
    background-color: transparent !important;
    color: var(--ink) !important;
    filter: brightness(1.03);
    opacity: 1;
  }

  .side-wrap {
    background: var(--glass-bg);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    backdrop-filter: blur(18px) saturate(140%);
    box-shadow: var(--glass-inner), var(--glass-shadow);
    border: 1px solid var(--glass-brd);
    border-radius: 999px;
    padding: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 52px;
  }

  .brand-wrap {
    padding: 0;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

/* ===== Section Fade-in (delay via CSS variable, not :nth-of-type) ===== */
.section-fade-in {
  opacity: 0;
  transform: translateY(20px);
  animation: fadeIn 0.6s ease-out forwards;
  animation-delay: var(--delay, 0s);
}

@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== Rainbow glow at top ===== */
body::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 12vh;
  background: linear-gradient(90deg,
    rgba(255, 0, 0, var(--glow-alpha)),
    rgba(255, 140, 0, var(--glow-alpha)),
    rgba(255, 255, 0, var(--glow-alpha)),
    rgba(0, 255, 0, var(--glow-alpha)),
    rgba(0, 207, 255, var(--glow-alpha)),
    rgba(123, 0, 255, var(--glow-alpha)),
    rgba(255, 0, 0, var(--glow-alpha)));
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 100%);
  background-size: 800% 100%;
  animation: rainbowFlow 15s linear infinite alternate;
  pointer-events: none;
}

@keyframes rainbowFlow {
  from { background-position: 0% 0; }
  to   { background-position: 100% 0; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/global.css
git commit -m "Add global styles ported from index.html with Tailwind v4 dark variant"
```

---

## Task 4: Set up content collections (config + seed entries)

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/projects/yolo-dualdev.md`
- Create: `src/content/projects/strato-pi.md`

- [ ] **Step 1: Create `src/content.config.ts`**

```ts
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
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

- [ ] **Step 2: Seed `src/content/projects/yolo-dualdev.md`**

```markdown
---
title: Yolo-dualdev
description: Develop and deploy TensorRT-optimised YOLOv5 models on Nvidia Jetson
repoUrl: https://github.com/The-Magicians-Code/Yolo-dualdev/
order: 1
---

Detail page body — flesh out later.
```

- [ ] **Step 3: Seed `src/content/projects/strato-pi.md`**

```markdown
---
title: Strato_Pi
description: Motor load machine controller with online interface
repoUrl: https://github.com/The-Magicians-Code/Strato_Pi/
order: 2
---

Detail page body — flesh out later.
```

- [ ] **Step 4: Verify schemas parse and types generate**

Run: `npx astro sync`
Expected: prints "Generated", no errors. The `.astro/types.d.ts` now contains types for the `projects` and `blog` collections.

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts src/content/projects/yolo-dualdev.md src/content/projects/strato-pi.md
git commit -m "Define projects and blog content collections, seed two project entries"
```

---

## Task 5: Build `SkillIcon.astro` component

**Files:**
- Create: `src/components/SkillIcon.astro`

The current `index.html` has six hand-tuned inline SVGs (Catppuccin-style) for Python, Docker, BASH, Swift, VS Code, and Git. They are not Lucide icons. Wrap them in one component that dispatches on a `name` prop.

- [ ] **Step 1: Create `src/components/SkillIcon.astro`**

```astro
---
type SkillName = 'python' | 'docker' | 'bash' | 'swift' | 'vscode' | 'git';
interface Props {
  name: SkillName;
}
const { name } = Astro.props;

const tints: Record<SkillName, string> = {
  python: 'rgba(137, 180, 250, 0.3)',
  docker: 'rgba(137, 180, 250, 0.3)',
  bash:   'rgba(166, 227, 161, 0.3)',
  swift:  'rgba(250, 179, 135, 0.3)',
  vscode: 'rgba(137, 180, 250, 0.3)',
  git:    'rgba(203, 166, 247, 0.3)',
};
const tint = tints[name];
---

<div
  class="glass w-12 h-12 rounded-xl flex items-center justify-center"
  style={`background: radial-gradient(circle at center, ${tint} 0%, transparent 85%), var(--glass-bg);`}
>
  {name === 'python' && (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 16 16" class="w-[26px] h-[26px]" aria-hidden="true">
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path stroke="#89b4fa" d="M8.5 5.5h-3m6 0V3c0-.8-.7-1.5-1.5-1.5H7c-.8 0-1.5.7-1.5 1.5v2.5H3c-.8 0-1.5.7-1.5 1.5v2c0 .8.7 1.5 1.48 1.5" stroke-width="1.5" />
        <path stroke="#f9e2af" d="M10.5 10.5h-3m-3 0V13c0 .8.7 1.5 1.5 1.5h3c.8 0 1.5-.7 1.5-1.5v-2.5H13c.8 0 1.5-.7 1.5-1.5V7c0-.8-.7-1.5-1.48-1.5H11.5c0 1.5 0 2-1 2h-2" stroke-width="1.5" />
        <path stroke="#89b4fa" d="M2.98 10.5H4.5c0-1.5 0-2 1-2h2m0-5" stroke-width="1.5" />
      </g>
    </svg>
  )}
  {name === 'docker' && (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 16 16" class="w-[26px] h-[26px]" fill="none" stroke="#89b4fa" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" aria-hidden="true">
      <path d="M.5 8.5H11l.75-.5a5.35 5.35 0 0 1 0-3.5c1 .6 1 1.88 1.74 2c.77-.09 1.23.01 2 .52c0 0-.97 1.77-2.5 1.98c-1.93 3.65-4.5 5.5-6.98 5.5C0 14.5.5 8.5.5 8.5m1 0v-2m0 0h8m-6 2v-4m0 0h4m-2-2h2m-2 6v-6m2 6v-6m2 6v-2" />
    </svg>
  )}
  {name === 'bash' && (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 16 16" class="w-[26px] h-[26px]" aria-hidden="true">
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path stroke="#a6e3a1" d="M2 15.5c-.7 0-1.5-.8-1.5-1.5V5c0-.7.8-1.5 1.5-1.5h9c.7 0 1.5.8 1.5 1.5v9c0 .7-.8 1.5-1.5 1.5z" stroke-width="1.5" />
        <path stroke="#a6e3a1" d="m1.2 3.8l3.04-2.5S5.17.5 5.7.5h8.4c.66 0 1.4.73 1.4 1.4v7.73a2.7 2.7 0 0 1-.7 1.75l-2.68 3.51" stroke-width="1.5" />
        <path stroke="#a6e3a1" d="M6 8.75c0-.69-.54-1.25-1.2-1.25h-.6c-.66 0-1.2.56-1.2 1.25S3.54 10 4.2 10h.6c.66 0 1.2.56 1.2 1.25s-.54 1.25-1.2 1.25h-.6c-.66 0-1.2-.56-1.2-1.25M4.5 6.5v1m0 5v1" stroke-width="1.5" />
      </g>
    </svg>
  )}
  {name === 'swift' && (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 16 16" class="w-[26px] h-[26px]" aria-hidden="true">
      <path fill="none" stroke="#fab387" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.34 10.2c.34-1.08 1.1-5.07-4.45-8.62a.48.48 0 0 0-.6.07a.44.44 0 0 0-.02.6c.03.02 2.07 2.5 1.34 5.34c-1.26-.86-6.24-4.81-6.24-4.81L7.25 7.5L1.9 4.05S5.68 8.7 8 10.45c-1.12.4-3.56.82-6.78-1.18a.48.48 0 0 0-.58.06a.44.44 0 0 0-.08.56c.11.18 2.7 4.36 8.14 4.36c1.5 0 2.37-.42 3.08-.77c.43-.2.77-.37 1.14-.37c.93 0 1.54.92 1.54.93c.1.14.27.22.44.21a.46.46 0 0 0 .4-.28c.67-1.55-.49-3.2-.96-3.78h0Z" />
    </svg>
  )}
  {name === 'vscode' && (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 16 16" class="w-[26px] h-[26px]" aria-hidden="true">
      <path fill="none" stroke="#89b4fa" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.5 11L3 4.5h-.5l-1 1V6l9 8.5l4-2v-9l-4-2v13m0-13L5.3 6.41M3.53 8.08L1.5 10v.5l.98 1.1l.52-.1l2.17-1.88m1.91-1.66L10.5 5" />
    </svg>
  )}
  {name === 'git' && (
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 16 16" class="w-[26px] h-[26px]" aria-hidden="true">
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path stroke="#cba6f7" d="M8.5 10.5a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1a1 1 0 0 1 1 1m0-6a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1a1 1 0 0 1 1 1m3 3a1 1 0 0 1-1 1a1 1 0 0 1-1-1a1 1 0 0 1 1-1a1 1 0 0 1 1 1m-4-2v4m-1-6l-1-1m4 4l-1-1" stroke-width="1.5" />
        <path stroke="#fab387" d="m9.06 1.06l5.88 5.88a1.5 1.5 0 0 1 0 2.12l-5.88 5.88a1.5 1.5 0 0 1-2.12 0L1.06 9.06a1.5 1.5 0 0 1 0-2.12l5.88-5.88a1.5 1.5 0 0 1 2.12 0" stroke-width="1.5" />
      </g>
    </svg>
  )}
</div>
```

- [ ] **Step 2: Verify the component type-checks**

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillIcon.astro
git commit -m "Add SkillIcon component with 6 dispatching inline SVGs"
```

---

## Task 6: Build `Hero`, `Contact`, `SiteFooter` components

**Files:**
- Create: `src/components/Hero.astro`
- Create: `src/components/Contact.astro`
- Create: `src/components/SiteFooter.astro`

Three small standalone components.

- [ ] **Step 1: Create `src/components/Hero.astro`**

```astro
---
---

<header class="text-center section-fade-in pt-6 md:pt-10" style="--delay: 0.1s">
  <h1 class="text-4xl md:text-5xl font-bold mb-2 name-gradient">Tanel</h1>
  <p class="text-xl md:text-2xl text-gray-600 dark:text-neutral-400">
    Software engineer, with data driven results.
  </p>
</header>
```

- [ ] **Step 2: Create `src/components/Contact.astro`**

```astro
---
import { Icon } from 'astro-icon/components';
---

<section id="contact" class="section-fade-in" style="--delay: 0.4s">
  <h2 class="text-2xl md:text-3xl font-semibold mb-6 flex items-center dark:text-white">
    <Icon name="lucide:mail" class="inline-block w-6 h-6 mr-3 text-purple-600 dark:text-purple-500" aria-hidden="true" />
    Get In Touch
  </h2>
  <div class="flex flex-wrap gap-4 md:gap-6">
    <a
      href="https://www.linkedin.com/in/taneltreuberg/"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors duration-200"
      aria-label="Connect with Tanel on LinkedIn"
    >
      <Icon name="lucide:linkedin" class="w-5 h-5 mr-2" aria-hidden="true" />LinkedIn
    </a>
    <a
      href="https://github.com/The-Magicians-Code/"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center text-gray-800 hover:text-black dark:text-neutral-300 dark:hover:text-white font-medium transition-colors duration-200"
      aria-label="View Tanel's GitHub profile"
    >
      <Icon name="lucide:github" class="w-5 h-5 mr-2" aria-hidden="true" />GitHub
    </a>
  </div>
</section>
```

- [ ] **Step 3: Create `src/components/SiteFooter.astro`**

```astro
---
const year = new Date().getFullYear();
---

<div class="max-w-4xl mx-auto p-6 md:p-10 space-y-12 md:space-y-16">
  <footer
    class="text-center text-gray-500 dark:text-neutral-400 text-sm pt-8 border-t border-gray-200 dark:border-neutral-700 section-fade-in px-6"
    style="--delay: 0.5s"
  >
    &copy; {year} Tanel Treuberg. All rights reserved.
  </footer>
</div>
```

- [ ] **Step 4: Verify**

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Hero.astro src/components/Contact.astro src/components/SiteFooter.astro
git commit -m "Add Hero, Contact, and SiteFooter components"
```

---

## Task 7: Build `ProjectCard.astro`

**Files:**
- Create: `src/components/ProjectCard.astro`

A single project tile. Title links to its detail page; "View on GitHub" link goes external.

- [ ] **Step 1: Create `src/components/ProjectCard.astro`**

```astro
---
import { Icon } from 'astro-icon/components';

interface Props {
  title: string;
  description: string;
  repoUrl: string;
  slug: string;
}
const { title, description, repoUrl, slug } = Astro.props;
---

<article class="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-300 dark:bg-neutral-800 dark:border-neutral-700">
  <h3 class="text-lg font-semibold mb-2 dark:text-white">
    <a href={`/projects/${slug}/`} class="hover:underline">{title}</a>
  </h3>
  <p class="text-gray-600 mb-4 text-sm dark:text-neutral-400">{description}</p>
  <a
    href={repoUrl}
    target="_blank"
    rel="noopener noreferrer"
    class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium inline-flex items-center"
    aria-label={`View ${title} project on GitHub`}
  >
    View on GitHub
    <Icon name="lucide:arrow-up-right" class="inline-block w-4 h-4 ml-1" aria-hidden="true" />
  </a>
</article>
```

- [ ] **Step 2: Verify**

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProjectCard.astro
git commit -m "Add ProjectCard component linking to per-project detail pages"
```

---

## Task 8: Build `ProjectsSection.astro`

**Files:**
- Create: `src/components/ProjectsSection.astro`

Reads the `projects` collection, sorts by `order`, renders `ProjectCard` per entry, plus the "see all on GitHub" footer card.

- [ ] **Step 1: Create `src/components/ProjectsSection.astro`**

```astro
---
import { Icon } from 'astro-icon/components';
import { getCollection } from 'astro:content';
import ProjectCard from './ProjectCard.astro';

const projects = (await getCollection('projects'))
  .filter((p) => !p.data.draft)
  .sort((a, b) => a.data.order - b.data.order);
---

<section id="projects" class="section-fade-in" style="--delay: 0.2s">
  <h2 class="text-2xl md:text-3xl font-semibold mb-6 flex items-center dark:text-white">
    <Icon name="lucide:folder-git-2" class="inline-block w-6 h-6 mr-3 text-blue-600 dark:text-blue-400" aria-hidden="true" />
    Projects
  </h2>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    {projects.map((project) => (
      <ProjectCard
        title={project.data.title}
        description={project.data.description}
        repoUrl={project.data.repoUrl}
        slug={project.id}
      />
    ))}
    <div class="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-300 md:col-span-2 text-center dark:bg-neutral-800 dark:border-neutral-700">
      <a
        href="https://github.com/The-Magicians-Code/"
        target="_blank"
        rel="noopener noreferrer"
        class="text-gray-700 hover:text-black dark:text-neutral-300 dark:hover:text-white font-medium inline-flex items-center"
        aria-label="View all projects on GitHub"
      >
        <Icon name="lucide:github" class="inline-block w-5 h-5 mr-2" aria-hidden="true" />
        See all projects on GitHub
      </a>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify**

Run: `npx astro check`
Expected: zero errors. The `getCollection` return type is fully inferred from `content.config.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProjectsSection.astro
git commit -m "Add ProjectsSection component reading from content collection"
```

---

## Task 9: Build `SkillsTools.astro`

**Files:**
- Create: `src/components/SkillsTools.astro`

Two-column grid: Skills (Python, Docker, BASH, Swift) and Tools (VS Code, Git).

- [ ] **Step 1: Create `src/components/SkillsTools.astro`**

```astro
---
import { Icon } from 'astro-icon/components';
import SkillIcon from './SkillIcon.astro';
---

<section id="skills-tools" class="section-fade-in" style="--delay: 0.3s">
  <h2 class="text-2xl md:text-3xl font-semibold mb-6 flex items-center dark:text-white">
    <Icon name="lucide:terminal-square" class="inline-block w-6 h-6 mr-3 text-green-600 dark:text-green-500" aria-hidden="true" />
    Skills & Tools
  </h2>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
    <div>
      <h3 class="text-lg font-semibold mb-3 text-gray-700 dark:text-neutral-300">Skills</h3>
      <ul class="space-y-4">
        <li class="flex items-center gap-4"><SkillIcon name="python" />Python</li>
        <li class="flex items-center gap-4"><SkillIcon name="docker" />Docker</li>
        <li class="flex items-center gap-4"><SkillIcon name="bash" />BASH</li>
        <li class="flex items-center gap-4"><SkillIcon name="swift" />Swift</li>
      </ul>
    </div>
    <div>
      <h3 class="text-lg font-semibold mb-3 text-gray-700 dark:text-neutral-300">Tools</h3>
      <ul class="space-y-4">
        <li class="flex items-center gap-4"><SkillIcon name="vscode" />VS Code</li>
        <li class="flex items-center gap-4"><SkillIcon name="git" />Git</li>
      </ul>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Verify**

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SkillsTools.astro
git commit -m "Add SkillsTools component"
```

---

## Task 10: Build `ThemeToggle.astro`

**Files:**
- Create: `src/components/ThemeToggle.astro`

Sun/moon button with click handler. The handler toggles the `dark` class on `<html>` and persists to `localStorage`. (The FOUC-prevention initial-state script lives in `BaseLayout` as `is:inline`; this component handles only user clicks.)

- [ ] **Step 1: Create `src/components/ThemeToggle.astro`**

```astro
---
import { Icon } from 'astro-icon/components';
---

<button id="theme-toggle-button" type="button" aria-label="Toggle theme">
  <Icon name="lucide:sun" class="icon-sun" aria-hidden="true" />
  <Icon name="lucide:moon" class="icon-moon" aria-hidden="true" />
</button>

<script>
  const THEME_KEY = 'theme-preference';

  const handleClick = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  };

  const button = document.getElementById('theme-toggle-button');
  button?.addEventListener('click', handleClick);
</script>
```

- [ ] **Step 2: Verify**

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ThemeToggle.astro
git commit -m "Add ThemeToggle component with localStorage persistence"
```

---

## Task 11: Build `MobileMenu.astro`

**Files:**
- Create: `src/components/MobileMenu.astro`

Hamburger panel with the same nav links as desktop. Hamburger button lives in `Nav`; this component is the drop-down panel (visible on small screens).

- [ ] **Step 1: Create `src/components/MobileMenu.astro`**

```astro
---
---

<div id="mobile-menu">
  <div class="panel glass">
    <a href="/#projects" class="mobile-nav-link">Projects</a>
    <a href="/#skills-tools" class="mobile-nav-link">Skills & Tools</a>
    <a href="/#contact" class="mobile-nav-link">Contact</a>
  </div>
</div>

<script>
  const menuButton = document.getElementById('hamburger-button');
  const mobileMenu = document.getElementById('mobile-menu');

  const setOpen = (open: boolean) => {
    if (!menuButton || !mobileMenu) return;
    mobileMenu.classList.toggle('show', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.classList.toggle('open', open);
  };

  menuButton?.addEventListener('click', () => {
    const open = mobileMenu?.classList.contains('show') ?? false;
    setOpen(!open);
  });

  document.querySelectorAll<HTMLAnchorElement>('#mobile-menu .mobile-nav-link').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });
</script>
```

- [ ] **Step 2: Verify**

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MobileMenu.astro
git commit -m "Add MobileMenu component with hamburger drop-down panel"
```

---

## Task 12: Build `Nav.astro`

**Files:**
- Create: `src/components/Nav.astro`

Glass nav pill: brand, desktop nav links, theme toggle, hamburger button. Uses root-absolute hashes (`/#projects`) so links work from `/projects/` and other routes.

- [ ] **Step 1: Create `src/components/Nav.astro`**

```astro
---
import { Icon } from 'astro-icon/components';
import ThemeToggle from './ThemeToggle.astro';
---

<nav id="site-nav">
  <div class="nav-shell max-w-4xl mx-auto px-6 md:px-10">
    <div id="nav-pill" class="glass">
      <div class="side-wrap brand-wrap">
        <a href="/" class="brand-pill" aria-label="Home">
          <span class="brand-name brand-text">Home</span>
          <Icon name="lucide:home" class="brand-home-icon" aria-hidden="true" />
        </a>
      </div>

      <div class="nav-links">
        <a href="/#projects">Projects</a>
        <a href="/#skills-tools">Skills & Tools</a>
        <a href="/#contact">Contact</a>
      </div>

      <div class="flex-1"></div>
      <div class="side-wrap actions-wrap">
        <div class="nav-actions">
          <ThemeToggle />
          <button
            id="hamburger-button"
            type="button"
            class="hamburger-button"
            aria-controls="mobile-menu"
            aria-expanded="false"
          >
            <span class="sr-only">Open main menu</span>
            <div class="hamburger-lines" aria-hidden="true">
              <span class="line line1"></span>
              <span class="line line2"></span>
              <span class="line line3"></span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</nav>
```

- [ ] **Step 2: Verify**

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.astro
git commit -m "Add Nav component with glass pill, brand, and theme toggle"
```

---

## Task 13: Build `BaseLayout.astro`

**Files:**
- Create: `src/layouts/BaseLayout.astro`

Wires the document `<head>` (meta, OG, Twitter, JSON-LD on home, favicons, canonical), inline FOUC theme script with `is:inline`, body shell, mounts `Nav` + `MobileMenu` + slot + `SiteFooter`. Imports `global.css` and Inter weights.

- [ ] **Step 1: Create `src/layouts/BaseLayout.astro`**

```astro
---
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '../styles/global.css';

import Nav from '../components/Nav.astro';
import MobileMenu from '../components/MobileMenu.astro';
import SiteFooter from '../components/SiteFooter.astro';

interface Props {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: string;
  includePersonSchema?: boolean;
}

const {
  title,
  description,
  canonicalPath = '/',
  ogType = 'website',
  includePersonSchema = false,
} = Astro.props;

const siteUrl = Astro.site?.toString().replace(/\/$/, '') ?? 'https://themagicianscode.dev';
const canonical = `${siteUrl}${canonicalPath}`;

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Tanel Treuberg',
  jobTitle: 'Software Engineer',
  description: 'Software engineer with data driven results',
  url: siteUrl + '/',
  sameAs: [
    'https://www.linkedin.com/in/taneltreuberg/',
    'https://github.com/The-Magicians-Code/',
  ],
  knowsAbout: ['Python', 'Docker', 'BASH', 'Swift', 'Machine Learning', 'TensorRT', 'YOLO'],
  worksFor: { '@type': 'Organization', name: 'Software Engineering' },
};
---

<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>{title}</title>
    <meta name="description" content={description} />
    <meta name="author" content="Tanel Treuberg" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href={canonical} />

    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:type" content={ogType} />
    <meta property="og:url" content={canonical} />
    <meta property="og:site_name" content="Tanel Treuberg Portfolio" />
    <meta property="og:locale" content="en_US" />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />

    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

    {includePersonSchema && (
      <script type="application/ld+json" set:html={JSON.stringify(personSchema)} />
    )}

    <script is:inline>
      // Pre-paint theme application — avoids FOUC.
      // Runs before any styled HTML paints. No imports allowed in is:inline scripts.
      (function () {
        try {
          var THEME_KEY = 'theme-preference';
          var saved = localStorage.getItem(THEME_KEY);
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var useDark = saved ? saved === 'dark' : prefersDark;
          if (useDark) document.documentElement.classList.add('dark');
        } catch (_) {}
      })();
    </script>
  </head>
  <body class="bg-gray-50 text-gray-800 leading-relaxed dark:bg-black dark:text-gray-100 pt-28">
    <Nav />
    <MobileMenu />
    <slot />
    <SiteFooter />
  </body>
</html>
```

- [ ] **Step 2: Verify**

Run: `npx astro check`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "Add BaseLayout with head metadata, FOUC script, and Nav/Footer mounts"
```

---

## Task 14: Build home page (`src/pages/index.astro`)

**Files:**
- Create or Replace: `src/pages/index.astro`

If the file exists from any earlier scaffold attempt, overwrite it.

- [ ] **Step 1: Write `src/pages/index.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import ProjectsSection from '../components/ProjectsSection.astro';
import SkillsTools from '../components/SkillsTools.astro';
import Contact from '../components/Contact.astro';
---

<BaseLayout
  title="Tanel Treuberg - SWE"
  description="Software engineer specializing in Python, Docker, BASH, and Swift development."
  canonicalPath="/"
  includePersonSchema={true}
>
  <main class="max-w-4xl mx-auto p-6 md:p-10 space-y-12 md:space-y-16">
    <Hero />
    <ProjectsSection />
    <SkillsTools />
    <Contact />
  </main>
</BaseLayout>
```

- [ ] **Step 2: Run dev server and visually smoke-test the home page**

Run: `npm run dev`
Open: `http://localhost:4321/`
Expected:
- Glass nav pill at top with brand "Home", links Projects/Skills & Tools/Contact, theme toggle
- Rainbow "Tanel" name gradient
- Two project cards (Yolo-dualdev, Strato_Pi) + "See all projects on GitHub" footer
- Skills + Tools two-column grid with custom SVG icons
- Contact section with LinkedIn + GitHub
- Footer with current year
- Top-of-page rainbow glow strip
- Theme toggle works, persists on reload

Stop the dev server (`Ctrl+C`).

- [ ] **Step 3: Run production build and ensure it succeeds**

Run: `npm run build`
Expected: builds with zero warnings, zero errors. `dist/index.html` exists.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "Add home page composing Hero, Projects, Skills, Contact"
```

---

## Task 15: Build `src/pages/projects/index.astro` (projects listing)

**Files:**
- Create: `src/pages/projects/index.astro`

Lists all project entries.

- [ ] **Step 1: Create `src/pages/projects/index.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProjectCard from '../../components/ProjectCard.astro';
import { getCollection } from 'astro:content';

const projects = (await getCollection('projects'))
  .filter((p) => !p.data.draft)
  .sort((a, b) => a.data.order - b.data.order);
---

<BaseLayout
  title="Projects · Tanel Treuberg"
  description="Software engineering projects by Tanel Treuberg, including TensorRT-optimised computer vision and embedded controllers."
  canonicalPath="/projects/"
>
  <main class="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
    <header class="text-center section-fade-in pt-6 md:pt-10" style="--delay: 0.1s">
      <h1 class="text-4xl md:text-5xl font-bold mb-2 dark:text-white">Projects</h1>
    </header>
    <section class="section-fade-in" style="--delay: 0.2s">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map((project) => (
          <ProjectCard
            title={project.data.title}
            description={project.data.description}
            repoUrl={project.data.repoUrl}
            slug={project.id}
          />
        ))}
      </div>
    </section>
  </main>
</BaseLayout>
```

- [ ] **Step 2: Verify**

Run: `npm run dev`
Open: `http://localhost:4321/projects/`
Expected: page renders with both project cards, nav present, dark mode works.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/projects/index.astro
git commit -m "Add /projects/ index page listing all project entries"
```

---

## Task 16: Build `src/pages/projects/[slug].astro` (dynamic project detail)

**Files:**
- Create: `src/pages/projects/[slug].astro`

`getStaticPaths` over the projects collection. Renders the project body Markdown into the page.

- [ ] **Step 1: Create `src/pages/projects/[slug].astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { Icon } from 'astro-icon/components';
import { getCollection, render } from 'astro:content';
import type { GetStaticPaths } from 'astro';

export const getStaticPaths = (async () => {
  const projects = await getCollection('projects');
  return projects.map((project) => ({
    params: { slug: project.id },
    props: { project },
  }));
}) satisfies GetStaticPaths;

const { project } = Astro.props;
const { Content } = await render(project);
---

<BaseLayout
  title={`${project.data.title} · Tanel Treuberg`}
  description={project.data.description}
  canonicalPath={`/projects/${project.id}/`}
  ogType="article"
>
  <main class="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
    <header class="section-fade-in pt-6 md:pt-10" style="--delay: 0.1s">
      <h1 class="text-4xl md:text-5xl font-bold mb-2 dark:text-white">{project.data.title}</h1>
      <p class="text-lg text-gray-600 dark:text-neutral-400">{project.data.description}</p>
      <a
        href={project.data.repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium inline-flex items-center"
        aria-label={`View ${project.data.title} on GitHub`}
      >
        View on GitHub
        <Icon name="lucide:arrow-up-right" class="inline-block w-4 h-4 ml-1" aria-hidden="true" />
      </a>
    </header>
    <article class="section-fade-in prose dark:prose-invert max-w-none" style="--delay: 0.2s">
      <Content />
    </article>
  </main>
</BaseLayout>
```

- [ ] **Step 2: Verify both detail pages render**

Run: `npm run dev`
Open: `http://localhost:4321/projects/yolo-dualdev/`
Expected: detail page with title "Yolo-dualdev", description, GitHub link, body text.

Open: `http://localhost:4321/projects/strato-pi/`
Expected: same shape, "Strato_Pi" content.

Stop the dev server.

- [ ] **Step 3: Run a full production build**

Run: `npm run build`
Expected: builds with zero warnings. `dist/projects/yolo-dualdev/index.html` and `dist/projects/strato-pi/index.html` exist.

```bash
ls dist/projects/
```

Expected output: `index.html`, `strato-pi/`, `yolo-dualdev/`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/projects/[slug].astro
git commit -m "Add dynamic /projects/[slug]/ detail pages from collection"
```

---

## Task 17: Move static assets into `public/` and add `CNAME`

**Files:**
- Move: `favicon.ico` → `public/favicon.ico`
- Move: `icon.svg` → `public/icon.svg`
- Move: `apple-touch-icon.png` → `public/apple-touch-icon.png`
- Create: `public/CNAME`

The legacy root copies are removed in Task 18.

- [ ] **Step 1: Ensure `public/` exists**

```bash
mkdir -p public
```

- [ ] **Step 2: Copy the three asset files into `public/`**

```bash
cp favicon.ico public/favicon.ico
cp icon.svg public/icon.svg
cp apple-touch-icon.png public/apple-touch-icon.png
```

- [ ] **Step 3: Create `public/CNAME`**

```bash
printf 'themagicianscode.dev\n' > public/CNAME
```

(Use `printf` not `echo` to avoid platform differences on trailing newlines.)

Verify content:

```bash
cat public/CNAME
```

Expected: `themagicianscode.dev` followed by a newline.

- [ ] **Step 4: Build and confirm assets land in `dist/`**

Run: `npm run build`
Expected: build succeeds.

```bash
ls dist/CNAME dist/favicon.ico dist/icon.svg dist/apple-touch-icon.png
```

Expected: all four files exist.

- [ ] **Step 5: Commit**

```bash
git add public/
git commit -m "Move static assets into public/ and add CNAME for custom domain"
```

---

## Task 18: Extend `.gitignore` and delete legacy root files

**Files:**
- Modify: `.gitignore`
- Delete: `index.html` (repo root)
- Delete: `favicon.ico` (repo root) — copy now lives in `public/`
- Delete: `icon.svg` (repo root)
- Delete: `apple-touch-icon.png` (repo root)

- [ ] **Step 1: Read current `.gitignore`**

Run: `cat .gitignore`
Expected output: `**/.DS_Store` and `.env` (the existing entries).

- [ ] **Step 2: Replace `.gitignore` with the extended version**

Replace contents with:

```
# OS
**/.DS_Store

# Env
.env
.env.production
.env.development

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Astro
dist/
.astro/
```

- [ ] **Step 3: Delete legacy root files**

```bash
git rm index.html favicon.ico icon.svg apple-touch-icon.png
```

Expected: four files staged for deletion.

- [ ] **Step 4: Verify `git status`**

Run: `git status`
Expected:
- Modified: `.gitignore`
- Deleted: `index.html`, `favicon.ico`, `icon.svg`, `apple-touch-icon.png`
- No other untracked changes.

- [ ] **Step 5: Run a final build to confirm nothing broke**

Run: `npm run build`
Expected: builds with zero warnings; `dist/` contains the Astro build with the assets.

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "Extend .gitignore for Node/Astro and delete legacy root HTML/assets"
```

---

## Task 19: Add the GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Ensure `.github/workflows/` exists**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy site to GitHub Pages

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
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: withastro/action@v6
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

- [ ] **Step 3: Validate YAML is well-formed**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml'))" && echo OK
```

Expected: `OK` printed.

- [ ] **Step 4: Commit (do not push yet — Pages source must be flipped first)**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions deploy workflow for GH Pages"
```

---

## Task 20: Local final smoke test

No file changes. Verify everything is consistent before triggering production.

- [ ] **Step 1: Type check**

Run: `npx astro check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: completes; `dist/` contains:

```bash
ls dist/
```

Expected (order may differ): `404.html` (or none), `CNAME`, `apple-touch-icon.png`, `favicon.ico`, `icon.svg`, `index.html`, `projects/`, plus Astro's `_astro/` asset directory.

- [ ] **Step 3: Preview the production build**

Run: `npm run preview`
Open: `http://localhost:4321/`
Expected: full site renders, indistinguishable from `dev` mode but served from `dist/`.

Open: `http://localhost:4321/projects/yolo-dualdev/` and `/projects/strato-pi/` — both render.

Open: `http://localhost:4321/projects/` — listing renders.

Toggle theme; verify no FOUC on reload (the `is:inline` script applies the dark class before paint).

Resize browser window narrow; hamburger menu appears and works.

Stop preview (`Ctrl+C`).

- [ ] **Step 4: Verify git tree is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

(If anything is dirty, fix and commit before proceeding.)

---

## Task 21: Production setup — DNS + GH Pages settings (manual, dashboard work)

These steps are performed in browser dashboards by the human operator, not in shell commands.

**Important order:** complete this whole task BEFORE pushing the deploy workflow to remote, so the first push triggers a deploy that has somewhere to land.

- [ ] **Step 1: Cloudflare DNS — add the apex CNAME**

In Cloudflare dashboard → `themagicianscode.dev` zone → DNS → Records → Add record:

| Type | Name | Target | Proxy status | TTL |
|---|---|---|---|---|
| `CNAME` | `themagicianscode.dev` (apex; or `@`) | `the-magicians-code.github.io` | **DNS only (gray cloud)** | Auto |

Save.

Verify resolution:

```bash
dig +short themagicianscode.dev CNAME
```

Expected output (after a few seconds of propagation): `the-magicians-code.github.io.`

- [ ] **Step 2: GitHub repo settings — flip Pages Source to GitHub Actions**

In GitHub: `The-Magicians-Code/The-Magicians-Code.github.io` → Settings → Pages.

- **Source**: change from "Deploy from a branch" to **GitHub Actions**.
- **Custom domain**: enter `themagicianscode.dev` and save. (GH will start cert provisioning. The "DNS check successful" indicator should appear within a minute or two.)
- Leave **Enforce HTTPS** OFF for now — toggle it on once GH confirms the cert is issued (Step 4 below).

---

## Task 22: First production deploy + verification

- [ ] **Step 1: Push to remote**

```bash
git push origin master
```

Expected: push succeeds. The GitHub Actions tab now shows the `Deploy site to GitHub Pages` workflow running.

- [ ] **Step 2: Watch the workflow complete**

```bash
gh run watch
```

Or via the GitHub UI: Actions → latest run → wait for both `build` and `deploy` jobs to go green.

Expected: both jobs succeed. Deploy job's environment URL: `https://the-magicians-code.github.io/` (will become `https://themagicianscode.dev/` after DNS propagates).

- [ ] **Step 3: Wait for cert issuance, then enforce HTTPS**

In GitHub Pages settings, wait until you see "Your site is published at https://themagicianscode.dev" with a green check (typically within 5 minutes of DNS resolving).

Then toggle **Enforce HTTPS** ON.

- [ ] **Step 4: Verify the live site**

```bash
curl -sI https://themagicianscode.dev/ | head -5
```

Expected: `HTTP/2 200`, `content-type: text/html`.

Open in a browser:
- `https://themagicianscode.dev/` — portfolio renders, theme toggle works, mobile menu works
- `https://themagicianscode.dev/projects/` — listing renders
- `https://themagicianscode.dev/projects/yolo-dualdev/` — detail page renders
- `https://themagicianscode.dev/projects/strato-pi/` — detail page renders

- [ ] **Step 5: Verify sibling project Pages auto-routed under the new domain**

Open in a browser:
- `https://themagicianscode.dev/qr-code/` — qr-code interactive site renders
- `https://themagicianscode.dev/play/` — play interactive site renders

If either 404s, GH may not have finished propagating the user-site custom domain to project sites yet. Wait a few minutes and retry. If still 404 after 30 minutes, check that the project repos themselves don't have conflicting CNAMEs or have Pages disabled.

- [ ] **Step 6: Verify 301 redirects from the old `*.github.io` URLs**

```bash
curl -sI https://the-magicians-code.github.io/ | head -3
curl -sI https://the-magicians-code.github.io/qr-code/ | head -3
curl -sI https://the-magicians-code.github.io/play/ | head -3
curl -sI https://the-magicians-code.github.io/projects/yolo-dualdev/ | head -3
```

Expected for each: `HTTP/2 301` with `location: https://themagicianscode.dev/<corresponding-path>`.

- [ ] **Step 7: Run Lighthouse against the live site**

Open Chrome DevTools → Lighthouse → analyse `https://themagicianscode.dev/`.

Expected: Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95. Investigate any score below 95 before declaring done.

- [ ] **Step 8: Final spec checklist sign-off**

Walk through the testing checklist in [docs/superpowers/specs/2026-05-07-astro-migration-design.md](../specs/2026-05-07-astro-migration-design.md#testing-checklist). Tick each item against the live site.

If everything passes, the migration is complete.

---

## Rollback procedure (if production deploy fails badly)

If the live site is broken after Task 22 and a quick fix isn't obvious:

1. In GitHub Pages settings, switch Source back to "Deploy from a branch" → `master` / root.
2. Revert the master branch to the commit before Task 1 (`git log --oneline` to find it):

   ```bash
   git revert <range-of-migration-commits>
   git push origin master
   ```

   The legacy `index.html` will be restored at the user-site root, serving the old portfolio.
3. Remove the Cloudflare CNAME (or repoint to whatever the previous setup used).
4. Investigate the failure offline before re-attempting.

The brief offline window is acceptable; the legacy portfolio has been the production site for years.
