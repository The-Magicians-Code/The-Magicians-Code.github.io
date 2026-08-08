# LocationCard component — design

**Date:** 2026-06-01
**Status:** Approved (design); pending implementation
**Depends on:** MorphClock (`src/components/MorphClock.astro`, `src/scripts/morph-clock.ts`)
**Reference:** A "location" card (faint world-map background, pin chip, LOCATION
label, large time, tagline) the user shared; adapted to Warsaw + the site's
MorphClock and design tokens.

## Overview

A card in the homepage Contact section showing where Tanel is (Warsaw, Poland)
and the live local time there, rendered with the MorphClock. A faint, static,
theme-tinted world-map SVG sits behind the content as decoration.

## Goals

- Reinforce "Based in Warsaw" with a tasteful location + live-time card.
- Show **Warsaw time to every visitor** (timezone-fixed), not the viewer's local
  time, with a DST-correct offset label.
- Stay static: no map API, keys, tiles, or network. Theme-aware (light/dark).

## Non-goals

- Interactive map (pan/zoom), Leaflet/Mapbox/Apple/Google. (Evaluated and
  rejected: cost/keys/tokens/network conflict with a static GitHub Pages,
  minimal-JS, editorial site.)
- A floating/persistent widget. The card scrolls within the Contact section.

## Layout

Horizontal rounded card (~2:1), faint world map behind everything:

- **Pin chip** (top-left): `lucide:map-pin` via `astro-icon` in a rounded-square chip.
- **Location** (top-right): "LOCATION" eyebrow (mono, tracked) + "Warsaw, Poland".
- **Clock** (bottom-left): `<MorphClock>` `HH:MM:SS`, Warsaw time, with a live
  offset suffix (`GMT+2` / `GMT+1`).
- **Tagline** (bottom): "Building from Warsaw." (copy easily changed).

Decorative map + chip are `aria-hidden`; location text and the clock's sr-only
time remain accessible.

## Components / files

1. **`src/components/LocationCard.astro`** (new)
   - Props (with defaults): `city="Warsaw"`, `country="Poland"`,
     `timeZone="Europe/Warsaw"`, `tagline="Building from Warsaw."`.
   - Renders the card, the world-map background, the pin chip, the labels,
     `<MorphClock seconds timeZone={timeZone} />`, and the offset suffix.
   - Scoped CSS using site tokens; the world map tinted at low opacity, with a
     darker treatment under `html.dark`.

2. **`src/components/MorphClock.astro` + `src/scripts/morph-clock.ts`** (enhance)
   - New optional `timeZone` prop (IANA string). When set, the controller derives
     H/M/S from `Intl.DateTimeFormat(undefined, { timeZone, hour/minute/second,
     hourCycle })` parts instead of `Date.get*` (which use the browser zone).
   - Offset label: the card renders an empty `[data-morph-tzlabel]` element next
     to the clock; when `timeZone` is set, the controller fills it **client-side
     on init** (and harmlessly on each tick) via
     `Intl.DateTimeFormat(undefined, { timeZone, timeZoneName: 'shortOffset' })`
     → e.g. `GMT+2`. Client-side fill (not Astro build-time) avoids serving a
     stale offset across a DST change; DST is handled by Intl. If the element is
     absent the controller does nothing extra.
   - No behavior change when `timeZone` is omitted (existing local-time path).

3. **`src/components/Contact.astro`** (integrate)
   - Add `<LocationCard />` within `#contact`, below the headline / near the
     links, inside the existing `.page` column. Keep `data-parallax` structure
     intact (the card is static content within the section).

## World-map asset

A compact public-domain world-map SVG, inlined and token-tinted at low opacity.
Implementation will choose a lightweight source (target < ~30 KB); if detailed
country outlines are too heavy, fall back to a dotted/simplified world map. No
runtime fetch — inlined into the component.

## Timezone correctness (the core non-obvious requirement)

- Hours/minutes/seconds for the digits come from `Intl` parts for `Europe/Warsaw`,
  so the displayed time is Warsaw's regardless of visitor location.
- The offset suffix uses `shortOffset` (DST-aware: `GMT+1` winter, `GMT+2`
  summer). No hardcoded offset.
- 24h format (`hourCycle: 'h23'`).

## Accessibility & motion

- Inherits MorphClock's handling: visual digits `aria-hidden`, sr-only time text
  (now reflecting Warsaw time), `prefers-reduced-motion` snaps without animation,
  offscreen/tab-hidden pause.
- Card map + pin are decorative (`aria-hidden`); "Warsaw, Poland" + offset are
  real text.

## Acceptance criteria

- `npm run check` + `npm run build` pass; Contact section shows the card with a
  faint world map, pin chip, "Warsaw, Poland", a ticking `HH:MM:SS` Warsaw-time
  morph clock, an offset suffix, and the tagline — in both light and dark.
- Setting the OS/browser to a non-Warsaw timezone still shows Warsaw time and the
  correct offset (verify by emulating a different timezone).
- Reduced motion: digits update without animation; offscreen: animation pauses.
- No new runtime dependencies, no network requests for the map.

## Branch / shipping note

Built on `feat/morph-clock` (LocationCard is the clock's first real use). May be
split into its own PR if preferred; otherwise ships together as "morph clock +
its location-card home."
