// C4 system context diagram (level 1 of the C4 model).
//
//   [ people ........ ] [ external systems that call us ]     ← who starts
//                 ↓                    ↓
//              [ THE SYSTEM WE BUILD (exactly one) ]
//                 ↓          ↓           ↓
//   [ external systems the central system depends on ... ]    ← what we need
//
// Modelling rules (lint errors, not warnings):
// - a person only has relationships with the central system, and starts them;
// - every arrow points down: 'from' is the element that starts the
//   interaction, and the layout puts it above what it depends on, so a
//   relationship that would close a cycle has to be reworded or removed;
// - at most one relationship per pair of elements (merge the descriptions);
// - every element has at least one relationship.
//
// The spec never says where anything goes: core/graph-layout.mjs decides.
// Boxes and labels are HTML (so the browser check can measure their text);
// the connectors are one inline SVG behind them.

import { readFileSync } from 'node:fs';
import { escapeHtml, escapeMarkdown } from '../../core/escape.mjs';
import { estimateTextBox, layoutGraph, upwardEdges } from '../../core/graph-layout.mjs';
import { renderSheet } from '../../core/page.mjs';

const here = new URL('.', import.meta.url);
const THEME = readFileSync(new URL('theme.css', here), 'utf8');
export const schema = JSON.parse(readFileSync(new URL('schema.json', here), 'utf8'));

export const id = 'c4-context';
export const title = 'C4 system context diagram (people, the system we build, external systems; arrows point down)';

/* --------------------------------------------------------------- metrics
   Kept in sync with theme.css. Glyph widths are on the generous side, so the
   estimate wraps no later than the browser does and boxes come out tall
   enough; the browser check reports any box whose text still overflows. */

const BOX = { width: 240, padX: 14, padY: 14, gap: 4, minHeight: 124 };
const NAME = { fontSize: 15, lineHeight: 1.25, charWidth: 0.62 };
const KIND = { fontSize: 11, lineHeight: 1.3, charWidth: 0.6 };
const DESC = { fontSize: 12, lineHeight: 1.3, charWidth: 0.58 };
const LABEL = { maxWidth: 170, pad: 2, text: { fontSize: 11, lineHeight: 1.3, charWidth: 0.58 }, tech: { fontSize: 10, lineHeight: 1.3, charWidth: 0.6 } };
const MIN_WIDTH = 960;

/* ------------------------------------------------------------------ i18n */

const I18N = {
  es: {
    view: 'Diagrama de contexto del sistema',
    kind: { person: 'Persona', system: 'Sistema principal', external: 'Sistema externo' },
    legend: 'Leyenda',
    legendPerson: 'Persona que usa el sistema',
    legendSystem: 'Sistema principal (el que se desarrolla)',
    legendExternal: 'Sistema externo (no se desarrolla)',
    legendArrow: 'Quien inicia → de quien depende',
    inferred: '* Inferido: no lo dice la fuente',
    madeWith: 'Elaborado a partir de',
    files: 'Archivos',
    fileHtml: 'diagrama autocontenido (ábrelo en el navegador).',
    filePng: 'el mismo diagrama en imagen de alta resolución.',
    fileMd: 'este documento.',
    howToRead: 'Cómo leer el diagrama',
    howToReadBody: 'Es el nivel 1 del modelo C4: muestra el sistema que se va a desarrollar, las personas que lo usan y los sistemas externos con los que se relaciona, sin entrar en su estructura interna. Las flechas siempre apuntan hacia abajo: arriba está quien inicia la interacción y abajo aquello de lo que depende. La etiqueta de cada flecha dice qué hace quien la inicia y, entre corchetes, con qué tecnología.',
    inferredBody: 'Los elementos marcados con * no aparecen en la fuente: son inferencias razonables que conviene validar.',
    system: 'Sistema principal',
    people: 'Personas',
    externals: 'Sistemas externos',
    callers: 'Sistemas externos que llaman al sistema',
    dependencies: 'Sistemas externos de los que depende el sistema',
    relationships: 'Relaciones',
    colName: 'Nombre',
    colDesc: 'Descripción',
    colSource: 'Fuente',
    colFrom: 'Desde',
    colTo: 'Hacia',
    colTech: 'Tecnología',
    notes: 'Observaciones',
    sources: 'Fuentes',
    source: 'Fuente',
    generated: 'Generado con ArquiChef a partir del spec; si cambias el diagrama, edita el spec y vuelve a construirlo',
  },
  en: {
    view: 'System context diagram',
    kind: { person: 'Person', system: 'Central system', external: 'External system' },
    legend: 'Key',
    legendPerson: 'Person who uses the system',
    legendSystem: 'Central system (the one being built)',
    legendExternal: 'External system (not built here)',
    legendArrow: 'Who starts → what it depends on',
    inferred: '* Inferred: not stated in the source',
    madeWith: 'Built from',
    files: 'Files',
    fileHtml: 'self-contained diagram (open it in a browser).',
    filePng: 'the same diagram as a high-resolution image.',
    fileMd: 'this document.',
    howToRead: 'How to read the diagram',
    howToReadBody: 'This is level 1 of the C4 model: the system being built, the people who use it and the external systems it interacts with, without its internal structure. Arrows always point down: the element that starts an interaction is above what it depends on. Each arrow label says what the initiator does and, in brackets, the technology used.',
    inferredBody: 'Items marked with * are not in the source: they are reasonable inferences worth validating.',
    system: 'Central system',
    people: 'People',
    externals: 'External systems',
    callers: 'External systems that call the system',
    dependencies: 'External systems the system depends on',
    relationships: 'Relationships',
    colName: 'Name',
    colDesc: 'Description',
    colSource: 'Source',
    colFrom: 'From',
    colTo: 'To',
    colTech: 'Technology',
    notes: 'Notes',
    sources: 'Sources',
    source: 'Source',
    generated: 'Generated by ArquiChef from the spec; to change the diagram, edit the spec and build it again',
  },
};

function strings(spec) {
  return I18N[(spec.meta.language ?? 'es').slice(0, 2)] ?? I18N.es;
}

/* -------------------------------------------------------------- elements */

/** Every box of the diagram with its kind and spec path, central system included. */
export function elements(spec) {
  return [
    ...spec.people.map((el, i) => ({ el, kind: 'person', path: `people[${i}]` })),
    { el: spec.system, kind: 'system', path: 'system' },
    ...(spec.externals ?? []).map((el, i) => ({ el, kind: 'external', path: `externals[${i}]` })),
  ];
}

function byId(spec) {
  const map = new Map();
  for (const e of elements(spec)) if (!map.has(e.el.id)) map.set(e.el.id, e);
  return map;
}

/* ------------------------------------------------------------------ lint */

export function lint(spec) {
  const errors = [];
  const warnings = [];
  const err = (path, message) => errors.push({ path, message });
  const warn = (path, message) => warnings.push({ path, message });

  const sourceIds = new Set(spec.meta.sources.map((s) => s.id));
  if (sourceIds.size !== spec.meta.sources.length) err('meta.sources', 'source ids must be unique');
  let withoutSource = 0;
  const checkSource = (item, path) => {
    if (item.source && !sourceIds.has(item.source.split(':')[0])) err(`${path}.source`, `source "${item.source}" does not match any meta.sources id`);
    if (!item.source && !item.inferred) withoutSource += 1;
  };

  // Elements: unique ids, distinct names.
  const all = elements(spec);
  const seenIds = new Map();
  const seenNames = new Map();
  for (const { el, path } of all) {
    if (seenIds.has(el.id)) err(`${path}.id`, `id "${el.id}" is already used by ${seenIds.get(el.id)}`);
    else seenIds.set(el.id, path);
    const name = el.name.trim().toLowerCase();
    if (seenNames.has(name)) warn(`${path}.name`, `same name as ${seenNames.get(name)}; readers will not tell them apart`);
    else seenNames.set(name, path);
    checkSource(el, path);
  }
  const index = byId(spec);
  const sys = spec.system.id;
  const name = (ref) => index.get(ref)?.el.name ?? ref;

  // Relationships: references, people rule, one per pair.
  const pairs = new Map();
  const related = new Set();
  const valid = []; // relationships that passed every per-relationship rule
  spec.relationships.forEach((r, i) => {
    const path = `relationships[${i}]`;
    checkSource(r, path);
    const from = index.get(r.from);
    const to = index.get(r.to);
    if (!from) err(`${path}.from`, `"${r.from}" is not the id of any element`);
    if (!to) err(`${path}.to`, `"${r.to}" is not the id of any element`);
    if (!from || !to) return;
    if (r.from === r.to) {
      err(path, 'an element cannot have a relationship with itself');
      return;
    }
    related.add(r.from);
    related.add(r.to);
    let ok = true;

    const key = [r.from, r.to].sort().join('\u0000');
    if (pairs.has(key)) {
      err(path, `there is already a relationship between «${name(r.from)}» and «${name(r.to)}» (${pairs.get(key)}); merge both into one description`);
      ok = false;
    } else pairs.set(key, path);

    if (from.kind === 'person' && r.to !== sys) {
      err(path, `a person only has relationships with the central system; «${from.el.name}» cannot relate to «${to.el.name}»`);
      ok = false;
    } else if (to.kind === 'person') {
      if (r.from === sys) err(path, `people start their relationships: write it as «${to.el.name}» → «${from.el.name}»`);
      else err(path, `a person only has relationships with the central system; «${from.el.name}» cannot relate to «${to.el.name}»`);
      ok = false;
    }

    if (from.kind === 'external' && to.kind === 'external') {
      warn(path, 'a relationship between two external systems is outside the scope of a context diagram; keep it only if the central system relies on it');
    }
    if (!r.technology) warn(`${path}.technology`, 'no technology; add the protocol or integration mechanism, or record in notes that the source does not say');
    if (ok) valid.push({ r, path });
  });

  // Arrows always point down: whatever closes a cycle is an error.
  if (valid.length) {
    const graph = {
      // First occurrence of each id only: duplicates are already reported above.
      nodes: all.filter(({ el, path }) => seenIds.get(el.id) === path).map(({ el }) => ({ id: el.id, width: 1, height: 1 })),
      edges: valid.map(({ r, path }) => ({ id: path, from: r.from, to: r.to })),
    };
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    graph.edges = graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
    for (const path of upwardEdges(graph)) {
      const r = valid.find((v) => v.path === path).r;
      err(path, `this arrow would point up (it closes a cycle). Reword it from the point of view of the upper element (e.g. «${name(r.to)}» → «${name(r.from)}») or remove it`);
    }
  }

  for (const { el, path } of all) {
    if (!related.has(el.id)) err(path, `«${el.name}» has no relationships; connect it or leave it out of the diagram`);
  }
  if (!spec.externals?.length) warn('externals', 'no external systems; confirm the central system really depends on nothing (payments, messaging, identity, government services...)');
  if (withoutSource > 0) {
    const total = all.length + spec.relationships.length;
    warn('(spec)', `${withoutSource} of ${total} elements and relationships have no source; add "source" or mark them "inferred": true`);
  }
  return { errors, warnings, stats: { elements: all.length + spec.relationships.length, withoutSource } };
}

/* ---------------------------------------------------------------- render */

function boxHeight(el, t, kind) {
  const inner = BOX.width - 2 * BOX.padX;
  const n = estimateTextBox(el.name + (el.inferred ? '*' : ''), { maxWidth: inner, ...NAME });
  const k = estimateTextBox(`[${t.kind[kind]}]`, { maxWidth: inner, ...KIND });
  const d = estimateTextBox(el.description, { maxWidth: inner, ...DESC });
  return Math.ceil(2 * BOX.padY + n.height + k.height + d.height + 2 * BOX.gap + 6);
}

function labelSize(r) {
  const text = estimateTextBox(r.description + (r.inferred ? '*' : ''), { maxWidth: LABEL.maxWidth, ...LABEL.text });
  const tech = r.technology ? estimateTextBox(`[${r.technology}]`, { maxWidth: LABEL.maxWidth, ...LABEL.tech }) : { width: 0, height: 0 };
  return {
    width: Math.ceil(Math.max(text.width, tech.width) + 2 * LABEL.pad + 2),
    height: Math.ceil(text.height + tech.height + 2),
  };
}

/** Run the layout for a spec. Exported for tests and tooling. */
export function layout(spec) {
  const t = strings(spec);
  const all = elements(spec);
  // One height for every box: a row of equal boxes reads as a row.
  const height = Math.max(BOX.minHeight, ...all.map(({ el, kind }) => boxHeight(el, t, kind)));
  const graph = {
    nodes: all.map(({ el }) => ({ id: el.id, width: BOX.width, height })),
    edges: spec.relationships.map((r, i) => ({ id: `relationships[${i}]`, from: r.from, to: r.to, label: labelSize(r) })),
  };
  return layoutGraph(graph);
}

function mark(item) {
  return item.inferred ? '<sup class="inf-mark">*</sup>' : '';
}

function px(v) {
  return `${Number(v)}px`;
}

export function render(spec) {
  const t = strings(spec);
  const out = layout(spec);
  const all = elements(spec);
  const width = Math.ceil(Math.max(MIN_WIDTH, out.width)) + 20; // + sheet padding

  const boxes = out.nodes.map((n, i) => {
    const { el, kind, path } = all[i];
    const cls = `el fixed c4 ${kind}${el.inferred ? ' inferred' : ''}`;
    return `<div class="${cls}" data-path="${escapeHtml(path)}" style="left: ${px(n.x)}; top: ${px(n.y)}; width: ${px(n.width)}; height: ${px(n.height)}">`
      + `<span class="n">${escapeHtml(el.name)}${mark(el)}</span>`
      + `<span class="k">[${escapeHtml(t.kind[kind])}]</span>`
      + `<span class="d">${escapeHtml(el.description)}</span></div>`;
  });

  const labels = out.edges.map((e, i) => {
    if (!e.label) return '';
    const r = spec.relationships[i];
    const tech = r.technology ? `<span class="tech">[${escapeHtml(r.technology)}]</span>` : '';
    return `<div class="el fixed rel${r.inferred ? ' inferred' : ''}" data-path="relationships[${i}]" style="left: ${px(e.label.x)}; top: ${px(e.label.y)}; width: ${px(e.label.width)}; height: ${px(e.label.height)}">`
      + `<span class="txt">${escapeHtml(r.description)}${mark(r)}</span>${tech}</div>`;
  });

  const wires = out.edges.map((e) => `<polyline points="${e.points.map((p) => `${Number(p.x)},${Number(p.y)}`).join(' ')}" marker-end="url(#c4-arrow)"/>`);
  const svg = `<svg class="wires" width="${Number(out.width)}" height="${Number(out.height)}" viewBox="0 0 ${Number(out.width)} ${Number(out.height)}" aria-hidden="true">`
    + '<defs><marker id="c4-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0L10,5L0,10z"/></marker></defs>'
    + `${wires.join('')}</svg>`;

  const org = sameName(spec) ? '' : ` · ${escapeHtml(spec.meta.organization)}`;
  const head = `<header class="c4-head"><h1>${escapeHtml(spec.meta.title)}</h1><span>[${escapeHtml(t.view)}]${org}</span></header>`;
  const stage = `<div class="stage" style="width: ${px(out.width)}; height: ${px(out.height)}">${svg}\n${boxes.join('\n')}\n${labels.join('\n')}</div>`;

  const inferred = all.some(({ el }) => el.inferred) || spec.relationships.some((r) => r.inferred);
  const credit = spec.meta.footer ?? `${fullTitle(spec)} · ${t.madeWith}: ${spec.meta.sources.map((s) => s.label).join('; ')}`;
  const legend = `<div class="legend"><b>${escapeHtml(t.legend)}</b>`
    + `<span class="key"><i class="sw person"></i>${escapeHtml(t.legendPerson)}</span>`
    + `<span class="key"><i class="sw system"></i>${escapeHtml(t.legendSystem)}</span>`
    + `<span class="key"><i class="sw external"></i>${escapeHtml(t.legendExternal)}</span>`
    + `<span class="key"><i class="sw arrow"></i>${escapeHtml(t.legendArrow)}</span>`
    + (inferred ? `<span class="key">${escapeHtml(t.inferred)}</span>` : '')
    + '</div>';
  const footer = `<footer class="c4-foot">${legend}<span class="credit">${escapeHtml(credit)}</span></footer>`;

  const body = renderSheet({ width, columns: 'minmax(0, 1fr)', cells: `${head}\n${stage}\n${footer}` });
  return { title: `${fullTitle(spec)} · ${t.view}`, lang: spec.meta.language ?? 'es', css: THEME, body, width };
}

/** The title and organization are often the same (a startup named after its product): say it once. */
function sameName(spec) {
  return spec.meta.title.trim().toLowerCase() === spec.meta.organization.trim().toLowerCase();
}

function fullTitle(spec) {
  return sameName(spec) ? spec.meta.title : `${spec.meta.title} · ${spec.meta.organization}`;
}

/* ---------------------------------------------------------------- readme */

function sourceText(spec, ref) {
  if (!ref) return '';
  const [sid, section] = ref.split(/:(.*)/s);
  const s = spec.meta.sources.find((x) => x.id === sid);
  return `${s ? s.label : sid}${section ? `, ${section}` : ''}`;
}

const cell = (v) => escapeMarkdown(v ?? '') || '—';
const star = (item) => (item.inferred ? ' \\*' : '');

export function readme(spec, { files }) {
  const t = strings(spec);
  const index = byId(spec);
  const sys = spec.system;
  const out = [];
  out.push(`# ${escapeMarkdown(fullTitle(spec))} · ${t.view}`, '');
  if (spec.meta.description) out.push(escapeMarkdown(spec.meta.description), '');

  out.push(`## ${t.files}`, '');
  out.push(`- \`${files.html}\`: ${t.fileHtml}`);
  if (files.png) out.push(`- \`${files.png}\`: ${t.filePng}`);
  out.push(`- \`${files.md}\`: ${t.fileMd}`, '');

  out.push(`## ${t.howToRead}`, '', t.howToReadBody, '');
  const anyInferred = elements(spec).some(({ el }) => el.inferred) || spec.relationships.some((r) => r.inferred);
  if (anyInferred) out.push(t.inferredBody, '');

  out.push(`## ${t.system}`, '', `**${escapeMarkdown(sys.name)}**${star(sys)}: ${escapeMarkdown(sys.description)}`, '');
  if (sys.source) out.push(`_${t.source}: ${escapeMarkdown(sourceText(spec, sys.source))}_`, '');

  const table = (list) => {
    out.push(`| ${t.colName} | ${t.colDesc} | ${t.colSource} |`, '| :--- | :--- | :--- |');
    for (const el of list) out.push(`| ${cell(el.name)}${star(el)} | ${cell(el.description)} | ${cell(sourceText(spec, el.source))} |`);
    out.push('');
  };
  out.push(`## ${t.people}`, '');
  table(spec.people);

  const externals = spec.externals ?? [];
  if (externals.length) {
    const callers = new Set(spec.relationships.filter((r) => r.to === sys.id).map((r) => r.from));
    const up = externals.filter((e) => callers.has(e.id));
    const down = externals.filter((e) => !callers.has(e.id));
    out.push(`## ${t.externals}`, '');
    if (down.length) {
      out.push(`### ${t.dependencies}`, '');
      table(down);
    }
    if (up.length) {
      out.push(`### ${t.callers}`, '');
      table(up);
    }
  }

  out.push(`## ${t.relationships}`, '');
  out.push(`| ${t.colFrom} | ${t.colTo} | ${t.colDesc} | ${t.colTech} | ${t.colSource} |`, '| :--- | :--- | :--- | :--- | :--- |');
  for (const r of spec.relationships) {
    const from = index.get(r.from)?.el.name ?? r.from;
    const to = index.get(r.to)?.el.name ?? r.to;
    out.push(`| ${cell(from)} | ${cell(to)} | ${cell(r.description)}${star(r)} | ${cell(r.technology)} | ${cell(sourceText(spec, r.source))} |`);
  }
  out.push('');

  if (spec.notes?.length) {
    out.push(`## ${t.notes}`, '');
    for (const n of spec.notes) out.push(`- ${escapeMarkdown(n)}`);
    out.push('');
  }
  out.push(`## ${t.sources}`, '');
  for (const s of spec.meta.sources) out.push(`- \`${s.id}\`: ${escapeMarkdown(s.label)}`); // id is schema-restricted
  out.push('', '---', `_${t.generated}._`, '');
  return out.join('\n');
}
