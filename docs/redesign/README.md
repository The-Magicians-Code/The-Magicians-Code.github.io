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
| Projects (ink-drawn SVG scenes) | — | brainstormed, not prototyped |
| Stack section | — | open |
| Contact | — | open (teacher's voice per spec §8) |
| Footer + seal | — | open |

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

## Still open for the hero

- Sumi-e branch (top-right, draw-in) — designed in the brainstorm, present in
  `docs/ideas/sakura-hero-mockup.html`, not yet merged into this part.
  Decide: branch + centered name, or petals-only liubai (current file).
- Seal placement (spec §3 says hero bottom-right + footer).
- Thesis line final wording.
- Font vendoring: Nanum Brush latin subset → `public/fonts/`, and whether the
  hanzi numerals can share a face.
- Mobile composition + real-device Safari/iOS pass (Netlify preview).
