/* ============================================================
   The Magicians Code — interactions
   No dependencies. Everything degrades gracefully and respects
   prefers-reduced-motion.
   ============================================================ */

(() => {
  "use strict";

  // The loading state is opted into from JS so the page stays usable
  // when scripts are disabled or blocked (see <noscript> fallback).
  document.body.setAttribute("data-loading", "");

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ------------------------------------------------ split hero chars ---- */

  document.querySelectorAll("[data-split]").forEach((el, li) => {
    const text = el.textContent;
    el.textContent = "";
    el.parentElement.style.setProperty("--li", li);
    [...text].forEach((ch, ci) => {
      const span = document.createElement("span");
      span.className = "char";
      span.style.setProperty("--ci", ci);
      span.style.setProperty("--li", li);
      span.textContent = ch;
      el.appendChild(span);
    });
  });

  /* ----------------------------------------------------------- loader ---- */

  const loader = document.getElementById("loader");
  const count = document.getElementById("loaderCount");

  const finishLoading = () => {
    loader.classList.add("is-done");
    document.body.removeAttribute("data-loading");
    document.body.classList.add("is-ready");
  };

  if (reduceMotion) {
    finishLoading();
  } else {
    let n = 0;
    const tick = () => {
      n = Math.min(100, n + Math.ceil(Math.random() * 9));
      count.textContent = String(n).padStart(2, "0");
      if (n < 100) {
        setTimeout(tick, 50 + Math.random() * 80);
      } else {
        setTimeout(finishLoading, 250);
      }
    };
    tick();
    // Safety net: never trap the page behind the curtain.
    setTimeout(() => {
      if (document.body.hasAttribute("data-loading")) finishLoading();
    }, 4000);
  }

  /* ----------------------------------------------------- aurora canvas ---- */

  const canvas = document.getElementById("aurora");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    const blobs = [
      { x: 0.2, y: 0.25, r: 0.55, hue: 252, sat: 70, spd: 0.00011, ph: 0 },
      { x: 0.75, y: 0.3, r: 0.45, hue: 170, sat: 55, spd: 0.00014, ph: 2.1 },
      { x: 0.5, y: 0.85, r: 0.6, hue: 268, sat: 60, spd: 0.00009, ph: 4.2 },
      { x: 0.9, y: 0.8, r: 0.35, hue: 42, sat: 60, spd: 0.00013, ph: 1.3 },
    ];
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let w = 0, h = 0, raf = 0, visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // render at reduced resolution: it's a blur field, nobody can tell
      w = canvas.width = Math.max(2, Math.floor(rect.width / 3));
      h = canvas.height = Math.max(2, Math.floor(rect.height / 3));
    };
    resize();
    addEventListener("resize", resize);

    if (finePointer) {
      addEventListener("pointermove", (e) => {
        mouse.tx = e.clientX / innerWidth;
        mouse.ty = e.clientY / innerHeight;
      });
    }

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(draw);
    }).observe(canvas);

    const draw = (t) => {
      raf = 0;
      if (!visible) return;
      mouse.x = lerp(mouse.x, mouse.tx, 0.04);
      mouse.y = lerp(mouse.y, mouse.ty, 0.04);

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#0b0b10";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (const b of blobs) {
        const bx = (b.x + Math.sin(t * b.spd + b.ph) * 0.08 + (mouse.x - 0.5) * 0.06) * w;
        const by = (b.y + Math.cos(t * b.spd * 1.3 + b.ph) * 0.1 + (mouse.y - 0.5) * 0.06) * h;
        const br = b.r * Math.min(w, h) * (1 + Math.sin(t * b.spd * 2 + b.ph) * 0.12);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, 52%, 0.16)`);
        g.addColorStop(1, "hsla(0, 0%, 0%, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }

  /* ------------------------------------------------- scroll machinery ---- */

  const nav = document.getElementById("nav");
  const progressBar = document.getElementById("progressBar");
  const depthEls = [...document.querySelectorAll("[data-depth]")];
  const parallaxImgs = [...document.querySelectorAll("[data-parallax]")];
  let lastY = scrollY;
  let targetY = scrollY;
  let smoothY = scrollY;
  let ticking = false;

  const applyScrollEffects = () => {
    ticking = false;
    // nav hide / show + solid background
    const y = scrollY;
    nav.classList.toggle("is-hidden", y > lastY && y > 140 && !menuOpen);
    nav.classList.toggle("is-solid", y > 40);
    lastY = y;

    const max = document.documentElement.scrollHeight - innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };

  addEventListener("scroll", () => {
    targetY = scrollY;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(applyScrollEffects);
    }
  }, { passive: true });

  // lerped parallax loop — gives the layered-depth, cinematic drift
  if (!reduceMotion) {
    const loop = () => {
      smoothY = lerp(smoothY, targetY, 0.085);
      if (Math.abs(smoothY - targetY) < 0.05) smoothY = targetY;

      for (const el of depthEls) {
        const d = parseFloat(el.dataset.depth);
        const rot = "rotate" in el.dataset ? ` rotate(${(smoothY * d * 0.2).toFixed(2)}deg)` : "";
        el.style.transform = `translate3d(0, ${-smoothY * d}px, 0)${rot}`;
      }
      for (const img of parallaxImgs) {
        const rect = img.parentElement.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > innerHeight) continue;
        const p = (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight;
        img.style.setProperty("--py", `${(p * 10).toFixed(2)}%`);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------ reveals ---- */

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  document.querySelectorAll(".reveal").forEach((el) => {
    if (el.dataset.delay) el.style.setProperty("--rd", `${el.dataset.delay}ms`);
    io.observe(el);
  });

  /* ------------------------------------------- manifesto word reveal ---- */

  const manifesto = document.getElementById("manifesto");
  if (manifesto) {
    const words = manifesto.textContent.trim().split(/\s+/);
    manifesto.innerHTML = words
      .map((wd) => `<span class="w">${wd}</span>`)
      .join(" ");
    const spans = [...manifesto.querySelectorAll(".w")];

    const litWords = () => {
      const rect = manifesto.getBoundingClientRect();
      const start = innerHeight * 0.85;
      const end = innerHeight * 0.25;
      const p = Math.min(1, Math.max(0, (start - rect.top) / (start - end + rect.height)));
      const cut = Math.floor(p * spans.length * 1.15);
      spans.forEach((s, i) => s.classList.toggle("is-lit", i <= cut || reduceMotion));
    };
    litWords();
    addEventListener("scroll", litWords, { passive: true });
  }

  /* ---------------------------------------------------- mobile menu ---- */

  const burger = document.getElementById("burger");
  const menu = document.getElementById("menu");
  let menuOpen = false;

  const setMenu = (open) => {
    menuOpen = open;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    menu.inert = !open;
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  };

  burger.addEventListener("click", () => setMenu(!menuOpen));
  menu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => setMenu(false))
  );
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) setMenu(false);
  });

  /* -------------------------------------------------- custom cursor ---- */

  if (finePointer && !reduceMotion) {
    const cursor = document.getElementById("cursor");
    const tag = document.getElementById("cursorTag");
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const target = { x: pos.x, y: pos.y };

    addEventListener("pointermove", (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
    });

    const cursorLoop = () => {
      pos.x = lerp(pos.x, target.x, 0.22);
      pos.y = lerp(pos.y, target.y, 0.22);
      cursor.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      tag.style.left = `${pos.x}px`;
      tag.style.top = `${pos.y}px`;
      requestAnimationFrame(cursorLoop);
    };
    cursorLoop();

    document.querySelectorAll("[data-cursor]").forEach((el) => {
      el.addEventListener("pointerenter", () => {
        cursor.classList.add("is-zoom");
        tag.textContent = el.dataset.cursor;
      });
      el.addEventListener("pointerleave", () => cursor.classList.remove("is-zoom"));
    });
  }

  /* ------------------------------------------------ magnetic hovers ---- */

  if (finePointer && !reduceMotion) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.28;
      // transforms need a box; only promote elements the stylesheet left inline
      if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
      el.style.transition = "transform .45s cubic-bezier(.22,1,.36,1)";
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transform = "translate(0, 0)";
      });
    });
  }

  /* ------------------------------------------------------ housekeeping ---- */

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
