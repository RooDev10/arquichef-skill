// Generic renderer for nested "box" trees: a box has a title and items; an item
// is either another box or an element. Any diagram type built from containers
// (enterprise maps, capability maps, landscape views...) can reuse this.
//
// Every value interpolated below is either escaped text or a number/enum that
// the schema already constrained, so spec content cannot produce markup.

import { escapeHtml, safeToken } from './escape.mjs';
import { ICON_KINDS } from './icons.mjs';

const VARIANTS = new Set(['dashed', 'rounded', 'emphasis', 'plain', 'compact']);

export function isBox(item) {
  return item && typeof item === 'object' && Array.isArray(item.items);
}

function iconClass(kind, fallback) {
  const k = ICON_KINDS.includes(kind) ? kind : fallback;
  return k ? ` k-${k}` : '';
}

/** Inline grid style from validated layout fields. Returns '' for the default flowing row. */
export function layoutStyle(box) {
  if (Array.isArray(box.weights) && box.weights.length > 0) {
    const cols = box.weights.map((w) => `minmax(0, ${Number(w)}fr)`).join(' ');
    return ` style="grid-template-columns: ${cols}"`;
  }
  if (Number.isInteger(box.columns)) {
    return ` style="grid-template-columns: repeat(${box.columns}, minmax(0, 1fr))"`;
  }
  return '';
}

function layoutClass(box) {
  if (box.stack) return 'lay stack';
  if ((Array.isArray(box.weights) && box.weights.length) || Number.isInteger(box.columns)) return 'lay grid';
  return 'lay row';
}

export function renderElement(el, path, { defaultIcon } = {}) {
  const variant = VARIANTS.has(el.variant) ? ` v-${el.variant}` : '';
  const inferred = el.inferred ? ' inferred' : '';
  const parts = [
    `<span class="n">${escapeHtml(el.name)}${el.inferred ? '<sup class="inf-mark">*</sup>' : ''}</span>`,
  ];
  if (el.detail) parts.push(`<small>${escapeHtml(el.detail)}</small>`);
  if (el.tag) parts.push(`<span class="tag">${escapeHtml(el.tag)}</span>`);
  parts.push('<i class="ic" aria-hidden="true"></i>');
  return `<div class="el${iconClass(el.icon, defaultIcon)}${variant}${inferred}" data-path="${escapeHtml(path)}">${parts.join('')}</div>`;
}

export function renderItems(items, path, ctx, depth) {
  return items
    .map((item, i) => {
      const p = `${path}.items[${i}]`;
      return isBox(item) ? renderBox(item, p, ctx, depth + 1) : renderElement(item, p, ctx);
    })
    .join('\n');
}

/**
 * Render a box. depth 0 is a section band; deeper boxes alternate tones so the
 * nesting stays readable without borders getting heavy.
 */
export function renderBox(box, path, ctx = {}, depth = 1) {
  // A nested box with neither title nor note is a pure layout group: it arranges
  // its items but draws no border, background, or icon of its own, and does not
  // count as a nesting level for colour purposes.
  if (depth > 0 && !box.title && !box.note && !box.icon) {
    return `<div class="group" data-path="${escapeHtml(path)}"><div class="${layoutClass(box)}"${layoutStyle(box)}>
${renderItems(box.items, path, ctx, depth - 1)}
</div></div>`;
  }
  const cls = [depth === 0 ? 'band' : `box d${Math.min(depth, 3)}`];
  if (box.align === 'left') cls.push('t-left');
  const heading = depth === 0 ? 'h2' : 'h3';
  const title = box.title ? `<${heading}>${escapeHtml(box.title)}</${heading}>` : '';
  const note = box.note ? `<div class="note-line">${escapeHtml(box.note)}</div>` : '';
  const boxIcon = box.icon ?? (depth === 0 ? ctx.bandIcon : ctx.defaultIcon);
  const icon = boxIcon ? `<i class="ic" aria-hidden="true"></i>` : '';
  const iconCls = boxIcon ? iconClass(boxIcon) : '';
  const extra = ctx.sectionClass && depth === 0 ? ` ${safeToken(ctx.sectionClass)}` : '';
  return `<section class="${cls.join(' ')}${iconCls}${extra}" data-path="${escapeHtml(path)}">${title}${note}${icon}
<div class="${layoutClass(box)}"${layoutStyle(box)}>
${renderItems(box.items, path, ctx, depth)}
</div></section>`;
}

/** Walk every element in a box tree, calling fn(element, path). */
export function walkElements(items, path, fn) {
  items.forEach((item, i) => {
    const p = `${path}.items[${i}]`;
    if (isBox(item)) walkElements(item.items, p, fn);
    else fn(item, p);
  });
}

/** Walk every box in a tree (including the root), calling fn(box, path, depth). */
export function walkBoxes(box, path, fn, depth = 0) {
  fn(box, path, depth);
  box.items.forEach((item, i) => {
    if (isBox(item)) walkBoxes(item, `${path}.items[${i}]`, fn, depth + 1);
  });
}
