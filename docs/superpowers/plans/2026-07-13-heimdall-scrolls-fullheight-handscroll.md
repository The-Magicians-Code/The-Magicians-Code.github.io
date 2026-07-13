# Heimdall Scrolls — Full-Height v8 Handscroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the v8 same-direction-roller handscroll to `docs/redesign/heimdall-scrolls.html`, scaled so the rollers span the full viewport height, opened via the hero's "Read the trial" link.

**Architecture:** The existing hero (junkships watercolor + 見/Heimdall/tagline) stays untouched. Three new layers are added inside `.world`: a `.backdrop` dim wash, a `.scrollwrap` overlay hosting the v8 scroll structure (two roller columns flanking a width-animated `#wrap` > `#scroller` > `#paper`), and an `is-open` state class that dims the hero and reveals the scroll. v8's JS mechanics (grain math, easings, drag-vs-click discrimination) are ported verbatim; only sizing changes from fixed px to viewport-driven CSS tokens.

**Tech Stack:** Plain HTML/CSS/JS, single file, no build. Spec: `docs/superpowers/specs/2026-07-13-heimdall-scrolls-fullheight-handscroll-design.md`.

## Global Constraints

- Target file: `docs/redesign/heimdall-scrolls.html` only. Do not touch `heimdall-scroll.html` (a different variant) or `chinese_handscroll_v8_same_direction_rollers.html` (the source).
- Roller height = `100svh`; paper/wrap height = `calc(100svh - 26px)`; closed wrap width = `26px`; open width token `--paper-w-open: 94vw`.
- Grain math verbatim from v8: `pan = Math.abs(scrollLeft) * 0.6`, `grainL = (open ? -132 : 0) + pan`, `grainR = pan`. Open ease `cubic-bezier(.3,1.18,.35,1)` over `2.1s`; close ease `cubic-bezier(.55,0,.3,1)`.
- Roller grain repeat period must stay ≥ 7px (it is 44px background-size in v8 — keep).
- `prefers-reduced-motion: reduce` → all scroll/backdrop/stack transitions disabled, states switch instantly.
- No native scrollbars anywhere.
- Verification is browser-based over local HTTP (`python3 -m http.server` in `docs/redesign/`); `file://` is blocked in the browser tool. `npm run check`/`build` do not apply (file is not in the Astro build).
- Commits go on `main` locally (matching prior `docs(redesign):` prototype commits); do not push.

---

### Task 1: Scroll structure — CSS + HTML

**Files:**
- Modify: `docs/redesign/heimdall-scrolls.html` (currently a byte-identical copy of `heimdall-junkships.html`; untracked)

**Interfaces:**
- Produces: DOM ids `#stage`, `#wrap`, `#scroller`, `#paper`, `#rollerL`, `#rollerR`, link id `#read-trial`, and the `world.is-open` state class — Task 2's JS binds to exactly these.

- [ ] **Step 1: Add the handscroll CSS block**

In `docs/redesign/heimdall-scrolls.html`, insert the following immediately **before** the existing `@media (max-aspect-ratio: 1/1)` rule inside the `<style>` block:

```css
  /* ============ Handscroll (v8 mechanics, full-viewport height) ============ */
  :root { --paper-h: calc(100svh - 26px); --paper-w-open: min(94vw, calc(100vw - 26px)); }

  .stack { transition: opacity 0.7s var(--ease-out), filter 0.7s var(--ease-out), transform 0.7s var(--ease-out); }
  .world.is-open .stack { opacity: 0.14; filter: blur(3px); transform: scale(0.98); pointer-events: none; }

  .backdrop {
    position: absolute; inset: 0; z-index: 3; pointer-events: none;
    background: radial-gradient(90vmax 90vmax at 50% 50%, rgba(14,9,5,0.30) 0%, rgba(14,9,5,0.52) 100%);
    opacity: 0; visibility: hidden;
    transition: opacity 0.6s var(--ease-out), visibility 0.6s;
  }
  .world.is-open .backdrop { opacity: 1; visibility: visible; }

  .scrollwrap {
    position: absolute; inset: 0; z-index: 4;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; visibility: hidden; transform: scale(0.985);
    transition: opacity 0.4s var(--ease-out), transform 0.4s var(--ease-out), visibility 0.4s;
  }
  .world.is-open .scrollwrap { opacity: 1; visibility: visible; transform: scale(1); }

  #stage { display: flex; align-items: center; cursor: pointer; user-select: none; -webkit-user-select: none; }
  #stage:focus-visible { outline: 2px solid var(--gold); outline-offset: -3px; }

  .rollcol {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100svh; flex: none; position: relative; z-index: 5;
  }
  .rollcol--l { margin-right: -13px; }
  .rollcol--r { margin-left: -13px; }
  .knob { width: 14px; height: 22px; flex: none; border-radius: 7px;
    background: linear-gradient(90deg,#3d2b1a,#8a5a2e 45%,#c89b62 55%,#5a3c22); }
  .jade { width: 18px; height: 12px; flex: none; border-radius: 50%/60%;
    background: radial-gradient(ellipse at 35% 35%,#9fd6b8,#4a8f6a 60%,#2c5c44); }
  .roller { width: 26px; height: 100svh; flex: none; border-radius: 13px; background-color: #8a5a2e;
    background-image: linear-gradient(90deg,rgba(20,10,4,.85),rgba(107,68,35,.2) 30%,rgba(255,220,170,.38) 48%,rgba(255,232,195,.46) 52%,rgba(80,48,22,.5) 72%,rgba(22,12,5,.9)),
      repeating-linear-gradient(90deg,rgba(38,20,7,.55) 0 3px,rgba(0,0,0,0) 3px 9px,rgba(58,33,13,.4) 9px 12px,rgba(0,0,0,0) 12px 22px);
    background-size: 100% 100%, 44px 100%; background-position: 0 0, 0 0;
    box-shadow: inset 0 6px 10px rgba(255,255,255,.15), inset 0 -8px 12px rgba(0,0,0,.35), 0 4px 10px rgba(0,0,0,.35);
    transition: background-position 2.1s cubic-bezier(.3,1.18,.35,1); }

  #wrap { width: 26px; height: var(--paper-h); overflow: hidden; position: relative; z-index: 1;
    transition: width 2.1s cubic-bezier(.3,1.18,.35,1); }
  #scroller { overflow-x: auto; overflow-y: hidden; direction: rtl; width: 100%; height: 100%;
    scrollbar-width: none; cursor: grab; }
  #scroller::-webkit-scrollbar { display: none; }
  #paper { width: max-content; height: 100%; display: flex; background: #efe3c6; box-shadow: 0 6px 18px rgba(0,0,0,.28); }
  .brocade { width: 30px; height: 100%; flex: none;
    background: #1c2947 repeating-linear-gradient(45deg,rgba(201,166,90,.28) 0 2px,transparent 2px 9px),
                repeating-linear-gradient(-45deg,rgba(201,166,90,.28) 0 2px,transparent 2px 9px); }
  .trim { width: 3px; height: 100%; flex: none; background: linear-gradient(#c9a65a,#a3833f); }
  .artwork { height: 100%; width: calc(var(--paper-h) * (1200 / 314)); flex: none; position: relative; background: #f1e6cb;
    background-image: repeating-linear-gradient(0deg,rgba(120,100,60,.05) 0 1px,transparent 1px 7px),
      radial-gradient(ellipse at 20% 80%,rgba(140,115,70,.10),transparent 55%),
      radial-gradient(ellipse at 85% 15%,rgba(140,115,70,.08),transparent 50%); }
  .artwork svg { display: block; width: 100%; height: 100%; }
  .edgeshadow { position: absolute; top: 0; bottom: 0; width: 34px; pointer-events: none; z-index: 3; }
  .edgeshadow--l { left: 0; background: linear-gradient(90deg,rgba(30,20,10,.5),rgba(30,20,10,.14) 40%,rgba(255,250,235,.14) 68%,rgba(255,250,235,0)); }
  .edgeshadow--r { right: 0; background: linear-gradient(-90deg,rgba(30,20,10,.5),rgba(30,20,10,.14) 40%,rgba(255,250,235,.14) 68%,rgba(255,250,235,0)); }

  /* calligraphy + seals, offsets = v8 px × (100svh / 314) — decorative, eye-tune if needed */
  .vtext { position: absolute; writing-mode: vertical-rl; font-family: 'Kaiti SC','STKaiti','KaiTi',serif; }
  .cal-title { top: 6.4svh; right: 8.3svh; font-size: 8.3svh; letter-spacing: 1.9svh; color: #2c2620; }
  .cal-date  { top: 7.6svh; right: 20.4svh; font-size: 3.8svh; letter-spacing: 0.95svh; color: #4d453a; }
  .cal-left  { top: 7.6svh; left: 17.8svh; font-size: 4.1svh; letter-spacing: 1.3svh; color: #4d453a; }
  .seal { position: absolute; background: #b3372a; border-radius: 3px;
    display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
  .seal .vtext { position: static; color: #f4e8d2; }
  .seal--artist { top: 44.6svh; right: 8.9svh; width: 8.3svh; height: 8.3svh; }
  .seal--artist .vtext { font-size: 4.1svh; letter-spacing: 0.3svh; }
  .seal--coll { top: 47.8svh; left: 8.3svh; width: 7svh; height: 7svh; }
  .seal--coll .vtext { font-size: 3.5svh; }
```

Also extend the existing `prefers-reduced-motion` block (keep its current contents) by adding this rule inside it:

```css
    .stack, .backdrop, .scrollwrap, #wrap, .roller { transition: none !important; }
```

- [ ] **Step 2: Give the "Read the trial" link an id**

Change the existing line:

```html
        <a class="more" href="#">Read the trial <span class="arr">&rarr;</span></a>
```

to:

```html
        <a class="more" id="read-trial" href="#" aria-expanded="false" aria-controls="stage">Read the trial <span class="arr">&rarr;</span></a>
```

- [ ] **Step 3: Add the backdrop + scroll markup**

Insert immediately **after** the closing `</div>` of `.plate` (still inside `<main class="world">`):

```html
    <div class="backdrop"></div>
    <div class="scrollwrap">
      <div id="stage" role="button" tabindex="0" aria-expanded="false"
           aria-label="Heimdall handscroll: click to roll away, drag to pan">
        <div class="rollcol rollcol--l">
          <div class="jade"></div><div class="knob"></div>
          <div id="rollerL" class="roller"></div>
          <div class="knob"></div><div class="jade"></div>
        </div>
        <div id="wrap">
          <div id="scroller">
            <div id="paper">
              <div class="brocade"></div><div class="trim"></div>
              <div class="artwork">
                <svg viewBox="0 0 1200 314" aria-hidden="true">
                  <ellipse cx="1010" cy="105" rx="130" ry="55" fill="#cfc6ac" opacity="0.35"/>
                  <ellipse cx="760" cy="80" rx="120" ry="45" fill="#cfc6ac" opacity="0.3"/>
                  <ellipse cx="420" cy="95" rx="140" ry="50" fill="#cfc6ac" opacity="0.32"/>
                  <ellipse cx="150" cy="120" rx="120" ry="55" fill="#cfc6ac" opacity="0.3"/>
                  <path d="M880 190 Q950 82 1008 138 Q1040 55 1095 130 Q1130 88 1175 158 L1175 314 L880 314 Z" fill="#a89d82" opacity="0.55"/>
                  <path d="M560 200 Q620 95 675 150 Q715 70 770 145 Q810 100 860 170 L860 314 L560 314 Z" fill="#a89d82" opacity="0.5"/>
                  <path d="M120 195 Q180 90 240 148 Q280 65 335 142 Q375 98 420 165 L420 314 L120 314 Z" fill="#a89d82" opacity="0.5"/>
                  <path d="M980 214 Q1060 65 1120 148 Q1155 92 1210 162 L1210 314 L980 314 Z" fill="#7d7259" opacity="0.7"/>
                  <path d="M330 220 Q410 78 470 158 Q505 105 555 172 Q595 132 645 195 L645 314 L330 314 Z" fill="#7d7259" opacity="0.65"/>
                  <path d="M-10 246 Q45 162 95 213 Q135 153 190 232 Q225 190 265 250 L265 314 L-10 314 Z" fill="#4d4536"/>
                  <path d="M700 250 Q760 175 815 225 Q855 180 905 240 Q940 205 980 252 L980 314 L700 314 Z" fill="#4d4536"/>
                  <path d="M96 214 q-6 -22 4 -40 M118 218 q2 -26 14 -44 M188 232 q-8 -20 -2 -42 M816 227 q-6 -20 2 -38 M906 240 q-4 -22 6 -40" fill="none" stroke="#332d22" stroke-width="1.6" opacity="0.7"/>
                  <path d="M0 278 H1200 M30 290 H420 M520 290 H900 M980 290 H1200 M120 300 H350 M600 302 H1080" stroke="#8b8168" stroke-width="1" opacity="0.45" fill="none"/>
                  <path d="M470 278 q45 -34 90 0" fill="none" stroke="#5a5142" stroke-width="4"/>
                  <path d="M478 278 q37 -26 74 0" fill="none" stroke="#5a5142" stroke-width="2" opacity="0.7"/>
                  <path d="M472 278 v10 M508 258 v30 M544 278 v10" stroke="#5a5142" stroke-width="2" fill="none"/>
                  <path d="M340 280 q14 -8 30 0 l-4 6 h-22 Z" fill="#3a342a"/>
                  <path d="M355 274 l0 -10 q10 -2 8 6" fill="none" stroke="#3a342a" stroke-width="1.4"/>
                  <path d="M905 284 q12 -7 26 0 l-3 5 h-19 Z" fill="#3a342a"/>
                  <path d="M916 279 l0 -9 q9 -2 7 5" fill="none" stroke="#3a342a" stroke-width="1.3"/>
                  <path d="M245 235 h34 l-6 -12 h-22 Z M251 223 h22 l-5 -11 h-12 Z M256 212 h12 l-6 -12 Z" fill="#4a4234"/>
                  <rect x="258" y="235" width="8" height="14" fill="#4a4234"/>
                  <path d="M1105 248 q-3 -30 6 -52 M1105 220 q-16 -4 -26 -16 M1106 212 q14 -8 22 -20 M1104 234 q-12 -2 -20 -10" fill="none" stroke="#3f382b" stroke-width="2.4"/>
                  <path d="M1068 194 q22 -16 46 -8 M1082 180 q18 -12 38 -6 M1096 206 q20 -10 36 -2" fill="none" stroke="#565040" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
                  <path d="M690 120 l7 5 l7 -5 M706 128 l7 5 l7 -5 M676 132 l6 4 l6 -4" fill="none" stroke="#4d4536" stroke-width="1.5"/>
                </svg>
                <div class="vtext cal-title">千里江山</div>
                <div class="vtext cal-date">丙午年夏月寫</div>
                <div class="seal seal--artist"><span class="vtext">墨仙</span></div>
                <div class="vtext cal-left">行到水窮處　坐看雲起時</div>
                <div class="seal seal--coll"><span class="vtext">藏</span></div>
              </div>
              <div class="trim"></div><div class="brocade"></div>
            </div>
          </div>
          <div class="edgeshadow edgeshadow--l"></div>
          <div class="edgeshadow edgeshadow--r"></div>
        </div>
        <div class="rollcol rollcol--r">
          <div class="jade"></div><div class="knob"></div>
          <div id="rollerR" class="roller"></div>
          <div class="knob"></div><div class="jade"></div>
        </div>
      </div>
    </div>
```

- [ ] **Step 4: Verify the static structure in the browser**

Run: `python3 -m http.server 8901 --directory docs/redesign` (background), open `http://localhost:8901/heimdall-scrolls.html` in the browser tool.

Expected: hero identical to before (watercolor, 見, Heimdall, tagline; no scroll visible).
Then via DevTools/JS, add the class: `document.querySelector('.world').classList.add('is-open')` and set `document.getElementById('wrap').style.width='var(--paper-w-open)'`.
Expected: hero dims/blurs; a full-viewport-height scroll appears — two wood rollers just inside the screen edges spanning top to bottom (end caps clipped off-screen), cream paper with the scaled ink panorama between them; paper edges tuck under the rollers with no gaps; no vertical or horizontal native scrollbars; dragging the paper region scrolls it natively (scrollbar hidden).

- [ ] **Step 5: Commit**

```bash
git add docs/redesign/heimdall-scrolls.html
git commit -m "docs(redesign): heimdall-scrolls — full-height v8 scroll structure (static)"
```

---

### Task 2: Behavior — open/close, grain rotation, drag

**Files:**
- Modify: `docs/redesign/heimdall-scrolls.html`

**Interfaces:**
- Consumes: ids `#stage`, `#wrap`, `#scroller`, `#rollerL`, `#rollerR`, `#read-trial`, class `world.is-open` from Task 1.
- Produces: final interactive prototype; no downstream consumers.

- [ ] **Step 1: Add the script**

Insert immediately **before** `</body>`:

```html
  <script>
  (function(){
    var world=document.querySelector('.world');
    var plate=document.querySelector('.plate');
    var link=document.getElementById('read-trial');
    var stage=document.getElementById('stage');
    var wrap=document.getElementById('wrap');
    var rL=document.getElementById('rollerL'),rR=document.getElementById('rollerR');
    var sc=document.getElementById('scroller');
    var open=false,openTimer=0,closeTimer=0,endH=null,K=0.6;
    var EASE_OPEN='cubic-bezier(.3,1.18,.35,1)',EASE_CLOSE='cubic-bezier(.55,0,.3,1)';
    /* live MediaQueryList — read .matches at each use so a mid-session
       reduced-motion flip can't strand the overlay waiting on transitionend */
    var mq=window.matchMedia('(prefers-reduced-motion: reduce)');

    function pan(){return Math.abs(sc.scrollLeft)*K;}
    function grainL(){return (open?-132:0)+pan();}
    function grainR(){return pan();}
    function setGrain(animate){
      var d=(animate&&!mq.matches)?'2.1s':'0s';
      rL.style.transitionDuration=d;rR.style.transitionDuration=d;
      rL.style.backgroundPosition='0 0, '+grainL()+'px 0';
      rR.style.backgroundPosition='0 0, '+grainR()+'px 0';
    }
    function setEase(e){[wrap,rL,rR].forEach(function(el){el.style.transitionTimingFunction=e;});}

    function openScroll(){
      if(open)return;
      open=true;
      clearTimeout(closeTimer);
      if(endH){wrap.removeEventListener('transitionend',endH);endH=null;}  /* reopen mid-close */
      sc.scrollLeft=0;
      world.classList.add('is-open');
      plate.inert=true;                       /* dimmed hero leaves tab order + a11y tree */
      stage.setAttribute('aria-expanded','true');
      link.setAttribute('aria-expanded','true');
      stage.focus();
      openTimer=setTimeout(function(){
        /* commit the closed grain baseline at 0s before animating — the
           programmatic scrollLeft reset above may have fired the scroll
           handler and pre-snapped the grain to its open target */
        rL.style.transitionDuration='0s';rR.style.transitionDuration='0s';
        rL.style.backgroundPosition='0 0, 0px 0';
        rR.style.backgroundPosition='0 0, 0px 0';
        void rL.offsetWidth;
        setEase(EASE_OPEN);
        wrap.style.width='var(--paper-w-open)';
        setGrain(true);
      },mq.matches?0:420);
    }
    function teardown(){
      if(endH){wrap.removeEventListener('transitionend',endH);endH=null;}
      clearTimeout(closeTimer);
      world.classList.remove('is-open');
      plate.inert=false;
      link.focus();
    }
    function closeScroll(){
      if(!open)return;
      open=false;
      clearTimeout(openTimer);                /* close during materialization: kill pending expansion */
      stage.setAttribute('aria-expanded','false');
      link.setAttribute('aria-expanded','false');
      var w=parseFloat(getComputedStyle(wrap).width);
      setEase(EASE_CLOSE);
      wrap.style.width='26px';
      setGrain(true);
      if(mq.matches||w<=26){teardown();return;}  /* no width transition will run → no transitionend */
      endH=function(e){
        if(e.propertyName!=='width')return;
        wrap.removeEventListener('transitionend',endH);endH=null;
        if(!open)teardown();
      };
      wrap.addEventListener('transitionend',endH);
      closeTimer=setTimeout(function(){if(!open)teardown();},2400);  /* bounded fallback */
    }
    /* instant recovery if reduced-motion flips on while a close is pending */
    mq.addEventListener('change',function(){
      if(mq.matches&&!open&&world.classList.contains('is-open'))teardown();
    });

    link.addEventListener('click',function(e){e.preventDefault();openScroll();});

    var dragging=false,moved=false,startX=0,startScroll=0;
    sc.addEventListener('pointerdown',function(e){
      dragging=true;moved=false;startX=e.clientX;startScroll=sc.scrollLeft;
      sc.setPointerCapture(e.pointerId);sc.style.cursor='grabbing';
    });
    sc.addEventListener('pointermove',function(e){
      if(!dragging)return;
      var dx=e.clientX-startX;
      if(Math.abs(dx)>5)moved=true;
      sc.scrollLeft=startScroll-dx;
    });
    function endDrag(){dragging=false;sc.style.cursor='grab';}
    sc.addEventListener('pointerup',endDrag);
    sc.addEventListener('pointercancel',function(){endDrag();moved=false;});
    sc.addEventListener('scroll',function(){setGrain(false);});

    stage.addEventListener('click',function(){if(moved){moved=false;return;}closeScroll();});
    stage.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();closeScroll();}
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeScroll();});
  })();
  </script>
```

- [ ] **Step 2: Verify interactions in the browser**

With the same local server, reload `http://localhost:8901/heimdall-scrolls.html` and check:

1. Click "Read the trial" → hero dims/blurs, backdrop fades in, closed full-height sliver materializes centered (~0.4s), then springs open to ~94vw over 2.1s; **left roller grain visibly spins during the opening** (the −132px open-spin).
2. Drag the paper left/right → paper pans; **both rollers' grain moves the same direction** in step with the paper (no transition lag while dragging).
3. Horizontal trackpad scroll on the paper also pans (if testable).
4. A drag ending on the paper does **not** close the scroll; a plain click (< 5px movement) anywhere on the scroll rolls it closed (close ease, grain spins back), then the scroll fades out and the hero resolves back.
5. Esc closes it the same way. Enter/Space on the focused stage closes it. Focus returns to the "Read the trial" link after close.
6. Re-open → paper starts panned to its right end again (`scrollLeft` reset).
7. **Race cases (from Codex review):** (a) click "Read the trial" then press Esc within the 420ms materialization → the scroll never expands and the hero returns cleanly; (b) press Esc mid-way through the opening width spring → it rolls back closed and tears down; (c) open → drag/pan somewhere → close → re-open → **the left roller open-spin animates again** (grain baseline reset).
8. **Keyboard/a11y:** while open, Shift+Tab from the stage does not reach the dimmed "Read the trial" link (plate is `inert`); focus lands on the stage immediately on open and returns to the link after close; the link and stage both report correct `aria-expanded`.
9. DevTools → emulate `prefers-reduced-motion: reduce` → reload → open/close are instant, no spring/spin/fade.
10. No native scrollbars at any point; no layout shift of the hero.

- [ ] **Step 3: Commit**

```bash
git add docs/redesign/heimdall-scrolls.html
git commit -m "docs(redesign): heimdall-scrolls — open/close, same-direction grain, drag-pan"
```

---

### Task 3: Polish pass — calligraphy placement + cross-check against spec

**Files:**
- Modify: `docs/redesign/heimdall-scrolls.html` (only if issues found)

**Interfaces:**
- Consumes: the complete prototype from Tasks 1–2.
- Produces: verified final state; screenshot evidence for review.

- [ ] **Step 1: Visual audit at two viewport sizes**

In the browser tool, at ~1440×900 and ~1280×720: open the scroll and screenshot. Check: calligraphy/seals sit inside the paper near the corners (title top-right, colophon top-left, seals below each) and don't collide with mountains illegibly; the title-end of the paper clears the right roller; brocade ends tuck under the rollers flush. Eye-tune the `.cal-*` / `.seal--*` svh offsets if anything overlaps a roller or clips — offsets are decorative judgment per the spec.

- [ ] **Step 2: Spec conformance checklist**

Re-read `docs/superpowers/specs/2026-07-13-heimdall-scrolls-fullheight-handscroll-design.md` §Decisions + §Flow and confirm each numbered decision and flow step is observable in the browser. Report any deviation rather than silently accepting it.

Note in the final report that the **Safari/iOS parity pass is still pending** (spec §Verification requires it before the prototype is promoted further) — Chromium-only checks here do not discharge it. Flag RTL horizontal scrolling, `svh` full-height clipping, and `inert` behavior as the specific WebKit risk areas to check.

- [ ] **Step 3: Commit (only if Step 1 changed offsets)**

```bash
git add docs/redesign/heimdall-scrolls.html
git commit -m "docs(redesign): heimdall-scrolls — tune calligraphy/seal placement"
```
