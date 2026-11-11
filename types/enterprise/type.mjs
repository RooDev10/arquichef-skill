// Enterprise architecture map: one sheet, stacked layers, no connectors.
//
// The layout is fixed and copies the hand-made Verifish sheet 1:1. A spec only
// fills named slots; it cannot change where or how a block is drawn.
//
//            [ ACTORES ...................................... ]
//            [ ALINEAMIENTO ESTRATÉGICO ...................... ]
//            [ CAPACIDADES ................................... ]
//   [DEMANDA][ ARQUITECTURA DE NEGOCIO      ][lateral cell][OFERTA]
//   [       ][  frameworks row              ][            ][      ]
//   [       ][  know | change | org/svc/proc | data gov    ][      ]
//   [       ][ ARQUITECTURA DE APLICACIONES ][lateral cell][      ]
//   [       ][ ARQUITECTURA DE DATOS        ][lateral cell][      ]
//   [       ][ ARQUITECTURA TECNOLÓGICA     ][lateral cell][      ]
//   [       ][  nodes / risks / security | governance      ][      ]

import { readFileSync } from 'node:fs';
import { renderElement } from '../../core/boxes.mjs';
import { escapeHtml, escapeMarkdown } from '../../core/escape.mjs';
import { ICON_KINDS, iconCss } from '../../core/icons.mjs';
import { renderSheet } from '../../core/page.mjs';

const here = new URL('.', import.meta.url);
const THEME = readFileSync(new URL('theme.css', here), 'utf8');
export const schema = JSON.parse(readFileSync(new URL('schema.json', here), 'utf8'));

export const id = 'enterprise';
export const title = 'Enterprise architecture map (layered, canonical layout, no connectors)';

const TOP = ['actors', 'strategy', 'capabilities'];
const LAYERS = ['business', 'application', 'data', 'technology'];
const BAND_ICON = { actors: 'actor', strategy: 'goal', capabilities: 'capability', business: 'value', application: 'component', data: 'data', technology: 'node' };

/* --------------------------------------------------------------- slot table
   Every element list in the spec, with its default icon/variant and the
   container icon. Rendering, lint and README all walk this one table. */

function slots(spec) {
  const out = [];
  const add = (band, path, items, icon, variant) => { if (items?.length) out.push({ band, path, items, icon, variant }); };
  spec.actors?.groups.forEach((g, i) => add('actors', `actors.groups[${i}].items`, g.items, 'actor'));
  if (spec.strategy) {
    add('strategy', 'strategy.statements', spec.strategy.statements, 'goal');
    add('strategy', 'strategy.goals', spec.strategy.goals, 'goal');
    add('strategy', 'strategy.model', spec.strategy.model, 'principle');
  }
  add('capabilities', 'capabilities.items', spec.capabilities?.items, 'capability');
  const b = spec.layers.business;
  if (b) {
    add('business', 'layers.business.frameworks.items', b.frameworks.items, 'framework', 'dashed');
    add('business', 'layers.business.knowledge.items', b.knowledge.items, 'actor');
    add('business', 'layers.business.change.items', b.change.items, 'actor');
    b.organization.units.forEach((u, i) => add('business', `layers.business.organization.units[${i}].items`, u.items, 'actor'));
    add('business', 'layers.business.services.external.items', b.services.external.items, 'service', 'rounded');
    add('business', 'layers.business.services.internal.items', b.services.internal.items, 'service', 'rounded');
    add('business', 'layers.business.processes.stages', b.processes.stages, 'function', 'emphasis');
    add('business', 'layers.business.processes.crossCutting', b.processes.crossCutting, 'function', 'rounded');
    add('business', 'layers.business.dataGovernance.items', b.dataGovernance.items, 'goal', 'rounded');
  }
  const a = spec.layers.application;
  if (a) {
    add('application', 'layers.application.core.items', a.core.items, 'component');
    add('application', 'layers.application.core.jobs', a.core.jobs, 'function', 'compact');
    add('application', 'layers.application.clients.items', a.clients.items, 'component');
    add('application', 'layers.application.itServices.items', a.itServices.items, 'service');
    add('application', 'layers.application.thirdParty.items', a.thirdParty.items, 'component');
    add('application', 'layers.application.legacy.items', a.legacy?.items, 'component');
  }
  const d = spec.layers.data;
  if (d) {
    add('data', 'layers.data.items', d.items, 'data');
    add('data', 'layers.data.governance', d.governance, 'principle');
  }
  const t = spec.layers.technology;
  if (t) {
    add('technology', 'layers.technology.nodes', t.nodes, 'node');
    add('technology', 'layers.technology.risks.items', t.risks.items, 'risk', 'rounded');
    add('technology', 'layers.technology.security.items', t.security.items, 'service', 'rounded');
    add('technology', 'layers.technology.governance.items', t.governance.items, 'service', 'rounded');
  }
  (spec.laterals ?? []).forEach((lat, i) => {
    for (const key of LAYERS) {
      const s = lat.sections?.[key];
      const icon = { business: 'service', application: 'component', data: 'data', technology: 'node' }[key];
      add(`lateral:${i}`, `laterals[${i}].sections.${key}.items`, s?.items, icon);
    }
  });
  return out;
}

/* -------------------------------------------------------------------- i18n */

const I18N = {
  es: {
    h: {
      frameworks: 'ALINEAMIENTO NORMATIVO / MARCOS DE REFERENCIA', knowledge: 'GESTIÓN DEL CONOCIMIENTO', change: 'GESTIÓN DEL CAMBIO',
      organization: 'ESTRUCTURA ORGANIZACIONAL', services: 'SERVICIOS DE NEGOCIO', external: 'SERVICIOS EXTERNOS', internal: 'SERVICIOS INTERNOS',
      processes: 'PROCESOS', dataGovernance: 'GESTIÓN Y GOBIERNO DE DATOS', clients: 'APLICACIONES CLIENTE', itServices: 'SERVICIOS DE TI',
      thirdParty: 'SOLUCIONES DE TERCEROS', legacy: 'APLICACIONES LEGADAS', risks: 'Gestión de riesgos', security: 'Seguridad de la información / Ciberseguridad',
      governance: 'GOBERNANZA TECNOLÓGICA', business: 'NEGOCIO', application: 'APLICACIONES', data: 'DATOS', technology: 'TECNOLOGÍA',
    },
    inferred: '* Elemento inferido: no figura textualmente en la fuente.',
    madeWith: 'Elaborado con ArquiChef a partir de',
    source: 'Fuente', files: 'Archivos',
    fileHtml: 'Lámina interactiva y fuente visual. Se abre en el navegador y se ajusta al ancho de la ventana.',
    filePng: 'Imagen en alta resolución para insertar en documentos.',
    fileMd: 'Esta explicación, generada desde la misma especificación que la lámina.',
    howToRead: 'Cómo leer la lámina',
    howToReadBody: 'La lámina no usa conectores: cada elemento pertenece a la caja que lo contiene y la posición indica su capa. Arriba están los actores, el alineamiento estratégico y las capacidades. A la izquierda está la demanda (el problema) y a la derecha la oferta de valor (el resultado). En el centro se apilan las capas de negocio, aplicaciones, datos y tecnología. Las flechas → entre las etapas de los procesos solo indican el orden de lectura del flujo de valor.',
    lateralsBody: 'Las columnas laterales atraviesan las capas y muestran qué aporta cada una a ese tema transversal:',
    icons: 'Íconos de esquina', iconCol: 'Ícono', kindCol: 'Tipo de elemento',
    byLayer: 'Explicación por capa', notes: 'Notas y hallazgos', sources: 'Fuentes', inferredMark: 'inferido', generated: 'Generado con ArquiChef',
    statements: 'Declaraciones', goals: 'Objetivos', model: 'Modelo de negocio', stages: 'Etapas', crossCutting: 'Procesos transversales', jobs: 'Procesos programados', nodes: 'Nodos', dataItems: 'Almacenes y dominios de datos', dataGov: 'Gobierno de datos',
    iconNames: { actor: 'Actor o rol', goal: 'Meta u objetivo', capability: 'Capacidad', service: 'Servicio', process: 'Proceso', function: 'Función o etapa de proceso', component: 'Aplicación o módulo', interface: 'Interfaz', data: 'Dato o almacén de datos', node: 'Nodo de infraestructura', device: 'Dispositivo', principle: 'Principio o regla', framework: 'Marco o norma de referencia', location: 'Ubicación o contexto', value: 'Valor', chain: 'Elemento transversal (p. ej. blockchain)', risk: 'Riesgo' },
  },
  en: {
    h: {
      frameworks: 'REGULATORY ALIGNMENT / REFERENCE FRAMEWORKS', knowledge: 'KNOWLEDGE MANAGEMENT', change: 'CHANGE MANAGEMENT',
      organization: 'ORGANIZATIONAL STRUCTURE', services: 'BUSINESS SERVICES', external: 'EXTERNAL SERVICES', internal: 'INTERNAL SERVICES',
      processes: 'PROCESSES', dataGovernance: 'DATA MANAGEMENT AND GOVERNANCE', clients: 'CLIENT APPLICATIONS', itServices: 'IT SERVICES',
      thirdParty: 'THIRD-PARTY SOLUTIONS', legacy: 'LEGACY APPLICATIONS', risks: 'Risk management', security: 'Information security / Cybersecurity',
      governance: 'TECHNOLOGY GOVERNANCE', business: 'BUSINESS', application: 'APPLICATIONS', data: 'DATA', technology: 'TECHNOLOGY',
    },
    inferred: '* Inferred element: not stated verbatim in the source.',
    madeWith: 'Made with ArquiChef from',
    source: 'Source', files: 'Files',
    fileHtml: 'Interactive sheet and visual source. Opens in a browser and fits the window width.',
    filePng: 'High-resolution image to embed in documents.',
    fileMd: 'This explanation, generated from the same spec as the sheet.',
    howToRead: 'How to read the sheet',
    howToReadBody: 'The sheet uses no connectors: every element belongs to the box that contains it and its position tells its layer. At the top are actors, strategic alignment and capabilities. Demand (the problem) is on the left and the value offer (the outcome) on the right. The business, application, data and technology layers stack in the middle. The → marks between process stages only show the reading order of the value stream.',
    lateralsBody: 'Lateral columns cut across the layers and show what each layer contributes to that cross-cutting concern:',
    icons: 'Corner icons', iconCol: 'Icon', kindCol: 'Element type',
    byLayer: 'Layer by layer', notes: 'Notes and findings', sources: 'Sources', inferredMark: 'inferred', generated: 'Generated with ArquiChef',
    statements: 'Statements', goals: 'Goals', model: 'Business model', stages: 'Stages', crossCutting: 'Cross-cutting processes', jobs: 'Scheduled processes', nodes: 'Nodes', dataItems: 'Data stores and domains', dataGov: 'Data governance',
    iconNames: { actor: 'Actor or role', goal: 'Goal', capability: 'Capability', service: 'Service', process: 'Process', function: 'Function or process stage', component: 'Application or module', interface: 'Interface', data: 'Data or data store', node: 'Infrastructure node', device: 'Device', principle: 'Principle or rule', framework: 'Framework or reference standard', location: 'Location or context', value: 'Value', chain: 'Cross-cutting element (e.g. blockchain)', risk: 'Risk' },
  },
};

function strings(spec) {
  const lang = (spec.meta.language ?? 'es').slice(0, 2);
  return I18N[lang] ?? I18N.es;
}

function sourceText(spec, ref) {
  if (!ref) return '';
  const [sid, section] = ref.split(/:(.*)/s);
  const label = spec.meta.sources.find((s) => s.id === sid)?.label ?? sid;
  return section ? `${label}, ${section}` : label;
}

/* ------------------------------------------------------------ html helpers */

const k = (icon) => (ICON_KINDS.includes(icon) ? ` k-${icon}` : '');
const ic = '<i class="ic" aria-hidden="true"></i>';

function el(e, path, icon, variant) {
  const withDefaults = { ...e, icon: e.icon ?? icon, variant: e.variant ?? variant };
  return renderElement(withDefaults, path);
}

function els(items, path, icon, variant) {
  return items.map((e, i) => el(e, `${path}[${i}]`, icon, variant)).join('\n');
}

function cols(n) {
  return ` style="grid-template-columns: repeat(${Math.max(1, Math.min(8, Number(n) || 1))}, minmax(0, 1fr))"`;
}

function fr(weights) {
  return weights.map((w) => `minmax(0, ${Number(w)}fr)`).join(' ');
}

/** Layout of a plain element list: stack, or a grid of n columns. */
function lay(items, path, icon, variant, columns) {
  if (columns && columns > 1) return `<div class="lay grid"${cols(columns)}>\n${els(items, path, icon, variant)}\n</div>`;
  return `<div class="lay stack">\n${els(items, path, icon, variant)}\n</div>`;
}

function box({ title, note, icon, path, inner, cls = '', left = false, noteInline = false }) {
  const t = title
    ? `<h3${left ? ' class="left"' : ''}>${escapeHtml(title)}${noteInline && note ? ` <span class="tn">(${escapeHtml(note)})</span>` : ''}</h3>`
    : '';
  const n = note && !noteInline ? `<div class="sub">${escapeHtml(note)}</div>` : '';
  return `<section class="box${cls ? ` ${cls}` : ''}${k(icon)}" data-path="${escapeHtml(path)}">${t}${n}${ic}\n${inner}\n</section>`;
}

/** A canonical section: { title?, note?, columns?, items }. */
function section(sec, path, { heading, boxIcon, elIcon, variant, columns, cls, left } = {}) {
  return box({
    title: sec.title ?? heading, note: sec.note, icon: boxIcon, path, cls, left,
    inner: lay(sec.items, `${path}.items`, elIcon, variant, sec.columns ?? columns),
  });
}

function band(key, b, path, inner, { layer = false, cls = '' } = {}) {
  return `<section class="band s-${key}${cls ? ` ${cls}` : ''}${k(BAND_ICON[key])}" data-path="${escapeHtml(path)}"><h2${layer ? ' class="layer"' : ''}>${escapeHtml(b.title)}</h2>${ic}\n${inner}\n</section>`;
}

/* ------------------------------------------------------------- top bands */

function renderActors(a) {
  const weights = a.weights?.length === a.groups.length ? a.weights : a.groups.map((g) => Math.max(1, g.items.length) ** 0.85);
  const groups = a.groups.map((g, i) => `<div class="grp${k('actor')}" data-path="actors.groups[${i}]"><div class="lab">${escapeHtml(g.label)}</div>${ic}
<div class="lay row">\n${els(g.items, `actors.groups[${i}].items`, 'actor')}\n</div></div>`);
  return band('actors', a, 'actors', `<div class="lay grid" style="grid-template-columns: ${fr(weights)}; gap: 14px">\n${groups.join('\n')}\n</div>`);
}

function renderStrategy(s) {
  const rest = [
    ...s.goals.map((e, i) => el(e, `strategy.goals[${i}]`, 'goal')),
    ...(s.model ?? []).map((e, i) => el(e, `strategy.model[${i}]`, 'principle')),
  ];
  const half = Math.ceil(rest.length / 2);
  const col = (html) => `<div class="lay stack">\n${html}\n</div>`;
  const inner = `<div class="lay grid" style="grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px">
${col(els(s.statements, 'strategy.statements', 'goal'))}
${col(rest.slice(0, half).join('\n'))}
${col(rest.slice(half).join('\n'))}
</div>`;
  return band('strategy', s, 'strategy', inner);
}

function renderCapabilities(c) {
  const n = c.columns ?? Math.min(7, Math.max(1, Math.ceil(c.items.length / Math.ceil(c.items.length / 7))));
  return band('capabilities', c, 'capabilities', `<div class="lay grid"${cols(n)}>\n${els(c.items, 'capabilities.items', 'capability')}\n</div>`);
}

/* ---------------------------------------------------------------- layers */

function renderBusiness(b, t) {
  const p = 'layers.business';
  const frameworks = box({
    title: b.frameworks.title ?? t.h.frameworks, note: b.frameworks.note, icon: 'capability', path: `${p}.frameworks`,
    inner: `<div class="lay row">\n${els(b.frameworks.items, `${p}.frameworks.items`, 'framework', 'dashed')}\n</div>`,
  });
  const knowledge = section(b.knowledge, `${p}.knowledge`, { heading: t.h.knowledge, boxIcon: 'goal', elIcon: 'actor' });
  const change = section(b.change, `${p}.change`, { heading: t.h.change, boxIcon: 'goal', elIcon: 'actor' });
  const dataGov = section(b.dataGovernance, `${p}.dataGovernance`, { heading: t.h.dataGovernance, boxIcon: 'goal', elIcon: 'goal', variant: 'rounded' });

  const o = b.organization;
  const unitW = o.weights?.length === o.units.length ? o.weights : o.units.map((u) => 0.6 + 0.35 * Math.min(3, u.columns ?? 1));
  const units = o.units.map((u, i) => section(u, `${p}.organization.units[${i}]`, { boxIcon: 'actor', elIcon: 'actor' }));
  const org = box({
    title: o.title ?? t.h.organization, icon: 'actor', path: `${p}.organization`,
    inner: `<div class="lay grid" style="grid-template-columns: ${fr(unitW)}; gap: 10px">\n${units.join('\n')}\n</div>`,
  });

  const s = b.services;
  const internalCols = s.internal.columns ?? Math.min(4, Math.max(1, Math.ceil(s.internal.items.length / 2)));
  const svcW = s.weights?.length === 2 ? s.weights : [1, Math.max(1, internalCols / 2)];
  const services = box({
    title: s.title ?? t.h.services, icon: 'service', path: `${p}.services`,
    inner: `<div class="lay grid" style="grid-template-columns: ${fr(svcW)}; gap: 10px">
${section(s.external, `${p}.services.external`, { heading: t.h.external, boxIcon: 'service', elIcon: 'service', variant: 'rounded' })}
${section(s.internal, `${p}.services.internal`, { heading: t.h.internal, boxIcon: 'service', elIcon: 'service', variant: 'rounded', columns: internalCols })}
</div>`,
  });

  const pr = b.processes;
  const stages = pr.stages.map((e, i) => el(e, `${p}.processes.stages[${i}]`, 'function', 'emphasis')).join('\n<span class="arr" aria-hidden="true">→</span>\n');
  const cross = (pr.crossCutting ?? []).map((e, i) => `<div class="mt">${el(e, `${p}.processes.crossCutting[${i}]`, 'function', 'rounded')}</div>`).join('\n');
  const processes = box({
    title: pr.title ?? t.h.processes, icon: 'process', path: `${p}.processes`,
    inner: `<div class="flow">\n${stages}\n</div>${cross ? `\n${cross}` : ''}`,
  });

  const body = `<div class="biz-body" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 4.4fr) minmax(0, 1.15fr)">
${knowledge}
${change}
<div class="vstack">
${org}
${services}
${processes}
</div>
${dataGov}
</div>`;
  return band('business', b, p, `${frameworks}\n${body}`, { layer: true });
}

function renderApplication(a, t) {
  const p = 'layers.application';
  const c = a.core;
  const coreCols = c.columns ?? Math.min(4, Math.max(2, Math.ceil(c.items.length / 2)));
  const jobs = c.jobs?.length
    ? `\n<div class="lay grid mt"${cols(Math.min(c.jobs.length, coreCols))}>\n${els(c.jobs, `${p}.core.jobs`, 'function', 'compact')}\n</div>`
    : '';
  const core = box({
    title: c.title, note: c.note, icon: 'component', path: `${p}.core`, left: true, noteInline: true,
    inner: `<div class="lay grid"${cols(coreCols)}>\n${els(c.items, `${p}.core.items`, 'component')}\n</div>${jobs}`,
  });
  const parts = [core,
    section(a.clients, `${p}.clients`, { heading: t.h.clients, boxIcon: 'component', elIcon: 'component' }),
    section(a.itServices, `${p}.itServices`, { heading: t.h.itServices, boxIcon: 'component', elIcon: 'service' }),
    section(a.thirdParty, `${p}.thirdParty`, { heading: t.h.thirdParty, boxIcon: 'component', elIcon: 'component' }),
  ];
  if (a.legacy) parts.push(section(a.legacy, `${p}.legacy`, { heading: t.h.legacy, boxIcon: 'component', elIcon: 'component' }));
  const w = [Math.max(2, 0.6 * coreCols + 0.5), 1, 1, 1, ...(a.legacy ? [1] : [])];
  return band('application', a, p, `<div class="lay grid" style="grid-template-columns: ${fr(w)}; gap: 10px">\n${parts.join('\n')}\n</div>`, { layer: true });
}

function renderData(d) {
  const p = 'layers.data';
  const all = [
    ...d.items.map((e, i) => el(e, `${p}.items[${i}]`, 'data')),
    ...(d.governance ?? []).map((e, i) => el(e, `${p}.governance[${i}]`, 'principle')),
  ];
  const n = d.columns ?? (all.length <= 8 ? all.length : Math.ceil(all.length / 2));
  return band('data', d, p, `<div class="data-grid grow"${cols(n)}>\n${all.join('\n')}\n</div>`, { layer: true, cls: 'fill' });
}

function renderTechnology(tech, t) {
  const p = 'layers.technology';
  const n = tech.columns ?? (tech.nodes.length <= 8 ? tech.nodes.length : Math.ceil(tech.nodes.length / 2));
  const strip = (sec, key, boxIcon, elIcon) => box({
    title: sec.title ?? t.h[key], note: sec.note, icon: boxIcon, path: `${p}.${key}`, cls: 'strip',
    inner: `<div class="lay row">\n${els(sec.items, `${p}.${key}.items`, elIcon, 'rounded')}\n</div>`,
  });
  const left = `<div class="vstack">
<div class="nodes"${cols(n)}>\n${els(tech.nodes, `${p}.nodes`, 'node')}\n</div>
${strip(tech.risks, 'risks', 'risk', 'risk')}
${strip(tech.security, 'security', 'service', 'service')}
</div>`;
  const gov = section(tech.governance, `${p}.governance`, { heading: t.h.governance, boxIcon: 'process', elIcon: 'service', variant: 'rounded' });
  return band('technology', tech, p, `<div class="tech-body">\n${left}\n${gov}\n</div>`, { layer: true });
}

/* -------------------------------------------------------------- the grid */

function grid(spec) {
  const laterals = spec.laterals ?? [];
  const c = [];
  if (spec.demand) c.push('250px');
  const main = c.length + 1;
  c.push('minmax(0, 1fr)');
  laterals.forEach(() => c.push('290px'));
  const valueCol = spec.value ? c.length + 1 : null;
  if (spec.value) c.push('250px');
  const tops = TOP.filter((key) => spec[key]);
  const layers = LAYERS.filter((key) => spec.layers[key]);
  const firstLayerRow = tops.length + 1;
  return {
    template: c.join(' '),
    main,
    lateralCol: (i) => main + 1 + i,
    valueCol,
    topSpanEnd: main + laterals.length + 1,
    topRow: (key) => tops.indexOf(key) + 1,
    layerRow: (key) => firstLayerRow + layers.indexOf(key),
    layers,
    firstLayerRow,
    endLayerRow: firstLayerRow + layers.length,
    lastCol: c.length + 1,
  };
}

const place = (col, colEnd, row, rowEnd) => ` style="grid-column: ${col} / ${colEnd}; grid-row: ${row} / ${rowEnd}"`;

function renderNarrative(spec, key, col, g) {
  const n = spec[key];
  const paras = n.paragraphs.map((x) => `<p>${escapeHtml(x)}</p>`).join('');
  const src = n.source ? `<p class="src">(${escapeHtml(sourceText(spec, n.source))})</p>` : '';
  const icon = key === 'demand' ? 'location' : 'value';
  return `<aside class="band side s-${key}${k(icon)}" data-path="${key}"${place(col, col + 1, g.firstLayerRow, g.endLayerRow)}>
<h2>${escapeHtml(n.title)}</h2>${ic}<div class="paper">${paras}${src}</div></aside>`;
}

function renderLateral(spec, lat, i, g, t) {
  const col = g.lateralCol(i);
  const cls = `s-lateral-${i + 1}`;
  const icon = lat.icon ?? 'chain';
  const out = [`<aside class="band lateral-frame ${cls}${k(icon)}" data-path="laterals[${i}]"${place(col, col + 1, g.firstLayerRow, g.endLayerRow)}>
<h2>${escapeHtml(lat.title)}</h2>${ic}</aside>`];
  for (const key of g.layers) {
    const sec = lat.sections?.[key];
    if (!sec) continue;
    const row = g.layerRow(key);
    const pos = `${row === g.firstLayerRow ? ' first' : ''}${row === g.endLayerRow - 1 ? ' last' : ''}`;
    const elIcon = { business: 'service', application: 'component', data: 'data', technology: 'node' }[key];
    const inner = section(sec, `laterals[${i}].sections.${key}`, { heading: t.h[key], boxIcon: icon, elIcon });
    out.push(`<div class="lateral-cell ${cls}${pos}"${place(col, col + 1, row, row + 1)}>${inner}</div>`);
  }
  return out.join('\n');
}

function hasInferred(spec) {
  return slots(spec).some((s) => s.items.some((e) => e.inferred));
}

export function render(spec) {
  const t = strings(spec);
  const width = spec.meta.width ?? 2200;
  const g = grid(spec);
  const parts = [];
  const top = { actors: renderActors, strategy: renderStrategy, capabilities: renderCapabilities };
  for (const key of TOP) {
    if (!spec[key]) continue;
    const row = g.topRow(key);
    parts.push(`<div class="slot"${place(g.main, g.topSpanEnd, row, row + 1)}>${top[key](spec[key], t)}</div>`);
  }
  if (spec.demand) parts.push(renderNarrative(spec, 'demand', 1, g));
  const layer = { business: renderBusiness, application: renderApplication, data: renderData, technology: renderTechnology };
  for (const key of g.layers) {
    const row = g.layerRow(key);
    parts.push(`<div class="slot"${place(g.main, g.main + 1, row, row + 1)}>${layer[key](spec.layers[key], t)}</div>`);
  }
  (spec.laterals ?? []).forEach((lat, i) => parts.push(renderLateral(spec, lat, i, g, t)));
  if (spec.value) parts.push(renderNarrative(spec, 'value', g.valueCol, g));

  const credit = spec.meta.footer ?? `${spec.meta.organization} · ${spec.meta.title} · ${t.madeWith}: ${spec.meta.sources.map((s) => s.label).join('; ')}`;
  const left = hasInferred(spec) ? t.inferred : '';
  parts.push(`<div class="footer"${place(1, g.lastCol, g.endLayerRow, g.endLayerRow + 1)}><span>${escapeHtml(left)}</span><span>${escapeHtml(credit)}</span></div>`);

  const body = renderSheet({ width, columns: g.template, cells: parts.join('\n') });
  const css = `${THEME}\n.slot > .band { height: 100%; }\n${iconCss()}`;
  return { title: `${spec.meta.title} · ${spec.meta.organization}`, lang: spec.meta.language ?? 'es', css, body, width };
}

/* -------------------------------------------------------------------- lint */

export function lint(spec) {
  const errors = [];
  const warnings = [];
  const ids = new Set(spec.meta.sources.map((s) => s.id));
  if (ids.size !== spec.meta.sources.length) errors.push({ path: 'meta.sources', message: 'source ids must be unique' });
  const checkSource = (ref, path) => {
    if (ref && !ids.has(ref.split(':')[0])) errors.push({ path, message: `source "${ref}" does not match any meta.sources id` });
  };
  for (const key of ['demand', 'value']) if (spec[key]) checkSource(spec[key].source, `${key}.source`);

  let total = 0;
  let withoutSource = 0;
  for (const s of slots(spec)) {
    const seen = new Set();
    s.items.forEach((e, i) => {
      const p = `${s.path}[${i}]`;
      total += 1;
      checkSource(e.source, `${p}.source`);
      if (!e.source && !e.inferred) withoutSource += 1;
      const key = e.name.trim().toLowerCase();
      if (seen.has(key)) warnings.push({ path: p, message: `duplicate element "${e.name}" in the same box` });
      seen.add(key);
    });
    if (s.items.length > 24) warnings.push({ path: s.path, message: `${s.items.length} elements in one box; move detail to the README` });
  }

  if (withoutSource > 0) warnings.push({ path: '(spec)', message: `${withoutSource} of ${total} elements have no source; add "source" or mark them "inferred": true` });
  if (total < 25) warnings.push({ path: '(spec)', message: `only ${total} elements; an enterprise map usually needs 60-200 to be useful` });
  if (total > 280) warnings.push({ path: '(spec)', message: `${total} elements; consider moving detail into the README to keep the sheet readable` });

  if (!spec.layers.data) warnings.push({ path: 'layers', message: 'no data layer; add one unless the source truly has no data concerns' });
  if (!spec.demand) warnings.push({ path: '(spec)', message: 'no demand narrative (the problem); the sheet loses its "why"' });
  if (!spec.value) warnings.push({ path: '(spec)', message: 'no value narrative (the outcome)' });
  for (const key of TOP) if (!spec[key]) warnings.push({ path: key, message: `no ${key} band` });
  if (spec.layers.data && !spec.layers.data.governance?.length) warnings.push({ path: 'layers.data.governance', message: 'no data governance rule (isolation, retention, privacy)' });
  for (const [i, lat] of (spec.laterals ?? []).entries()) {
    const missing = LAYERS.filter((key) => spec.layers[key] && !lat.sections?.[key]);
    if (missing.length) warnings.push({ path: `laterals[${i}].sections`, message: `no cell for ${missing.join(', ')}; the lateral column shows a gap there` });
  }
  for (const key of TOP) if (spec[key] && !spec[key].summary) warnings.push({ path: `${key}.summary`, message: `no summary for the ${key} band; the README explanation will be thin` });
  for (const key of LAYERS) if (spec.layers[key] && !spec.layers[key].summary) warnings.push({ path: `layers.${key}.summary`, message: `no summary for the ${key} layer; the README explanation will be thin` });
  return { errors, warnings, stats: { elements: total, withoutSource } };
}

/* ------------------------------------------------------------------ readme */

function mdSource(spec, ref) {
  if (spec.meta.sources.length === 1) {
    const section = ref.split(/:(.*)/s)[1];
    if (section) return section;
  }
  return sourceText(spec, ref);
}

function mdElement(spec, e, t) {
  let line = `**${escapeMarkdown(e.name)}**`;
  if (e.detail) line += `: ${escapeMarkdown(e.detail)}`;
  if (e.tag) line += ` (${escapeMarkdown(e.tag)})`;
  const meta = [];
  if (e.inferred) meta.push(t.inferredMark);
  if (e.source) meta.push(`${t.source.toLowerCase()}: ${escapeMarkdown(mdSource(spec, e.source))}`);
  if (meta.length) line += ` _(${meta.join('; ')})_`;
  return line;
}

function mdGroup(spec, t, heading, items, depth = 0) {
  if (!items?.length) return [];
  const pad = '  '.repeat(depth);
  return [`${pad}- **${escapeMarkdown(heading)}**`, ...items.map((e) => `${pad}  - ${mdElement(spec, e, t)}`)];
}

function mdSection(spec, t, sec, heading, depth = 0) {
  if (!sec) return [];
  const title = sec.title ?? heading;
  return mdGroup(spec, t, sec.note ? `${title} (${sec.note})` : title, sec.items, depth);
}

function bandLines(spec, key, t) {
  const L = [];
  if (key === 'actors') spec.actors.groups.forEach((g) => L.push(...mdGroup(spec, t, g.label, g.items)));
  if (key === 'strategy') {
    const s = spec.strategy;
    L.push(...mdGroup(spec, t, t.statements, s.statements), ...mdGroup(spec, t, t.goals, s.goals), ...mdGroup(spec, t, t.model, s.model));
  }
  if (key === 'capabilities') L.push(...spec.capabilities.items.map((e) => `- ${mdElement(spec, e, t)}`));
  if (key === 'business') {
    const b = spec.layers.business;
    L.push(...mdSection(spec, t, b.frameworks, t.h.frameworks), ...mdSection(spec, t, b.knowledge, t.h.knowledge), ...mdSection(spec, t, b.change, t.h.change));
    L.push(`- **${escapeMarkdown(b.organization.title ?? t.h.organization)}**`);
    b.organization.units.forEach((u) => L.push(...mdSection(spec, t, u, u.title ?? '', 1)));
    L.push(`- **${escapeMarkdown(b.services.title ?? t.h.services)}**`);
    L.push(...mdSection(spec, t, b.services.external, t.h.external, 1), ...mdSection(spec, t, b.services.internal, t.h.internal, 1));
    L.push(`- **${escapeMarkdown(b.processes.title ?? t.h.processes)}**`);
    L.push(...mdGroup(spec, t, t.stages, b.processes.stages, 1), ...mdGroup(spec, t, t.crossCutting, b.processes.crossCutting, 1));
    L.push(...mdSection(spec, t, b.dataGovernance, t.h.dataGovernance));
  }
  if (key === 'application') {
    const a = spec.layers.application;
    L.push(...mdGroup(spec, t, a.core.note ? `${a.core.title} (${a.core.note})` : a.core.title, a.core.items));
    L.push(...mdGroup(spec, t, t.jobs, a.core.jobs, 1));
    for (const s of ['clients', 'itServices', 'thirdParty', 'legacy']) L.push(...mdSection(spec, t, a[s], t.h[s]));
  }
  if (key === 'data') {
    const d = spec.layers.data;
    L.push(...mdGroup(spec, t, t.dataItems, d.items), ...mdGroup(spec, t, t.dataGov, d.governance));
  }
  if (key === 'technology') {
    const x = spec.layers.technology;
    L.push(...mdGroup(spec, t, t.nodes, x.nodes));
    for (const s of ['risks', 'security', 'governance']) L.push(...mdSection(spec, t, x[s], t.h[s]));
  }
  return L;
}

function usedIcons(spec) {
  const used = new Set();
  for (const s of slots(spec)) for (const e of s.items) used.add(e.icon ?? s.icon);
  (spec.laterals ?? []).forEach((l) => used.add(l.icon ?? 'chain'));
  return [...used].filter((x) => ICON_KINDS.includes(x));
}

export function readme(spec, { files }) {
  const t = strings(spec);
  const out = [];
  out.push(`# ${escapeMarkdown(spec.meta.title)} · ${escapeMarkdown(spec.meta.organization)}`, '');
  if (spec.meta.description) out.push(escapeMarkdown(spec.meta.description), '');

  out.push(`## ${t.files}`, '');
  out.push(`- \`${files.html}\`: ${t.fileHtml}`);
  if (files.png) out.push(`- \`${files.png}\`: ${t.filePng}`);
  out.push(`- \`${files.md}\`: ${t.fileMd}`, '');

  out.push(`## ${t.howToRead}`, '', t.howToReadBody, '');
  if (spec.laterals?.length) {
    out.push(t.lateralsBody, '');
    for (const lat of spec.laterals) out.push(`- **${escapeMarkdown(lat.title)}**`);
    out.push('');
  }
  out.push(`### ${t.icons}`, '', `| ${t.iconCol} | ${t.kindCol} |`, '| :--- | :--- |');
  for (const x of usedIcons(spec)) out.push(`| \`${x}\` | ${t.iconNames[x]} |`);
  out.push('');

  out.push(`## ${t.byLayer}`, '');
  const narrative = (key) => {
    const n = spec[key];
    if (!n) return;
    out.push(`### ${escapeMarkdown(n.title)}`, '');
    for (const p of n.paragraphs) out.push(escapeMarkdown(p), '');
    if (n.source) out.push(`_${t.source}: ${escapeMarkdown(sourceText(spec, n.source))}_`, '');
  };
  const bands = [...TOP.filter((key) => spec[key]).map((key) => [key, spec[key]]), ...LAYERS.filter((key) => spec.layers[key]).map((key) => [key, spec.layers[key]])];
  for (const [key, b] of bands) {
    if (key === 'business') narrative('demand');
    out.push(`### ${escapeMarkdown(b.title)}`, '');
    if (b.summary) out.push(escapeMarkdown(b.summary), '');
    out.push(...bandLines(spec, key, t), '');
  }
  narrative('value');
  for (const lat of spec.laterals ?? []) {
    out.push(`### ${escapeMarkdown(lat.title)}`, '');
    if (lat.summary) out.push(escapeMarkdown(lat.summary), '');
    for (const key of LAYERS) out.push(...mdSection(spec, t, lat.sections?.[key], t.h[key]));
    out.push('');
  }

  if (spec.notes?.length) {
    out.push(`## ${t.notes}`, '');
    for (const n of spec.notes) out.push(`- ${escapeMarkdown(n)}`);
    out.push('');
  }
  out.push(`## ${t.sources}`, '');
  for (const s of spec.meta.sources) out.push(`- \`${s.id}\`: ${escapeMarkdown(s.label)}`);
  out.push('', '---', `_${t.generated}._`, '');
  return out.join('\n');
}

/** Every element list of a spec (path, default icon), for tests and tooling. */
export { slots };
/** Optional type hook used by `arquichef migrate`: format 1 → current format. */
export { migrateV1 as migrate } from './migrate.mjs';
