import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estimateTextBox, layoutGraph, upwardEdges } from '../core/graph-layout.mjs';

const box = (id, width = 220, height = 120) => ({ id, width, height });
const label = (width = 120, height = 32) => ({ width, height });

// A C4 context view shaped like the MediCita eval: people on top (connected
// only to the central system), the system in the middle, external systems
// below. Every relationship is worded from the upper element, so every arrow
// points down, and each pair of elements has at most one relationship.
const CONTEXT = {
  nodes: [box('paciente'), box('medico'), box('admin'), box('medicita', 260, 140),
    box('pagos'), box('correo'), box('his'), box('sms')],
  edges: [
    { id: 'e1', from: 'paciente', to: 'medicita', label: label(140, 44) },
    { id: 'e2', from: 'medico', to: 'medicita', label: label() },
    { id: 'e3', from: 'admin', to: 'medicita', label: label() },
    { id: 'e4', from: 'medicita', to: 'pagos', label: label() },
    { id: 'e5', from: 'medicita', to: 'correo', label: label() },
    { id: 'e6', from: 'medicita', to: 'his', label: label(160, 48) },
    { id: 'e8', from: 'medicita', to: 'sms' },
  ],
};

function overlaps(a, b, pad = 0) {
  return a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
}

function onBoundary(p, r) {
  const inX = p.x >= r.x - 0.01 && p.x <= r.x + r.width + 0.01;
  const inY = p.y >= r.y - 0.01 && p.y <= r.y + r.height + 0.01;
  const onH = inX && (Math.abs(p.y - r.y) < 0.01 || Math.abs(p.y - (r.y + r.height)) < 0.01);
  const onV = inY && (Math.abs(p.x - r.x) < 0.01 || Math.abs(p.x - (r.x + r.width)) < 0.01);
  return onH || onV;
}

/** Does the axis-aligned segment p→q pass through the interior of r? */
function segmentHitsRect(p, q, r) {
  const x1 = Math.min(p.x, q.x);
  const x2 = Math.max(p.x, q.x);
  const y1 = Math.min(p.y, q.y);
  const y2 = Math.max(p.y, q.y);
  return x1 < r.x + r.width - 0.01 && x2 > r.x + 0.01 && y1 < r.y + r.height - 0.01 && y2 > r.y + 0.01;
}

/** Proper crossings between a horizontal and a vertical segment of two different edges. */
function drawnCrossings(out) {
  const segs = out.edges.flatMap((e) => e.points.slice(1).map((q, i) => ({ e: e.id, p: e.points[i], q })));
  let n = 0;
  for (const a of segs) {
    for (const b of segs) {
      if (a.e === b.e || a.p.y !== a.q.y || b.p.x !== b.q.x) continue; // a horizontal, b vertical
      const x = b.p.x;
      const y = a.p.y;
      const inA = x > Math.min(a.p.x, a.q.x) && x < Math.max(a.p.x, a.q.x);
      const inB = y > Math.min(b.p.y, b.q.y) && y < Math.max(b.p.y, b.q.y);
      if (inA && inB) n++;
    }
  }
  return n;
}

test('jogs in a channel are stacked so their drops do not cut each other', () => {
  // Two people far apart feeding one box: the left one's long jog must not be
  // crossed by the right one's drop (the bug seen in the first MediCita build).
  const out = layoutGraph({
    nodes: [box('p1'), box('p2'), box('p3'), box('p4'), box('sys', 240, 140)],
    edges: ['p1', 'p2', 'p3', 'p4'].map((p) => ({ id: p, from: p, to: 'sys', label: label(150, 44) })),
  });
  assert.equal(drawnCrossings(out), 0);
  assert.equal(drawnCrossings(layoutGraph(CONTEXT)), 0);
});

test('layout is deterministic', () => {
  assert.deepEqual(layoutGraph(CONTEXT), layoutGraph(structuredClone(CONTEXT)));
});

test('boxes and labels never overlap each other', () => {
  const out = layoutGraph(CONTEXT);
  const rects = [...out.nodes, ...out.edges.map((e) => e.label).filter(Boolean)];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) assert.ok(!overlaps(rects[i], rects[j]), `overlap ${i} / ${j}`);
  }
  for (const r of rects) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= out.width && r.y + r.height <= out.height, 'inside the drawing');
  }
});

test('edges are orthogonal, start and end on their boxes, and avoid other boxes', () => {
  const out = layoutGraph(CONTEXT);
  const byId = new Map(out.nodes.map((n) => [n.id, n]));
  for (const e of out.edges) {
    const pts = e.points;
    assert.ok(pts.length >= 2, e.id);
    for (let i = 0; i + 1 < pts.length; i++) {
      assert.ok(pts[i].x === pts[i + 1].x || pts[i].y === pts[i + 1].y, `${e.id} segment ${i} is not orthogonal`);
    }
    assert.ok(onBoundary(pts[0], byId.get(e.from)), `${e.id} starts on ${e.from}`);
    assert.ok(onBoundary(pts[pts.length - 1], byId.get(e.to)), `${e.id} ends on ${e.to}`);
    for (const n of out.nodes) {
      for (let i = 0; i + 1 < pts.length; i++) {
        assert.ok(!segmentHitsRect(pts[i], pts[i + 1], n), `${e.id} crosses ${n.id}`);
      }
    }
    if (e.label) {
      for (let i = 0; i + 1 < pts.length; i++) {
        for (const other of out.edges) {
          if (other.label) assert.ok(!segmentHitsRect(pts[i], pts[i + 1], other.label), `${e.id} crosses label of ${other.id}`);
        }
      }
    }
  }
});

test('in a C4 view without cycles every arrow points down', () => {
  assert.deepEqual(upwardEdges(CONTEXT), []);
  const out = layoutGraph(CONTEXT);
  for (const e of out.edges) {
    assert.equal(e.reversed, false, e.id);
    const [p, q] = e.points.slice(-2);
    assert.ok(p.x === q.x && q.y > p.y, `${e.id} arrives from above`);
  }
});

test('cycles are broken but arrows keep their direction', () => {
  const cycle = {
    nodes: [box('a'), box('b'), box('c')],
    edges: [
      { id: 'ab', from: 'a', to: 'b', label: label() },
      { id: 'bc', from: 'b', to: 'c' },
      { id: 'ca', from: 'c', to: 'a', label: label() },
    ],
  };
  assert.deepEqual(upwardEdges(cycle), ['ca']);
  const out = layoutGraph(cycle);
  const back = out.edges.find((e) => e.id === 'ca');
  assert.equal(back.reversed, true);
  const byId = new Map(out.nodes.map((n) => [n.id, n]));
  assert.ok(onBoundary(back.points[0], byId.get('c')), 'line starts at the original source');
  assert.ok(onBoundary(back.points.at(-1), byId.get('a')), 'arrow ends at the original target');
  assert.equal(out.edges.filter((e) => e.reversed).length, 1);
});

test('people sit above the system, external systems below', () => {
  const out = layoutGraph(CONTEXT);
  const rank = Object.fromEntries(out.nodes.map((n) => [n.id, n.rank]));
  for (const p of ['paciente', 'medico', 'admin']) assert.ok(rank[p] < rank.medicita, p);
  for (const s of ['pagos', 'correo', 'his', 'sms']) assert.ok(rank[s] > rank.medicita, s);
});

test('a C4 view has at most one relationship per pair of elements', () => {
  const pairs = CONTEXT.edges.map((e) => [e.from, e.to].sort().join('|'));
  assert.equal(new Set(pairs).size, pairs.length);
});

test('an external system that calls the central system sits above it, arrow pointing down', () => {
  const g = structuredClone(CONTEXT);
  g.nodes.push(box('aseguradora'));
  g.edges.push({ id: 'e9', from: 'aseguradora', to: 'medicita', label: label() });
  assert.deepEqual(upwardEdges(g), []);
  const out = layoutGraph(g);
  const rank = Object.fromEntries(out.nodes.map((n) => [n.id, n.rank]));
  assert.equal(rank.aseguradora, rank.paciente);
  const e = out.edges.find((x) => x.id === 'e9');
  const [p, q] = e.points.slice(-2);
  assert.ok(p.x === q.x && q.y > p.y);
});

test('parallel edges between the same boxes get distinct ports', () => {
  // C4 forbids them, but the engine stays generic and must still draw them apart.
  const out = layoutGraph({
    nodes: [box('a'), box('b')],
    edges: [{ id: 'x', from: 'a', to: 'b', label: label() }, { id: 'y', from: 'a', to: 'b', label: label() }],
  });
  const [a, b] = out.edges;
  assert.notEqual(a.points[0].x, b.points[0].x);
  assert.notEqual(a.points.at(-1).x, b.points.at(-1).x);
});

test('ordering removes avoidable crossings', () => {
  // Input order would cross (a→d, b→c with rows [a, b] / [c, d]); barycenter fixes it.
  const out = layoutGraph({
    nodes: [box('a'), box('b'), box('c'), box('d')],
    edges: [{ id: 'x', from: 'a', to: 'd' }, { id: 'y', from: 'b', to: 'c' }],
  });
  assert.equal(out.crossings, 0);
  const byId = Object.fromEntries(out.nodes.map((n) => [n.id, n]));
  assert.ok(byId.a.x < byId.b.x === byId.d.x < byId.c.x);
});

test('a single straight edge has no jogs', () => {
  const out = layoutGraph({ nodes: [box('a'), box('b')], edges: [{ id: 'x', from: 'a', to: 'b', label: label() }] });
  assert.equal(out.edges[0].points.length, 2);
});

test('long edges route around the boxes in between', () => {
  const out = layoutGraph({
    nodes: [box('a'), box('b'), box('c'), box('d')],
    edges: [
      { id: 'ab', from: 'a', to: 'b' },
      { id: 'bc', from: 'b', to: 'c' },
      { id: 'cd', from: 'c', to: 'd' },
      { id: 'ad', from: 'a', to: 'd', label: label() },
    ],
  });
  const long = out.edges.find((e) => e.id === 'ad');
  for (const n of out.nodes) {
    for (let i = 0; i + 1 < long.points.length; i++) assert.ok(!segmentHitsRect(long.points[i], long.points[i + 1], n), n.id);
  }
});

test('isolated nodes and empty graphs are laid out', () => {
  const out = layoutGraph({ nodes: [box('solo'), box('a'), box('b')], edges: [{ id: 'x', from: 'a', to: 'b' }] });
  assert.equal(out.nodes.length, 3);
  assert.ok(!overlaps(out.nodes[0], out.nodes[1]) && !overlaps(out.nodes[0], out.nodes[2]));
  assert.deepEqual(layoutGraph({ nodes: [] }).nodes, []);
});

test('bad input is rejected with a clear message', () => {
  assert.throws(() => layoutGraph({ nodes: [box('a'), box('a')] }), /duplicate node id "a"/);
  assert.throws(() => layoutGraph({ nodes: [box('a')], edges: [{ id: 'x', from: 'a', to: 'z' }] }), /unknown node/);
  assert.throws(() => layoutGraph({ nodes: [box('a')], edges: [{ id: 'x', from: 'a', to: 'a' }] }), /self-loop/);
  assert.throws(() => layoutGraph({ nodes: [{ id: 'a', width: 0, height: 10 }] }), /positive width/);
  assert.throws(() => layoutGraph({ nodes: [box('a'), box('b')], edges: [{ id: 'x', from: 'a', to: 'b', label: { width: -1, height: 2 } }] }), /label/);
});

test('a larger graph stays fast', () => {
  const nodes = Array.from({ length: 60 }, (_, i) => box(`n${i}`, 180, 90));
  const edges = [];
  for (let i = 1; i < 60; i++) {
    edges.push({ id: `t${i}`, from: `n${Math.floor((i - 1) / 3)}`, to: `n${i}`, label: label(90, 28) });
    if (i % 7 === 0) edges.push({ id: `c${i}`, from: `n${i}`, to: `n${(i * 5) % 60}` });
  }
  const t0 = performance.now();
  const out = layoutGraph({ nodes, edges });
  assert.ok(performance.now() - t0 < 2000);
  assert.equal(out.edges.length, edges.length);
});

test('estimateTextBox wraps words and splits long ones', () => {
  const r = estimateTextBox('Envía recordatorios de citas por SMS', { fontSize: 10, maxWidth: 80 });
  assert.ok(r.lines.length > 1);
  assert.ok(r.width <= 80);
  assert.equal(r.height, Math.ceil(r.lines.length * 10 * 1.3));
  const long = estimateTextBox('a'.repeat(50), { fontSize: 10, maxWidth: 56 });
  assert.ok(long.lines.every((l) => l.length <= 10));
});
