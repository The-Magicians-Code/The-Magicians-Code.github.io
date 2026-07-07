# Project codenames — design

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan

## Summary

Each project gets a single-word **codename** drawn from a language relevant to its
topic. The codename becomes the project's display name on the collapsed bento card;
the existing descriptive title is demoted to a secondary sub-line that appears only
inside the case study (the expanded modal and the detail page). Project markdown
bodies are not edited — the descriptive title is rendered from frontmatter.

## Codenames

| Slug | Codename | Language / meaning | Why |
|---|---|---|---|
| `yolo-dualdev` | **Heimdall** | Norse — the watchman god with the keenest sight, guarding the realm | Autonomous vessel whose whole job is to *see* everything around it (perception, radar/AIS fusion, mast lookout) |
| `strato-pi` | **Volta** | Italian/Portuguese — "a turn, a revolution"; also Alessandro Volta (voltage) | Rotation theme (motors spin, torque, RPM) + the electric-motor rig. Double meaning: rotation + electricity |
| `organic-flow` | **Nagare** | Japanese 流れ — "flow, stream, current" | The dance school's fluid motion + the project's "organic-flow" name and light edge stack |

## Display model

The user chose **"codename only on card, title inside content."** The descriptive
title never appears on the *collapsed* card face — only once the case study is opened
(expanded modal or detail page).

All three current projects are `.has-cover` bento cards, so each title renders in two
places on the homepage plus the detail page:

| Surface | Element | Shows after change |
|---|---|---|
| Resting card face | `.cover-resttitle` (white, over cover) | **codename only** |
| Expanded modal header | `.card-title` (centered ink) | **codename** |
| Expanded modal header, new | `.card-subtitle` (new) | **descriptive title** (sub-line under codename) |
| Detail page `/projects/[slug]` | `<h1 class="project-title">` | **codename** |
| Detail page, new | `.project-subtitle` (new) | **descriptive title** (sub-line under H1) |
| Detail page | `.project-lede` (existing) | description (unchanged) |
| `/projects/` index card | `.project-title a` | **codename** (link) |
| `/projects/` index card, new | `.project-subtitle` (new) | **descriptive title** (sub-line) |

## Components to change

### 1. `src/content.config.ts`
Add a required field to the `projects` schema:
```ts
codename: z.string(),
```

### 2. `src/content/projects/*.md` (frontmatter only)
Add to each of the three files:
- `yolo-dualdev.md` → `codename: Heimdall`
- `strato-pi.md` → `codename: Volta`
- `organic-flow.md` → `codename: Nagare`

Bodies are **not** edited.

### 3. `src/components/BentoCard.astro`
- Add `codename: string` to `Props`.
- `.cover-resttitle` renders `titleToHtml(codename)` instead of the title.
  (Codenames carry no `*accent*` markers, so `titleToHtml` just returns the escaped
  word — reusing the helper keeps rendering uniform and safe.)
- `.card-title` renders `titleToHtml(codename)`.
- Add a new `.card-subtitle` element inside `.card-body`, immediately after
  `.card-title`, rendering `titleToHtml(title)` (the descriptive title, `*accent*`
  emphasis preserved as `<em>`).
- `aria-label` becomes `` `${titleToText(codename)} — ${titleToText(title)}` `` —
  codename first (WCAG 2.5.3 Label-in-Name; the visible label is now the codename),
  descriptive title appended for screen-reader context.

### 4. `src/components/BentoProjectsSection.astro`
Pass `codename={project.data.codename}` to `<BentoCard>`.

### 5. `src/components/BentoGrid.astro` (styles)
- Add `.card-subtitle` to the has-cover reveal group so it is hidden at rest
  (`opacity: 0`) and revealed with the rest of the modal content on `.is-content-in`
  (and faded out on `.is-closing-content`). It must appear in the same selector lists
  as `.card-title` in these blocks:
  - the base hide rule (`opacity: 0; transition …`),
  - the `.is-content-in` reveal rule,
  - the `.is-closing-content` exit rule,
  - the `prefers-reduced-motion` reset.
- Style `.card-subtitle`: sits under the codename in the centered modal header —
  smaller than `.card-title`, `var(--ink-dim)` color, sized to `var(--modal-w)` like
  the other modal items so it doesn't reflow during the morph. Its `em` keeps the
  accent emphasis (unlike `.card-title em`, which is normalized).

### 6. `src/pages/projects/[slug].astro`
- Compute `codenameText = project.data.codename` (plain word).
- `<h1 class="project-title">` renders `titleToHtml(codename)`.
- Add `<p class="project-subtitle" set:html={titleToHtml(project.data.title)}>` between
  the H1 and the lede.
- `<title>` and OG stay on the **descriptive title** (`titleText`) — codename is a
  visual/branding layer, not the SEO identity. A search result reading
  "Heimdall · Tanel Treuberg" would be meaningless; "Vision pipeline for edge
  inference · Tanel Treuberg" is discoverable. `canonicalPath` unchanged.
- `aria-label` on the repo link stays `titleText` (descriptive) for the same reason.
- Style `.project-subtitle`: serif, between the H1 and lede in size, `var(--ink-dim)`.

### 7. `src/pages/projects/index.astro` + `src/components/ProjectCard.astro`
- `ProjectCard` gains a `codename: string` prop.
- The heading link (`.project-title a`) renders `titleToHtml(codename)`.
- Add a `.project-subtitle` sub-line rendering `titleToHtml(title)` between the heading
  and the description.
- `index.astro` passes `codename={project.data.codename}`.
- `aria-label` on the GitHub link stays `titleText` (descriptive).

## Non-goals

- No change to project markdown body content.
- No change to the codename→title relationship being configurable per-project (both
  are always shown in the case study; codename always leads on the card).
- No new title-parsing syntax — codenames are plain single words; `titleToHtml`/
  `titleToText` are reused as-is.

## Verification

Per project conventions (no test suite):
- `npm run check` — TypeScript + Astro diagnostics (schema change must type-clean; a
  missing `codename` on any project fails the content-collection type-check).
- `npm run build` — production build succeeds.
- Manual browser checks:
  - Homepage bento: each collapsed card shows only its codename over the cover.
  - Expand each card: codename as header + descriptive title sub-line beneath it,
    revealed with the content, faded out on close.
  - `/projects/`: each index card shows codename heading + descriptive sub-line +
    description.
  - `/projects/[slug]`: codename H1 + descriptive sub-line + lede; browser tab shows
    the descriptive title.
  - Reduced-motion: subtitle snaps rather than transitions.

## Acceptance criteria

1. Schema requires `codename`; all three projects define it.
2. Collapsed bento card face shows the codename only.
3. Expanded modal and detail page show codename (lead) + descriptive title (sub-line).
4. `/projects/` index cards show codename + descriptive sub-line.
5. Browser `<title>`/OG and repo-link aria-labels retain the descriptive title.
6. `npm run check` and `npm run build` pass.
