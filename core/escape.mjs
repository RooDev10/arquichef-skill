// Escaping helpers. Every string that comes from a spec passes through one of
// these before it reaches the generated HTML or Markdown. Nothing from a spec is
// ever interpreted as markup, CSS, or code.

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/** Escape text for use inside an HTML element or a double-quoted attribute. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Escape text for Markdown output so that spec content cannot inject links,
 * images, raw HTML, or formatting into the generated README.
 */
export function escapeMarkdown(value) {
  return String(value ?? '')
    // Only characters that can start markup inline: links/images ([ ]), raw HTML
    // (< >), code (`), emphasis (* _), tables (|) and the escape char itself.
    .replace(/[\\`*_\[\]<>|]/g, (ch) => `\\${ch}`)
    .replace(/\r?\n/g, ' ');
}

/** Restrict a token used inside a class name or data attribute to a safe alphabet. */
export function safeToken(value) {
  return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
}
