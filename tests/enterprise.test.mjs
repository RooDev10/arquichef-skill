import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { findChrome } from '../core/chrome.mjs';
import { renderPage } from '../core/page.mjs';
import { validate } from '../core/schema.mjs';
import * as enterprise from '../types/enterprise/type.mjs';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = path.join(ROOT, 'bin', 'arquichef.mjs');
const EXAMPLE = path.join(ROOT, 'types/enterprise/examples/verifish.json');
const STARTER = path.join(ROOT, 'types/enterprise/templates/starter.json');
const V1 = path.join(ROOT, 'tests/fixtures/verifish.v1.json');
const load = (p) => JSON.parse(readFileSync(p, 'utf8'));

test('the Verifish example and the starter are valid and lint-clean', () => {
  for (const file of [EXAMPLE, STARTER]) {
    const spec = load(file);
    assert.deepEqual(validate(enterprise.schema, spec), [], file);
    assert.deepEqual(enterprise.lint(spec).errors, [], file);
  }
  assert.ok(enterprise.lint(load(EXAMPLE)).stats.elements > 100);
});

test('hostile strings are escaped in the HTML and the README', () => {
  const spec = load(STARTER);
  const evil = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
  spec.meta.title = 'T';
  spec.layers.business.frameworks.items[0].name = evil.slice(0, 70);
  spec.layers.business.frameworks.items[0].detail = '[link](javascript:alert(3)) ![i](http://x/y.png)';
  assert.deepEqual(validate(enterprise.schema, spec), []);

  const html = renderPage(enterprise.render(spec));
  assert.ok(!html.includes('<script>alert'), 'raw script tag leaked');
  assert.ok(!html.includes('<img src=x'), 'raw img tag leaked');
  // URLs may appear as visible text; what must never appear is a resource reference.
  assert.ok(!/(src|href|action)\s*=\s*["']?\s*(https?:|javascript:|\/\/)/i.test(html), 'external reference in output');
  assert.ok(!/url\(\s*["']?(https?:|\/\/)/i.test(html), 'external CSS url() in output');

  const md = enterprise.readme(spec, { files: { html: 'a.html', md: 'README.md' } });
  assert.ok(!md.includes('<script>'));
  assert.ok(!/(^|[^\\])\[link\]/.test(md));
});

test('lint flags unknown sources and missing parts', () => {
  const spec = load(STARTER);
  spec.layers.business.frameworks.items[0].source = 'nope:1';
  delete spec.layers.data;
  const { errors, warnings } = enterprise.lint(spec);
  assert.ok(errors.some((e) => /does not match any meta.sources id/.test(e.message)));
  assert.ok(warnings.some((w) => /no data layer/.test(w.message)));
});

test('every rendered element carries its spec path', () => {
  const html = enterprise.render(load(EXAMPLE)).body;
  const elements = (html.match(/class="el[ "]/g) ?? []).length;
  const withPath = (html.match(/class="el[^"]*" data-path="/g) ?? []).length;
  assert.equal(elements, withPath);
  assert.equal(elements, enterprise.lint(load(EXAMPLE)).stats.elements);
});

test('CLI: invalid spec exits 2, build without browser writes outputs', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arquichef-cli-'));
  try {
    const bad = path.join(dir, 'bad.json');
    await fs.writeFile(bad, JSON.stringify({ arquichef: '2', type: 'enterprise', meta: {}, layers: {} }));
    await assert.rejects(run('node', [CLI, 'validate', bad]), (err) => err.code === 2);

    const notype = path.join(dir, 'notype.json');
    await fs.writeFile(notype, '{}');
    await assert.rejects(run('node', [CLI, 'validate', notype]), (err) => err.code === 2);

    await run('node', [CLI, 'build', STARTER, '--out', path.join(dir, 'out'), '--name', 'demo', '--skip-browser']);
    const files = await fs.readdir(path.join(dir, 'out'));
    assert.ok(files.includes('demo.html') && files.includes('README.md'));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('browser check: the Verifish example has no layout errors', async (t) => {
  if (!(await findChrome())) {
    t.skip('Chrome not available');
    return;
  }
  const { stdout } = await run('node', [CLI, 'check', EXAMPLE, '--json'], { maxBuffer: 16 * 1024 * 1024 });
  const report = JSON.parse(stdout.slice(stdout.indexOf('{')));
  const errors = report.layout.issues.filter((i) => i.severity === 'error');
  assert.deepEqual(errors, []);
  assert.equal(report.layout.width, 2200);
});

test('the layout is canonical: horizontal title bars, fixed business and technology blocks', () => {
  const page = enterprise.render(load(EXAMPLE));
  const html = renderPage(page);
  assert.ok(!/writing-mode|rotate\(/.test(html), 'no rotated labels');
  assert.ok(!/<h1/.test(html), 'no page title above the sheet');
  const order = ['layers.business.frameworks', 'layers.business.knowledge', 'layers.business.change', 'layers.business.organization', 'layers.business.services', 'layers.business.processes', 'layers.business.dataGovernance'];
  const at = order.map((p) => html.indexOf(`data-path="${p}"`));
  assert.ok(at.every((i) => i > 0), 'every business block is rendered');
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'business blocks keep the canonical order');
  for (const p of ['layers.technology.risks', 'layers.technology.security', 'layers.technology.governance']) assert.ok(html.includes(`data-path="${p}"`), p);
  assert.equal((html.match(/class="lateral-cell /g) ?? []).length, 4, 'one lateral cell per layer');
  assert.equal((html.match(/class="paper"/g) ?? []).length, 2, 'one note in demand and one in value');
  assert.equal((html.match(/class="arr"/g) ?? []).length, load(EXAMPLE).layers.business.processes.stages.length - 1, 'arrows between stages');
});

test('every container and element has a corner icon', () => {
  const { body } = enterprise.render(load(EXAMPLE));
  const tags = body.match(/<(section|aside|div) class="(band|box|grp|el)[^"]*"/g) ?? [];
  assert.ok(tags.length > 150);
  for (const tag of tags) assert.match(tag, / k-[a-z]+/, tag);
});

test('format 1 specs are refused with a hint and migrate cleanly', async () => {
  await assert.rejects(run('node', [CLI, 'validate', V1]), (err) => err.code === 2 && /arquichef migrate/.test(err.stderr));
  const { spec, problems } = enterprise.migrate(load(V1));
  assert.deepEqual(problems, []);
  assert.deepEqual(validate(enterprise.schema, spec), []);
  assert.equal(enterprise.lint(spec).stats.elements, enterprise.lint(load(EXAMPLE)).stats.elements);
});
