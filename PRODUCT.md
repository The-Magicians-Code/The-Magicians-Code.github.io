# Product

## Register

brand

## Users

A mixed but identifiable audience landing on a single small surface (homepage + projects + resume). Three reader types, no single anchor:

1. **Hiring managers and recruiters** reviewing a portfolio in a queue of dozens. They scan, not read. The resume, the project cards, and the contact path must read clearly at a glance. Their judgment is "yes, schedule a call" or "no, next tab."
2. **Peer makers** — other engineers and designers who recognize craft when they see it. They evaluate the maker by *how the site behaves*, not just by what it lists. MorphNav is a deliberate flex for this audience: a nav that morphs between a compact scrollspy bar and an open menu, with a live scroll-progress ring tracking your place in the page. It announces "this person sweats the interaction details most don't."
3. **Potential collaborators or freelance clients** evaluating fit. The site is a soft sales surface. It has to convey range, taste, and a clear path to reach out, without reading as a pitch deck.

All three are arriving at the same URL with the same content. The identity has to be strong enough that the same surface lands for all three — there's no per-audience routing, no segmentation, no "for recruiters" / "for engineers" branches. One voice, three readings.

## Product Purpose

`themagicianscode.dev` is the public face of a solo developer / maker identity ("The Magicians' Code"). The site exists to:

- Show *who built it* by being itself — the implementation is part of the portfolio. MorphNav is not a UI decoration; it's a piece of the argument that this person knows how to build interesting things, all the way down.
- Frame the work — three named projects (organic-flow, strato-pi, yolo-dualdev) with detail pages each linking to a real artifact / repo.
- Carry a résumé surface — the build-time PDF served at `/Tanel_Treuberg_Software_Engineer.pdf` and linked from the nav (there is no HTML `/resume` route; the styled page was intentionally removed in favor of the ATS-minimal generated PDF) — for the reader who needs the linear chronology.
- Open a clear contact path for the next step.

Success in the next 1–3 months: document the visual system that already exists, identify and close the gaps where the existing implementation has drifted from its own intent, and ship a couple of targeted polish passes on the surfaces that most affect first impressions (homepage, project detail, resume).

This site does NOT transact, capture leads, or run analytics funnels. It communicates. The deliverable is the impression.

## Brand Personality

**Playful, technical, generous.** Magic in the name is real, not metaphor — the site is intended to delight on the craft level, not just inform. Things move when motion adds meaning. MorphNav is the established signature; new work extends that disposition rather than backing away from it.

Voice: first-person, opinionated, specific. This is a solo identity; the copy talks to readers as the maker would in conversation, not as a brand. No "we" plural, no agency-style abstraction. "I built this because…" beats "Our process yields…" every time.

Tone: confident but not performative. The work argues for itself; the copy doesn't need to oversell it. Short lines, real verbs, concrete nouns. No buzzwords, no aphoristic-cadence body copy, no "elegant solutions to complex problems" framing.

## Anti-references

- **Agency-portfolio-monochrome (the Stripe / Linear school).** Pure black or pure white, big serif headlines, oversized cursor, every interaction over-engineered, scroll-driven choreography for every section. Reads as performance: every flourish announces itself. This is the strongest aversion. The existing cream-paper / terracotta / Geist + Fraunces identity is the antibody — the site has a *specific* color world that an agency-monochrome doesn't.
- **Generic dev portfolio (Vercel-template-clone).** Black/white minimal, default Inter or Geist with no opinion, hero name + tagline + projects grid + about + email link. Looks like every GitHub-page portfolio. Identity comes from being non-default; the site already commits to a non-default direction and should not drift back.
- **Resume-as-website (CV-on-HTML).** Sidebar bio, skills-as-progress-bars, chronological work-history table. The résumé ships as a downloadable PDF (`/Tanel_Treuberg_Software_Engineer.pdf`) for the reader who needs it — deliberately *not* an HTML page. The site as a whole is not a CV; the homepage isn't a chronology.
- **Notion-template / pretty-Markdown personal site.** Soft pastels, generic emoji headers, vague-aspirational copy, no committed POV. The opposite of this site's actual identity.

If a new design move could plausibly come from any of those four lanes, rework it.

## Design Principles

1. **Craft is the argument.** The site doesn't tell you the maker is good; MorphNav shows you. Every implementation decision is also a portfolio decision. A new component is judged not only by whether it works but by what shipping it says about how the maker thinks.
2. **Magic, not magic-tricks.** "Playful" doesn't mean gimmicky. Effects earn their place by serving wayfinding, hierarchy, or affordance — MorphNav's scrollspy reveals *where you are* in the page, which serves orientation. Effects that don't earn their place don't ship.
3. **Identity over template.** The committed warm-paper / terracotta / Geist + Fraunces / MorphNav system is the brand. Drift toward "neutral" (more black, less color, more system-default) is reversion to template. The brand defends itself by being specific.
4. **Specifics over generalities.** Named projects, real verbs, concrete artifacts. "I built organic-flow for Fundacja Organic Flow on Astro + Cloudflare Workers" beats "I build production systems." Generality is the language of templates; this site is the opposite of a template.
5. **Engineered to the level the craft requires, not beyond.** A11y is table stakes, not a moral ceiling — graceful degradation is the right model: the effect *is* the engineering, including how it degrades (MorphNav tones its morph down under reduced-motion; the Liquid Glass module, where it's still used, keeps its Safari/Firefox fallback). Reduced-motion is respected, focus rings exist, dark mode works. Beyond that, the experience is the experience.

## Accessibility & Inclusion

**Craft-first, table-stakes a11y.** This is a deliberately scoped position, not an oversight.

In scope:
- **WCAG 2.2 A** as the floor for static content (resume, project copy, contact). The reader who can't use MorphNav's motion can still read the page and reach every link.
- **Real focus rings** on interactive elements, with one deliberate exception: the bento project cards suppress the UA outline and surface focus through the `.cs-expand` affordance reveal instead (the default outline read as a stray boundary line on the dark cover). Removed-or-invisible focus rings are otherwise forbidden — anywhere lacking a bespoke focus affordance keeps its ring.
- **`prefers-reduced-motion: reduce`** respected on any new motion. MorphNav and the interactive components already tone down under reduce; the known gap is the `.section-fade-in` entrance in `global.css`, which should be audited and gated.
- **Dark mode works end-to-end.** The token swap in `global.css` is real and complete; new components must respect both modes.
- **Keyboard navigation** is supported on the nav, the project cards, and the contact links.

Explicitly out of scope:
- **WCAG AAA** as a blanket target. The site doesn't pursue 7:1 contrast across all surfaces; the cream-paper / ink palette is committed and is AA-but-not-AAA in places.
- **MorphNav's motion for reduced-motion users.** The morph and scrollspy animation are part of the experience, not load-bearing. Under `prefers-reduced-motion: reduce` the pill tones down to a near-static nav that still names the section and exposes every link, which is degraded-but-functional. That's the contract.
- **Screen-reader-first design.** The site is visually-led by intent. Semantic HTML and ARIA where the structure naturally calls for it; no investment in screen-reader-optimized alternative experiences.
