/**
 * Liquid-glass runtime.
 *
 * Spec: docs/superpowers/specs/2026-05-08-liquid-glass-module-design.md
 *
 * Auto-discovers `.liquid-glass` elements at DOMContentLoaded, builds a
 * per-instance SVG filter for each, and applies the inline backdrop-filter.
 *
 * Originally ported from
 * github.com/The-Magicians-Code/prototypes/liquid-glass-pill (pill.js).
 */

declare global {
  interface Window {
    __lg?: {
      refresh: (el: Element) => void;
    };
  }
}

const DESKTOP_MQ = '(min-width: 641px)';

let defsContainer: SVGSVGElement | null = null;

function ensureDefsContainer(): SVGSVGElement {
  if (defsContainer && defsContainer.isConnected) return defsContainer;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'liquid-glass-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('color-interpolation-filters', 'sRGB');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);
  document.body.appendChild(svg);
  defsContainer = svg;
  return svg;
}

function initElement(_el: Element): void {
  // Filled in by Task 5.
}

function refresh(el: Element): void {
  initElement(el);
}

function discoverAndInit(): void {
  ensureDefsContainer();
  const elements = document.querySelectorAll<HTMLElement>('.liquid-glass');
  elements.forEach(initElement);
}

window.__lg = { refresh };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', discoverAndInit);
} else {
  discoverAndInit();
}

export {};
