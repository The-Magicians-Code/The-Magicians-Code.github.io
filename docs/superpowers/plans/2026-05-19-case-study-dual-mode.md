# Case Study Dual-Mode (TL;DR ↔ Detailed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pill toggle inside the expanded bento card modal that swaps between TL;DR and Detailed reading modes of a case study, persisted across cards within a session, with a `> blockquote` Markdown authoring convention and the first real case study (Organic Flow) drafted to the new shape.

**Architecture:** Each case study `.md` file uses `## H2` per section with a leading blockquote as the TL;DR and the rest as Detail. Mode is gated by CSS sibling-combinators on a `data-mode` attribute set on the dynamically-mounted `.bento-card-body-rendered` wrap. A small pill toggle is mounted by `bento-expand.ts` as a sibling preceding that wrap; clicks cross-fade the wrap and write the new mode to `sessionStorage`. A `deepwikiUrl` frontmatter field surfaces a "For the nerds →" footer link visible only in Detailed mode.

**Tech Stack:** Astro v6 (default Markdown pipeline, no plugins), TypeScript, plain CSS in `<style is:global>` blocks, vanilla DOM APIs.

**Spec:** See [docs/superpowers/specs/2026-05-19-case-study-dual-mode-design.md](../specs/2026-05-19-case-study-dual-mode-design.md).

**Verification model:** This project has no automated test suite (per [CLAUDE.md](../../../CLAUDE.md)). Each task verifies via `npm run check` (TypeScript + Astro diagnostics) and an explicit manual browser walkthrough using `npm run dev`. "Verify" steps below specify exactly what to click and what to look for.

---

### Task 1: Add `deepwikiUrl` to projects schema

**Files:**
- Modify: `src/content.config.ts` (lines around the `projects` collection schema)

- [ ] **Step 1: Update the projects schema to accept an optional `deepwikiUrl` URL field**

Edit [src/content.config.ts](../../../src/content.config.ts). Add `deepwikiUrl` as the last field of the `projects` schema:

```ts
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    repoUrl: z.url(),
    order: z.number().int(),
    draft: z.boolean().default(false),
    bentoSpan: z.enum(['hero', 'wide', 'tall', 'normal']).default('normal'),
    coverVariant: z.enum(['base', 'alt']).default('base'),
    deepwikiUrl: z.url().optional(),
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

- [ ] **Step 2: Verify Astro accepts the new schema field**

Run: `npm run check`
Expected: `0 errors`. Any prior warnings about existing files persist; no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/content.config.ts
git commit -m "$(cat <<'EOF'
Add optional deepwikiUrl field to projects content schema

Surfaces the project's DeepWiki link to the case-study renderer so a
"For the nerds → architecture wiki" footer can appear in Detailed
mode. Optional — projects without a wiki render no footer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Author the Organic Flow case study using the new convention

**Files:**
- Create: `src/content/projects/organic-flow.md`

- [ ] **Step 1: Write the case study using `## H2 + leading blockquote + detail` convention**

Create [src/content/projects/organic-flow.md](../../../src/content/projects/organic-flow.md):

```markdown
---
title: Organic Flow
description: A Polish Brazilian Zouk dance school's WordPress + WooCommerce site, rebuilt as a custom edge-native commerce stack — lighter on the wire, easier to operate, deeper in abuse controls.
repoUrl: https://github.com/The-Magicians-Code/organic-flow
deepwikiUrl: https://deepwiki.com/The-Magicians-Code/organic-flow
order: 3
bentoSpan: wide
coverVariant: alt
draft: false
---

## Context

> Organic Flow is a Polish dance school running Brazilian Zouk classes, weekend retreats around Poland, and occasional ski trips abroad — previously selling registrations through WordPress + WooCommerce.

Organic Flow organises Brazilian Zouk dance classes — regular weekly sessions, weekend retreats around Poland, and the occasional ski trip abroad. Booking and payment ran through a WordPress 6.7.1 install with WooCommerce 9.4.3 and a GTranslate plugin for Polish/English copy. The stack worked — registrations happened — but the operating model leaked into everything: each plugin needed patching, theme updates risked layout regressions, abuse defense leaned on whatever plugin du jour, and a single copy change went through a CMS the brand owner didn't fully trust. The rebuild brief was simple: keep the booking flow, keep the brand voice, but trade the WordPress sandwich for something the brand owner could run alone.

## The problem

> The WordPress + WooCommerce sandwich shipped 5× more HTML per page, fanned out across 13 separate asset files, and locked the brand into a plugin maintenance loop just to keep the standard stack standing.

The old homepage rendered as 121 KB of HTML — most of it WooCommerce theme markup the visitor never saw — pulling in eight JavaScript files and five stylesheets before the cart even rendered. Beyond raw weight, the WordPress operating model leaked into everything around it: each plugin needed patching, theme updates risked layout regressions, the abuse-defense story changed whenever a security plugin was deprecated, and the editorial workflow ran through a CMS the brand owner didn't fully trust. The architectural cost was high too — i18n, payment, captcha, rate limiting, transactional email, and admin auth were each a separate plugin surface with its own update cycle and failure mode. None of the plugins were *wrong*. They just compounded into a maintenance loop nobody wanted to be inside.

## The approach

> Traded the WP plugin sandwich for a tight custom stack: Astro SSR on Cloudflare Workers, Supabase for everything stateful, Przelewy24 + bank transfer for payment, Resend for email, layered Cloudflare primitives for abuse defense.

The new stack is deliberately small. **Astro SSR on Cloudflare Workers** renders pages at the edge — Workers runtime, not Pages — with partial hydration meaning the default response ships almost no JavaScript. **Supabase** holds everything stateful: product catalog (including admin-edited markdown bodies), cover images via Storage, auth via SSR session cookies. **Payments** run through Przelewy24 (Poland's standard gateway) with a manual bank-transfer fallback for customers who prefer it — that fallback is a real reservation, expired by a second cron Worker after seven days. **Abuse defense** is layered: Cloudflare Turnstile on auth/cart, Rate Limit bindings on the same endpoints, CSRF double-submit tokens on every POST, signed Przelewy24 webhook verification, and admin pages return 404 (not 403) to non-admins so they leave no trace. **Outbound email** runs through Resend on a separate billing subdomain. **Order state** mirrors to a Google Sheet on every change, so the organiser can read the ledger without logging in. The brand owner edits products through a custom `/admin` web form; changes reflect on the public site within ~60 seconds without a redeploy.

What got chosen against: keeping WooCommerce (too much surface area for too little signal), Next.js (heavier default JS bundle, more runtime to ship at the edge), Stripe (Polish customers expect Przelewy24 by default).

## The results

> 5× smaller HTML on the wire, sub-500ms TTFB, content edits live in ~60 seconds, and abuse defense built from Cloudflare primitives that don't need update cycles.

The homepage HTML dropped from 121 KB to 25.4 KB — a 5× reduction on the wire — with TTFB sub-500ms from a cold connection. JavaScript ships only where there's an island that needs it (registration wizard, Turnstile widget, cart badge); everything else is server-rendered HTML the browser can use immediately. The admin workflow is the quieter win: product copy, prices, cover images, and active/inactive state are now self-serve, with changes visible to a logged-out visitor within ~60 seconds — no developer involved. Abuse defense moved from "whichever plugin we trust this month" to layered Cloudflare primitives (Turnstile + Rate Limits + CSRF + signed webhooks) that don't require update cycles. Per-PR Cloudflare preview URLs catch layout regressions before merge; the cron Worker quietly cleans up stale orders every five minutes without supervision.
```

- [ ] **Step 2: Verify content collection picks it up**

Run: `npm run check`
Expected: `0 errors`. No frontmatter validation errors on the new file.

- [ ] **Step 3: Verify it renders in the modal**

Run: `npm run dev`
Open: http://localhost:4321/
Action: Click the Organic Flow bento card to expand. Modal opens.
Expected: The card body now shows the full Markdown rendered — H2 headings ("Context", "The problem", "The approach", "The results"), each followed by a blockquote (rendered as default Astro blockquote — vertical bar on the left) and paragraphs of detail.
Note: At this point everything renders as Detailed mode (no toggle yet). That's expected.

- [ ] **Step 4: Commit**

```bash
git add src/content/projects/organic-flow.md
git commit -m "$(cat <<'EOF'
Add Organic Flow case study draft

First real case study using the dual-mode authoring convention from
the design spec: ## H2 per T2 section (Context / Problem / Approach /
Results), a leading blockquote as the TL;DR, detail prose below.
deepwikiUrl frontmatter set so the upcoming Detailed-mode footer
surfaces the DeepWiki escape hatch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: CSS mode gating on `.bento-card-body-rendered`

**Files:**
- Modify: `src/components/BentoGrid.astro` (the `<style>` block — locate the `.bento-card .bento-card-body-rendered` rule and add the dual-mode rules nearby)

- [ ] **Step 1: Add mode-gating CSS rules**

In [src/components/BentoGrid.astro](../../../src/components/BentoGrid.astro), locate the `:global(.bento-card .bento-card-body-rendered)` rule (around line 441). Immediately after it, add the dual-mode block:

```css
  /* ── Dual-mode reading (TL;DR ↔ Detailed) ─────────────────────
     The rendered case-study wrap carries data-mode="tldr|detailed".
     Authoring convention: each ## H2 section is followed by a single
     leading blockquote (the TL;DR) and zero or more sibling elements
     (the Detail). In TL;DR mode we hide everything that follows the
     leading blockquote until the next H2. In Detailed mode the
     leading blockquote is styled as an italic lede above the detail
     prose. See docs/superpowers/specs/2026-05-19-case-study-dual-
     mode-design.md. */
  :global(.bento-card-body-rendered) {
    transition: opacity 160ms ease-out;
  }
  :global(.bento-card-body-rendered.is-swapping) {
    opacity: 0;
  }
  /* Hide everything that follows the section-leading blockquote in TL;DR
     mode. The next H2 reopens its own section's leading blockquote
     because the selector is scoped by the blockquote's sibling chain. */
  :global(.bento-card-body-rendered[data-mode="tldr"] h2 + blockquote ~ *) {
    display: none;
  }
  /* Style the section-leading blockquote as an italic lede in Detailed
     mode so it reads as the section's nut graph rather than a generic
     quotation. */
  :global(.bento-card-body-rendered[data-mode="detailed"] h2 + blockquote) {
    border-left: 2px solid var(--ink-3);
    padding: 2px 0 2px 14px;
    margin: 0 0 14px;
    font-style: italic;
    color: var(--ink-dim);
    font-size: 15px;
    line-height: 1.55;
  }
  /* In TL;DR mode, the leading blockquote IS the content for the
     section — drop the indent + bar styling so it reads as a normal
     paragraph under the heading. */
  :global(.bento-card-body-rendered[data-mode="tldr"] h2 + blockquote) {
    border-left: none;
    padding: 0;
    margin: 0 0 14px;
    font-style: normal;
    color: var(--ink);
    font-size: 15px;
    line-height: 1.55;
  }
```

- [ ] **Step 2: Apply default `data-mode="tldr"` to the rendered wrap at creation**

In [src/scripts/bento-expand.ts](../../../src/scripts/bento-expand.ts), locate the block where `.bento-card-body-rendered` is created (search for `'bento-card-body-rendered'`). It looks like:

```ts
const wrap = document.createElement('div');
wrap.className = 'bento-card-body-rendered';
```

Immediately after the `wrap.className = ...` line, add:

```ts
wrap.dataset.mode = 'tldr';
```

(Note: we'll override this in Task 4 with the persisted session mode. For now `tldr` is the hardcoded default so we can verify the CSS gating before persistence lands.)

- [ ] **Step 3: Verify mode gating works manually**

Run: `npm run check` → Expected: `0 errors`
Run: `npm run dev`
Open: http://localhost:4321/
Action 1: Click the Organic Flow bento card. Modal opens.
Expected: Each section ("Context", "The problem", etc.) shows only its H2 heading and a single short paragraph (the TL;DR — the previous leading blockquote, now styled as plain prose). The detail paragraphs are hidden.

Action 2: Open browser DevTools, find `.bento-card-body-rendered`, change its `data-mode` attribute from `"tldr"` to `"detailed"`.
Expected: Each section now shows the H2, the leading blockquote styled as an italic muted-color lede with a left border, and the full detail paragraphs below.

- [ ] **Step 4: Commit**

```bash
git add src/components/BentoGrid.astro src/scripts/bento-expand.ts
git commit -m "$(cat <<'EOF'
Add CSS mode gating for case-study dual-mode rendering

The .bento-card-body-rendered wrap now carries data-mode="tldr" by
default (set in bento-expand.ts at wrap creation). CSS sibling
combinators in BentoGrid.astro toggle each ## section's content:
TL;DR mode shows only the leading blockquote per section as plain
prose; Detailed mode renders the same blockquote as an italic lede
plus the full detail body below. Opacity transition primed for the
cross-fade animation lands in a later task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Pill toggle UI + sessionStorage persistence + cross-fade

**Files:**
- Create: `src/scripts/case-study-mode.ts`
- Modify: `src/scripts/bento-expand.ts`
- Modify: `src/components/BentoGrid.astro` (styles for the toggle)

- [ ] **Step 1: Create the mode helper module**

Create [src/scripts/case-study-mode.ts](../../../src/scripts/case-study-mode.ts):

```ts
// Reading-mode toggle (TL;DR ↔ Detailed) for the expanded bento card modal.
// Mounted by bento-expand.ts; persists choice in sessionStorage so a reader
// who opts into Detailed on one card sees Detailed on the next card opened
// in the same visit. See docs/superpowers/specs/2026-05-19-case-study-dual-
// mode-design.md.

export type CaseStudyMode = 'tldr' | 'detailed';

const SS_KEY = 'cs-mode';
const SWAP_OUT_MS = 160; // matches BentoGrid.astro .is-swapping opacity transition

export function readMode(): CaseStudyMode {
  try {
    const stored = sessionStorage.getItem(SS_KEY);
    if (stored === 'tldr' || stored === 'detailed') return stored;
  } catch {
    /* sessionStorage may be unavailable (private-mode in some browsers) */
  }
  return 'tldr';
}

export function writeMode(mode: CaseStudyMode): void {
  try {
    sessionStorage.setItem(SS_KEY, mode);
  } catch {
    /* ignore — best-effort persistence */
  }
}

export function applyMode(wrap: HTMLElement, mode: CaseStudyMode): void {
  wrap.dataset.mode = mode;
}

// Build the pill toggle DOM. Returns the root element; the caller is
// responsible for appending it to the modal body before the rendered wrap.
// Updates the wrap's data-mode (with cross-fade) on click and writes the
// new mode to sessionStorage.
export function buildPillToggle(wrap: HTMLElement, initialMode: CaseStudyMode): HTMLElement {
  const root = document.createElement('div');
  root.className = 'cs-mode-toggle';
  root.setAttribute('role', 'tablist');
  root.setAttribute('aria-label', 'Reading mode');

  const makeTab = (mode: CaseStudyMode, label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.mode = mode;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(mode === initialMode));
    btn.tabIndex = mode === initialMode ? 0 : -1;
    btn.textContent = label;
    return btn;
  };

  const tldrBtn = makeTab('tldr', 'TL;DR');
  const detailBtn = makeTab('detailed', 'Detailed');
  root.appendChild(tldrBtn);
  root.appendChild(detailBtn);

  const setActive = (next: CaseStudyMode): void => {
    if (wrap.dataset.mode === next) return;
    wrap.classList.add('is-swapping');
    window.setTimeout(() => {
      applyMode(wrap, next);
      writeMode(next);
      [tldrBtn, detailBtn].forEach((b) => {
        const isActive = b.dataset.mode === next;
        b.setAttribute('aria-selected', String(isActive));
        b.tabIndex = isActive ? 0 : -1;
      });
      // Trigger fade-in on the next frame so the browser commits the
      // data-mode swap before the opacity transition kicks back in.
      requestAnimationFrame(() => wrap.classList.remove('is-swapping'));
    }, SWAP_OUT_MS);
  };

  tldrBtn.addEventListener('click', () => setActive('tldr'));
  detailBtn.addEventListener('click', () => setActive('detailed'));

  // Keyboard: Left/Right arrows move focus + activate (standard ARIA
  // tablist pattern: roving tabindex).
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: CaseStudyMode = wrap.dataset.mode === 'tldr' ? 'detailed' : 'tldr';
    setActive(next);
    (next === 'tldr' ? tldrBtn : detailBtn).focus();
  });

  return root;
}
```

- [ ] **Step 2: Mount the pill toggle from bento-expand.ts**

In [src/scripts/bento-expand.ts](../../../src/scripts/bento-expand.ts):

(a) At the top of the file, add this import alongside the existing imports:

```ts
import { readMode, applyMode, buildPillToggle } from './case-study-mode';
```

(b) In the block where the rendered wrap is created (the place edited in Task 3), replace:

```ts
const wrap = document.createElement('div');
wrap.className = 'bento-card-body-rendered';
wrap.dataset.mode = 'tldr';
```

with:

```ts
const wrap = document.createElement('div');
wrap.className = 'bento-card-body-rendered';
const initialMode = readMode();
applyMode(wrap, initialMode);
```

(c) Right after the loop that clones the source children into the wrap, but before `body.appendChild(wrap)`, insert the pill toggle as a sibling preceding the wrap:

```ts
const pillToggle = buildPillToggle(wrap, initialMode);
body.appendChild(pillToggle);
```

(d) The existing `body.appendChild(wrap)` stays where it is — it now appends the wrap after the pill toggle.

(e) In the close lifecycle, ensure the pill toggle is removed when the modal closes. Locate the `doCleanup` function and add the pill removal alongside the existing wrap/closeBtn/blur removals. Find the line:

```ts
if (appendedBodyWrap) appendedBodyWrap.remove();
```

It needs to also remove the pill toggle. The simplest path: also track the pillToggle in `openState` and remove it in cleanup. Add `pillToggle` to the `OpenState` interface, store it when the wrap is built, and `pillToggle.remove()` in cleanup. Concretely:

In the `OpenState` interface near the top of the file, add the field:

```ts
interface OpenState {
  card: HTMLElement;
  placeholder: HTMLElement;
  closeBtn: HTMLButtonElement;
  backdrop: HTMLElement;
  blurTop: HTMLElement;
  blurBottom: HTMLElement;
  originalInline: string;
  appendedBodyWrap: HTMLElement | null;
  pillToggle: HTMLElement | null;
  closing: boolean;
}
```

In `openCaseStudy`, after `openState = { ... }` (the initial state assignment), the `pillToggle` is created later when the body content mounts. Update the rendered-body setTimeout block where `appendedBodyWrap` is stored on state — also store the pill toggle there:

```ts
openState.appendedBodyWrap = wrap;
openState.pillToggle = pillToggle;
```

In `closeCaseStudy`'s `doCleanup`, alongside `if (appendedBodyWrap) appendedBodyWrap.remove();` add:

```ts
if (state.pillToggle) state.pillToggle.remove();
```

And ensure `pillToggle: null` is added to the initial `openState` object literal.

- [ ] **Step 3: Style the pill toggle**

In [src/components/BentoGrid.astro](../../../src/components/BentoGrid.astro), add this rule block immediately after the dual-mode rules added in Task 3:

```css
  /* ── Reading-mode pill toggle ─────────────────────────────────
     Mounted by bento-expand.ts as a sibling preceding the rendered
     wrap, only visible while a card is .is-expanded. Reuses the
     existing pill aesthetic: translucent ink-toned background,
     paper-toned active segment. */
  :global(.cs-mode-toggle) {
    display: flex;
    justify-content: center;
    gap: 0;
    margin: 0 auto 18px;
    width: fit-content;
    background: rgba(26, 26, 28, 0.06);
    border-radius: 999px;
    padding: 4px;
  }
  :global(.cs-mode-toggle button) {
    background: transparent;
    border: 0;
    color: var(--ink-dim);
    font: 500 12.5px/1 var(--font-sans, -apple-system, system-ui, sans-serif);
    padding: 7px 16px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 200ms ease, color 200ms ease;
  }
  :global(.cs-mode-toggle button:hover) {
    color: var(--ink);
  }
  :global(.cs-mode-toggle button[aria-selected="true"]) {
    background: var(--paper);
    color: var(--ink);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
```

- [ ] **Step 4: Verify the toggle**

Run: `npm run check` → Expected: `0 errors`
Run: `npm run dev`
Open: http://localhost:4321/

Action 1 (default mode): Click the Organic Flow card. Modal opens.
Expected: A centered pill at the top of the modal body, "TL;DR" highlighted, "Detailed" muted. Below it, each section shows only the H2 + summary paragraph (no detail prose).

Action 2 (toggle to Detailed): Click "Detailed".
Expected: Brief ~320ms cross-fade. After the fade, the body now shows each H2, an italic muted-color lede (the former blockquote, restyled), and the full detail paragraphs below.

Action 3 (close + reopen): Click the close button. Card collapses.
Action 4: Click any project card (Organic Flow or another).
Expected: It opens directly in Detailed mode (mode persisted via `sessionStorage` for the session).

Action 5 (keyboard): Focus a pill button. Press ArrowLeft / ArrowRight.
Expected: The other tab activates, focus moves to it.

Action 6 (new tab): Open the site in a new browser tab. Click any card.
Expected: Opens in TL;DR (sessionStorage is per-tab).

- [ ] **Step 5: Commit**

```bash
git add src/scripts/case-study-mode.ts src/scripts/bento-expand.ts src/components/BentoGrid.astro
git commit -m "$(cat <<'EOF'
Mount case-study reading-mode pill toggle in expanded card modal

New helper module case-study-mode.ts owns sessionStorage persistence,
pill-toggle DOM construction, ARIA tablist semantics, and cross-fade
mode swap. bento-expand.ts mounts the toggle as a sibling preceding
the rendered wrap during card open, applies the persisted mode on
first paint, and tears down the toggle alongside the close button
and blur strips on close.

Mode defaults to TL;DR for first-time visitors and persists across
cards within a browser session (sessionStorage scope, deliberately
not localStorage). Cross-fade is opacity 160ms out + 160ms in on the
rendered wrap so the section content swaps without layout jank;
the pill itself sits outside the wrap and stays sharp during the
swap.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: "For the nerds" DeepWiki footer in Detailed mode

**Files:**
- Modify: `src/scripts/bento-expand.ts` (append footer link when `deepwikiUrl` exists)
- Modify: `src/components/BentoGrid.astro` (footer styling + mode-gated visibility)

- [ ] **Step 1: Read deepwikiUrl from the card and append the footer**

The bento card markup stores arbitrary frontmatter fields on the card element via Astro's project rendering. Inspect [src/components/BentoCard.astro](../../../src/components/BentoCard.astro) and confirm whether `deepwikiUrl` already flows through to a `data-*` attribute. If it doesn't, add it now:

In [src/components/BentoCard.astro](../../../src/components/BentoCard.astro), locate where the bento card's wrapper element is rendered (search for `data-bento-card`). Add a `data-deepwiki-url` attribute that uses the frontmatter field when present:

```astro
---
// ...existing prop reads...
const { entry } = Astro.props;
const data = entry.data;
---
<article
  data-bento-card
  data-slug={entry.slug}
  data-deepwiki-url={data.deepwikiUrl ?? undefined}
  {/* ...existing attributes... */}
>
  {/* ...existing content... */}
</article>
```

(If `BentoCard.astro` already passes the entry data via props with a different shape, adapt this step to its existing pattern — the goal is `card.dataset.deepwikiUrl` being accessible from `bento-expand.ts`.)

In [src/scripts/bento-expand.ts](../../../src/scripts/bento-expand.ts), inside the setTimeout block that mounts the rendered wrap (after the loop that clones source children, after the `body.appendChild(pillToggle)` and before/after `body.appendChild(wrap)`), append a footer when the card has a `deepwikiUrl`:

```ts
const deepwikiUrl = card.dataset.deepwikiUrl;
if (deepwikiUrl) {
  const footer = document.createElement('p');
  footer.className = 'cs-nerds-footer';
  const link = document.createElement('a');
  link.href = deepwikiUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'For the nerds — full architecture wiki →';
  footer.appendChild(link);
  wrap.appendChild(footer);
}
```

(The footer is appended INSIDE the rendered wrap so it's affected by `data-mode` gating, but its visibility is restricted to Detailed mode via CSS — see Step 2.)

- [ ] **Step 2: Style the footer + restrict to Detailed mode**

In [src/components/BentoGrid.astro](../../../src/components/BentoGrid.astro), add this rule block after the pill-toggle styles from Task 4:

```css
  /* ── "For the nerds" footer ──────────────────────────────────
     Surfaces only in Detailed mode when frontmatter.deepwikiUrl is
     set. Hidden in TL;DR mode by the existing
     `[data-mode="tldr"] h2 + blockquote ~ *` rule (the footer is a
     sibling that follows the last section's blockquote — so it
     naturally hides). Explicit selector below also hides it in case
     the footer ever lands before any blockquote (e.g. a case study
     with no sections — defensive). */
  :global(.bento-card-body-rendered .cs-nerds-footer) {
    margin: 32px 0 0;
    text-align: right;
    font-size: 13px;
    color: var(--ink-dim);
  }
  :global(.bento-card-body-rendered[data-mode="tldr"] .cs-nerds-footer) {
    display: none;
  }
  :global(.bento-card-body-rendered .cs-nerds-footer a) {
    color: var(--ink-dim);
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-color: rgba(26, 26, 28, 0.25);
    transition: color 200ms ease;
  }
  :global(.bento-card-body-rendered .cs-nerds-footer a:hover) {
    color: var(--ink);
  }
```

- [ ] **Step 3: Verify the footer surfaces only in Detailed mode**

Run: `npm run check` → Expected: `0 errors`
Run: `npm run dev`
Open: http://localhost:4321/

Action 1: Click Organic Flow. Toggle to Detailed.
Expected: Scroll to the bottom of the modal body. A right-aligned muted text "For the nerds — full architecture wiki →" appears as a link. Clicking it opens https://deepwiki.com/The-Magicians-Code/organic-flow in a new tab.

Action 2: Toggle back to TL;DR.
Expected: The footer is hidden along with all other detail content.

Action 3: Open a card without `deepwikiUrl` set (Strato_Pi or Yolo-dualdev — they still have stub content but no deepwikiUrl).
Expected: No footer in either mode.

- [ ] **Step 4: Commit**

```bash
git add src/components/BentoCard.astro src/scripts/bento-expand.ts src/components/BentoGrid.astro
git commit -m "$(cat <<'EOF'
Add "For the nerds" DeepWiki footer in Detailed mode

When a project's frontmatter includes deepwikiUrl, bento-expand.ts
appends a small right-aligned footer link to the rendered wrap on
open. The footer is gated to Detailed mode by the existing CSS
sibling rule plus a defensive explicit rule. Style reuses the muted
--ink-dim tone so it reads as an escape hatch for the rare reader
who wants more than even Detailed gives, not as a CTA.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Build-time content validation

**Files:**
- Create: `scripts/check-content.mjs`
- Modify: `package.json` (add `check:content` script; wire into `check`)

- [ ] **Step 1: Write the validation script**

Create [scripts/check-content.mjs](../../../scripts/check-content.mjs):

```javascript
#!/usr/bin/env node
// Walks src/content/projects/*.md and warns when a case-study section
// (## H2) is missing its leading blockquote (the TL;DR). Warnings only —
// missing summaries don't block the build. See
// docs/superpowers/specs/2026-05-19-case-study-dual-mode-design.md.

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PROJECTS_DIR = join(ROOT, 'src', 'content', 'projects');

function stripFrontmatter(text) {
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---\n', 4);
  return end === -1 ? text : text.slice(end + 5);
}

function checkBody(body) {
  // Split on lines, walk linearly. For each `## ` heading, peek forward
  // skipping blank lines and confirm the next non-blank line starts with
  // `> ` (a blockquote). Anything else → missing TL;DR.
  const lines = body.split('\n');
  const warnings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('## ')) continue;
    const heading = line.slice(3).trim();
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j >= lines.length || !lines[j].startsWith('> ')) {
      warnings.push(heading);
    }
  }
  return warnings;
}

let total = 0;
for (const file of readdirSync(PROJECTS_DIR)) {
  if (!file.endsWith('.md')) continue;
  const full = join(PROJECTS_DIR, file);
  const text = readFileSync(full, 'utf8');
  const body = stripFrontmatter(text);
  const warnings = checkBody(body);
  if (warnings.length === 0) continue;
  console.warn(`⚠  ${basename(file)} — sections missing a leading blockquote (TL;DR):`);
  for (const h of warnings) console.warn(`     - "${h}"`);
  total += warnings.length;
}

if (total === 0) {
  console.log('✓  content-check: all project sections have a leading blockquote.');
} else {
  console.warn(`\n  ${total} section(s) flagged. Warnings only — build is not blocked.`);
}
process.exit(0);
```

- [ ] **Step 2: Wire the script into npm**

Edit `package.json` and add a `check:content` script. Update the `check` script to run it after Astro check:

```json
{
  "scripts": {
    "dev": "astro dev",
    "dev:lan": "astro dev --host",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "check": "astro check && npm run check:content",
    "check:content": "node scripts/check-content.mjs"
  }
}
```

- [ ] **Step 3: Verify the script runs and is silent on a complete file**

Run: `npm run check:content`
Expected: A single line: `✓  content-check: all project sections have a leading blockquote.`

(The Strato_Pi and Yolo-dualdev stub files have no `## ` headings, so they don't trigger warnings. Once they get rewritten to the new convention with sections that are missing blockquotes, this script will start warning — that's the point.)

- [ ] **Step 4: Verify it correctly warns on a missing blockquote**

Quick smoke test — temporarily remove the leading blockquote from one section of `src/content/projects/organic-flow.md`, run the script, see the warning, then restore:

```bash
# Temporarily mutate
cp src/content/projects/organic-flow.md /tmp/organic-flow.md.bak
sed -i.tmp '/^> Organic Flow is a Polish dance school/d' src/content/projects/organic-flow.md
npm run check:content
# Restore
mv /tmp/organic-flow.md.bak src/content/projects/organic-flow.md
rm -f src/content/projects/organic-flow.md.tmp
```

Expected during the mutated run:
```
⚠  organic-flow.md — sections missing a leading blockquote (TL;DR):
     - "Context"

  1 section(s) flagged. Warnings only — build is not blocked.
```

After restore, run `npm run check:content` again and confirm it returns to the silent `✓` state.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-content.mjs package.json
git commit -m "$(cat <<'EOF'
Add content-validation script for case-study TL;DR convention

scripts/check-content.mjs walks src/content/projects/*.md and warns
(does not error) when a ## section is missing a leading blockquote.
Wired into npm run check via a new check:content script so the
existing `npm run check` runs Astro diagnostics then content
validation. Missing summaries don't block the build — they surface
as actionable warnings during the existing check workflow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Acceptance walkthrough + push

**Files:** None modified. Verification only.

- [ ] **Step 1: Confirm every acceptance criterion from the spec**

Spec acceptance criteria (from [docs/superpowers/specs/2026-05-19-case-study-dual-mode-design.md](../specs/2026-05-19-case-study-dual-mode-design.md)):

Run: `npm run dev`
Open: http://localhost:4321/ in a **fresh tab** (so sessionStorage is empty).

For each criterion below, perform the action and note pass/fail. If any fails, debug and re-run the affected task's steps before proceeding to push.

| # | Criterion | Action | Expected |
|---|-----------|--------|----------|
| 1 | Toggle renders + both modes work | Click Organic Flow card | Modal opens with pill toggle, TL;DR active, summary-only sections visible |
| 2 | Default mode on first session open is TL;DR | (above) | TL;DR pill is highlighted |
| 3 | Toggling persists across cards in session | Toggle to Detailed → close → open Strato_Pi card | Strato_Pi opens in Detailed (stub content, but pill state and data-mode confirm) |
| 4 | Closing and re-opening preserves the active mode | Close Strato_Pi → reopen Organic Flow | Organic Flow opens in Detailed |
| 5 | New tab opens in TL;DR | Open site in new browser tab | TL;DR is active |
| 6 | `deepwikiUrl` surfaces footer link in Detailed only | In Detailed mode on Organic Flow, scroll to bottom | "For the nerds — full architecture wiki →" link visible. Toggle to TL;DR → link hidden |
| 7 | Missing summary callout warns at `npm run check` | (covered by Task 6 mutated run, no need to repeat) | ✓ already verified |
| 8 | Keyboard ArrowLeft/Right cycles tabs | Focus a pill button, press arrow keys | Other tab activates + focuses |
| 9 | Cross-fade is ~320ms, no layout shift outside modal | Toggle modes a few times | Body content fades; pill toggle stays sharp; modal card's outer geometry doesn't shift |

- [ ] **Step 2: Run full build to confirm production parity**

Run: `npm run build`
Expected: Build completes with `0 errors`. The `dist/` output contains the organic-flow case study under the project's static route.
Run: `npm run preview`
Open: http://localhost:4321/ (preview port)
Action: Re-run criterion 1 above against the production build.
Expected: Identical behavior to dev.

- [ ] **Step 3: Push the feature branch**

Run:

```bash
git log --oneline -10
```

Expected: The six task commits (Tasks 1–6) plus the existing main-branch history. Confirm with the user before pushing.

```bash
git push
```

Expected: Push succeeds to the existing remote tracking branch (`origin/editorial-redesign`).

---

## Summary of files touched

**Created:**
- `src/content/projects/organic-flow.md` — first real case study
- `src/scripts/case-study-mode.ts` — mode persistence + pill toggle DOM
- `scripts/check-content.mjs` — content validation

**Modified:**
- `src/content.config.ts` — `deepwikiUrl` schema field
- `src/components/BentoCard.astro` — surfaces `data-deepwiki-url` to the card element
- `src/components/BentoGrid.astro` — CSS for mode gating, pill toggle, nerds footer
- `src/scripts/bento-expand.ts` — mounts pill toggle + footer on open, applies persisted mode, cleans up on close
- `package.json` — `check:content` npm script wired into `check`

## Self-Review

**Spec coverage:**
- Goal — covered by Tasks 1–5
- Authoring contract (## H2 + leading blockquote + detail) — Task 2
- Schema (`deepwikiUrl`) — Task 1
- Rendering: CSS sibling-combinator gating on `data-mode` — Task 3
- Pill toggle (placement, default mode, ARIA tablist, sessionStorage) — Task 4
- Cross-fade animation (160ms × 2) — Task 4 Step 1 (`is-swapping` + the existing `.bento-card-body-rendered` opacity transition added in Task 3)
- "For the nerds" footer — Task 5
- Validation — Task 6
- Acceptance criteria — Task 7

All spec sections are covered. No gaps.

**Placeholder scan:** No TBDs, no "implement later", no abstract "handle edge cases" prompts. All code blocks are concrete.

**Type consistency:** `CaseStudyMode` type is defined once in `case-study-mode.ts` and used consistently. `OpenState.pillToggle` added with matching usage in cleanup. Function signatures (`readMode`, `writeMode`, `applyMode`, `buildPillToggle`) all match across creation and consumer sites.
