# Project Codenames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each project a single-word codename that becomes its collapsed bento-card display name, demoting the descriptive title to a sub-line shown only inside the case study (expanded modal + detail page).

**Architecture:** Add a required `codename` string to the `projects` content schema and to the three project frontmatters. Update the three rendering surfaces (homepage bento card, `/projects/[slug]` detail page, `/projects/` index card) so the codename leads and the descriptive title becomes a secondary sub-line revealed with the case-study content. No project markdown bodies change.

**Tech Stack:** Astro 5 content collections (Zod schema), `.astro` components, scoped + `:global()` CSS in `BentoGrid.astro`, existing `src/lib/title.ts` helpers (`titleToHtml`, `titleToText`).

## Global Constraints

- No automated test suite exists. Per-task verification is `npm run check` (TypeScript + Astro diagnostics — the only static gate) followed by `npm run build`, plus manual browser checks. Never claim "tests pass" — say verification is check + build.
- Codenames are plain single words with no `*accent*` markers: `Heimdall` (yolo-dualdev), `Volta` (strato-pi), `Nagare` (organic-flow).
- `codename` is **required** in the schema (no default) — a missing codename must fail `npm run check`.
- Reuse `titleToHtml` / `titleToText` from `src/lib/title.ts`; do not add new title-parsing syntax.
- Browser `<title>`, OG tags, and repo-link `aria-label`s keep the **descriptive title** (SEO identity), not the codename.
- Follow the existing merge convention: feature branch → PR. Do not push to `main`.

---

### Task 1: Schema + frontmatter (data foundation)

**Files:**
- Modify: `src/content.config.ts` (projects schema)
- Modify: `src/content/projects/yolo-dualdev.md` (frontmatter)
- Modify: `src/content/projects/strato-pi.md` (frontmatter)
- Modify: `src/content/projects/organic-flow.md` (frontmatter)

**Interfaces:**
- Produces: `project.data.codename` (type `string`, required) on every entry of the `projects` collection. All later tasks consume this.

- [ ] **Step 1: Add the `codename` field to the schema**

In `src/content.config.ts`, inside the `projects` `z.object({ … })`, add `codename` immediately after `title`:

```ts
      title: z.string(),
      codename: z.string(),
      description: z.string(),
```

- [ ] **Step 2: Verify the schema change fails check (codenames not yet added)**

Run: `npm run check`
Expected: FAIL — Astro reports the three project entries are missing the required `codename` field. This confirms the field is required.

- [ ] **Step 3: Add `codename` to each frontmatter**

In `src/content/projects/yolo-dualdev.md`, add after the `title:` line:
```yaml
codename: Heimdall
```

In `src/content/projects/strato-pi.md`, add after the `title:` line:
```yaml
codename: Volta
```

In `src/content/projects/organic-flow.md`, add after the `title:` line:
```yaml
codename: Nagare
```

- [ ] **Step 4: Verify check passes**

Run: `npm run check`
Expected: PASS — no diagnostics. The collection now type-checks with all three codenames present.

- [ ] **Step 5: Commit**

```bash
git add src/content.config.ts src/content/projects/yolo-dualdev.md src/content/projects/strato-pi.md src/content/projects/organic-flow.md
git commit -m "feat(projects): add required codename field + Heimdall/Volta/Nagare"
```

---

### Task 2: Homepage bento card (resting face + expanded modal)

**Files:**
- Modify: `src/components/BentoCard.astro`
- Modify: `src/components/BentoProjectsSection.astro`
- Modify: `src/components/BentoGrid.astro` (styles)

**Interfaces:**
- Consumes: `project.data.codename` (string) from Task 1.
- Produces: a `.card-subtitle` element in the bento card DOM carrying the descriptive title, revealed only in the expanded modal.

- [ ] **Step 1: Add the `codename` prop to BentoCard**

In `src/components/BentoCard.astro`, add to the `Props` interface (after `title`):

```ts
interface Props {
  title: string;
  codename: string;
  eyebrow?: string;
```

And add it to the destructure:

```ts
const {
  title,
  codename,
  eyebrow,
```

- [ ] **Step 2: Render the codename on the resting face and modal title; add the subtitle**

In `src/components/BentoCard.astro`, change the `.cover-resttitle` span from the title to the codename:

```astro
  {cover && (
    <div class="cover-resttitle" aria-hidden="true">
      <span set:html={titleToHtml(codename)}></span>
    </div>
  )}
```

Change the `aria-label` on the `<article>` to lead with the codename:

```astro
  aria-label={`${titleToText(codename)} — ${titleToText(title)}`}
```

Change the `.card-body` block so `.card-title` shows the codename and a new `.card-subtitle` carries the descriptive title:

```astro
  <div class="card-body">
    {eyebrow && <div class="card-eyebrow">{eyebrow}</div>}
    <div class="card-title" set:html={titleToHtml(codename)}></div>
    <div class="card-subtitle" set:html={titleToHtml(title)}></div>
  </div>
```

- [ ] **Step 3: Pass `codename` from the section**

In `src/components/BentoProjectsSection.astro`, add the prop to `<BentoCard>` (after `title`):

```astro
      <BentoCard
        title={project.data.title}
        codename={project.data.codename}
        eyebrow="Case study"
```

- [ ] **Step 4: Add `.card-subtitle` to the has-cover reveal group in BentoGrid styles**

In `src/components/BentoGrid.astro`, add `.card-subtitle` alongside `.card-title` in each of these four `:global()` selector lists (base hide, `.is-content-in` reveal, `.is-closing-content` exit, `prefers-reduced-motion` reset). For each block that currently lists:

```css
  :global(.bento-card.has-cover .card-title),
```

add a sibling line right after it:

```css
  :global(.bento-card.has-cover .card-subtitle),
```

The four blocks to update begin at (approx.) these anchors in the file:
- base hide rule: the selector group ending `… .bento-card-body-rendered > *) { opacity: 0; … }`
- reveal rule: `:global(.bento-card.has-cover.is-content-in .card-title),`
- exit rule: `:global(.bento-card.has-cover.is-closing-content .card-title),`
- reduced-motion reset: inside `@media (prefers-reduced-motion: reduce)`, the group listing `.card-title`

- [ ] **Step 5: Add the `.card-subtitle` style block**

In `src/components/BentoGrid.astro`, immediately after the `.has-cover .card-title` modal rules (the block ending with the `em { font-style: normal }` normalization near the modal-title rules), add:

```css
  /* Descriptive title, demoted to a sub-line under the codename in the modal
     header. Sized to --modal-w like the other modal items so it doesn't reflow
     during the morph. Keeps its *accent* emphasis (unlike .card-title em). */
  :global(.bento-card.has-cover .card-subtitle) {
    width: var(--modal-w, 100%);
    max-width: none;
    text-align: center;
    align-self: auto;
    margin-top: 6px;
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: 1.0625rem;
    line-height: 1.3;
    letter-spacing: -0.005em;
    color: var(--ink-dim);
  }
  :global(.bento-card.has-cover .card-subtitle em) {
    font-style: italic;
    color: inherit;
  }
```

- [ ] **Step 6: Verify check + build**

Run: `npm run check && npm run build`
Expected: PASS — no TypeScript/Astro diagnostics; production build completes.

- [ ] **Step 7: Manual browser check**

Run: `npm run dev`, open `http://localhost:4321/`.
Expected:
- Each collapsed project card shows only its codename (Heimdall / Volta / Nagare) over the cover.
- Clicking a card expands it: the codename is the header, with the descriptive title as a smaller dimmed sub-line directly beneath it, both revealed as the content fades in.
- Closing the card fades the subtitle out with the rest of the content (no stranded sub-line).

- [ ] **Step 8: Commit**

```bash
git add src/components/BentoCard.astro src/components/BentoProjectsSection.astro src/components/BentoGrid.astro
git commit -m "feat(bento): codename on card face, descriptive title as modal sub-line"
```

---

### Task 3: Project detail page (`/projects/[slug]`)

**Files:**
- Modify: `src/pages/projects/[slug].astro`

**Interfaces:**
- Consumes: `project.data.codename` (string) from Task 1.

- [ ] **Step 1: Render the codename as H1 and add the descriptive-title sub-line**

In `src/pages/projects/[slug].astro`, the `<title>` and repo-link `aria-label` already use `titleText` (descriptive) — leave both unchanged. Change the header so the H1 shows the codename and a new `.project-subtitle` shows the descriptive title.

Replace:

```astro
      <h1 class="project-title" set:html={titleToHtml(project.data.title)}></h1>
      <p class="project-lede">{project.data.description}</p>
```

with:

```astro
      <h1 class="project-title" set:html={titleToHtml(project.data.codename)}></h1>
      <p class="project-subtitle" set:html={titleToHtml(project.data.title)}></p>
      <p class="project-lede">{project.data.description}</p>
```

- [ ] **Step 2: Add the `.project-subtitle` style**

In the `<style>` block of `src/pages/projects/[slug].astro`, add after the `.project-title` rule:

```css
  .project-subtitle {
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: clamp(1.25rem, 1vw + 1rem, 1.6rem);
    line-height: 1.2;
    letter-spacing: -0.01em;
    color: var(--ink-dim);
    margin: -6px 0 14px;
  }
```

- [ ] **Step 3: Verify check + build**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual browser check**

With `npm run dev` running, open `http://localhost:4321/projects/yolo-dualdev/` (and the other two slugs).
Expected: H1 shows the codename; the descriptive title sits directly beneath it as a dimmed sub-line; the lede/description and body follow. The browser tab still reads the descriptive title (e.g. "Vision pipeline for edge inference · Tanel Treuberg").

- [ ] **Step 5: Commit**

```bash
git add "src/pages/projects/[slug].astro"
git commit -m "feat(project-page): codename H1 + descriptive title sub-line"
```

---

### Task 4: Projects index (`/projects/`)

**Files:**
- Modify: `src/components/ProjectCard.astro`
- Modify: `src/pages/projects/index.astro`

**Interfaces:**
- Consumes: `project.data.codename` (string) from Task 1.

- [ ] **Step 1: Add the `codename` prop to ProjectCard and render it**

In `src/components/ProjectCard.astro`, add `codename` to the `Props` interface and destructure:

```ts
interface Props {
  title: string;
  codename: string;
  description: string;
  repoUrl: string;
  slug: string;
}
const { title, codename, description, repoUrl, slug } = Astro.props;
const titleText = titleToText(title);
```

Change the heading link to render the codename, and add a `.project-subtitle` sub-line before the description. The GitHub-link `aria-label` keeps `titleText` (descriptive) — leave it unchanged.

```astro
  <h3 class="project-title">
    <a href={`/projects/${slug}/`} set:html={titleToHtml(codename)}></a>
  </h3>
  <p class="project-subtitle" set:html={titleToHtml(title)}></p>
  <p class="project-desc">{description}</p>
```

- [ ] **Step 2: Add the `.project-subtitle` style**

In the `<style>` block of `src/components/ProjectCard.astro`, add after the `.project-title a:hover` rule:

```css
  .project-subtitle {
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: 1rem;
    line-height: 1.3;
    letter-spacing: -0.005em;
    color: var(--ink-dim);
  }
  .project-subtitle :global(em) { font-style: italic; }
```

- [ ] **Step 3: Pass `codename` from the index page**

In `src/pages/projects/index.astro`, add the prop to `<ProjectCard>` (after `title`):

```astro
          <ProjectCard
            title={project.data.title}
            codename={project.data.codename}
            description={project.data.description}
            repoUrl={project.data.repoUrl}
            slug={project.id}
          />
```

- [ ] **Step 4: Verify check + build**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 5: Manual browser check**

With `npm run dev` running, open `http://localhost:4321/projects/`.
Expected: each index card shows the codename as its heading link, the descriptive title as a dimmed sub-line beneath it, then the description. Clicking the heading navigates to the correct detail page.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProjectCard.astro src/pages/projects/index.astro
git commit -m "feat(projects-index): codename heading + descriptive title sub-line"
```

---

## Final verification (after all tasks)

- [ ] Run `npm run check && npm run build` once more — both pass.
- [ ] Spot-check all four surfaces in the browser (homepage collapsed card, expanded modal, `/projects/`, `/projects/[slug]`) against the spec's acceptance criteria.
- [ ] Confirm no project markdown *body* was edited (only frontmatter): `git diff main --stat` should show frontmatter-only changes under `src/content/projects/`.
