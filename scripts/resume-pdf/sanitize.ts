// Text normalization for the ATS resume PDF.
//
// Policy (revised): Helvetica's WinAnsi encoding renders accented Latin-1
// letters and many common symbols natively (no font embedding). So we PRESERVE
// every WinAnsi-renderable character and normalize ONLY genuinely
// non-renderable ones — chars that pdf-lib's WinAnsi encoder would throw on.
//
// Superscripts are NO LONGER flattened here. They are handled structurally by
// the generator (`splitSuperscriptRuns`): each superscript run is drawn smaller
// and raised above the baseline as a true typographic superscript, using the
// ASCII equivalent glyphs (so "10⁻³" extracts as "10-3", not "10^-3"). The
// generator maps the superscript code points to ASCII itself before drawing, so
// they never reach `normalizeForPdf`/`assertEncodable` as superscript chars.
//
// Two responsibilities:
//   1. `normalizeForPdf` — map the known non-WinAnsi characters (non-breaking
//      space) to WinAnsi-safe equivalents. It does NOT enforce ASCII; accented
//      letters (Ü, õ, ä…), °, ×, ·, dashes, smart quotes and ellipsis all pass
//      through untouched because Helvetica renders them. Anything unexpected is
//      caught by `assertEncodable`, not here.
//   2. `assertEncodable` — the single source of truth for "can Helvetica render
//      this": it calls `font.encodeText(text)` and throws with the field path
//      and code point if any character is still non-WinAnsi after normalization.

import type { PDFFont } from 'pdf-lib';

// Superscript code point → ASCII equivalent. Used by the generator's run-splitter
// to detect superscript runs and to map each char to the ASCII glyph it draws
// (smaller + raised). U+00B9/B2/B3 (¹²³) are WinAnsi-renderable but are treated
// as superscripts here for consistent exponent rendering; the rest (U+2070–2079,
// U+207B) are non-WinAnsi.
export const SUPERSCRIPT_TO_ASCII: Record<string, string> = {
  '⁰': '0', // U+2070
  '¹': '1', // U+00B9
  '²': '2', // U+00B2
  '³': '3', // U+00B3
  '⁴': '4', // U+2074
  '⁵': '5', // U+2075
  '⁶': '6', // U+2076
  '⁷': '7', // U+2077
  '⁸': '8', // U+2078
  '⁹': '9', // U+2079
  '⁻': '-', // U+207B superscript minus
};

/** A logical text run: a span of text drawn either inline or as a raised superscript. */
export interface TextRun {
  /** Drawable text. For `sup` runs this is already ASCII-mapped; for normal runs it is raw. */
  text: string;
  /** True if this run should be drawn smaller and raised above the baseline. */
  sup: boolean;
}

/**
 * Split a raw string into ordered runs of normal vs. superscript text.
 *
 * A superscript run is a maximal run of superscript code points (see
 * `SUPERSCRIPT_TO_ASCII`); its `text` is the ASCII-mapped equivalent. Normal
 * runs keep their raw text (the generator normalizes them via `normalizeForPdf`
 * at draw time). Adjacent runs of the same kind are merged.
 */
export function splitSuperscriptRuns(input: string): TextRun[] {
  const chars = Array.from(input); // iterate by code point, not UTF-16 unit
  const runs: TextRun[] = [];
  let buf = '';
  let bufSup = false;

  const flush = () => {
    if (buf.length > 0) runs.push({ text: buf, sup: bufSup });
    buf = '';
  };

  for (const ch of chars) {
    const mapped = SUPERSCRIPT_TO_ASCII[ch];
    const isSup = mapped !== undefined;
    if (buf.length > 0 && isSup !== bufSup) flush();
    bufSup = isSup;
    buf += isSup ? mapped : ch;
  }
  flush();

  return runs;
}

// Direct one-to-(zero-or-more) stylistic replacements. NBSP (U+00A0) below IS
// WinAnsi-encodable, so folding it to a normal space is a deliberate stylistic
// choice (predictable wrapping), not an encodability fix. Other WinAnsi chars
// (accented Latin letters, °, ×, ·, en/em
// dashes, smart quotes, …) are intentionally absent so they pass through.
const DIRECT: Record<string, string> = {
  ' ': ' ', // non-breaking space (U+00A0, WinAnsi) → normal space (stylistic)
};

function snippet(input: string): string {
  return input.length > 60 ? `${input.slice(0, 60)}...` : input;
}

/**
 * Normalize an input string for the WinAnsi (Helvetica) encoder: map known
 * non-WinAnsi characters (NBSP) to safe equivalents and leave every
 * WinAnsi-renderable character untouched.
 *
 * Superscript code points are intentionally NOT handled here — the generator
 * splits them into raised runs before this is ever called on a normal run.
 *
 * This does NOT assert encodability — `assertEncodable` is the safety gate that
 * catches any character still outside WinAnsi after this pass.
 */
export function normalizeForPdf(input: string): string {
  const chars = Array.from(input); // iterate by code point, not UTF-16 unit
  let out = '';

  for (const ch of chars) {
    if (Object.prototype.hasOwnProperty.call(DIRECT, ch)) {
      out += DIRECT[ch];
      continue;
    }

    // Everything else passes through verbatim. WinAnsi-renderable chars render
    // natively; anything that slips through that is genuinely non-WinAnsi is
    // caught by assertEncodable before it is drawn.
    out += ch;
  }

  return out;
}

/**
 * Final safety net before drawing — and the single source of truth for "can
 * Helvetica render this". Validates `text` against the exact font it will be
 * drawn with; re-throws with the field path on any encoder failure.
 */
export function assertEncodable(text: string, font: PDFFont, fieldPath: string): void {
  try {
    font.encodeText(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Un-encodable char in ${fieldPath} (in "${snippet(text)}"): ${detail}`);
  }
}
