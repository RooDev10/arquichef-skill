// Layered graph layout with orthogonal edge routing, for diagram types that
// need connectors (C4 context and container views first).
//
// Pure function: a graph with sizes in, coordinates out. No DOM, no browser,
// no randomness: the same input always gives the same output, so layouts can
// be unit-tested and builds are reproducible.
//
// Pipeline (classic Sugiyama, kept small on purpose):
//   1. break cycles      DFS from sources; back edges are laid out reversed
//   2. rank              longest path, then sources pulled down next to
//                        what they use
//   3. normalize         real nodes live on even rows; every edge gets a
//                        dummy per odd row it crosses. The dummy on the middle
//                        odd row carries the label, so the ordering and
//                        spacing steps treat labels as obstacles and a label
//                        never lands on a box
//   4. order             barycenter sweeps + adjacent transposition, keeping
//                        the order with the fewest crossings
//   5. x coordinates     weighted isotonic regression per row (pool adjacent
//                        violators) pulls every item towards its neighbours
//                        while keeping the minimum gaps
//   6. route             ports spread along the bottom/top side of each box;
//                        in each channel between rows, jogs get their own
//                        horizontal track (left-edge algorithm)
//
// The caller provides box and label sizes in px. Text is not measured here:
// use estimateTextBox for a first guess and let the browser check catch
// overflow, as the box-based types already do.

const DEFAULTS = {
  margin: 24, // around the drawing
  nodeGap: 64, // horizontal gap between two boxes in a row
  edgeGap: 22, // horizontal gap next to an edge line or label
  labelGap: 6, // space between an edge line and its label
  minChannel: 22, // minimum height of the routing channel between two rows
  trackGap: 12, // vertical distance between horizontal tracks in a channel
  sweeps: 24, // ordering sweeps (each one is down + up)
  passes: 12, // x-coordinate relaxation passes
};

const W_DUMMY_DUMMY = 8; // keep long edges straight
const W_NODE_DUMMY = 2;
const W_ISOLATED = 1e-3; // items without neighbours yield to the others

/**
 * @typedef {{ id: string, width: number, height: number }} NodeIn
 * @typedef {{ id: string, from: string, to: string, label?: { width: number, height: number } }} EdgeIn
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ x: number, y: number, width: number, height: number }} Rect
 *
 * @param {{ nodes: NodeIn[], edges?: EdgeIn[] }} graph
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {{
 *   width: number, height: number, crossings: number,
 *   nodes: Array<{ id: string } & Rect & { rank: number }>,
 *   edges: Array<{ id: string, from: string, to: string, reversed: boolean, points: Point[], label: Rect | null }>
 * }}
 */
export function layoutGraph(graph, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const { nodes, edges } = checkGraph(graph);
  if (nodes.length === 0) return { width: 2 * opt.margin, height: 2 * opt.margin, crossings: 0, nodes: [], edges: [] };

  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const dag = breakCycles(nodes, edges, index);
  const rank = assignRanks(nodes.length, dag);
  const g = normalize(nodes, edges, dag, rank, opt);
  const crossings = orderRows(g, opt.sweeps);
  assignX(g, opt);
  return route(g, nodes, edges, rank, crossings, opt);
}

/**
 * Ids of the edges that layoutGraph would draw pointing upwards (the ones it
 * reverses to break cycles). Diagram types where arrows must always point
 * down, such as C4, report these as errors so the author can reword the
 * relationship from the upper element's point of view.
 * @param {{ nodes: NodeIn[], edges?: EdgeIn[] }} graph
 * @returns {string[]}
 */
export function upwardEdges(graph) {
  const { nodes, edges } = checkGraph(graph);
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  return breakCycles(nodes, edges, index)
    .map((d, k) => (d.reversed ? edges[k].id : null))
    .filter(Boolean);
}

/* ------------------------------------------------------------ input check */

function isSize(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function checkGraph(graph) {
  const nodes = graph?.nodes;
  const edges = graph?.edges ?? [];
  if (!Array.isArray(nodes) || !Array.isArray(edges)) throw new TypeError('layoutGraph: nodes and edges must be arrays');
  const ids = new Set();
  for (const n of nodes) {
    if (typeof n?.id !== 'string' || n.id === '') throw new TypeError('layoutGraph: every node needs a string id');
    if (ids.has(n.id)) throw new TypeError(`layoutGraph: duplicate node id "${n.id}"`);
    if (!isSize(n.width) || !isSize(n.height)) throw new TypeError(`layoutGraph: node "${n.id}" needs a positive width and height`);
    ids.add(n.id);
  }
  const edgeIds = new Set();
  for (const e of edges) {
    if (typeof e?.id !== 'string' || e.id === '') throw new TypeError('layoutGraph: every edge needs a string id');
    if (edgeIds.has(e.id)) throw new TypeError(`layoutGraph: duplicate edge id "${e.id}"`);
    if (!ids.has(e.from) || !ids.has(e.to)) throw new TypeError(`layoutGraph: edge "${e.id}" references an unknown node`);
    if (e.from === e.to) throw new TypeError(`layoutGraph: edge "${e.id}" is a self-loop`);
    if (e.label != null && (!isSize(e.label.width) || !isSize(e.label.height))) {
      throw new TypeError(`layoutGraph: edge "${e.id}" label needs a positive width and height`);
    }
    edgeIds.add(e.id);
  }
  return { nodes, edges };
}

/* ------------------------------------------------------- 1. break cycles */

/**
 * Returns one { u, v, reversed } per input edge, with u → v acyclic.
 *
 * Greedy feedback arc set (Eades, Lin & Smyth): peel off sinks and sources;
 * when only cycles are left, take the node with the largest out − in degree,
 * the earliest in input order on ties. Edges that point backwards in the
 * resulting sequence are reversed. Because ties follow input order, a spec
 * that lists people first keeps them on top even when a reply edge
 * (system → person) closes a cycle.
 */
function breakCycles(nodes, edges, index) {
  const n = nodes.length;
  const ends = edges.map((e) => [index.get(e.from), index.get(e.to)]);
  const alive = new Array(n).fill(true);
  const inDeg = new Array(n).fill(0);
  const outDeg = new Array(n).fill(0);
  const succ = Array.from({ length: n }, () => []);
  const pred = Array.from({ length: n }, () => []);
  for (const [a, b] of ends) {
    outDeg[a]++;
    inDeg[b]++;
    succ[a].push(b);
    pred[b].push(a);
  }
  const head = [];
  const tail = [];
  const remove = (v) => {
    alive[v] = false;
    for (const w of succ[v]) inDeg[w]--;
    for (const w of pred[v]) outDeg[w]--;
  };
  let left = n;
  while (left > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let v = 0; v < n; v++) {
        if (alive[v] && outDeg[v] === 0) { tail.push(v); remove(v); left--; changed = true; }
      }
      for (let v = 0; v < n; v++) {
        if (alive[v] && inDeg[v] === 0) { head.push(v); remove(v); left--; changed = true; }
      }
    }
    if (left === 0) break;
    let pick = -1;
    for (let v = 0; v < n; v++) {
      if (alive[v] && (pick === -1 || outDeg[v] - inDeg[v] > outDeg[pick] - inDeg[pick])) pick = v;
    }
    head.push(pick);
    remove(pick);
    left--;
  }
  const seq = head.concat(tail.reverse());
  const place = new Array(n);
  seq.forEach((v, i) => { place[v] = i; });

  return ends.map(([a, b]) =>
    place[a] < place[b] ? { u: a, v: b, reversed: false } : { u: b, v: a, reversed: true },
  );
}

/* ---------------------------------------------------------------- 2. rank */

function assignRanks(n, dag) {
  const succ = Array.from({ length: n }, () => []);
  const pred = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (const { u, v } of dag) {
    succ[u].push(v);
    pred[v].push(u);
    indeg[v] += 1;
  }
  // Kahn's algorithm, always taking the lowest index first (stable).
  const rank = new Array(n).fill(0);
  const ready = [];
  for (let v = 0; v < n; v++) if (indeg[v] === 0) ready.push(v);
  const topo = [];
  while (ready.length) {
    ready.sort((a, b) => a - b);
    const v = ready.shift();
    topo.push(v);
    for (const w of succ[v]) {
      rank[w] = Math.max(rank[w], rank[v] + 1);
      if (--indeg[w] === 0) ready.push(w);
    }
  }
  // Pull sources down so they sit right above the first thing they use.
  for (const v of topo) {
    if (pred[v].length === 0 && succ[v].length > 0) {
      rank[v] = Math.min(...succ[v].map((w) => rank[w])) - 1;
    }
  }
  const min = Math.min(...rank);
  return rank.map((r) => r - min);
}

/* ----------------------------------------------------------- 3. normalize */

/**
 * Build the row structure. Items are real nodes or dummies; a chain is the
 * sequence of items one edge passes through, top to bottom.
 */
function normalize(nodes, edges, dag, rank, opt) {
  const rowCount = 2 * Math.max(...rank) + 1;
  const rows = Array.from({ length: rowCount }, () => []);
  const items = [];
  const add = (item) => {
    item.key = items.length;
    item.up = [];
    item.down = [];
    items.push(item);
    rows[item.row].push(item);
    return item;
  };
  const nodeItem = nodes.map((n, i) =>
    add({ kind: 'node', node: i, row: 2 * rank[i], width: n.width, height: n.height, anchor: n.width / 2 }),
  );

  const chains = dag.map(({ u, v }, k) => {
    const label = edges[k].label;
    const top = 2 * rank[u];
    const bottom = 2 * rank[v];
    const span = (bottom - top) / 2; // number of odd rows crossed
    const labelRow = top + 1 + 2 * Math.floor((span - 1) / 2);
    const chain = [nodeItem[u]];
    for (let r = top + 1; r < bottom; r++) {
      const isLabel = label && r === labelRow;
      chain.push(add({
        kind: isLabel ? 'label' : 'dummy',
        edge: k,
        row: r,
        width: isLabel ? label.width + opt.labelGap : 0,
        height: isLabel ? label.height : 0,
        anchor: 0, // the line runs along the left side; the label sits to its right
      }));
    }
    chain.push(nodeItem[v]);
    for (let i = 0; i + 1 < chain.length; i++) {
      const seg = { edge: k, upper: chain[i], lower: chain[i + 1] };
      chain[i].down.push(seg);
      chain[i + 1].up.push(seg);
    }
    return chain;
  });

  return { rows, items, chains };
}

/* --------------------------------------------------------------- 4. order */

function crossingsBetween(upperRow) {
  // Segments between row r and r+1 as (upper position, lower position) pairs.
  const segs = [];
  for (const it of upperRow) for (const s of it.down) segs.push([s.upper.pos, s.lower.pos]);
  let c = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if ((segs[i][0] - segs[j][0]) * (segs[i][1] - segs[j][1]) < 0) c++;
    }
  }
  return c;
}

function totalCrossings(rows) {
  let c = 0;
  for (let r = 0; r + 1 < rows.length; r++) c += crossingsBetween(rows[r]);
  return c;
}

function setPositions(rows) {
  for (const row of rows) row.forEach((it, i) => { it.pos = i; });
}

function sortByBarycenter(row, side) {
  for (const it of row) {
    const nb = side === 'up' ? it.up.map((s) => s.upper.pos) : it.down.map((s) => s.lower.pos);
    it.bary = nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : it.pos;
  }
  row.sort((a, b) => a.bary - b.bary || a.pos - b.pos);
  row.forEach((it, i) => { it.pos = i; });
}

/** Crossings between items a (left) and b (right) of one row, against both neighbour rows. */
function pairCrossings(a, b) {
  let c = 0;
  for (const side of ['up', 'down']) {
    const end = side === 'up' ? 'upper' : 'lower';
    for (const sa of a[side]) {
      for (const sb of b[side]) if (sa[end].pos > sb[end].pos) c++;
    }
  }
  return c;
}

function transpose(rows) {
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 20) {
    improved = false;
    for (const row of rows) {
      for (let i = 0; i + 1 < row.length; i++) {
        const a = row[i];
        const b = row[i + 1];
        if (pairCrossings(b, a) < pairCrossings(a, b)) {
          row[i] = b;
          row[i + 1] = a;
          a.pos = i + 1;
          b.pos = i;
          improved = true;
        }
      }
    }
  }
}

/** Order every row to reduce crossings. Returns the crossing count of the kept order. */
function orderRows(g, sweeps) {
  const { rows } = g;
  // Initial order: row 0 in input order, then each row by barycenter of the row above.
  setPositions(rows);
  for (let r = 1; r < rows.length; r++) sortByBarycenter(rows[r], 'up');

  let best = rows.map((row) => row.slice());
  let bestCount = totalCrossings(rows);
  for (let s = 0; s < sweeps && bestCount > 0; s++) {
    for (let r = 1; r < rows.length; r++) sortByBarycenter(rows[r], 'up');
    for (let r = rows.length - 2; r >= 0; r--) sortByBarycenter(rows[r], 'down');
    transpose(rows);
    const count = totalCrossings(rows);
    if (count < bestCount) {
      bestCount = count;
      best = rows.map((row) => row.slice());
    }
  }
  best.forEach((row, r) => { rows[r] = row; });
  setPositions(rows);
  return bestCount;
}

/* --------------------------------------------------------- 5. x position */

function gapBetween(a, b, opt) {
  return a.kind === 'node' && b.kind === 'node' ? opt.nodeGap : opt.edgeGap;
}

/**
 * Place the items of one row as close as possible (weighted least squares)
 * to their desired left positions, keeping order and minimum gaps.
 * Pool-adjacent-violators on y_i = left_i - offset_i, which must not decrease.
 */
function placeRow(row, desired, weights, opt) {
  const offset = [0];
  for (let i = 1; i < row.length; i++) {
    offset[i] = offset[i - 1] + row[i - 1].width + gapBetween(row[i - 1], row[i], opt);
  }
  const blocks = [];
  for (let i = 0; i < row.length; i++) {
    blocks.push({ w: weights[i], wt: weights[i] * (desired[i] - offset[i]), n: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.wt / a.w <= b.wt / b.w) break;
      blocks.splice(-2, 2, { w: a.w + b.w, wt: a.wt + b.wt, n: a.n + b.n });
    }
  }
  let i = 0;
  for (const b of blocks) {
    const y = b.wt / b.w;
    for (let j = 0; j < b.n; j++, i++) row[i].x = y + offset[i];
  }
}

function segWeight(s) {
  return s.upper.kind !== 'node' && s.lower.kind !== 'node' ? W_DUMMY_DUMMY : W_NODE_DUMMY;
}

/**
 * Fix where each segment leaves and enters its items, as an offset from the
 * item's left side. Boxes spread their ports evenly along the side, ordered
 * by the position of the other end (so ports never cross next to the box);
 * dummies have a single anchor. Known before x assignment, so the relaxation
 * can line dummies up with the real port instead of the box centre.
 */
function assignPortOffsets(items) {
  for (const it of items) {
    for (const [side, end, key] of [['down', 'lower', 'offU'], ['up', 'upper', 'offL']]) {
      if (it.kind !== 'node') {
        for (const s of it[side]) s[key] = it.anchor;
        continue;
      }
      const segs = it[side].slice().sort((a, b) => a[end].pos - b[end].pos || a.edge - b.edge);
      segs.forEach((s, i) => { s[key] = (it.width * (i + 1)) / (segs.length + 1); });
    }
  }
}

function relaxRow(row, sides, opt) {
  const desired = [];
  const weights = [];
  for (const it of row) {
    let w = 0;
    let wx = 0;
    for (const side of sides) {
      for (const s of it[side]) {
        // Left position that would make this segment perfectly vertical.
        const target = side === 'up' ? s.upper.x + s.offU - s.offL : s.lower.x + s.offL - s.offU;
        const sw = segWeight(s);
        w += sw;
        wx += sw * target;
      }
    }
    if (w === 0) {
      desired.push(it.x);
      weights.push(W_ISOLATED);
    } else {
      desired.push(wx / w);
      weights.push(w);
    }
  }
  placeRow(row, desired, weights, opt);
}

/**
 * Least squares leaves a dummy halfway between the port above and the port
 * below, which draws two jogs. Snap it onto one of them (the nearer one that
 * fits between its row neighbours) so the edge has a single jog. Runs top to
 * bottom, so a long edge's dummies follow each other in a straight line.
 */
function snapDummies(rows, opt) {
  for (const row of rows) {
    row.forEach((it, i) => {
      if (it.kind === 'node') return;
      const left = row[i - 1];
      const right = row[i + 1];
      const lo = left ? left.x + left.width + gapBetween(left, it, opt) : -Infinity;
      const hi = right ? right.x - it.width - gapBetween(it, right, opt) : Infinity;
      const up = it.up[0];
      const down = it.down[0];
      const candidates = [up.upper.x + up.offU - up.offL, down.lower.x + down.offL - down.offU]
        .filter((x) => x >= lo - 0.01 && x <= hi + 0.01)
        .sort((a, b) => Math.abs(a - it.x) - Math.abs(b - it.x));
      if (candidates.length) it.x = candidates[0];
    });
  }
}

function assignX(g, opt) {
  const { rows } = g;
  assignPortOffsets(g.items);
  for (const row of rows) placeRow(row, row.map(() => 0), row.map(() => 1), opt); // packed left
  for (let r = 1; r < rows.length; r++) relaxRow(rows[r], ['up'], opt);
  for (let p = 0; p < opt.passes; p++) {
    for (let r = rows.length - 2; r >= 0; r--) relaxRow(rows[r], ['up', 'down'], opt);
    for (let r = 1; r < rows.length; r++) relaxRow(rows[r], ['up', 'down'], opt);
  }
  snapDummies(rows, opt);
  const minX = Math.min(...g.items.map((it) => it.x));
  for (const it of g.items) it.x = round(it.x - minX + opt.margin);
}

/* --------------------------------------------------------------- 6. route */

function round(v) {
  return Math.round(v * 100) / 100;
}

/**
 * Channel routing: give every jog (a segment whose top and bottom x differ)
 * a horizontal track. Track 0 is the highest. Returns the number of tracks.
 *
 * Vertical constraints avoid crossings that ordering alone cannot see: a jog
 * drops from x1 at the channel top to its track, so if x1 lies within another
 * jog's span, it must use a higher track than that jog, or it would cut
 * through it. Likewise its rise to x2 at the channel bottom must sit below any
 * jog whose span covers x2. Jogs are placed in constraint order (each one
 * below everything it must be below); constraint cycles mean an unavoidable
 * crossing and are broken at the leftmost jog. Jogs that overlap never share
 * a track.
 */
function assignTracks(segs, opt) {
  const jogs = segs
    .filter((s) => s.x1 !== s.x2) // both rounded already; any difference needs a track
    .map((s) => ({ s, lo: Math.min(s.x1, s.x2), hi: Math.max(s.x1, s.x2), above: [], below: 0 }))
    .sort((a, b) => a.lo - b.lo || a.hi - b.hi || a.s.edge - b.s.edge);
  const within = (x, j) => x > j.lo && x < j.hi;
  for (const a of jogs) {
    for (const b of jogs) {
      if (a === b) continue;
      // a must be above b when a's drop (x1) is inside b, or b's rise (x2) is inside a.
      if (within(a.s.x1, b) || within(b.s.x2, a)) {
        a.above.push(b);
        b.below += 1;
      }
    }
  }
  const placed = [];
  const pending = new Set(jogs);
  while (pending.size) {
    let next = [...pending].find((j) => j.below === 0);
    if (!next) next = pending.values().next().value; // cycle: leftmost pending jog
    pending.delete(next);
    for (const b of next.above) b.below -= 1;
    // Lowest track (largest index needed) above which every constraint holds.
    const minTrack = Math.max(-1, ...placed.filter((p) => p.above.includes(next)).map((p) => p.s.track)) + 1;
    let t = minTrack;
    while (placed.some((p) => p.s.track === t && p.lo < next.hi + opt.trackGap && next.lo < p.hi + opt.trackGap)) t++;
    next.s.track = t;
    placed.push(next);
  }
  return placed.length ? Math.max(...placed.map((p) => p.s.track)) + 1 : 0;
}

function simplify(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    const prev = out[out.length - 2];
    if (prev && last && ((prev.x === last.x && last.x === p.x) || (prev.y === last.y && last.y === p.y))) {
      out[out.length - 1] = p; // collinear: drop the middle point
      continue;
    }
    out.push(p);
  }
  return out;
}

function route(g, nodes, edges, rank, crossings, opt) {
  const { rows, items, chains } = g;

  for (const it of items) {
    for (const s of it.down) {
      s.x1 = round(s.upper.x + s.offU);
      s.x2 = round(s.lower.x + s.offL);
    }
  }

  // Row and channel heights, top to bottom.
  const rowTop = [];
  const rowHeight = rows.map((row) => Math.max(0, ...row.map((it) => it.height)));
  const channel = [];
  let y = opt.margin;
  for (let r = 0; r < rows.length; r++) {
    rowTop[r] = y;
    y += rowHeight[r];
    if (r + 1 < rows.length) {
      const segs = rows[r].flatMap((it) => it.down);
      const tracks = assignTracks(segs, opt);
      const height = Math.max(opt.minChannel, (tracks + 1) * opt.trackGap);
      channel[r] = { top: y, height, tracks, segs };
      y += height;
    }
  }
  const totalHeight = round(y + opt.margin);

  for (const it of items) it.y = round(rowTop[it.row] + (rowHeight[it.row] - it.height) / 2);

  const edgeOut = chains.map((chain, k) => {
    const pts = [];
    for (let i = 0; i + 1 < chain.length; i++) {
      const upper = chain[i];
      const s = upper.down.find((d) => d.edge === k);
      const r = upper.row;
      const startY = upper.kind === 'node' ? upper.y + upper.height : rowTop[r] + rowHeight[r];
      const endY = s.lower.kind === 'node' ? s.lower.y : rowTop[r + 1];
      pts.push({ x: s.x1, y: round(startY) });
      if (s.track !== undefined) {
        const ch = channel[r];
        const ty = round(ch.top + ((s.track + 1) * ch.height) / (ch.tracks + 1));
        pts.push({ x: s.x1, y: ty }, { x: s.x2, y: ty });
      }
      pts.push({ x: s.x2, y: round(endY) });
    }
    const labelItem = chain.find((it) => it.kind === 'label');
    const label = labelItem
      ? {
          x: round(labelItem.x + opt.labelGap),
          y: labelItem.y,
          width: edges[k].label.width,
          height: edges[k].label.height,
        }
      : null;
    const points = simplify(pts);
    const reversed = chain[0].node !== nodes.findIndex((n) => n.id === edges[k].from);
    return {
      id: edges[k].id,
      from: edges[k].from,
      to: edges[k].to,
      reversed,
      points: reversed ? points.reverse() : points,
      label,
    };
  });

  const nodeOut = nodes.map((n, i) => {
    const it = items[i]; // node items were added first, in input order
    return { id: n.id, x: it.x, y: it.y, width: n.width, height: n.height, rank: rank[i] };
  });

  const right = Math.max(...items.map((it) => it.x + it.width));
  return { width: round(right + opt.margin), height: totalHeight, crossings, nodes: nodeOut, edges: edgeOut };
}

/* ------------------------------------------------------------------ text */

/**
 * Rough size of a text block, for layout before the browser has measured it.
 * Greedy word wrap with an average glyph width for Arial-like fonts; words
 * longer than a line are split. Returns the wrapped lines too.
 */
export function estimateTextBox(text, { fontSize = 12, maxWidth = 200, lineHeight = 1.3, charWidth = 0.56 } = {}) {
  const glyph = fontSize * charWidth;
  const perLine = Math.max(1, Math.floor(maxWidth / glyph));
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (let word of para.split(/\s+/).filter(Boolean)) {
      while (word.length > perLine) {
        if (line) { lines.push(line); line = ''; }
        lines.push(word.slice(0, perLine));
        word = word.slice(perLine);
      }
      if (!word) continue;
      if (!line) line = word;
      else if (line.length + 1 + word.length <= perLine) line += ` ${word}`;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  const longest = Math.max(0, ...lines.map((l) => l.length));
  return {
    width: Math.ceil(longest * glyph),
    height: Math.ceil(lines.length * fontSize * lineHeight),
    lines,
  };
}
