import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { escapeHtml, escapeMarkdown, safeToken } from '../core/escape.mjs';
import { renderPage } from '../core/page.mjs';
import { validate } from '../core/schema.mjs';
import { UserError, writeOutputs } from '../core/safe-fs.mjs';

test('escapeHtml neutralises markup and attribute breakouts', () => {
  assert.equal(escapeHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(escapeHtml("' ` &"), '&#39; &#96; &amp;');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeMarkdown blocks links, images, html and tables', () => {
  const out = escapeMarkdown('![x](http://e.vil) <b>|</b> *a* _b_');
  assert.ok(!/(^|[^\\])\[/.test(out), out);
  assert.ok(!/(^|[^\\])</.test(out), out);
  assert.ok(!/(^|[^\\])\|/.test(out), out);
  assert.equal(escapeMarkdown('a\nb'), 'a b');
});

test('safeToken keeps only a safe alphabet', () => {
  assert.equal(safeToken('actor" onclick="x'), 'actoronclickx');
});

test('renderPage sets a CSP that blocks the network and pins scripts by hash', () => {
  const html = renderPage({ title: '<t>', lang: 'es', css: '', body: '<div id="fit"></div>' });
  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'sha256-[A-Za-z0-9+/=]+'/);
  assert.ok(!/unsafe-eval/.test(html));
  assert.match(html, /<title>&lt;t&gt;<\/title>/);
});

test('validator: types, enums, lengths, required, additionalProperties', () => {
  const schema = {
    type: 'object', additionalProperties: false, required: ['a'],
    properties: { a: { type: 'string', maxLength: 3 }, b: { enum: ['x', 'y'] }, c: { type: 'integer', minimum: 1 } },
  };
  assert.deepEqual(validate(schema, { a: 'ok' }), []);
  const errs = validate(schema, { a: 'long', b: 'z', c: 0, d: 1 }).map((e) => e.message).join(' | ');
  assert.match(errs, /at most 3/);
  assert.match(errs, /one of/);
  assert.match(errs, />= 1/);
  assert.match(errs, /unknown property "d"/);
  assert.match(validate(schema, {})[0].message, /missing required/);
});

test('validator rejects unsupported keywords so rules cannot silently vanish', () => {
  assert.throws(() => validate({ type: 'string', maxLenght: 3 }, 'x'), /Unsupported schema keyword/);
});

test('validator oneOf reports the alternative the author meant', () => {
  const schema = {
    $defs: {
      el: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' } } },
      box: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { $ref: '#/$defs/item' } }, columns: { type: 'integer', maximum: 8 } } },
      item: { oneOf: [{ $ref: '#/$defs/el' }, { $ref: '#/$defs/box' }] },
    },
    $ref: '#/$defs/item',
  };
  const errs = validate(schema, { columns: 1, items: [{ name: 3 }] });
  assert.equal(errs.length, 1);
  assert.match(errs[0].path, /items\[0\]\.name/);
});

test('writeOutputs refuses to replace foreign files but replaces its own', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arquichef-test-'));
  try {
    await fs.writeFile(path.join(dir, 'a.html'), 'user file');
    await assert.rejects(writeOutputs(dir, { 'a.html': 'new' }), UserError);
    assert.equal(await fs.readFile(path.join(dir, 'a.html'), 'utf8'), 'user file');

    await writeOutputs(dir, { 'b.html': 'v1' });
    await writeOutputs(dir, { 'b.html': 'v2' });
    assert.equal(await fs.readFile(path.join(dir, 'b.html'), 'utf8'), 'v2');

    await fs.writeFile(path.join(dir, 'b.html'), 'edited by hand');
    await assert.rejects(writeOutputs(dir, { 'b.html': 'v3' }), /--force/);
    await writeOutputs(dir, { 'b.html': 'v3' }, { force: true });
    assert.equal(await fs.readFile(path.join(dir, 'b.html'), 'utf8'), 'v3');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('writeOutputs rejects unsafe names and symlinked targets', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arquichef-test-'));
  try {
    await assert.rejects(writeOutputs(dir, { '../evil.html': 'x' }), /Unsafe output file name/);
    await assert.rejects(writeOutputs(dir, { '.arquichef-manifest.json': 'x' }), /Unsafe/);
    await fs.symlink('/etc/hostname', path.join(dir, 'link.html'));
    await assert.rejects(writeOutputs(dir, { 'link.html': 'x' }, { force: true }), /non-regular/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
