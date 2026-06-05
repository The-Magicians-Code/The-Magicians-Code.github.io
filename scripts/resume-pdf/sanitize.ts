// Text normalization for the ATS resume PDF.
//
// Policy (revised): Helvetica's WinAnsi encoding renders accented Latin-1
// letters and many common symbols natively (no font embedding). So we PRESERVE
// every WinAnsi-renderable character and normalize ONLY genuinely
// non-renderable ones — chars that pdf-lib's WinAnsi encoder would throw on.
//
// Two responsibilities:
//   1. `normalizeForPdf` — map the known non-WinAnsi characters (superscript
//      digits/minus, non-breaking space) to WinAnsi-safe equivalents. It does
//      NOT enforce ASCII; accented letters (Ü, õ, ä…), °, ×, ·, dashes, smart
//      quotes and ellipsis all pass through untouched because Helvetica renders
//      them. Anything unexpected is caught by `assertEncodable`, not here.
//   2. `assertEncodable` — the single source of truth for "can Helvetica render
//      this": it calls `font.encodeText(text)` and throws with the field path
//      and code point if any character is still non-WinAnsi after normalization.

import type { PDFFont } from 'pdf-lib';

// Superscript digits/minus → caret form. These code points are NOT in WinAnsi
// (except ¹²³ at U+00B9/B2/B3, handled below), so pdf-lib's encoder throws on
// them. A contiguous run collapses to one leading "^" so "10⁻³" → "10^-3" and
// "10⁴" → "10^4".
const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0', // U+2070
  '¹': '1', // U+00B9 (Latin-1, but normalized for exponent consistency)
  '²': '2', // U+00B2 (Latin-1, but normalized for exponent consistency)
  '³': '3', // U+00B3 (Latin-1, but normalized for exponent consistency)
  '⁴': '4', // U+2074
  '⁵': '5', // U+2075
  '⁶': '6', // U+2076
  '⁷': '7', // U+2077
  '⁸': '8', // U+2078
  '⁹': '9', // U+2079
  '⁻': '-', // U+207B superscript minus
};

// Direct one-to-(zero-or-more) replacements for genuinely non-WinAnsi chars.
// Deliberately small: only characters that Helvetica's WinAnsi encoder cannot
// render. WinAnsi-encodable chars (accented Latin letters, °, ×, ·, en/em
// dashes, smart quotes, …) are intentionally absent so they pass through.
const DIRECT: Record<string, string> = {
  ' ': ' ', // non-breaking space → normal space
};

function snippet(input: string): string {
  return input.length > 60 ? `${input.slice(0, 60)}...` : input;
}

/**
 * Normalize an input string for the WinAnsi (Helvetica) encoder: map known
 * non-WinAnsi characters (superscript digits/minus, NBSP) to safe equivalents
 * and leave every WinAnsi-renderable character untouched.
 *
 * This does NOT assert encodability — `assertEncodable` is the safety gate that
 * catches any character still outside WinAnsi after this pass.
 */
export function normalizeForPdf(input: string): string {
  const chars = Array.from(input); // iterate by code point, not UTF-16 unit
  let out = '';
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    // Collapse a contiguous run of superscript chars into one "^…" token.
    if (Object.prototype.hasOwnProperty.call(SUPERSCRIPTS, ch)) {
      let run = '';
      while (i < chars.length && Object.prototype.hasOwnProperty.call(SUPERSCRIPTS, chars[i])) {
        run += SUPERSCRIPTS[chars[i]];
        i += 1;
      }
      out += `^${run}`;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(DIRECT, ch)) {
      out += DIRECT[ch];
      i += 1;
      continue;
    }

    // Everything else passes through verbatim. WinAnsi-renderable chars render
    // natively; anything that slips through that is genuinely non-WinAnsi is
    // caught by assertEncodable before it is drawn.
    out += ch;
    i += 1;
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
