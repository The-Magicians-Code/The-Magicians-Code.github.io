# Redesign — assembly area

Working parts for the site redesign (evolution of the approved
[Xuan & Seal spec](../superpowers/specs/2026-07-08-xuan-seal-redesign-design.md),
extended with the sakura/petal direction from the 2026-07-10 brainstorm).

Each settled part lives here as a **standalone HTML file** — self-contained,
openable directly (serve the repo root, e.g. `python3 -m http.server`, so the
`/public/fonts/` paths resolve). Once all parts are settled they get sewn
together into the real Astro components, and this folder becomes the
reference for that implementation. Nothing in `docs/` is built into `dist/`.

## Parts

| Part | File | Status |
|------|------|--------|
| Hero | [hero.html](hero.html) | **Settled** (2026-07-10) |
| Project 1 — Heimdall | [heimdall-trial.html](heimdall-trial.html) | **Settled** (2026-07-14) |
| Projects 2–3 layout | — | open (trial-slide is the settled pattern; not yet templated) |
| Stack section | — | open |
| Contact | — | open (teacher's voice per spec §8) |
| Footer + seal | — | open |

The earlier "ink-drawn SVG scenes" idea for the projects section is superseded
by the trial-slide treatment settled in `heimdall-trial.html`.

## Hero — decisions locked in

- **Name centered**, set in **Nanum Brush Script** (wet-brush handwriting;
  needs vendoring/self-hosting before production — currently Google Fonts CDN
  for the experiment). No text animation — the name just sits on the paper.
  The writing-itself SVG exploration was tried and dropped (2026-07-10).
- **Thesis line:** “Shaping ideas into reality — deliberate, weightless,
  precise.” (wording may still be polished)
- **Petals across the whole hero**, canvas 2D, physics: terminal-velocity
  fall + sway/flutter, layered-sine breeze, cursor/touch wind (directional
  drag + radial parting + tumble kick — tuning ported from
  `docs/ideas/petal-wind-playground.html`).
- **The name is a collision surface**: petals fall in front of / behind the
  letters (z-bands fixed at spawn), and some **land and rest on the strokes**
  — slope/concavity-aware catching (bowls trap, crests shrug, steep contours
  slide), settle animation with a decaying rock, petals lie lengthwise along
  the surface foreshortened flat (~52–72 % vertical squash, +0.15 alpha),
  faint contact shadow. Caps: ≤22 settled, ≤2 per 14 px column. Strong
  cursor gust peels resting petals back into the fall.
- **Collision mask** is built by drawing the *same* text into an offscreen
  canvas (single draw function feeds both visible canvas and mask → no
  alignment drift), sampled once into a `Uint8Array`.
- **Themes:** Xuan (paper + sakura-pink petals) / Lacquer (black + antique
  gold petals, maki-e). Reduced motion → still scene with petals pre-rested
  on the letters.

## Project 1 (Heimdall) — decisions locked in

The project-1 experience is a **full-viewport takeover**, not a bento card.
`heimdall-trial.html` is the settled prototype (chosen 2026-07-14 over the
handscroll variants — `heimdall-scrolls.html`, the v8 rollers, `heimdall.html`
— which stay as historical explorations).

- **Two-panel horizontal slide.** A `.world` viewport clips a 200vw `.track`.
  Panel 1 is the watercolor header; panel 2 is the case study. Opening slides
  the track `translateX(-100vw)` over **0.9s** on a shared ease; closing is the
  symmetric reverse. Toggling `.is-trial` mid-slide reverses from the current
  computed transform — the interruptibility contract; no timers or transitionend
  teardown.
- **Header panel:** the `junkships.png` watercolor fills its own panel
  (`junkships-portrait.png` below 1:1 aspect), `object-position: 34% 50%`, a
  very slow ambient `drift` breathing (no parallax), a radial focal scrim, then
  the hero stack — the brush **見** seeing-mark, **Heimdall** codename, subtitle
  “Vision pipeline for edge inference”, the line “A vessel learning to see the
  sea it sails.”, and a **“Read the trial →”** trigger. Text resolves in with a
  blur-fade on load (ported from the xuan-seal reveal).
- **Trial panel ("The Trial"):** a full-bleed **porcelain** dossier (paper-grain
  gradients, opaque — no backdrop-filter needed), a single bold **gold rule**
  down the reading column's left edge, a colophon head (kicker + brush title +
  vermillion **見試** seal), Problem / Approach / Results sections, and a footer
  meta row (tech tags + repo link). Sections reveal on a **staggered blur-in**
  gated on `.is-trial` (transitions, not keyframes, so an interrupted close
  reverses cleanly).
- **Brush face:** **Nanum Brush Script** — same CDN experiment as the hero,
  shares the hero's vendoring task.
- **A11y / focus gotchas already solved** (keep these on port): off-screen panel
  is `inert`; `.world` uses `overflow: clip` (not `hidden`) so it can't become a
  scroll container; `focus({ preventScroll: true })` everywhere (a plain focus
  jumps `world.scrollLeft` and leaves a residual gap on interrupt); **Esc close
  does not refocus the trigger** (a real keypress flips `:focus-visible` to
  keyboard and would leave a stuck gold ring — same lesson as
  `heimdall-scrolls.html`); click/Enter/ArrowLeft close still refocus.
- **Reduced motion:** no slide, no drift, no hover nudges; the trial reveal keeps
  only a brief opacity cross-in.

## Still open for project 1

- **Not yet templated.** The prototype is Heimdall-hardcoded (copy, painting,
  seal glyphs). Generalizing it into a data-driven component fed by
  `src/content/projects/` is deferred to the Astro assembly pass; the trial-slide
  is the settled *pattern* for projects 2–3, not yet a reusable template.
- **Repo link is a placeholder** (`href="#"`). At assembly, wire the real
  `repoUrl` (and the `deepwikiUrl` "for the nerds" affordance) from the project's
  frontmatter.
- **Font vendoring** shared with the hero (Nanum Brush latin subset →
  `public/fonts/`); the seal/mark also lean on `Kaiti SC`/`Songti SC` system CJK
  faces — decide whether those need vendoring or a webfont fallback.
- **Mobile composition + real-device Safari/iOS pass** (Netlify preview) still
  pending — the slide, `overflow: clip`, and `-webkit-overflow-scrolling` paths
  want a device check before assembly.

## Still open for the hero

- Sumi-e branch (top-right, draw-in) — designed in the brainstorm, present in
  `docs/ideas/sakura-hero-mockup.html`, not yet merged into this part.
  Decide: branch + centered name, or petals-only liubai (current file).
- Seal placement (spec §3 says hero bottom-right + footer).
- Thesis line final wording.
- Font vendoring: Nanum Brush latin subset → `public/fonts/`, and whether the
  hanzi numerals can share a face.
- Mobile composition + real-device Safari/iOS pass (Netlify preview).
