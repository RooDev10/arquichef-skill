// Convert an enterprise spec in format 1 (free nested boxes) to format 2
// (fixed canonical slots). Format 1 specs written from the starter or the
// Verifish example follow the canonical arrangement by position, so the slots
// can be recovered from it. Anything that cannot be placed is reported, never
// silently dropped.

const isBox = (x) => x && typeof x === 'object' && Array.isArray(x.items);
const elementsOf = (b) => (b?.items ?? []).filter((x) => !isBox(x));
const boxesOf = (b) => (b?.items ?? []).filter(isBox);

/** All elements under a box, in reading order (flattens untitled layout groups). */
function flat(b) {
  return (b?.items ?? []).flatMap((x) => (isBox(x) ? flat(x) : [x]));
}

/** A format 1 box becomes a format 2 section; a note-only box uses its note as title. */
function section(b) {
  if (!b) return undefined;
  const out = {};
  if (b.title) out.title = b.title;
  if (b.note) {
    if (b.title) out.note = b.note;
    else out.title = b.note;
  }
  if (Number.isInteger(b.columns) && b.columns > 1) out.columns = b.columns;
  else {
    const inner = boxesOf(b).find((x) => !x.title && Number.isInteger(x.columns));
    if (inner && inner.columns > 1) out.columns = inner.columns;
  }
  out.items = flat(b);
  return out;
}

const RISK = /riesg|risk/i;

function splitRisk(el) {
  if (!el) return [];
  if (RISK.test(el.name) && el.detail && el.detail.includes(' · ')) {
    return el.detail.split(' · ').map((part) => {
      const name = part.trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 70);
      return { name, ...(el.source ? { source: el.source } : {}), ...(el.inferred ? { inferred: true } : {}) };
    });
  }
  return [el];
}

export function migrateV1(v1) {
  const problems = [];
  const v2 = { arquichef: '2', type: 'enterprise', meta: v1.meta };

  if (v1.actors) {
    const groups = boxesOf(v1.actors).map((g) => ({ label: g.note ?? g.title ?? '—', items: flat(g) }));
    const loose = elementsOf(v1.actors);
    if (loose.length) groups.push({ label: '—', items: loose });
    v2.actors = { title: v1.actors.title, ...(v1.actors.summary ? { summary: v1.actors.summary } : {}), ...(v1.actors.weights?.length === groups.length ? { weights: v1.actors.weights } : {}), groups };
  }

  if (v1.strategy) {
    const columns = boxesOf(v1.strategy);
    const first = columns.length ? flat(columns[0]) : elementsOf(v1.strategy).slice(0, 2);
    const rest = columns.length ? columns.slice(1).flatMap(flat) : elementsOf(v1.strategy).slice(2);
    v2.strategy = {
      title: v1.strategy.title,
      ...(v1.strategy.summary ? { summary: v1.strategy.summary } : {}),
      statements: first.filter((e) => e.icon !== 'principle'),
      goals: rest.filter((e) => e.icon !== 'principle'),
      model: [...first, ...rest].filter((e) => e.icon === 'principle'),
    };
    if (!v2.strategy.model.length) delete v2.strategy.model;
  }

  if (v1.capabilities) {
    v2.capabilities = { title: v1.capabilities.title, ...(v1.capabilities.summary ? { summary: v1.capabilities.summary } : {}), ...(v1.capabilities.columns ? { columns: v1.capabilities.columns } : {}), items: flat(v1.capabilities) };
  }
  if (v1.demand) v2.demand = { title: v1.demand.title, paragraphs: v1.demand.paragraphs, ...(v1.demand.source ? { source: v1.demand.source } : {}) };
  if (v1.value) v2.value = { title: v1.value.title, paragraphs: v1.value.paragraphs, ...(v1.value.source ? { source: v1.value.source } : {}) };

  v2.layers = {};
  const b1 = v1.layers?.business;
  if (b1) {
    const [frameworks, body] = boxesOf(b1);
    const [knowledge, change, center, dataGov] = boxesOf(body);
    const [org, services, processes] = boxesOf(center);
    const [external, internal] = boxesOf(services);
    v2.layers.business = {
      title: b1.title,
      ...(b1.summary ? { summary: b1.summary } : {}),
      frameworks: section(frameworks),
      knowledge: section(knowledge),
      change: section(change),
      organization: { ...(org?.title ? { title: org.title } : {}), ...(org?.weights ? { weights: org.weights } : {}), units: boxesOf(org).map((u) => section(u)) },
      services: { ...(services?.title ? { title: services.title } : {}), ...(services?.weights?.length === 2 ? { weights: services.weights } : {}), external: section(external), internal: section(internal) },
      processes: { ...(processes?.title ? { title: processes.title } : {}), stages: boxesOf(processes).flatMap(flat), crossCutting: elementsOf(processes) },
      dataGovernance: section(dataGov),
    };
    if (!v2.layers.business.processes.crossCutting.length) delete v2.layers.business.processes.crossCutting;
    if (!frameworks || !dataGov || !org || !services || !processes) problems.push('layers.business does not follow the canonical arrangement; check the migrated slots by hand.');
  }

  const a1 = v1.layers?.application;
  if (a1) {
    const [core, clients, itServices, thirdParty, legacy] = boxesOf(a1);
    const groups = boxesOf(core);
    const modules = groups.length ? flat(groups[0]) : elementsOf(core);
    const jobs = groups.length > 1 ? groups.slice(1).flatMap(flat) : [];
    const coreCols = core?.columns ?? groups[0]?.columns;
    v2.layers.application = {
      title: a1.title,
      ...(a1.summary ? { summary: a1.summary } : {}),
      core: { title: core?.title ?? '—', ...(core?.note ? { note: core.note } : {}), ...(coreCols ? { columns: coreCols } : {}), items: modules, ...(jobs.length ? { jobs } : {}) },
      clients: section(clients),
      itServices: section(itServices),
      thirdParty: section(thirdParty),
      ...(legacy ? { legacy: section(legacy) } : {}),
    };
  }

  const d1 = v1.layers?.data;
  if (d1) {
    const all = flat(d1);
    const governance = all.filter((e) => e.icon === 'principle');
    v2.layers.data = { title: d1.title, ...(d1.summary ? { summary: d1.summary } : {}), items: all.filter((e) => e.icon !== 'principle'), ...(governance.length ? { governance } : {}) };
  }

  const t1 = v1.layers?.technology;
  if (t1) {
    const [left, governance] = boxesOf(t1);
    const leftBoxes = boxesOf(left);
    const nodesBox = leftBoxes.find((x) => !x.title);
    const security = leftBoxes.find((x) => x.title);
    const riskEls = elementsOf(left).flatMap(splitRisk);
    v2.layers.technology = {
      title: t1.title,
      ...(t1.summary ? { summary: t1.summary } : {}),
      ...(nodesBox?.columns ? { columns: nodesBox.columns } : {}),
      nodes: flat(nodesBox),
      risks: { items: riskEls.length ? riskEls : [{ name: '—', inferred: true }] },
      security: section(security),
      governance: section(governance),
    };
  }

  if (v1.laterals?.length) {
    v2.laterals = v1.laterals.map((l) => {
      const sections = {};
      for (const [key, box] of Object.entries(l.sections ?? {})) sections[key] = section(box);
      return { title: l.title, ...(l.summary ? { summary: l.summary } : {}), ...(l.icon ? { icon: l.icon } : {}), sections };
    });
  }
  if (v1.notes?.length) v2.notes = v1.notes;
  return { spec: v2, problems };
}
