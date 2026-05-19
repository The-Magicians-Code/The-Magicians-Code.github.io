// Title parsing for project frontmatter. The `title` field supports inline
// `*accent*` markers — single-word or short-phrase emphasis that renders as
// <em> in HTML contexts (bento cards, detail page H1) and falls back to plain
// text in non-HTML contexts (<title>, meta tags, aria-label).
//
// Two helpers, one source of truth in frontmatter. Authoring example:
//   title: "Vision pipeline for *edge inference*"
// renders as `Vision pipeline for <em>edge inference</em>` in cards, and as
// `Vision pipeline for edge inference` inside <title> and aria attributes.

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]!);
}

// HTML-safe render. Escapes all HTML first, then converts `*accent*` to
// `<em>accent</em>`. Use with Astro's `set:html` directive.
export function titleToHtml(title: string): string {
  return escapeHtml(title).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Plain-text render. Strips `*` markers, returns the underlying text. Use
// inside `<title>`, `<meta content="…">`, `aria-label`, anything that can't
// render HTML.
export function titleToText(title: string): string {
  return title.replace(/\*([^*]+)\*/g, '$1');
}
