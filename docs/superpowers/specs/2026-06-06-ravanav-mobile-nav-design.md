# RavaNav as the site's mobile navigation — design

**Date:** 2026-06-06
**Branch:** `feat/rava-nav-module`
**Status:** Design — pending review

## Goal

Promote the isolated `RavaNav` morphing-pill demo (currently only on the
`/nav-test` route) into the site's **real mobile navigation**. Below 640px the
liquid-glass nav is replaced by RavaNav; the morphing pill's dropdown holds the
site's navigation links **and** the theme switcher, rather than the theme
switcher (and hamburger) sitting in a nav bar.

Desktop (>640px) is unchanged: the existing liquid-glass `#site-nav` stays.

## Scope decisions (resolved during brainstorming)

| Decision | Choice |
|----------|--------|
| Coexistence | RavaNav **mobile-only**, swap at ≤640px. Desktop keeps the liquid-glass nav. |
| Bar behaviour | **Keep** the scrollspy title-reel + progress-ring morph. |
| Dropdown content | **Nav links + theme toggle only** — drop the demo's studio copy + pricing rows. |
| Intro | Keep the brief intro morph, but **no auto-open** — settle into the compact bar (`autoOpen=false`). |
| Link layout | **Vertical tappable rows** (like the current MobileMenu), theme toggle as the last row. |

## Non-goals

- No change to desktop navigation (the liquid-glass pill).
- No change to RavaNav's core animation system (shell morph, title reel, progress
  ring, height-measurement logic) beyond what theming/layout requires.
- Not keeping RavaNav's `copy`/`rows` props — they have no consumer once the demo
  is repurposed (YAGNI). Removed, not preserved "just in case."

## Architecture

Five units change. Each is independently understandable; interfaces below.

### 1. `BaseLayout.astro` — mount + breakpoint swap

- Import and render `<RavaNav>` after `<MobileMenu />`.
- RavaNav receives the site's real sections/links via props (see §4).
- Breakpoint swap is pure CSS (no JS):
  - `≤640px`: `#site-nav` and `#mobile-menu` are `display:none`; RavaNav visible.
  - `>640px`: RavaNav's `.nav-shell` is `display:none`; liquid-glass nav visible.
- RavaNav's own stylesheet gets a `@media (min-width: 641px) { .nav-shell { display:none } }`
  guard so the component is self-contained (it hides itself on desktop). The
  hiding of `#site-nav`/`#mobile-menu` on mobile lives in `global.css` next to the
  existing responsive block.

### 2. `global.css` — responsive cleanup

- Add: `@media (max-width:640px){ #site-nav, #mobile-menu { display:none } }`.
- **Remove** the now-dead `@media (max-width:640px)` block that reshapes
  `#nav-pill`, `.brand-pill`, `.nav-actions`, `#theme-toggle-button`,
  `.hamburger-button` (global.css ~462–529). These rules only existed to make the
  liquid-glass pill usable on mobile; once `#site-nav` is hidden on mobile they
  are unreachable. This is cleanup of code our change orphans, not unrelated
  refactoring.
- Update the two `#theme-toggle-button` selectors here as part of the
  ThemeToggle id→class migration (§5) — though most of this block is being
  removed anyway.

### 3. Homepage section components — scrollspy hooks

Add `data-nav-section="<id>"` (the contract RavaNav's IntersectionObserver reads):

| Component | id | Reel title |
|-----------|----|-----------|
| `Hero.astro` (`<header class="hero">`) | `hero` | `Home` |
| `About.astro` (`#about`) | `about` | `About` |
| `BentoProjectsSection.astro` (`#projects`) | `projects` | `Work` |
| `BentoStackSection.astro` (`#skills-tools`) | `skills-tools` | `Stack` |
| `Contact.astro` (`#contact`) | `contact` | `Contact` |

These are additive attributes; they don't disturb the existing `data-parallax`
or ids. On non-homepage routes (project detail pages) none of these exist, so
the observer simply never fires and RavaNav rests on the `hero`/brand title —
acceptable. **Resume** is a PDF route, so it is a dropdown link only, never a
scrollspy section.

### 4. `RavaNav.astro` — props + dropdown body

**Props change:**
- Remove `copy` and `rows` props and their rendering.
- `sections` — the scrollspy reel (Home/About/Work/Stack/Contact above).
- `links` — repurposed to the dropdown nav-link list: `{ label, href }[]`.
  Site value: About `/#about`, Work `/#projects`, Stack `/#skills-tools`,
  Resume `/resume/`, Contact `/#contact`.
- Add `themeToggle?: boolean` (default false) — when true, render a `<ThemeToggle />`
  as the last dropdown row.
- Keep `introMs`, `autoOpen`.

**Dropdown body (`.nav-body`) becomes:**
- A vertical list of full-width tappable link rows (replacing the two side-by-side
  pill buttons). Comfortable tap targets (~44px), one per line, hairline
  separators consistent with the existing `.nav-row` border treatment.
- The theme toggle as the final row when `themeToggle` is set.
- Tapping a link collapses the dropdown (mirrors MobileMenu's `setOpen(false)`
  on link click) and lets the in-page anchor scroll happen.

**Theming — wire the `--rava-*` tokens to site theme variables:**
- The component already reads `var(--rava-panel, …)`, `var(--rava-ink, …)`,
  `var(--rava-muted, …)`, `var(--rava-line, …)`, `var(--rava-shadow, …)`,
  `var(--rava-green, …)` with light fallbacks.
- Define these `--rava-*` values from the site's existing theme tokens
  (`--bg`, `--ink`, `--ink-dim`, surface/line tokens) for light mode, and add
  `html.dark` overrides so the pill, ink, links, and separators invert correctly.
- Replace the hardcoded light-only link backgrounds (`rgba(255,255,255,.55)`,
  `rgba(23,23,23,.55)`) with token-driven values.

### 5. `ThemeToggle.astro` — multi-instance fix

Problem: the button uses `id="theme-toggle-button"`; the script binds a single
`getElementById`; `global.css` selects the same id. With the desktop nav and
RavaNav both rendering a toggle, the id collides (invalid HTML) and only the
first (the hidden desktop button) is wired.

Fix (contained to this component + the two global.css selectors):
- Replace `id="theme-toggle-button"` with `class="theme-toggle-btn"` (an id can't
  legally repeat, so a class is required for two instances). Migrate the
  component's own `#theme-toggle-button` CSS selectors and the two in global.css
  to the `.theme-toggle-btn` class.
- Script: `document.querySelectorAll('.theme-toggle-btn').forEach(b =>
  b.addEventListener('click', () => applyTheme('toggle')))`.
- `applyTheme()` is already stateless/idempotent and reads `html.dark`, so every
  instance stays in sync via CSS with no extra coordination.

### 6. `nav-test.astro` — update the demo harness

The demo currently passes `copy`/`rows`/`links` (studio flavour). Update it to
exercise the new shape: real-ish `sections`, vertical `links`, `themeToggle`.
Keep it on its own `<html>` (still isolated from BaseLayout's real nav). This
keeps a living harness for the component without affecting the deployed site.

## Data flow

```
scroll → IntersectionObserver (RavaNav script)
       → nav.dataset.section / data-progress
       → title reel offset + progress ring (existing logic, unchanged)

tap pill → toggleExpanded() → .is-open → dropdown reveals links + theme toggle
tap link → collapse dropdown → browser anchor scroll
tap theme toggle → applyTheme('toggle') → html.dark class → all toggles + nav re-theme via CSS
```

## Risks / edge cases

- **Dark mode contrast:** the demo was never tested in dark mode; the token
  wiring needs a real visual check in both themes (Chromium **and** Safari/iOS,
  per the cross-browser parity requirement).
- **Two navs in the DOM at once:** both `#site-nav` and RavaNav render on every
  page; only CSS hides one. Confirm no duplicate-id or duplicate-landmark a11y
  issues (RavaNav uses `aria-label="Site navigation"`; the desktop nav is also a
  `<nav>` — one is `display:none`, but verify screen-reader behaviour / consider
  `aria-hidden` on the hidden one if needed).
- **Resume link** opens the PDF (`/resume/` → the PDF route). Confirm the href
  matches the canonical resume URL the rest of the site uses.
- **liquid-glass runtime:** unaffected — it discovers `.liquid-glass` elements;
  RavaNav is not one. The pre-paint UA sniff is independent.
- **Removing the mobile `#nav-pill` block:** verify nothing on desktop depends on
  those rules (they're inside `max-width:640px`, so they shouldn't).

## Verification

No automated test suite. Gate is:
1. `npm run check` (astro/TS diagnostics) — clean.
2. `npm run build` — succeeds.
3. Manual browser checks at ≤640px and >640px, **light and dark**, Chromium and
   Safari/iOS: swap happens at the right breakpoint; scrollspy reel tracks
   sections; dropdown links navigate + collapse; theme toggle flips theme from
   inside the dropdown and stays in sync with the (hidden) desktop toggle;
   reduced-motion honoured.

---

## Revisions after Codex pre-implementation review (2026-06-06)

### Rename: RavaNav → MorphNav

All "rava" naming is dropped. The rename also resolves the `.nav-shell` /
`.nav-links` collisions Codex flagged (the desktop `Nav.astro` uses both class
names, and `global.css` hides `.nav-links` on mobile — which would have hidden
MorphNav's dropdown links). Fixed naming contract, used verbatim by every unit:

| Thing | Old | New |
|-------|-----|-----|
| Component / file | `RavaNav` / `RavaNav.astro` | `MorphNav` / `MorphNav.astro` (`git mv`) |
| Root element class | `.nav-shell` | `.morph-nav` |
| Internal classes | `.nav-top`, `.title-window/-stack/-line`, `.nav-action`, `.menu-glyph`, `.progress-glyph`, `.spark`, `.progress-track/-ring`, `.nav-body`, `.nav-links` (+`a`), `.rava-live` | `.morph-top`, `.morph-title-window/-stack/-line`, `.morph-action`, `.morph-menu-glyph`, `.morph-progress-glyph`, `.morph-spark`, `.morph-progress-track/-ring`, `.morph-body`, `.morph-links`/`.morph-link`, `.morph-live` |
| CSS tokens | `--rava-panel/-ink/-muted/-line/-shadow/-green` | `--morph-panel/-ink/-muted/-line/-shadow/-accent` |
| Open-height var | `--nav-open-height` | `--morph-open-height` |
| Change event | `rava-nav:change` | `morph-nav:change` |
| State classes | `.is-intro/.is-compact/.is-open` | unchanged (scoped under `.morph-nav`) |
| Scrollspy hook | `data-nav-section` | unchanged (already neutral; the page-contract attribute) |
| `data-*` on root | `data-section/-progress/-intro-ms/-auto-open/-scroll` | unchanged (element-scoped, no collision) |

The original source artifact `docs/ideas/ravalabs-nav-artifact.html` keeps its
name (historical reference, not shipped).

### Must-fix items folded in (from Codex)

1. **measure() while hidden caches a bad height.** On desktop MorphNav is
   `display:none`; `measure()` would read `offsetHeight: 0` and bake
   `--morph-open-height: 0px`, never re-measuring on shrink to mobile.
   Fix: at the top of `measure()`, bail when the element isn't rendered using
   **`nav.getClientRects().length === 0`** — NOT `offsetParent === null`, which
   is always null for a `position: fixed` element even when visible (Codex's
   suggested check would misfire). The existing `onResize` handler re-runs
   `measure()` when the window crosses into mobile width (resize fires across the
   breakpoint), so a desktop→mobile resize measures correctly once visible. A
   device that loads at mobile width measures correctly at init.
2. **Unique root** — `.morph-nav` (above); the document-level
   `querySelectorAll('.nav-shell')` becomes `querySelectorAll('.morph-nav')`, so
   it no longer scans the desktop `Nav.astro` shell.
3. **Remove `<MobileMenu />` from `BaseLayout`** (import + mount). It's hidden
   only via opacity/max-height (`global.css` ~423-449), so its links stay in tab
   order; and it's fully redundant once MorphNav owns mobile. `MobileMenu.astro`
   becomes an unused file — left in place (not deleted) and noted for a possible
   follow-up cleanup. `Nav.astro` (incl. its now-never-shown hamburger) is left
   untouched to keep desktop byte-identical.
4. **Collapse-on-link-click:** delegate a click handler on the dropdown's
   `.morph-link` anchors → `setExpanded(false)` (mirrors MobileMenu's behaviour),
   so tapping a link closes the panel before the in-page anchor scroll.
5. **Init idempotency guard:** set `data-morph-ready` on the root before binding;
   bail if already present.
6. **`data-nav-section`** added to the five homepage sections (already in §3).

### Corrections to the original draft

- **Resume href is `/resume/`** — Codex confirmed `src/pages/resume.astro` is a
  real, live route and both existing navs link to it. (CLAUDE.md's "no styled
  /resume/ page" note is stale.) The dropdown uses `/resume/`.
- **resume.astro print-hide:** add `.morph-nav` to the print `display:none`
  selector group at `src/pages/resume.astro` (~511-519) alongside `#site-nav` /
  `#mobile-menu` / tuner.

### Final file-ownership map (for the implementation workflow)

Each unit owns a disjoint set of files so the work parallelises without edit
collisions; all shared names come from the contract table above.

| Unit | Files |
|------|-------|
| component | `src/components/RavaNav.astro` → `MorphNav.astro` (rename + repurpose + theming + measure fix + collapse + root + guard) |
| theme | `src/components/ThemeToggle.astro` (id `theme-toggle-button` → class `theme-toggle-btn`, `querySelectorAll` bind) |
| global-css | `src/styles/global.css` (theme-toggle selector migration; add `@media(max-width:640px){#site-nav,#mobile-menu{display:none}}`; remove dead mobile `#nav-pill` block ~461-550) |
| sections | `Hero.astro`, `About.astro`, `BentoProjectsSection.astro`, `BentoStackSection.astro`, `Contact.astro` (`data-nav-section`) |
| layout | `src/layouts/BaseLayout.astro` (import + mount `MorphNav` with site sections/links + `themeToggle`, `autoOpen={false}`; remove `MobileMenu` import + mount) |
| resume | `src/pages/resume.astro` (print-hide adds `.morph-nav`) |
| demo | `src/pages/nav-test.astro` (update to `MorphNav` + new props/markup) |
