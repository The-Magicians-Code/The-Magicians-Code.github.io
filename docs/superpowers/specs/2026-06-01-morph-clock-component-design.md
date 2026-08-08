# MorphClock component — design

**Date:** 2026-06-01
**Status:** Approved (design); pending implementation
**Source:** Ports `docs/ideas/morph-clock.html` (clock only — the demo's control panel is out of scope).

## Overview

A morphing digital clock: each digit is **29 SVG circles** tweened onto points
sampled along a hidden numeral path, blended by an SVG "gooey" filter so the
circles read as a solid glyph that liquid-morphs from one digit to the next.
Ported from a standalone demo into a reusable Astro component themed with the
site's design tokens.

## Goals

- A reusable `<MorphClock />` that drops into any page; multiple instances safe.
- Themed by the site's tokens (light + dark); digits default to `var(--accent)`.
- Live, ticking `HH:MM:SS` (24h default), with the morph animation on each change.
- Configurable via props without a UI panel.

## Non-goals

- The demo's control panel: live/manual toggle, 12/24h buttons, duration/stagger
  sliders, manual-digit grid, ink swatches, shuffle. (Props cover the useful
  subset; no interactive chrome.)
- A blog/route integration beyond an isolated preview route.

## Architecture (Approach A — self-contained custom element)

Three files:

1. **`src/scripts/morph-clock.ts`**
   - The numeral path `d`-strings (0–9) as a module const (ported verbatim from
     the demo's `#path_0..9`). No reliance on a global `<template>`.
   - `class MorphDigit extends HTMLElement` (Shadow DOM): builds the SVG
     (gooey `<filter>` with a randomized ID per instance, 29 `<circle>`s),
     reads `value` attribute, `morphTo(value)` samples the path with
     `getPointAtLength` and tweens each circle with expo-out easing + per-circle
     stagger via `requestAnimationFrame`. `prefers-reduced-motion` → snap
     instantly (no rAF tween).
   - A controller that finds each `[data-morph-clock]` wrapper, reads its config
     from `data-*` attributes, builds `morph-digit` + `.colon` children from the
     formatted time, and ticks once per second (`setInterval`, 250ms poll like
     the demo to stay aligned). Pauses the tick when the clock is offscreen
     (IntersectionObserver) or the tab is hidden (`visibilitychange`); resumes
     and re-syncs on return.
   - `customElements.define('morph-digit', …)` guarded against double-define.
     `export {}` for module scope (avoid global-script name collisions, per the
     scroll-hero precedent).

2. **`src/components/MorphClock.astro`**
   - Renders `<div class="morph-clock" data-morph-clock data-format data-seconds
     data-duration data-stagger aria-label=…>` plus an `sr-only` live-text
     element for the accessible time. Scoped CSS: colon dots, sizing, and
     `color: var(--clock-ink, var(--accent))`. Imports the script.

3. **`src/pages/proto/clock.astro`**
   - `BaseLayout`, `robots="noindex, nofollow"`, renders `<MorphClock />`
     centered for preview.

## Component API (props)

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `format` | `12 \| 24` | `24` | hour format |
| `seconds` | `boolean` | `true` | `HH:MM:SS` vs `HH:MM` |
| `duration` | `number` (ms) | `640` | morph tween length |
| `stagger` | `number` (ms) | `12` | per-circle delay |
| `color` | `string` (CSS) | `var(--accent)` | sets `--clock-ink` |

Defaults serialize to `data-*` on the wrapper; the script reads them.

## Theming

Circles are `fill: currentColor`; the wrapper sets `color` from `--clock-ink`
(default `var(--accent)`). Light/dark and accent follow the site tokens
automatically. The demo's dark-green chrome is dropped.

## Accessibility & motion

- The visual clock is `aria-hidden`; an `sr-only` element carries the current
  time as text, updated each tick.
- `prefers-reduced-motion: reduce` → digits set instantly; clock still updates.

## Performance

- 29 circles tween on every changing digit each second; offscreen/tab-hidden
  pause prevents perpetual background animation. rAF tweens are cancelled and
  restarted per morph (as in the demo).

## Browser parity

SVG `feGaussianBlur` + `feColorMatrix` gooey filter is broadly supported,
including WebKit, but **Safari/WebKit must be verified** before this is used on
a live page (project's first-class parity requirement). Chromium + build are the
automated gates; Safari is a manual smoke test.

## Acceptance criteria

- `npm run check` and `npm run build` pass; `/proto/clock` renders a ticking,
  morphing 24h clock with accent digits in both light and dark themes.
- Reduced-motion: digits update without circle animation.
- Scrolling the clock offscreen (or hiding the tab) halts the per-second
  animation; returning resumes with the correct time.
- A second `<MorphClock />` on the same page animates independently (no filter-ID
  collision).
