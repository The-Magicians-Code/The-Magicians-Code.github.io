## Ideas
- **TODO:** Petal wind — falling peach-blossom petals with mouse-as-wind physics (canvas, velocity force + radial displacement, reduced-motion → static scatter) for the Xuan & Seal redesign. Tuned prototype: [petal-wind-playground.html](petal-wind-playground.html) · [live artifact](https://claude.ai/code/artifact/b5b48894-e85d-4bc2-8e37-923dff57c080)
- **TODO:** Koisei "Down the Spring River" — key inspiration page for the redesign overall: [koisei-spring-river-inspiration.html](koisei-spring-river-inspiration.html) (reference copy, CDN-dependent — Tailwind/GSAP/three/Lenis from CDNs without SRI, external media; open online, never ship as-is). Devices to steal: WebGL petal field with modes (down/up/settle) + mouse impulse, scroll-scrubbed video "films", day→night fbm dissolve, pinned horizontal gallery, manifesto line-reveals with inline expanding images, progress rail + section index, preloader wordmark, magnetic CTA, custom cursor. Palette is near-ours (washi #F1E9DE ≈ xuan, vermilion #C4472F ≈ seal red).
- Animated SVG Claude in the site
- Animated different Claude Code text [statuses](https://claude-spinner-verbs.vercel.app)
- https://tympanus.net/codrops/2026/05/05/reverse-engineering-claude-ais-mascot-animations-with-svg-and-gsap/
- https://claude.ai/design/p/019e0f0d-e003-7135-83d0-4c0f76aca7fb?file=index.html
- https://gsap.com/docs/v3/
- apple rainbow logo
- https://github.com/hotheadhacker/no-as-a-service
- [HTML CV to PDF](https://www.reddit.com/r/webdev/comments/1m67e80/comment/n4hk5vk/)
- https://www.typeui.sh
- https://glassmorphism-pro.vercel.app
- https://ui.shadcn.com
- https://lucide.dev
- https://animations.dev
- https://simpleicons.org
- [Pretext.js](https://pretextjs.dev) for CV — DOM-free text measurement engine; candidate uses: smooth text reflow on Formal↔Interactive mode toggle, jank-free streamed/animated text reveals. [repo](https://github.com/chenglou/pretext) · [demo](http://chenglou.me/pretext/)
- [CV](https://www.overleaf.com)
- https://www.agentation.com
- Chuck Norris queotes daily
- Claude thinking rotating words
- https://uditakhourii.github.io/adhd/
- https://thesvg.org
- https://www.radix-ui.com
- https://www.awwwards.com/awwwards/collections/css-js-animations/
- https://www.hover.dev/components/heros
- https://github.com/chenglou/chenglou.github.io
- https://github.com/AndrewPrifer/liquid-dom

### Design
- https://emilkowal.ski/ui/7-practical-animation-tips
- https://animations.dev/vocabulary
- https://www.ui-skills.com · [repo](https://github.com/ibelick/ui-skills)
- https://index.how/to/articulate
- https://pixelwrld.co
- https://godly.website/website/roman-tesliuk-947
- https://mchiu.co.uk
- https://ehabhussein.com/
- https://juanmora.co/
- https://danielamuntyan.com/
- https://www.northgarden.com/
- https://lottiefiles.com/
- https://yanhladchenko.com/
- https://appstacks.club/mobile-apps
- https://www.symbols.dev
- https://designdotmd.directory
- https://polpus.studio
- https://flighty.com/
- https://www.typeui.sh
- https://designmd.cc
- https://staromlynski.com
- https://www.kevdu.co
- https://polpus.studio
- https://liquid-dom-showcase.vercel.app/
- https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4
- https://appstacks.club/mobile-apps
- https://www.landing.love/categories/portfolio/
- https://www.stainless.com
- https://www.interfacecraft.dev
- https://interfaces.dev
- https://cofounder.co
- https://www.hover.dev
- https://gridportfolio.sites.blink.new
- https://rauno.me
- https://www.killerportfolio.com
- https://www.youtube.com/@samselikoff

### Glass
- https://themagicianscode.dev/prototypes/liquid-glass-pill/
- https://kube.io/blog/liquid-glass-css-svg/
- [Progressive blur (Paco Coursey)](https://paco.me/craft/blur) — stacked masked `backdrop-filter` layers (the technique already used by the `.card-blur` edge strips). Also documents the Chromium bug where `overflow: hidden` + `border-radius` + `backdrop-filter` clip before filtering (hard edge) — fix is to clip with `mask` instead of `overflow: hidden`. Relevant again if the expanded cards ever keep rounded corners (currently they morph to `border-radius: 0`, which sidesteps it).

## Prompting
- https://thariqs.github.io/html-effectiveness/

### Extras to think about
- Claude playing radio on schedule?
- https://andonlabs.com/radio
- [Weekly survival guide](https://www.reddit.com/r/ClaudeAI/wiki/survivalguideweekly/)
- Edge-blur / mask-fade on case-study titles (desktop only?) — alternative to text wrapping where the title stays on one line and the right edge fades to transparent via `mask-image: linear-gradient(...)`. Container width changes during open/close simply reveal more of the same text (no reflow, no word-flip, no Pretext needed). Trade-off: mobile users lose information at the tile level since there's less screen real estate to begin with, so this likely needs to be desktop-only or disabled under a viewport-width media query. Could pair with `backdrop-filter: blur(...)` on a right-edge pseudo-element for an actual progressive blur instead of just opacity fade.
- In each project box extended content: "For all the nerds out there, this one's for you", with the detailed or "extravagant" button with deepwiki links
- https://huggingface.co/NemoStation/Marlin-2B
- https://github.com/lottiefiles/dotlottie-web
- https://www.workforce.ai/
- Tab title animated text and animated favicon SVG? [Studio Gusto](https://www.studiogusto.com/studio)

### Performance
- WebGPU or WebGL
- Web Animaions API
- Lottie animations
- [GSAP](https://gsap.com)
- https://performance.dev/how-is-linear-so-fast-a-technical-breakdown
- https://www.npmjs.com/package/html-in-canvas-polyfill
- https://performance.dev

### Courses
- https://devouringdetails.com
- https://animations.dev
- https://motion.dev

### Layout ideas
- Parallax Hero
- Stagger blur fade text appear and disappear
- Horizontally scrollable parallax projects
- The nav bar is the sections navigator displaying circular progress for each section + the section's title instead of inline
- https://juanmora.co/
Website made using:
- Figma
- Webflow
- GSAP
- AE/Lottie
- Lennis Scroll