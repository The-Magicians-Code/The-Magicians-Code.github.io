// Text normalization for the ATS resume PDF.
//
// Two responsibilities:
//   1. `normalizeToAscii` — product policy: map known non-ASCII chars to a pure
//      ASCII equivalent (curly quotes, dashes, superscripts, etc.). Anything that
//      survives the map but is still outside printable ASCII throws — we never
//      silently drop a character, because a dropped char in a resume is a
//      correctness bug nobody would notice until an ATS mangles it.
//   2. `assertEncodable` — the final safety net: even pure-looking ASCII can trip
//      pdf-lib's Helvetica WinAnsi encoder in edge cases, so every drawn string is
//      validated against the exact font object it will be drawn with.

import type { PDFFont } from 'pdf-lib';

// Superscript digits/minus → caret form. A run of superscripts collapses to a
// single leading "^" followed by the mapped chars (so "10⁻³" → "10^-3").
const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0', // ⁰
  '¹': '1', // ¹
  '²': '2', // ²
  '³': '3', // ³
  '⁴': '4', // ⁴
  '⁵': '5', // ⁵
  '⁶': '6', // ⁶
  '⁷': '7', // ⁷
  '⁸': '8', // ⁸
  '⁹': '9', // ⁹
  '⁻': '-', // ⁻ (superscript minus)
};

// Direct one-to-(zero-or-more) ASCII replacements applied char-by-char.
// NOTE: U+00B7 (middle dot ·) is mapped to " - " (space-hyphen-space) so that
// e.g. "Company · Location" reads naturally as "Company - Location".
const DIRECT: Record<string, string> = {
  '×': 'x', // × multiplication sign
  '·': ' - ', // · middle dot → " - "
  '–': '-', // – en dash
  '—': '-', // — em dash
  '’': "'", // ’ right single quote
  '‘': "'", // ‘ left single quote
  '“': '"', // “ left double quote
  '”': '"', // ” right double quote
  '…': '...', // … horizontal ellipsis
  ' ': ' ', // non-breaking space
  '−': '-', // − minus sign (defensive: not a superscript run)
  '°': ' deg ', // ° degree sign → " deg " (e.g. "3.3°C" → "3.3 deg C")
  // Estonian / Nordic letters appearing in proper nouns (e.g. "SP Engineers OÜ",
  // "INSÜK"). Folded to their base ASCII letter — ATS-safe, name still readable.
  Ü: 'U',
  ü: 'u',
  Õ: 'O',
  õ: 'o',
  Ä: 'A',
  ä: 'a',
  Ö: 'O',
  ö: 'o',
  Š: 'S',
  š: 's',
  Ž: 'Z',
  ž: 'z',
};

function isPrintableAscii(code: number): boolean {
  return code === 0x0a /* \n */ || (code >= 0x20 && code <= 0x7e);
}

function snippet(input: string): string {
  return input.length > 60 ? `${input.slice(0, 60)}...` : input;
}

/**
 * Normalize an input string to pure printable ASCII (plus newline).
 * Throws on any character that has no mapping and is not already ASCII.
 */
export function normalizeToAscii(input: string): string {
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

    const code = ch.codePointAt(0)!;
    if (isPrintableAscii(code)) {
      out += ch;
      i += 1;
      continue;
    }

    const hex = code.toString(16).toUpperCase().padStart(4, '0');
    throw new Error(`Un-normalizable char U+${hex} '${ch}' in: "${snippet(input)}"`);
  }

  return out;
}

/**
 * Final safety net before drawing. Validates `text` against the exact font it
 * will be drawn with; re-throws with the field path on any encoder failure.
 */
export function assertEncodable(text: string, font: PDFFont, fieldPath: string): void {
  try {
    font.encodeText(text);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Un-encodable char in ${fieldPath}: ${detail}`);
  }
}
