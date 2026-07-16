# Stack section — the quiet breather (retheme)

**Status:** built + verified 2026-07-16 (`docs/redesign/stack.html`)
**Part of:** the Xuan & Seal / sakura site redesign (assembled in `docs/redesign/`,
sewn into Astro at the end). Covers the README's open **Stack section** part.
**Spec basis:** the [2026-07-08 Xuan & Seal spec](2026-07-08-xuan-seal-redesign-design.md)
§5/§10 frames the stack as the page's *quiet* section — it gets **one** ornament
(the hanzi numeral 三) and otherwise inherits the palette. This design honors that
restraint: a faithful retheme, not a functional redesign.

## Goal

Re-skin the existing tech-stack section into the redesign's on-paper visual
language as a deliberate **liubai** (negative-space) breather between the
expressive hero / projects / contact sections. Same content, same grouped-pill
structure — new palette, serif typography, the 三 ornament, and one gentle
scroll reveal.

## Locked decisions

1. **One standalone prototype** — `docs/redesign/stack.html`, self-contained HTML,
   same workflow as the sibling prototypes (serve repo root so tokens + inlined
   logos resolve). Not in the Astro build.
2. **Quiet / spec-faithful** — chosen over "editorial toolkit" and
   "motif-driven." No background image, no ink/seal motif; the section is a calm
   pause. (Content was later **curated** — 8 tools dropped; see the Layout table.)
3. **On paper** — Xuan light / Lacquer dark via the redesign tokens (this is a
   content section, NOT an image-backed porcelain-on-dark section like the trial
   / contact close).

## Visual language / tokens (reuse from `hero.html`, the paper set)

```
:root {                             html[data-theme="lacquer"] {
  --bg:      #f5f1e8;                 --bg:      #141210;
  --ink:     #1a1a18;                 --ink:     #f0ede4;
  --ink-dim: #4a473f;                 --ink-dim: #c9c4b6;
  --ink-3:   #8a8578;                 --ink-3:   #8f8a7c;
  --accent:  #b33a2b;                 --accent:  #c9a961;
  --rule:    rgba(26,26,24,0.12);     --rule:    rgba(240,237,228,0.12);
}                                    }
--accent-soft: color-mix(in srgb, var(--accent) 14%, transparent);  /* featured ring */
--serif:   'Iowan Old Style', Georgia, 'Times New Roman', 'Songti SC', serif;
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
```

## Section frame

- **三 ornament:** pale (`--ink-3`), large (`clamp(2rem, 5vw, 3.25rem)`), above
  the heading. Markup: `<span lang="zh-Hans" aria-hidden="true">三</span>` +
  `<span class="sr-only">Section 3</span>`. **Prototype uses a system CJK
  fallback** (`'Songti SC','STSong','Source Han Serif SC', serif`); production
  vendors a Source Han Serif SC subset (`U+4E09`, ≤~5 KB woff2) — see Open items.
- **Heading:** serif, `"Tools I <em>actually</em> reach for."` — the `<em>`
  renders in `--accent`.

## Layout — the current grouped structure, kept

Six category rows in order, each = a small **uppercase letter-spaced serif label**
(the redesign's kicker style from `heimdall-trial.html`'s `.t-section h2` —
`letter-spacing: ~0.2em`, `--ink-dim`; chosen over the live site's Geist Mono to
match the redesign language) over a wrapping pill row:

| Category | Items (★ = featured) |
|---|---|
| Languages | **Python★**, C++, JavaScript, SQL, Bash, Swift |
| AI / ML | **PyTorch★**, TensorFlow, TensorRT, OpenCV, Nvidia Jetson |
| Back end | **Flask★**, REST APIs |
| Databases | **PostgreSQL★** |
| DevOps | **Docker★**, Jenkins, AWS S3 |
| Tools | **Git★**, Postman |

**19 tools, 6 featured.** Curated down from the live `techStack.ts`'s 27 (user
call, 2026-07-16): dropped **GStreamer, ONNX** (AI/ML), **GitLab CI/CD,
Kubernetes, Grafana, ELK** (DevOps), **Selenium, Scrapy** (Tools). All 6 featured
survive; every group keeps ≥1 pill. **This diverges from `techStack.ts`** — see
Open items for the sync decision.

## Pills + logos

- Each pill = an **18px inline brand SVG** + label, inline-flex, ~6px 14px
  padding, `border-radius: 999px`, a faint tint background, `1px solid var(--rule)`
  border. Hover: `translateY(-2px)` on `~0.25s var(--ease-out)`.
- **Featured pills** (the 6 ★) get `background: var(--accent-soft)`, transparent
  border — as on the live site.
- **Logos are inlined** (copied from `src/assets/logos/{slug}.svg`), NOT `<img>`,
  so `currentColor` mono-knockouts recolor with the theme. Where a
  `{slug}.dark.svg` exists — **8 slugs: cplusplus, sqlite, bash, nvidia, flask,
  openapi, postgresql, elasticsearch** (→ 9 pills, as TensorRT + Nvidia Jetson
  both use `nvidia`) — include both and swap under `html[data-theme="lacquer"]`,
  mirroring the live `TechPill` **file-existence logic** (read the filesystem, not
  this list).
  Slug mapping to note: SQL→`sqlite`, REST APIs→`openapi`, Nvidia Jetson→`nvidia`,
  AWS S3→`aws-amazon-simple-storage-service`, ELK→`elasticsearch`.

## Motion & accessibility

- **Scroll-in reveal:** the heading + each group blur-fade + rise on entering the
  viewport, staggered per group (IntersectionObserver). Reuse the **page-safe
  reveal contract** from `contact-footer.html`: hidden state applied only after
  JS inits (no-JS ⇒ visible), `threshold: 0.01` + `rootMargin: '0px 0px -10% 0px'`,
  an immediate in-view check, a `pageshow` re-check, and a `setTimeout` failsafe.
- **Reduced motion:** everything renders instantly — no reveal, no hover lift.
- Pills are **static text** (not links/buttons) → not in the tab order; the
  heading is a real `<h2>` in the a11y tree; the 三 is `aria-hidden` with an
  `.sr-only` label. Focus-visible rings (accent) only on the preview toggle.

## Preview theme toggle (prototype-only)

A small, unobtrusive toggle flips `html[data-theme]` Xuan⇄Lacquer so both
palettes are viewable. Clearly a **dev affordance** — in the assembled site the
footer owns theming; this control is dropped at integration.

## Non-goals

- No structural redesign (grouped-pill layout kept). Content WAS curated (27→19,
  see Layout); the 6 groups and 6 featured are unchanged.
- No background image, ink-wash, or seal motif — the section stays quiet.
- No font vendoring (system CJK fallback for 三 in the prototype).
- Not the Astro integration — this is the settle-in-`docs/redesign/` prototype.

## Open items (for assembly, not this prototype)

- Vendor the Source Han Serif SC 三 subset (`U+4E09`) for production.
- Wire the theme toggle to real site-wide theming (footer-owned); drop the
  prototype's preview toggle.
- Confirm the redesign's body serif (the prototypes use the `Iowan Old Style`
  stack; the live site + §2 use Fraunces) — a global redesign decision, not
  this part's to settle.
- Mobile/narrow pass (pills wrap fine, but verify group rhythm on a phone).
- **Sync `src/data/techStack.ts` to the curated 19** (drop GStreamer, ONNX,
  GitLab CI/CD, Kubernetes, Grafana, ELK, Selenium, Scrapy) so the live site
  matches — a separate production change, deferred until the redesign is assembled
  (or done sooner if desired). Until then the prototype and the live data diverge.

## Acceptance criteria

- The live stack's 6 groups / 19 tools / 6 featured, rethemed on paper in both
  Xuan and Lacquer, with the 三 ornament over the serif heading.
- Real brand logos render inline and mono-knockouts recolor correctly on theme
  flip.
- One staggered scroll-in reveal that is page-safe (never leaves content stuck
  hidden) and fully disabled under `prefers-reduced-motion`.
- Renders with no console errors; verified in Chrome (chrome-devtools MCP over
  CDP) in both themes.
