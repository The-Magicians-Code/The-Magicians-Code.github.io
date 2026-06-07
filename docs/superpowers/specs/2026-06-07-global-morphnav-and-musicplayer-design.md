# Global MorphNav + musicplayer extraction — design

**Date:** 2026-06-07
**Branch:** `feat/rava-nav-module`

## Goal

1. **Adopt MorphNav as the site's nav at all breakpoints** (it was mobile-only),
   with desktop sizing/adjustments. Retire the liquid-glass pill (`Nav.astro` /
   `#site-nav`) from the navigation role.
2. **Consolidate the glassmorphism pill into a standalone `musicplayer` project**
   — a new `/musicplayer` route rendering an Apple-Music-iOS-style liquid-glass
   player bar, consuming the (retained, reusable) liquid-glass module.

## Phase A — MorphNav everywhere

- `MorphNav.astro`: remove the `@media (min-width: 641px) { .morph-nav { display:none } }`
  self-hide. Add a desktop block (`min-width: 641px`) widening the pill slightly
  (`min(400px, …)`) — the centered pill + dropdown otherwise carry over unchanged
  (1rem type, squircle rows, theme toggle, scroll-progress ring all work on desktop;
  desktop adds hover, already styled).
- `BaseLayout.astro`: remove `<Nav />` (import + mount). MorphNav is the only nav.
  `intro={false}`, `autoOpen={false}` stay; it's already mounted at all sizes.
- `global.css`: remove the now-dead `@media (max-width:640px){ #site-nav, #mobile-menu { display:none } }`
  swap. The `#site-nav` / `#nav-pill` / `.nav-links` / `.brand-*` / `.nav-actions`
  / `.hamburger-*` styles become dead once `Nav.astro` is unmounted; remove the
  nav-specific blocks (keep anything shared). Leave `MobileMenu.astro` (already
  unmounted) for a later delete.
- `Nav.astro` is retired from the layout. Its liquid-glass markup + dev tuner move
  to the musicplayer project (Phase B); the file is deleted once Phase B lands.

## Phase B — musicplayer

- New `src/pages/musicplayer.astro` (standalone, like the old `nav-test`): a
  bottom-docked **player bar** with `class="liquid-glass"` so the existing
  `liquid-glass.ts` runtime auto-upgrades it. Apple-Music-iOS-inspired:
  album-art thumbnail, track title + artist, transport controls
  (prev / play-pause / next), and a progress scrubber. Static/demo data; the
  point is the liquid-glass player-bar surface, not real playback.
- Reuse the liquid-glass CSS custom-property API (`--lg-*`) to tune the player
  bar's glass. Optionally mount the dev tuner (`data-lg-tuner`) there instead of
  the nav.
- The liquid-glass module (`liquid-glass.ts`, `liquid-glass-tuner.ts`,
  `liquid-glass.css`) is **retained as shared infra** — only its *consumer*
  changes from the nav pill to the player bar.

## Verification

`npm run check` + `npm run build` clean; browser check MorphNav at desktop +
mobile (compact bar, dropdown, theme toggle, progress ring, scroll); musicplayer
page renders the glass player bar (Chromium) with graceful Safari/Firefox
fallback (the liquid-glass module's existing UA-sniff path).
