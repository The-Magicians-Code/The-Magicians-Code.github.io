// ATS-minimal resume PDF generator.
//
// Renders `src/data/resume.ts` to a bare, machine-readable, black-on-white PDF
// using pdf-lib and the non-embedded base-14 Helvetica family. Output is
// deterministic: fixed metadata, fixed creation/mod dates derived from
// resume.meta.updatedAt, no Date.now()/Math.random().
//
// Run: `npm run resume:pdf` (writes dist/resume.pdf). Pass `--copy-public` to
// also write public/resume.pdf.

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
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_BOTTOM = MARGIN; // y must stay above this

const BLACK = rgb(0, 0, 0);

// Type scale
const SIZE_NAME = 18;
const SIZE_TITLE = 11;
const SIZE_BODY = 10;
const SIZE_SECTION = 12;
const SIZE_SMALL = 9;

const LEADING = 1.32; // line-height multiplier

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
// Link annotation. Builds a real /Link annot with a PDF-string URI.
// ---------------------------------------------------------------------------
function percentEncodeUri(uri: string): string {
  // mailto: keep as-is except space; http(s): encodeURI handles most.
  // encodeURI preserves :/?#[]@!$&'()*+,;= and alphanumerics, which is what we want.
  return encodeURI(uri);
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
      layout.page.drawText(line, { x, y: baselineY, size, font, color: BLACK });
      if (opts.linkUri) {
        const w = font.widthOfTextAtSize(line, size);
        addLinkAnnotation(layout, x, baselineY, w, size, opts.linkUri);
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
  // Header + at least one following line must fit.
  layout.ensureSpace(headerLh + followLh + 6);
  layout.gap(4);
  drawWrapped(layout, title.toUpperCase(), {
    font: fonts.bold,
    size: SIZE_SECTION,
    fieldPath: `section:${title}`,
  });
  layout.gap(2);
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

  doc.setTitle(`${normalizeForPdf(resume.name)} - Resume`);
  doc.setAuthor(normalizeForPdf(resume.name));
  doc.setSubject('Resume');
  doc.setCreator('resume-pdf generator');
  doc.setProducer('pdf-lib');
  doc.setCreationDate(fixedDate);
  doc.setModificationDate(fixedDate);

  const layout = new Layout(doc, fonts);

  // --- Header: name → title → location → contact -------------------------
  drawWrapped(layout, resume.name, {
    font: fonts.bold,
    size: SIZE_NAME,
    fieldPath: 'name',
  });
  layout.gap(2);
  drawWrapped(layout, resume.title, {
    font: fonts.regular,
    size: SIZE_TITLE,
    fieldPath: 'title',
  });
  drawWrapped(layout, `${resume.baseLocation.city}, ${resume.baseLocation.country}`, {
    font: fonts.regular,
    size: SIZE_BODY,
    fieldPath: 'baseLocation',
  });
  layout.gap(4);

  // Contact line: draw each contact on its own line so link rects stay simple
  // and reading order is unambiguous.
  for (let i = 0; i < resume.contact.length; i += 1) {
    const c = resume.contact[i];
    const printed = c.printLabel ?? c.label;
    const fieldPath = `contact[${i}]`;
    if (isLinkHref(c.href)) {
      drawWrapped(layout, printed, {
        font: fonts.regular,
        size: SIZE_BODY,
        fieldPath,
        linkUri: c.href,
      });
    } else {
      drawWrapped(layout, printed, { font: fonts.regular, size: SIZE_BODY, fieldPath });
    }
  }
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
    const companyLine = `${job.company} - ${job.location.city}, ${job.location.country}`;
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
    const instLine = `${ed.institution} - ${ed.location.city}, ${ed.location.country} - ${ed.dates.display}`;
    drawWrapped(layout, instLine, { font: fonts.oblique, size: SIZE_SMALL, fieldPath: `${base}.institution` });
    if (ed.notes) {
      layout.gap(2);
      for (let n = 0; n < ed.notes.length; n += 1) {
        drawBullet(layout, ed.notes[n], fonts, `${base}.notes[${n}]`);
      }
    }
    layout.gap(4);
  }

  // --- Skills ------------------------------------------------------------
  drawSectionHeader(layout, 'Skills', fonts);
  for (let i = 0; i < resume.skills.length; i += 1) {
    const group = resume.skills[i];
    const line = `${group.label}: ${group.items.join(' - ')}`;
    drawWrapped(layout, line, {
      font: fonts.regular,
      size: SIZE_BODY,
      fieldPath: `skills[${i}]`,
    });
    layout.gap(1);
  }

  // --- Interests ---------------------------------------------------------
  if (resume.interests) {
    layout.gap(4);
    drawSectionHeader(layout, 'Interests', fonts);
    drawWrapped(layout, resume.interests, {
      font: fonts.regular,
      size: SIZE_BODY,
      fieldPath: 'interests',
    });
  }

  const bytes = await doc.save();
  return { bytes, pageCount: layout.pageCount };
}

/**
 * Draw a "- " bulleted, hanging-indented paragraph.
 */
function drawBullet(layout: Layout, rawText: string, fonts: Fonts, fieldPath: string): void {
  const marker = '- ';
  const markerW = fonts.regular.widthOfTextAtSize(marker, SIZE_BODY);
  const textX = MARGIN + markerW;
  const textMaxW = CONTENT_W - markerW;

  const ascii = safe(rawText, fonts.regular, fieldPath);
  const lines = wrapText(ascii, fonts.regular, SIZE_BODY, textMaxW);
  const lh = layout.lineHeight(SIZE_BODY);

  for (let i = 0; i < lines.length; i += 1) {
    layout.ensureSpace(lh);
    const baselineY = layout.y - SIZE_BODY;
    if (i === 0) {
      layout.page.drawText(marker, { x: MARGIN, y: baselineY, size: SIZE_BODY, font: fonts.regular, color: BLACK });
    }
    layout.page.drawText(lines[i], { x: textX, y: baselineY, size: SIZE_BODY, font: fonts.regular, color: BLACK });
    layout.y -= lh;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..');
  const distDir = path.join(repoRoot, 'dist');
  const outPath = path.join(distDir, 'resume.pdf');

  const { bytes, pageCount } = await build();

  await mkdir(distDir, { recursive: true });
  await writeFile(outPath, bytes);

  if (process.argv.includes('--copy-public')) {
    const publicPath = path.join(repoRoot, 'public', 'resume.pdf');
    await mkdir(path.dirname(publicPath), { recursive: true });
    await copyFile(outPath, publicPath);
    console.log(`✓ resume-pdf: also copied → public/resume.pdf`);
  }

  console.log(`✓ resume-pdf: ${pageCount} page(s) → dist/resume.pdf`);
}

main().catch((err) => {
  console.error(`✗ resume-pdf: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
