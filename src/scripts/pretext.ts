// src/scripts/pretext.ts
// Per-word title morph animation for .cs-card case-study cards and the
// .stack-card tech stack card.
// Replaces the title's text with absolutely-positioned word spans
// pre-computed at TWO widths (card rest + modal expanded). Each span
// carries data-sx/sy/mx/my so the open / close lifecycle hooks can
// translate between them without re-measuring.
//
// Design spec: docs/superpowers/specs/2026-05-20-pretext-redesign-design.md
//
// Measurement uses a hidden DOM mirror (not Canvas) so CSS letter-spacing,
// kerning, and font features are all accounted for. Each engine measures
// with its own paint pipeline → engine-local layouts that line up exactly
// with what each engine paints.

export const PRETEXT_ENABLED = true;

interface WordWithEm {
  word: string;
  isEm: boolean;
}

interface WordMetric {
  word: string;
  width: number;
  spaceWidth: number;
  isEm: boolean;
}

interface WordPosition {
  word: string;
  x: number;
  y: number;
  line: number;
  isEm: boolean;
}

interface LayoutResult {
  positions: WordPosition[];
  lineWidths: number[];
}

const TITLE_LINE_HEIGHT_RATIO = 1.15;
const MIRROR_ID = 'pretext-mirror';

function getMirror(): HTMLSpanElement {
  const existing = document.getElementById(MIRROR_ID) as HTMLSpanElement | null;
  if (existing) return existing;
  const mirror = document.createElement('span');
  mirror.id = MIRROR_ID;
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.cssText = [
    'position: fixed',
    'top: -9999px',
    'left: -9999px',
    'visibility: hidden',
    'pointer-events: none',
    'white-space: nowrap',
    "font-family: var(--font-serif)",
    'font-weight: 400',
    `line-height: ${TITLE_LINE_HEIGHT_RATIO}`,
    'letter-spacing: -0.01em',
  ].join('; ');
  document.body.appendChild(mirror);
  return mirror;
}

function extractWordsWithEm(el: HTMLElement): WordWithEm[] {
  const result: WordWithEm[] = [];
  const walk = (node: Node, inEm: boolean): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      for (const word of text.split(/\s+/).filter(Boolean)) {
        result.push({ word, isEm: inEm });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const isInEm = inEm || (node as Element).tagName === 'EM';
      for (const child of Array.from(node.childNodes)) {
        walk(child, isInEm);
      }
    }
  };
  walk(el, false);
  return result;
}

function pretextOriginalWords(titleEl: HTMLElement): WordWithEm[] {
  if (titleEl.dataset.pretextWords) {
    try {
      const parsed = JSON.parse(titleEl.dataset.pretextWords) as WordWithEm[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* fall through and re-extract */
    }
  }
  const words = extractWordsWithEm(titleEl);
  titleEl.dataset.pretextWords = JSON.stringify(words);
  return words;
}

function pretextMeasureWords(words: WordWithEm[], fontSize: number): WordMetric[] {
  const mirror = getMirror();
  mirror.style.fontSize = `${fontSize}px`;
  mirror.style.fontStyle = 'normal';
  // Space-width via subtraction. A span containing only ' ' renders at
  // zero width because CSS layout collapses leading/trailing whitespace.
  // Measure 'ii' and 'i i' (where the middle space sits between glyphs
  // and is preserved), then back out the space width, accounting for
  // the extra inter-glyph letter-spacing the middle span introduces:
  //   width('ii')  = 2*Wi + 1*ls
  //   width('i i') = 2*Wi + Wspace + 2*ls
  //   spaceWidth   = width('i i') - width('ii') - ls
  const lsPx = parseFloat(getComputedStyle(mirror).letterSpacing) || 0;
  mirror.textContent = 'ii';
  const wii = mirror.getBoundingClientRect().width;
  mirror.textContent = 'i i';
  const wisi = mirror.getBoundingClientRect().width;
  const spaceWidth = Math.max(0, wisi - wii - lsPx);
  return words.map((w) => {
    mirror.style.fontStyle = w.isEm ? 'italic' : 'normal';
    mirror.textContent = w.word;
    return {
      word: w.word,
      width: mirror.getBoundingClientRect().width,
      spaceWidth,
      isEm: w.isEm,
    };
  });
}

function pretextLayout(words: WordMetric[], maxWidth: number, lineHeight: number): LayoutResult {
  const positions: WordPosition[] = [];
  const lineWidths: number[] = [];
  if (words.length === 0) return { positions, lineWidths };
  let x = 0;
  let line = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (x > 0 && x + w.width > maxWidth) {
      lineWidths[line] = positions[positions.length - 1].x + words[i - 1].width;
      line++;
      x = 0;
    }
    positions.push({ word: w.word, x, y: line * lineHeight, line, isEm: w.isEm });
    x += w.width + w.spaceWidth;
  }
  lineWidths[line] = positions[positions.length - 1].x + words[words.length - 1].width;
  return { positions, lineWidths };
}

function pretextCenterPositions(
  positions: WordPosition[],
  lineWidths: number[],
  containerWidth: number,
): WordPosition[] {
  return positions.map((p) => ({
    ...p,
    x: p.x + (containerWidth - lineWidths[p.line]) / 2,
  }));
}

export interface ViewportRect {
  width: number;
}

// Render a single .cs-card or .stack-card title with word spans + source-modal
// transforms. getViewportRect returns the modal's target rect (provided by
// bento-expand.ts). Project cards center their modal title; stack card keeps
// natural-flow (left-aligned) modal positions.
export function pretextRenderCard(card: HTMLElement, getViewportRect: () => ViewportRect): void {
  if (!PRETEXT_ENABLED) return;
  if (!card.classList.contains('cs-card') && !card.classList.contains('stack-card')) return;
  const titleEl = card.querySelector<HTMLElement>('.card-title');
  if (!titleEl) return;
  const words = pretextOriginalWords(titleEl);
  if (words.length === 0) return;
  const fontSize = parseFloat(getComputedStyle(titleEl).fontSize) || 24;

  const body = card.querySelector<HTMLElement>('.card-body');
  if (!body) return;
  const bodyStyles = getComputedStyle(body);
  const bodyPadX =
    (parseFloat(bodyStyles.paddingLeft) || 0) + (parseFloat(bodyStyles.paddingRight) || 0);
  const sourceWidth = card.getBoundingClientRect().width - bodyPadX;

  const vr = getViewportRect();
  const modalHPad = window.innerWidth <= 540 ? 22 : 48;
  const modalWidth = vr.width - modalHPad * 2;

  if (sourceWidth <= 0 || modalWidth <= 0) return;

  const metrics = pretextMeasureWords(words, fontSize);
  if (metrics.length === 0) return;

  const lineHeight = fontSize * TITLE_LINE_HEIGHT_RATIO;
  const sourceLayout = pretextLayout(metrics, sourceWidth, lineHeight);
  const modalLayout = pretextLayout(metrics, modalWidth, lineHeight);

  // Source positions are NOT centered — natural-flow left-aligned positions
  // preserve the resting visual (cards look identical to today at rest).
  const sourcePositions = sourceLayout.positions;
  const modalPositions = card.classList.contains('cs-card')
    ? pretextCenterPositions(
        modalLayout.positions,
        modalLayout.lineWidths,
        modalWidth,
      )
    : modalLayout.positions;

  titleEl.replaceChildren();
  for (let i = 0; i < sourcePositions.length; i++) {
    const sp = sourcePositions[i];
    const mp = modalPositions[i];
    const el = document.createElement(sp.isEm ? 'em' : 'span');
    el.className = 'word';
    el.textContent = sp.word;
    el.style.transform = `translate(${sp.x.toFixed(2)}px, ${sp.y}px)`;
    el.dataset.sx = sp.x.toFixed(2);
    el.dataset.sy = String(sp.y);
    el.dataset.mx = mp.x.toFixed(2);
    el.dataset.my = String(mp.y);
    titleEl.appendChild(el);
  }

  // Title container must be tall enough to hold the taller of the two layouts.
  const sourceMaxLine =
    sourceLayout.positions.length > 0
      ? sourceLayout.positions[sourceLayout.positions.length - 1].line
      : 0;
  const modalMaxLine =
    modalLayout.positions.length > 0
      ? modalLayout.positions[modalLayout.positions.length - 1].line
      : 0;
  const tallestLine = Math.max(sourceMaxLine, modalMaxLine);
  titleEl.style.height = `${(tallestLine + 1) * lineHeight}px`;

  card.classList.add('pretext-title');
}

// Animate all .word spans on a single card between source and modal positions.
// Called from the open / close morph lifecycle in bento-expand.ts.
export function pretextAnimateCard(card: HTMLElement, toModal: boolean): void {
  card.querySelectorAll<HTMLElement>('.card-title .word').forEach((el) => {
    const x = toModal ? el.dataset.mx : el.dataset.sx;
    const y = toModal ? el.dataset.my : el.dataset.sy;
    if (x == null || y == null) return;
    el.style.transform = `translate(${x}px, ${y}px)`;
  });
}

// Re-measure every idle .cs-card / .stack-card. Skip cards mid-lifecycle
// (their geometry reflects the modal, not the rest position).
export function pretextRenderAll(
  getViewportRect: () => ViewportRect,
  skipCard?: HTMLElement | null,
): void {
  document.querySelectorAll<HTMLElement>(':is(.cs-card, .stack-card)[data-bento-card]').forEach((card) => {
    if (card === skipCard) return;
    if (
      card.classList.contains('is-expanding') ||
      card.classList.contains('is-expanded') ||
      card.classList.contains('is-collapsing')
    ) {
      return;
    }
    pretextRenderCard(card, getViewportRect);
  });
}
