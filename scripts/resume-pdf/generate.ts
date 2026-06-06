// ATS-minimal resume PDF generator.
//
// Renders `src/data/resume.ts` to a bare, machine-readable, black-on-white PDF
// using pdf-lib and the non-embedded base-14 Helvetica family. Output is
// deterministic: fixed metadata, fixed creation/mod dates derived from
// resume.meta.updatedAt, no Date.now()/Math.random().
//
// Run: `npm run resume:pdf` (writes dist/<PDF_FILENAME>). Pass `--copy-public` to
// also write public/<PDF_FILENAME>.

import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PDFDocument,
  PDFFont,
  PDFName,
  PDFNumber,
  PDFString,
  PDFArray,
  StandardFonts,
  rgb,
  type PDFPage,
} from 'pdf-lib';
import { resume } from '../../src/data/resume';
import { normalizeForPdf, assertEncodable } from './sanitize';

// ---------------------------------------------------------------------------
// Page geometry
// ---------------------------------------------------------------------------
const PAGE_W = 595.28; // A4 width in pt
const PAGE_H = 841.89; // A4 height in pt
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_BOTTOM = MARGIN; // y must stay above this

const BLACK = rgb(0, 0, 0);
const RULE = rgb(0, 0, 0); // black divider under section headers

// Output filename. On GitHub Pages this also becomes the download filename (no
// Content-Disposition is possible), so it's named after the person rather than
// "resume.pdf". Must match the button href, robots.txt, .gitignore and verify script.
const PDF_FILENAME = 'Tanel_Treuberg_Software_Engineer.pdf';

// Type scale
const SIZE_NAME = 18;
const SIZE_TITLE = 11;
const SIZE_BODY = 9.6;
const SIZE_SECTION = 11.5;
const SIZE_SMALL = 9;

const LEADING = 1.2; // line-height multiplier

// ---------------------------------------------------------------------------
// Fonts (set in main, used everywhere)
// ---------------------------------------------------------------------------
interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  oblique: PDFFont;
}

// ---------------------------------------------------------------------------
// Layout cursor — owns the document, the current page, and y.
// ---------------------------------------------------------------------------
class Layout {
  doc: PDFDocument;
  fonts: Fonts;
  page: PDFPage;
  pageCount = 1;
  y: number;

  constructor(doc: PDFDocument, fonts: Fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private newPage(): void {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pageCount += 1;
    this.y = PAGE_H - MARGIN;
  }

  /** Line height for a given font size. */
  lineHeight(size: number): number {
    return size * LEADING;
  }

  /**
   * Ensure at least `needed` pt of vertical space remains; otherwise break.
   * Returns true if a break occurred.
   */
  ensureSpace(needed: number): boolean {
    if (this.y - needed < CONTENT_BOTTOM) {
      this.newPage();
      return true;
    }
    return false;
  }

  /** Add vertical gap (no page break — used between sections only after content). */
  gap(amount: number): void {
    this.y -= amount;
  }
}

// ---------------------------------------------------------------------------
// Text safety: normalize then encode-check against the font that will draw it.
// ---------------------------------------------------------------------------
function safe(text: string, font: PDFFont, fieldPath: string): string {
  const normalized = normalizeForPdf(text);
  assertEncodable(normalized, font, fieldPath);
  return normalized;
}

// ---------------------------------------------------------------------------
// Word wrapping. Splits on spaces; force-splits any single token wider than
// maxWidth character-by-character with a guaranteed-progress guard.
// Operates on already-ASCII text.
// ---------------------------------------------------------------------------
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const widthOf = (s: string) => font.widthOfTextAtSize(s, size);
  const lines: string[] = [];
  // Normalize whitespace runs to single spaces; keep explicit newlines as breaks.
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of words) {
      // Force-split an over-long single token first.
      const pieces = splitToken(word, font, size, maxWidth);
      for (let p = 0; p < pieces.length; p += 1) {
        const piece = pieces[p];
        // A force-split piece (not the last) is on its own line by definition.
        const forcedBreak = pieces.length > 1 && p < pieces.length - 1;

        const candidate = current.length === 0 ? piece : `${current} ${piece}`;
        if (widthOf(candidate) <= maxWidth || current.length === 0) {
          current = candidate;
        } else {
          lines.push(current);
          current = piece;
        }

        if (forcedBreak) {
          lines.push(current);
          current = '';
        }
      }
    }
    if (current.length > 0) lines.push(current);
  }

  return lines;
}

/**
 * Split a single token into pieces that each fit within maxWidth.
 * Guaranteed progress: always consumes at least one char per piece.
 */
function splitToken(token: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const widthOf = (s: string) => font.widthOfTextAtSize(s, size);
  if (widthOf(token) <= maxWidth) return [token];

  const pieces: string[] = [];
  let buf = '';
  for (const ch of token) {
    const next = buf + ch;
    if (buf.length > 0 && widthOf(next) > maxWidth) {
      pieces.push(buf);
      buf = ch;
    } else {
      buf = next;
    }
  }
  if (buf.length > 0) pieces.push(buf);
  return pieces;
}

// ---------------------------------------------------------------------------
// Word-based text wrapping.
//
// We model a line as a flat list of `Segment`s (a piece of text with its font/
// size/width) grouped into `Word`s (contiguous non-whitespace). Words are the
// word-wrap break units; spaces between them collapse to a single space.
// ---------------------------------------------------------------------------
interface Segment {
  text: string; // ASCII-safe, ready to draw
  font: PDFFont;
  size: number;
  width: number; // advance width at `size`
}

interface Word {
  segments: Segment[];
  width: number; // total advance width
}

/**
 * Convert a string into words: normalize + encode-check, split on whitespace so the
 * surrounding words wrap correctly, and force-split any single word wider than
 * maxWidth (with guaranteed progress).
 */
function textToWords(
  text: string,
  baseFont: PDFFont,
  baseSize: number,
  maxWidth: number,
  fieldPath: string,
): Word[] {
  // Accumulate the current word's segments; a space flushes the word.
  const words: Word[] = [];
  let curSegs: Segment[] = [];

  const pushWord = () => {
    if (curSegs.length === 0) return;
    let width = 0;
    for (const s of curSegs) width += s.width;
    words.push({ segments: curSegs, width });
    curSegs = [];
  };

  const addSegment = (segText: string, font: PDFFont, size: number) => {
    if (segText.length === 0) return;
    curSegs.push({ text: segText, font, size, width: font.widthOfTextAtSize(segText, size) });
  };

  // Normalize + encode-check, then split on whitespace so the surrounding words
  // wrap correctly. Whitespace flushes the current word.
  const ascii = normalizeForPdf(text);
  assertEncodable(ascii, baseFont, fieldPath);
  let buf = '';
  for (const ch of ascii) {
    if (/\s/.test(ch)) {
      if (buf.length > 0) {
        addSegment(buf, baseFont, baseSize);
        buf = '';
      }
      pushWord();
    } else {
      buf += ch;
    }
  }
  if (buf.length > 0) addSegment(buf, baseFont, baseSize);
  pushWord();

  // Force-split any word wider than maxWidth (segment-by-segment, char-by-char),
  // with guaranteed progress so an over-long token can't loop forever.
  const out: Word[] = [];
  for (const word of words) {
    if (word.width <= maxWidth) {
      out.push(word);
      continue;
    }
    out.push(...forceSplitWord(word, maxWidth));
  }
  return out;
}

/**
 * Force-split an over-wide word into multiple words that each fit `maxWidth`.
 * Splits within segments char-by-char; always consumes at least one char so the
 * caller is guaranteed forward progress.
 */
function forceSplitWord(word: Word, maxWidth: number): Word[] {
  const pieces: Word[] = [];
  let segs: Segment[] = [];
  let width = 0;

  const flush = () => {
    if (segs.length > 0) {
      pieces.push({ segments: segs, width });
      segs = [];
      width = 0;
    }
  };

  for (const seg of word.segments) {
    let buf = '';
    let bufW = 0;
    const flushSeg = () => {
      if (buf.length > 0) {
        segs.push({ text: buf, font: seg.font, size: seg.size, width: bufW });
        width += bufW;
        buf = '';
        bufW = 0;
      }
    };
    for (const ch of seg.text) {
      const chW = seg.font.widthOfTextAtSize(ch, seg.size);
      // If adding this char overflows and we already have content on the line,
      // break to a new piece first (guaranteed-progress: never break an empty line).
      if (width + bufW + chW > maxWidth && (width > 0 || bufW > 0)) {
        flushSeg();
        flush();
      }
      buf += ch;
      bufW += chW;
    }
    flushSeg();
  }
  flush();
  return pieces;
}

/** Group words into lines that fit `maxWidth`, joined by single spaces. */
function layoutLines(words: Word[], spaceWidth: number, maxWidth: number): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineWidth = 0;

  for (const word of words) {
    const extra = line.length === 0 ? word.width : spaceWidth + word.width;
    if (line.length > 0 && lineWidth + extra > maxWidth) {
      lines.push(line);
      line = [word];
      lineWidth = word.width;
    } else {
      line.push(word);
      lineWidth += extra;
    }
  }
  if (line.length > 0) lines.push(line);
  if (lines.length === 0) lines.push([]);
  return lines;
}

interface DrawRunsOpts {
  font: PDFFont;
  size: number;
  fieldPath: string;
  x?: number; // x of continuation lines (and first line if hangX unset)
  hangX?: number; // x of the FIRST line (e.g. after a bullet marker)
  maxWidth?: number; // wrap width for continuation lines
  firstMaxWidth?: number; // wrap width for the first line (defaults to maxWidth)
}

/**
 * Draw a string as wrapped lines, advancing layout.y, with optional hanging indent
 * (first line at hangX, continuations at x). Word-wraps and force-splits over-wide
 * tokens.
 */
function drawRuns(layout: Layout, rawText: string, opts: DrawRunsOpts): void {
  const { font, size } = opts;
  const x = opts.x ?? MARGIN;
  const hangX = opts.hangX ?? x;
  const maxWidth = opts.maxWidth ?? CONTENT_W;
  const firstMaxWidth = opts.firstMaxWidth ?? maxWidth;
  const spaceWidth = font.widthOfTextAtSize(' ', size);
  const lh = layout.lineHeight(size);

  // Wrap against the tighter of the two widths so the first (narrower) line is
  // never overset; this is conservative but keeps the layout simple and safe.
  const wrapWidth = Math.min(firstMaxWidth, maxWidth);
  const words = textToWords(rawText, font, size, wrapWidth, opts.fieldPath);
  const lines = layoutLines(words, spaceWidth, wrapWidth);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    layout.ensureSpace(lh);
    const baselineY = layout.y - size;
    const lineX = i === 0 ? hangX : x;

    // Flatten the line's words into a segment stream, re-inserting an inter-word
    // space between words. Then coalesce adjacent segments that share font/size
    // into a single drawText call so a line emits one text op — keeping the
    // content stream (and file size) tight.
    const stream: Segment[] = [];
    for (let w = 0; w < line.length; w += 1) {
      if (w > 0) {
        stream.push({ text: ' ', font, size, width: spaceWidth });
      }
      for (const seg of line[w].segments) stream.push(seg);
    }

    let penX = lineX;
    let bi = 0;
    while (bi < stream.length) {
      const head = stream[bi];
      let text = head.text;
      let width = head.width;
      let bj = bi + 1;
      while (
        bj < stream.length &&
        stream[bj].font === head.font &&
        stream[bj].size === head.size
      ) {
        text += stream[bj].text;
        width += stream[bj].width;
        bj += 1;
      }
      layout.page.drawText(text, {
        x: penX,
        y: baselineY,
        size: head.size,
        font: head.font,
        color: BLACK,
      });
      penX += width;
      bi = bj;
    }
    layout.y -= lh;
  }
}

// ---------------------------------------------------------------------------
// Link annotation. Builds a real /Link annot with a PDF-string URI.
// ---------------------------------------------------------------------------
function percentEncodeUri(uri: string): string {
  // Idempotent encode: leave existing valid %XX escapes intact, and encode only
  // characters that are actually unsafe in a PDF /URI. A bare "%" not followed by
  // two hex digits is treated as a literal and encoded; "%20" and friends are
  // preserved as-is (so re-running never turns "%20" into "%2520"). encodeURI
  // preserves :/?#[]@!$&'()*+,;= and alphanumerics, which is what we want.
  return uri.replace(/%(?![0-9A-Fa-f]{2})|[^\x21-\x7E]/g, (c) => encodeURI(c));
}

function addLinkAnnotation(
  layout: Layout,
  x: number,
  baselineY: number,
  width: number,
  size: number,
  uri: string,
): void {
  // Rect spans from a little below baseline (descent) to a little above (cap).
  const descent = size * 0.22;
  const rise = size * 0.78;
  const x1 = x;
  const y1 = baselineY - descent;
  const x2 = x + width;
  const y2 = baselineY + rise;

  const rect = layout.doc.context.obj([
    PDFNumber.of(x1),
    PDFNumber.of(y1),
    PDFNumber.of(x2),
    PDFNumber.of(y2),
  ]);
  const border = layout.doc.context.obj([PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(0)]);

  const action = layout.doc.context.obj({
    S: PDFName.of('URI'),
    URI: PDFString.of(percentEncodeUri(uri)),
  });

  const annot = layout.doc.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: rect,
    Border: border,
    A: action,
  });

  const annotRef = layout.doc.context.register(annot);

  // Append to the page's /Annots array.
  const annotsKey = PDFName.of('Annots');
  let annots = layout.page.node.get(annotsKey) as PDFArray | undefined;
  if (!annots) {
    annots = layout.doc.context.obj([]) as PDFArray;
    layout.page.node.set(annotsKey, annots);
  }
  annots.push(annotRef);
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------
interface DrawOpts {
  font: PDFFont;
  size: number;
  x?: number;
  maxWidth?: number;
  fieldPath: string;
  /** If set, each wrapped fragment gets a /Link annotation with this URI. */
  linkUri?: string;
  /** Reserve space so the FIRST line is kept with `keepWithNext` following lines. */
  keepWithNext?: number;
  /** Horizontal alignment within the content width (default left). */
  align?: 'left' | 'center';
}

/**
 * Draw wrapped text starting at the current y, advancing y. Returns nothing.
 * Handles page breaks per-line. Optionally attaches link annotations.
 */
function drawWrapped(layout: Layout, rawText: string, opts: DrawOpts): void {
  const { font, size } = opts;
  const x = opts.x ?? MARGIN;
  const maxWidth = opts.maxWidth ?? CONTENT_W;
  const ascii = safe(rawText, font, opts.fieldPath);
  const lines = wrapText(ascii, font, size, maxWidth);
  const lh = layout.lineHeight(size);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    layout.ensureSpace(lh);
    const baselineY = layout.y - size; // baseline sits `size` below the top of the line box
    if (line.length > 0) {
      const lineW = font.widthOfTextAtSize(line, size);
      const lineX = opts.align === 'center' ? MARGIN + (CONTENT_W - lineW) / 2 : x;
      layout.page.drawText(line, { x: lineX, y: baselineY, size, font, color: BLACK });
      if (opts.linkUri) {
        addLinkAnnotation(layout, lineX, baselineY, lineW, size, opts.linkUri);
      }
    }
    layout.y -= lh;
  }
}

/**
 * Draw a section header, guaranteeing it is followed by at least one body line
 * on the same page (no orphaned header at the page bottom).
 */
function drawSectionHeader(layout: Layout, title: string, fonts: Fonts): void {
  const headerLh = layout.lineHeight(SIZE_SECTION);
  const followLh = layout.lineHeight(SIZE_BODY);
  // Orphan prevention: reserve the full header block plus one following body line so a
  // section title + divider is never stranded alone at the page bottom. The block's
  // non-text gaps total 12 pt: the leading gap(4) below, plus the two SECTION_RULE_GAP
  // (4 pt each) around the divider. Assumes a single-line header (titles never wrap).
  layout.ensureSpace(headerLh + followLh + 12);
  layout.gap(4);
  drawWrapped(layout, title.toUpperCase(), {
    font: fonts.bold,
    size: SIZE_SECTION,
    fieldPath: `section:${title}`,
  });
  // Hairline divider rule, centered vertically between the section header and the
  // first content line (equal gap above and below). Mirrors the web heading underline.
  const SECTION_RULE_GAP = 4;
  layout.gap(SECTION_RULE_GAP);
  const ruleY = layout.y;
  layout.page.drawLine({
    start: { x: MARGIN, y: ruleY },
    end: { x: PAGE_W - MARGIN, y: ruleY },
    thickness: 0.6,
    color: RULE,
  });
  layout.gap(SECTION_RULE_GAP);
}

// ---------------------------------------------------------------------------
// Helpers for the resume model
// ---------------------------------------------------------------------------
function isLinkHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------
async function build(): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const doc = await PDFDocument.create();

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
  };

  // --- Deterministic metadata --------------------------------------------
  // updatedAt is "YYYY-MM"; build a fixed UTC instant from explicit int parts.
  const [yStr, mStr] = resume.meta.updatedAt.split('-');
  const year = Number.parseInt(yStr, 10);
  const monthIndex = Number.parseInt(mStr, 10) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Invalid resume.meta.updatedAt: "${resume.meta.updatedAt}" (expected YYYY-MM)`);
  }
  const fixedDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));

  // Metadata strings go through the same normalize + encode gate as on-page
  // text, so a stray non-WinAnsi char in the name can't silently bypass it.
  // Window/tab title: the name + role joined with underscores (no extension), e.g.
  // "Tanel_Treuberg_Software_Engineer". Paired with showInWindowTitleBar below so
  // viewers use this (without the .pdf) instead of the URL filename.
  const metaTitle = normalizeForPdf(`${resume.name} ${resume.title}`.replace(/\s+/g, '_'));
  const metaAuthor = normalizeForPdf(resume.name);
  assertEncodable(metaTitle, fonts.regular, 'meta.title');
  assertEncodable(metaAuthor, fonts.regular, 'meta.author');
  // showInWindowTitleBar sets the ViewerPreferences /DisplayDocTitle flag so viewers
  // use /Title for the window/tab title instead of the filename (defaults to false).
  doc.setTitle(metaTitle, { showInWindowTitleBar: true });
  doc.setAuthor(metaAuthor);
  doc.setSubject('Resume');
  doc.setCreator('resume-pdf generator');
  doc.setProducer('pdf-lib');
  doc.setCreationDate(fixedDate);
  doc.setModificationDate(fixedDate);

  const layout = new Layout(doc, fonts);

  // --- Header: name → location → contact links ----------------------------
  drawWrapped(layout, resume.name, {
    font: fonts.bold,
    size: SIZE_NAME,
    fieldPath: 'name',
    align: 'center',
  });
  layout.gap(2);
  drawWrapped(layout, `${resume.baseLocation.city}, ${resume.baseLocation.country}`, {
    font: fonts.regular,
    size: SIZE_BODY,
    fieldPath: 'baseLocation',
    align: 'center',
  });
  layout.gap(4);

  // Contact line: the contact links laid out inline on a single line separated by
  // " · ", each getting its own clickable /Link rect so the annotations don't
  // overlap and each points to its own URI.
  drawContactLine(layout, fonts);
  layout.gap(6);

  // --- Summary -----------------------------------------------------------
  drawSectionHeader(layout, 'Summary', fonts);
  drawWrapped(layout, resume.summary, {
    font: fonts.regular,
    size: SIZE_BODY,
    fieldPath: 'summary',
  });
  layout.gap(6);

  // --- Experience --------------------------------------------------------
  drawSectionHeader(layout, 'Experience', fonts);
  for (let i = 0; i < resume.experience.length; i += 1) {
    const job = resume.experience[i];
    const base = `experience[${i}]`;

    // Role + dates on one line if they fit; otherwise dates wrap to next line.
    const roleAscii = safe(job.role, fonts.bold, `${base}.role`);
    const datesAscii = safe(job.dates.display, fonts.regular, `${base}.dates`);
    const roleW = fonts.bold.widthOfTextAtSize(roleAscii, SIZE_BODY);
    const datesW = fonts.regular.widthOfTextAtSize(datesAscii, SIZE_SMALL);

    // Keep the role header with at least the company line following it.
    const blockHeader = layout.lineHeight(SIZE_BODY) + layout.lineHeight(SIZE_SMALL);
    layout.ensureSpace(blockHeader + 4);
    layout.gap(4);

    if (roleW + 12 + datesW <= CONTENT_W) {
      const lh = layout.lineHeight(SIZE_BODY);
      layout.ensureSpace(lh);
      const baselineY = layout.y - SIZE_BODY;
      layout.page.drawText(roleAscii, { x: MARGIN, y: baselineY, size: SIZE_BODY, font: fonts.bold, color: BLACK });
      const dx = MARGIN + CONTENT_W - datesW;
      layout.page.drawText(datesAscii, { x: dx, y: baselineY, size: SIZE_SMALL, font: fonts.regular, color: BLACK });
      layout.y -= lh;
    } else {
      drawWrapped(layout, job.role, { font: fonts.bold, size: SIZE_BODY, fieldPath: `${base}.role` });
      drawWrapped(layout, job.dates.display, { font: fonts.regular, size: SIZE_SMALL, fieldPath: `${base}.dates` });
    }

    // Company · Location
    const companyLine = `${job.company} · ${job.location.city}, ${job.location.country}`;
    drawWrapped(layout, companyLine, {
      font: fonts.oblique,
      size: SIZE_SMALL,
      fieldPath: `${base}.company`,
    });
    layout.gap(2);

    for (let b = 0; b < job.bullets.length; b += 1) {
      drawBullet(layout, job.bullets[b], fonts, `${base}.bullets[${b}]`);
    }
    layout.gap(4);
  }

  // --- Education ---------------------------------------------------------
  drawSectionHeader(layout, 'Education', fonts);
  for (let i = 0; i < resume.education.length; i += 1) {
    const ed = resume.education[i];
    const base = `education[${i}]`;
    const blockHeader = layout.lineHeight(SIZE_BODY) + layout.lineHeight(SIZE_SMALL);
    layout.ensureSpace(blockHeader + 4);
    layout.gap(4);
    drawWrapped(layout, ed.degree, { font: fonts.bold, size: SIZE_BODY, fieldPath: `${base}.degree` });
    const instLine = `${ed.institution} · ${ed.location.city}, ${ed.location.country} · ${ed.dates.display}`;
    drawWrapped(layout, instLine, { font: fonts.oblique, size: SIZE_SMALL, fieldPath: `${base}.institution` });
    if (ed.notes) {
      layout.gap(2);
      for (let n = 0; n < ed.notes.length; n += 1) {
        drawBullet(layout, ed.notes[n], fonts, `${base}.notes[${n}]`);
      }
    }
    layout.gap(4);
  }

  // --- Skills & Interests ------------------------------------------------
  // Interests are the final group in resume.skills, so they render inline under
  // this combined heading (no separate section).
  drawSectionHeader(layout, 'Skills & Interests', fonts);
  for (let i = 0; i < resume.skills.length; i += 1) {
    const group = resume.skills[i];
    // Bold subsection title on its own line (no colon), with its items on the line
    // below. A title-on-its-own-line keeps the bold weight without the label→items
    // horizontal spacing drift that a bold inline label suffered (non-embedded
    // font metrics differ per viewer).
    // Bold subsection title on its own line (no colon), items on the line below,
    // all at the document's normal line spacing. The bold titles delineate the
    // groups (no extra inter-group gap), so the spacing stays uniform throughout.
    drawWrapped(layout, group.label, {
      font: fonts.bold,
      size: SIZE_BODY,
      fieldPath: `skills[${i}] (title)`,
    });
    drawWrapped(layout, group.items.join(' · '), {
      font: fonts.regular,
      size: SIZE_BODY,
      fieldPath: `skills[${i}]`,
    });
  }

  const bytes = await doc.save();
  return { bytes, pageCount: layout.pageCount };
}

/**
 * Draw the contact links on a single line, separated by " · ", with each
 * segment laid out at its own measured x-offset and given its own /Link
 * annotation so the rects don't overlap. Segments flow left-to-right and wrap
 * to a new line if the running x would exceed the content width.
 */
function drawContactLine(layout: Layout, fonts: Fonts): void {
  const font = fonts.regular;
  const size = SIZE_BODY;
  const sep = ' · ';
  const sepW = font.widthOfTextAtSize(sep, size);
  const lh = layout.lineHeight(size);

  // Precompute printed segments and the full one-line width.
  const segs = resume.contact.map((c, i) => {
    const printed = safe(c.printLabel ?? c.label, font, `contact[${i}]`);
    return { printed, href: c.href, w: font.widthOfTextAtSize(printed, size) };
  });
  const totalW =
    segs.reduce((acc, s) => acc + s.w, 0) + sepW * Math.max(0, segs.length - 1);

  const drawSeg = (s: { printed: string; href: string; w: number }, x: number, by: number) => {
    layout.page.drawText(s.printed, { x, y: by, size, font, color: BLACK });
    if (isLinkHref(s.href)) addLinkAnnotation(layout, x, by, s.w, size, s.href);
  };

  layout.ensureSpace(lh);

  // Common case: the whole line fits — draw it centered within the content width.
  if (totalW <= CONTENT_W) {
    const baselineY = layout.y - size;
    let x = MARGIN + (CONTENT_W - totalW) / 2;
    for (let i = 0; i < segs.length; i += 1) {
      if (i > 0) {
        layout.page.drawText(sep, { x, y: baselineY, size, font, color: BLACK });
        x += sepW;
      }
      drawSeg(segs[i], x, baselineY);
      x += segs[i].w;
    }
    layout.y -= lh;
    return;
  }

  // Fallback: left-aligned with wrapping if the contacts ever exceed one line.
  let x = MARGIN;
  let baselineY = layout.y - size;
  let firstOnLine = true;
  for (let i = 0; i < segs.length; i += 1) {
    const s = segs[i];
    const needed = (firstOnLine ? 0 : sepW) + s.w;
    if (!firstOnLine && x - MARGIN + needed > CONTENT_W) {
      layout.y -= lh;
      layout.ensureSpace(lh);
      x = MARGIN;
      baselineY = layout.y - size;
      firstOnLine = true;
    }
    if (!firstOnLine) {
      layout.page.drawText(sep, { x, y: baselineY, size, font, color: BLACK });
      x += sepW;
    }
    drawSeg(s, x, baselineY);
    x += s.w;
    firstOnLine = false;
  }
  layout.y -= lh;
}

/**
 * Draw a "- " bulleted, hanging-indented paragraph.
 */
function drawBullet(layout: Layout, rawText: string, fonts: Fonts, fieldPath: string): void {
  const marker = '• '; // • bullet dot (WinAnsi 0x95 — stays extractable)
  const markerW = fonts.regular.widthOfTextAtSize(marker, SIZE_BODY);
  const textX = MARGIN + markerW;
  const textMaxW = CONTENT_W - markerW;

  // Draw the hanging marker on the first line, then the body text hung-indented.
  // drawRuns handles the wrapping. The marker is part of the first visible line;
  // ensure the first line exists before stamping it by reserving space the same
  // way drawRuns will.
  const markerAscii = safe(marker, fonts.regular, `${fieldPath} (marker)`);
  const lh = layout.lineHeight(SIZE_BODY);
  layout.ensureSpace(lh);
  const markerBaselineY = layout.y - SIZE_BODY;
  layout.page.drawText(markerAscii, {
    x: MARGIN,
    y: markerBaselineY,
    size: SIZE_BODY,
    font: fonts.regular,
    color: BLACK,
  });

  drawRuns(layout, rawText, {
    font: fonts.regular,
    size: SIZE_BODY,
    fieldPath,
    x: textX,
    maxWidth: textMaxW,
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const distDir = path.join(repoRoot, 'dist');
  // The served filename IS the download name on GitHub Pages (no Content-Disposition
  // header is possible), so name it after the person, not "resume.pdf". Keep this in
  // sync with the button href, robots.txt, .gitignore and verify script.
  const outPath = path.join(distDir, PDF_FILENAME);

  const { bytes, pageCount } = await build();

  await mkdir(distDir, { recursive: true });
  await writeFile(outPath, bytes);

  // Soft single-page guard: the current content is tuned to fit one A4 page.
  // Warn (don't fail) if it ever overflows so natural growth isn't blocked.
  if (pageCount > 1) {
    console.warn(
      `⚠ resume-pdf: output is ${pageCount} pages — content overflowed the single A4 page. ` +
        `Tighten spacing/sizes in scripts/resume-pdf/generate.ts or trim resume content to restore one page.`,
    );
  }

  if (process.argv.includes('--copy-public')) {
    const publicPath = path.join(repoRoot, 'public', PDF_FILENAME);
    await mkdir(path.dirname(publicPath), { recursive: true });
    await copyFile(outPath, publicPath);
    console.log(`✓ resume-pdf: also copied → public/${PDF_FILENAME}`);
  }

  console.log(`✓ resume-pdf: ${pageCount} page(s) → dist/${PDF_FILENAME}`);
}

main().catch((err) => {
  console.error(`✗ resume-pdf: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
