# Contact + Footer — the page close (ink-panorama bookend)

**Status:** design approved 2026-07-14, prototype not yet built
**Part of:** the Xuan & Seal / sakura site redesign (assembled in `docs/redesign/`,
sewn into Astro at the end). Covers the README's two open parts — **Contact**
and **Footer + seal** — as a single "page close" prototype.
**Supersedes for these parts:** the seal-in-footer intent of
[2026-07-08 Xuan & Seal spec](2026-07-08-xuan-seal-redesign-design.md) §3/§8
(see Divergences).

## Goal

Close the page as an expressive bookend to the hero: a full-bleed sumi-e ink
panorama (`docs/redesign/footer-image.jpeg`) carrying the contact invitation in
the teacher's voice, with a quiet footer meta line beneath. The site's arc reads
**paper + petals (hero) → watercolor (projects) → ink horizon (close)**.

## Locked decisions

1. **One prototype file** — `docs/redesign/contact-footer.html`, standalone HTML
   in the settled visual language, same workflow as `hero.html` /
   `heimdall-trial.html` (serve repo root so `/public/fonts/` resolve). Not in
   the Astro build.
2. **Cinematic "contact over the image"** — the panorama is the full-bleed
   backdrop for the whole close; the invitation + channels overlay it, scrimmed
   for legibility (the trial's watercolor-header treatment applied to the close).
3. **Image stands alone — no petals.** The red sun + lone figure are the
   bookend; petals stay a hero-only signature. The arc rhymes without literally
   repeating petals.
4. **No seal / stamp.** Dropped at the user's call — the image's red sun already
   carries the vermillion seal-language, and a small chop would compete with it.
   (This is the departure from spec §3; see Divergences.)

## Visual language / tokens (reuse verbatim from hero + trial)

```
--porcelain:      #F5F1E7;   /* text over the dark scrim */
--porcelain-soft: rgba(245, 241, 231, 0.80);
--gold:           #E6C77E;   /* link underlines / accents — reads light on dark */
--gold-ink:       #9c7b2e;   /* not used here (that's the on-porcelain variant) */
--vermillion:     #B33A2B;   /* :focus-visible rings */
--ease-out:       cubic-bezier(0.22, 1, 0.36, 1);
--serif:  'Iowan Old Style', Georgia, 'Times New Roman', 'Songti SC', serif;
```

- **Text is porcelain over the image**, same as the trial's watercolor header —
  the band looks identical in both themes (it is artwork).
- **Nanum Brush is NOT used in this part.** The heading is serif (a long line in
  brush script over busy ink would fight legibility), so this prototype needs no
  CDN brush font — one fewer dependency than hero/trial.

## Composition

- Full-bleed `<section>` at **~85–90svh**. `footer-image.jpeg` (1116×432,
  ~2.58:1) as a `cover` image, `object-position` tuned so the **figure
  (lower-left)** and **red sun (upper-right)** stay in frame.
- **Scrim** over the image, below the text: a radial pool under the centered
  stack + soft top/bottom linear gradients (port of `.panel--header::after` from
  `heimdall-trial.html`), dark enough for porcelain text while leaving the figure
  and sun readable.
- **Ambient `drift`** on the image (very slow scale/translate breathing, the
  trial idiom) so the still ink feels alive. Image clipped to its box
  (`overflow: hidden`) so drift-scale can't bleed.
- Centered content stack; **footer meta pinned to the bottom edge**.

## Copy (teacher's voice)

- **Heading** (serif, large, porcelain): *"If you have a thoughtful thing to put
  into the world, so do I."* — kept per spec §8 "refine, don't replace."
- **Invitation line** (serif italic, smaller, porcelain): *"Tell me what you're
  making. I'll help you make it real."* — the teacher's-voice framing of what
  collaboration gives the other party.

## Channels

- **Primary CTA:** `→ tanel.treuberg@gmail.com` (`mailto:`), styled like the
  trial's `.more` — gold underline grows + arrow nudges on hover/focus.
- **Secondary row** (small porcelain links, `.repo`-style):
  - **GitHub** → `https://github.com/The-Magicians-Code/`
  - **LinkedIn** → `https://www.linkedin.com/in/taneltreuberg/`
  - **Résumé** → `/Tanel_Treuberg_Software_Engineer.pdf` (`target="_blank"
    rel="noopener"` — opens the inline PDF preview).

## Footer meta (bottom of the band)

Small porcelain text at reduced opacity, thin rule above:
- **Left:** `© 2026 Tanel Treuberg  ·  Last updated July 2026`
- **Right:** **theme toggle** (Xuan sun / Lacquer moon).
- **"Last updated"** is a hardcoded `July 2026` in the prototype → becomes a
  build-time constant at assembly (deterministic, never `Date.now()`, per
  CLAUDE.md).
- **Theme toggle** is functional (flips `html[data-theme]`), but its site-wide
  effect is out of this prototype's scope — the image band itself doesn't change
  with theme. Noted as a wiring task for assembly.

## Motion & accessibility

- **Scroll-in reveal:** heading, invitation, and channels blur-fade + rise on
  entering the viewport (IntersectionObserver — it's the page bottom), staggered
  like the trial's dossier reveal.
- **Reduced motion:** content renders **immediately** —
  `animation: none; transition: none; opacity: 1; filter: none; transform: none`.
  No drift, no reveal, **no crossfade** (stricter than the trial's reduced-motion
  dossier fade). Static scrim. (Resolves the earlier contradiction with the
  acceptance criteria — both effects are fully off, not a brief fade.)
- **Hover/focus:** gold underline + arrow nudge on links; hover motion gated
  behind `(hover: hover) and (pointer: fine)` so it can't stick on touch.
- **Focus-visible:** vermillion rings, offset, on every link and the toggle.
- **Contrast:** porcelain over the scrimmed center must clear WCAG AA for the
  body text; tune the scrim opacity to hit it (verify on the actual image, not by
  eyeballing).
- Links are real `<a>`s; the toggle a real `<button>` with `aria-pressed`.

## Responsive

- **Desktop/wide:** image `cover`, centered stack, meta pinned bottom.
- **Mobile/portrait caveat:** at 2.58:1 the image crops hard, and **figure + sun
  cannot both stay in frame under `cover`** on a portrait phone (they're ~590 of
  the 1116 source px apart; only ~240px show). So the "both in frame" goal is
  **landscape/desktop only**. Below `max-aspect-ratio: 3/4`, set
  `object-position: ~78% 50%` to keep the **sun + pavilion** and accept losing
  the figure. A proper portrait framing (a recomposed/outpainted crop, like the
  trial's `junkships-portrait.png`) is **deferred**, consistent with the other
  redesign parts' pending iOS pass.

## Non-goals

- No petals, no seal/stamp in this part.
- No brush font.
- No real theme wiring beyond flipping `data-theme` (site-wide theming is
  assembled later).
- Not the Astro integration — this is the settle-in-`docs/redesign/` prototype.

## Divergences from the 2026-07-08 Xuan & Seal spec

- **§3 seal placement:** that spec put the seal in the footer (and hero). This
  close **drops the seal** (user decision) — the image's red sun carries the
  vermillion accent. Consequence: the seal now appears **nowhere** in the settled
  redesign. The hero-seal placement is therefore a **conscious open question**,
  not a silent omission — decide it deliberately when the hero's seal task is
  taken up.
- **§8 footer "last updated":** retained.

## Open items (for assembly, not this prototype)

- Portrait/mobile crop of `footer-image.jpeg`.
- Wiring the theme toggle to real site-wide theming.
- Sourcing "last updated" from a build constant.
- Whether the hero still gets a seal (see Divergences).
- `footer-image.jpeg` provenance/licensing check before it ships (it's an
  AI-style ink-wash asset dropped into `docs/redesign/`).

## Implementation notes (from Codex pre-review, 2026-07-14)

- **Scrim must be stronger and shifted** — the asset is mostly bright parchment
  with a near-white bridge, so the trial's `rgba(18,12,7,0.44)` scrim reused
  verbatim would fail AA where text crosses sky/bridge. Use a darker, plateaued
  pool centered on the text (roughly
  `radial-gradient(70% 62% at 42% 46%, rgba(12,8,4,.76) 0 52%, rgba(12,8,4,.60) 72%, rgba(12,8,4,0) 100%)`)
  plus a **separate bottom seating gradient** (`~rgba(12,8,4,.72)`) under the
  footer meta. Treat these numbers as a **starting point** and tune to the
  *minimum* darkness that clears AA — verify by sampling actual composited pixels
  in-browser, don't eyeball. Keep the red sun out from directly behind text.
- **Reveal robustness (page-bottom IO):** apply the hidden state **only after JS
  initializes** (no-JS / init failure ⇒ content visible by default). Observe with
  `threshold: 0.01`, `rootMargin: "0px 0px -10% 0px"`, and do an **immediate
  post-observe check** (reveal if `rect.top < innerHeight*0.9 && rect.bottom >
  innerHeight*0.1`) plus a `pageshow` re-check, then `unobserve`. This dodges the
  "already in view on load ⇒ never fires ⇒ stuck invisible" trap (same class as
  the trial's barely-overflowing scrollspy).
- **Clip the image layer only, not the interactive layer.** Structure: section
  `min-height: 88svh` (not fixed height), `display: grid` `1fr auto` so the meta
  sits in normal flow (`padding-bottom: max(1.25rem, env(safe-area-inset-bottom))`),
  not absolutely positioned — otherwise the toggle's focus ring can clip. Only
  the image/`drift` layer gets `overflow: hidden`.
- **Drift bounds:** reuse the trial's exact `.painting` values (scale 1.06–1.10,
  translate ≤ ~1.2%) so the scaled image never exposes an edge.
- **Toggle a11y:** `<button>` with `aria-pressed` (`false` = Xuan / `true` =
  Lacquer) and a **constant** visible "Xuan / Lacquer" label — do not swap the
  accessible name to the next action per click.
- **Link targets:** GitHub + LinkedIn open **same-tab** (no `rel` needed); only
  the résumé PDF uses `target="_blank" rel="noopener"`.
- If the backdrop is an `<img>`, mark it `alt="" aria-hidden="true"`.
- Sanity-check the sun-vs-text collision at intermediate sizes too (1024×768,
  820×1180, 768×1024, 430×932, 390×844), not just desktop/phone extremes.

## Acceptance criteria

- Full-bleed ink panorama close; **on landscape/desktop** the figure + sun are
  both in frame (portrait keeps sun + pavilion, accepts losing the figure — see
  Responsive); porcelain invitation + channels legibly over a tuned scrim, footer
  meta at the bottom, no seal, no petals.
- Email/GitHub/LinkedIn/Résumé links correct and working; résumé opens the PDF in
  a new tab.
- Scroll-in reveal + ambient drift on desktop; both fully disabled under
  `prefers-reduced-motion`.
- Renders with no console errors; body text clears AA contrast over the scrim.
- Verified frame-accurate in Chrome (chrome-devtools MCP over CDP, the working
  local `file://`/served-prototype path).
