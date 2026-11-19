import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { findChrome } from '../core/chrome.mjs';
import { renderPage } from '../core/page.mjs';
import { validate } from '../core/schema.mjs';
import * as c4 from '../types/c4-context/type.mjs';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = path.join(ROOT, 'bin', 'arquichef.mjs');
const EXAMPLE = path.join(ROOT, 'types/c4-context/examples/medicita.json');
const STARTER = path.join(ROOT, 'types/c4-context/templates/starter.json');
const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const errorsOf = (spec) => c4.lint(spec).errors;
const rel = (from, to, description = 'Usa') => ({ from, to, description, technology: 'HTTPS' });

test('the MediCita example and the starter are valid and error-free', () => {
  for (const file of [EXAMPLE, STARTER]) {
    const spec = load(file);
    assert.deepEqual(validate(c4.schema, spec), [], file);
    assert.deepEqual(errorsOf(spec), [], file);
  }
});

test('a person can only relate to the central system', () => {
  const spec = load(EXAMPLE);
  spec.relationships.push(rel('paciente', 'twilio'));
  assert.ok(errorsOf(spec).some((e) => e.path === 'relationships[8]' && /only has relationships with the central system/.test(e.message)));

  const spec2 = load(EXAMPLE);
  spec2.relationships.push(rel('twilio', 'paciente', 'Entrega SMS a'));
  assert.ok(errorsOf(spec2).some((e) => /only has relationships with the central system/.test(e.message)));
});

test('people start their relationships with the central system', () => {
  const spec = load(EXAMPLE);
  spec.relationships = spec.relationships.filter((r) => r.from !== 'gerencia');
  spec.relationships.push(rel('medicita', 'gerencia', 'Envía reportes'));
  assert.ok(errorsOf(spec).some((e) => /people start their relationships: write it as «Gerencia de la clínica» → «MediCita»/.test(e.message)));
});

test('only one relationship per pair of elements, in either direction', () => {
  const spec = load(EXAMPLE);
  spec.relationships.push(rel('medicita', 'twilio', 'Consulta el estado de los SMS'));
  assert.ok(errorsOf(spec).some((e) => e.path === 'relationships[8]' && /already a relationship between «MediCita» and «Twilio» \(relationships\[4\]\)/.test(e.message)));

  const spec2 = load(EXAMPLE);
  spec2.relationships.push(rel('twilio', 'medicita', 'Notifica entregas'));
  assert.ok(errorsOf(spec2).some((e) => /already a relationship/.test(e.message)));
});

test('arrows always point down: a cycle is an error', () => {
  const spec = load(EXAMPLE);
  spec.relationships.push(rel('twilio', 'whatsapp', 'Reenvía'), rel('whatsapp', 'eps', 'Avisa'), rel('eps', 'twilio', 'Pide SMS'));
  const up = errorsOf(spec).filter((e) => /would point up/.test(e.message));
  assert.equal(up.length, 1);
});

test('an external system that calls the central system is drawn above it', () => {
  const spec = load(EXAMPLE);
  spec.externals.push({ id: 'portal-eps', name: 'Portal de la EPS', description: 'Consulta las atenciones de sus asegurados.' });
  spec.relationships.push(rel('portal-eps', 'medicita', 'Consulta atenciones de asegurados'));
  assert.deepEqual(errorsOf(spec), []);
  const out = c4.layout(spec);
  const rank = Object.fromEntries(out.nodes.map((n) => [n.id, n.rank]));
  assert.ok(rank['portal-eps'] < rank.medicita);
  assert.equal(rank['portal-eps'], rank.paciente);
  const md = c4.readme(spec, { files: { html: 'a.html', md: 'README.md' } });
  assert.match(md, /### Sistemas externos que llaman al sistema\n\n[^#]*Portal de la EPS/);
});

test('references, ids and orphans are checked', () => {
  const spec = load(EXAMPLE);
  spec.relationships.push(rel('medicita', 'nadie'));
  spec.externals.push({ id: 'twilio', name: 'Otro', description: 'Duplicado.' });
  spec.externals.push({ id: 'suelto', name: 'Suelto', description: 'Sin relaciones.' });
  const errors = errorsOf(spec);
  assert.ok(errors.some((e) => e.path === 'relationships[8].to' && /not the id of any element/.test(e.message)));
  assert.ok(errors.some((e) => e.path === 'externals[4].id' && /already used by externals\[0\]/.test(e.message)));
  assert.ok(errors.some((e) => e.path === 'externals[5]' && /has no relationships/.test(e.message)));
});

test('hostile strings are escaped in the HTML and the README', () => {
  const spec = load(STARTER);
  const evil = '<script>alert(1)</script>"><img src=x>';
  spec.system.name = evil.slice(0, 40);
  spec.relationships[0].description = '[link](javascript:alert(3)) <b>|</b>';
  assert.deepEqual(validate(c4.schema, spec), []);
  const html = renderPage(c4.render(spec));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!/(src|href|action)\s*=\s*["']?\s*(https?:|javascript:|\/\/)/i.test(html));
  const md = c4.readme(spec, { files: { html: 'a.html', md: 'README.md' } });
  assert.ok(!md.includes('<script>'));
  assert.ok(!/(^|[^\\])\[link\]/.test(md));
});

test('every box and arrow label carries its spec path and every arrow is drawn', () => {
  const spec = load(EXAMPLE);
  const { body } = c4.render(spec);
  const boxes = body.match(/class="el fixed c4 [^"]*" data-path="[^"]+"/g) ?? [];
  const labels = body.match(/class="el fixed rel[^"]*" data-path="relationships\[\d+\]"/g) ?? [];
  assert.equal(boxes.length, 1 + spec.people.length + spec.externals.length);
  assert.equal(labels.length, spec.relationships.length);
  assert.equal((body.match(/<polyline /g) ?? []).length, spec.relationships.length);
});

test('the README explains every element and relationship', () => {
  const spec = load(EXAMPLE);
  const md = c4.readme(spec, { files: { html: 'm.html', png: 'm.png', md: 'README.md' } });
  for (const p of spec.people) assert.ok(md.includes(p.name), p.name);
  for (const e of spec.externals) assert.ok(md.includes(e.name), e.name);
  const section = (title) => md.split(`## ${title}\n`)[1].split('\n## ')[0];
  const rows = (title) => section(title).split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| :') && !/^\| (Nombre|Desde) /.test(l));
  assert.equal(rows('Personas').length, spec.people.length);
  assert.equal(rows('Sistemas externos').length, spec.externals.length);
  assert.equal(rows('Relaciones').length, spec.relationships.length);
  assert.ok(md.includes('## Observaciones'));
  assert.equal(md, c4.readme(load(EXAMPLE), { files: { html: 'm.html', png: 'm.png', md: 'README.md' } }), 'stable output');
});

test('browser check: the MediCita example has no layout errors', async (t) => {
  if (!(await findChrome())) {
    t.skip('Chrome not available');
    return;
  }
  const { stdout } = await run('node', [CLI, 'check', EXAMPLE, '--json'], { maxBuffer: 16 * 1024 * 1024 });
  const report = JSON.parse(stdout.slice(stdout.indexOf('{')));
  assert.deepEqual(report.layout.issues.filter((i) => i.severity === 'error'), []);
});
