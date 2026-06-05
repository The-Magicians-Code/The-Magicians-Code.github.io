// Text normalization for the ATS resume PDF.
//
// Policy (revised): Helvetica's WinAnsi encoding renders accented Latin-1
// letters and many common symbols natively (no font embedding). So we PRESERVE
// every WinAnsi-renderable character and normalize ONLY genuinely
// non-renderable ones — chars that pdf-lib's WinAnsi encoder would throw on.
//
// Superscripts are flattened to caret notation ("10⁻³" → "10^-3") so the exponent
// stays unambiguous, extractable plain text (a visually-raised glyph would copy
// as "10-3"). The website keeps the real raised Unicode superscript; only the PDF
// flattens.
//
// Two responsibilities:
//   1. `normalizeForPdf` — flatten superscript runs to caret notation and map the
//      known non-WinAnsi characters (non-breaking space) to WinAnsi-safe
//      equivalents. It does NOT enforce ASCII; accented letters (Ü, õ, ä…), °, ×,
//      ·, dashes, smart quotes and ellipsis all pass through untouched because
//      Helvetica renders them. Anything unexpected is caught by `assertEncodable`.
//   2. `assertEncodable` — the single source of truth for "can Helvetica render
//      this": it calls `font.encodeText(text)` and throws with the field path
//      and code point if any character is still non-WinAnsi after normalization.

import type { PDFFont } from 'pdf-lib';

// Superscript code point → ASCII equivalent, used by `normalizeForPdf` to flatten
// a superscript run to caret notation (e.g. "⁻³" → "^-3"). U+00B9/B2/B3 (¹²³) are
// WinAnsi-renderable but are treated as superscripts here for consistent exponent
// notation; the rest (U+2070–2079, U+207B) are non-WinAnsi.
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
 * Wrap a raw string as a single normal run. (Superscripts are no longer drawn
 * raised; they are flattened to caret notation by `normalizeForPdf` instead — see
 * the file header. This shim keeps the generator's run-based wrapping pipeline.)
 */
export function splitSuperscriptRuns(input: string): TextRun[] {
  return [{ text: input, sup: false }];
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
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    // Flatten a run of superscript code points to caret notation: "10⁻³" → "10^-3".
    // Kept as plain extractable text (unambiguous for ATS/copy-paste) rather than
    // a visually-raised glyph that would extract as "10-3".
    if (SUPERSCRIPT_TO_ASCII[ch] !== undefined) {
      let mapped = '';
      while (i < chars.length && SUPERSCRIPT_TO_ASCII[chars[i]] !== undefined) {
        mapped += SUPERSCRIPT_TO_ASCII[chars[i]];
        i += 1;
      }
      out += `^${mapped}`;
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
