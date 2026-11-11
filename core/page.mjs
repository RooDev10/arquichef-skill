// HTML page shell, modelled on the hand-made Verifish sheet that ArquiChef
// reproduces (Verifish-Report/assets/arquitectura-empresarial/*.html):
// a fixed-width sheet inside #fit, scaled down to the window width by a tiny
// script, white page, Arial, no page title above the sheet.
//
// The output is a single self-contained file:
// - a Content-Security-Policy that blocks every network request;
// - scripts allowed only by SHA-256 hash (the fit-to-width script, plus the
//   measuring script in check builds);
// - no external fonts, images, or stylesheets.

import { createHash } from 'node:crypto';
import { escapeHtml, safeToken } from './escape.mjs';

const FIT_SCRIPT = `(function(){var f=document.getElementById('fit');if(!f)return;var w=f.offsetWidth;function r(){var s=Math.min(1,window.innerWidth/w);f.style.transform='scale('+s+')';document.body.style.height=(f.offsetHeight*s)+'px';}window.addEventListener('resize',r);r();})();`;

/** Type-agnostic base styles shared by every sheet. Types add their own theme after it. */
export const BASE_CSS = `* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #111; }
body { font-family: Arial, "Liberation Sans", Helvetica, sans-serif; }
#fit { transform-origin: 0 0; }
.sheet { padding: 10px; display: grid; gap: 10px; }
.sheet > * { min-width: 0; }
.ic { position: absolute; top: 4px; right: 4px; width: 14px; height: 14px; background-repeat: no-repeat; background-size: contain; opacity: .85; pointer-events: none; }`;

function hash(script) {
  return `'sha256-${createHash('sha256').update(script, 'utf8').digest('base64')}'`;
}

/**
 * Wrap rendered cells into the fixed-width sheet.
 * @param {object} o
 * @param {number} o.width      sheet width in px (schema-validated integer)
 * @param {string} o.columns    grid-template-columns built by the type from fixed tokens
 * @param {string} o.cells      HTML produced by ArquiChef renderers
 */
export function renderSheet({ width, columns, cells }) {
  const w = Number.isInteger(width) ? width : 2200;
  return `<div id="fit" style="width: ${w}px"><div class="sheet" style="width: ${w}px; grid-template-columns: ${columns}">
${cells}
</div></div>`;
}

/**
 * @param {object} o
 * @param {string} o.title       plain text (escaped here)
 * @param {string} o.lang        BCP 47 tag (already schema-validated)
 * @param {string} o.css         stylesheet authored by ArquiChef (never spec content)
 * @param {string} o.body        HTML produced by ArquiChef renderers (usually renderSheet output)
 * @param {string} [o.extraScript] measuring script for check builds
 */
export function renderPage({ title, lang = 'es', css = '', body, extraScript = '' }) {
  const scripts = [FIT_SCRIPT, extraScript].filter(Boolean);
  const csp = [
    "default-src 'none'",
    "img-src data:",
    "style-src 'unsafe-inline'",
    `script-src ${scripts.map(hash).join(' ')}`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  return `<!doctype html>
<html lang="${safeToken(lang) || 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="generator" content="arquichef">
<title>${escapeHtml(title)}</title>
<style>
${BASE_CSS}
${css}
</style>
</head>
<body>
${body}
${scripts.map((s) => `<script>${s}</script>`).join('\n')}
</body>
</html>
`;
}
