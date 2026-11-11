#!/usr/bin/env node
// ArquiChef CLI.
//
//   arquichef types
//   arquichef new <type> <spec.json>
//   arquichef validate <spec.json> [--json]
//   arquichef check <spec.json> [--json]
//   arquichef build <spec.json> --out <dir> [--name <base>] [--scale <1-4>]
//                   [--readme <file.md>] [--force] [--skip-browser] [--allow-issues] [--json]
//   arquichef migrate <old-spec.json> <new-spec.json>
//
// Exit codes: 0 ok · 1 usage or unexpected error · 2 invalid spec
//             3 layout issues found by the browser check · 4 browser unavailable

import { constants, promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, measurePage, screenshotPage } from '../core/chrome.mjs';
import { MEASURE_SCRIPT } from '../core/measure-script.mjs';
import { renderPage } from '../core/page.mjs';
import { listTypes, loadType, typeDir } from '../core/registry.mjs';
import { readSpec, UserError, writeOutputs } from '../core/safe-fs.mjs';
import { validate } from '../core/schema.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VERSION = readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const BASE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/;

class ExitError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const valued = new Set(['out', 'name', 'scale', 'readme']);
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (valued.has(key)) {
        if (i + 1 >= argv.length) throw new ExitError(1, `--${key} needs a value`);
        flags[key] = argv[++i];
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

/** Resolve a spec path like "layers.business.items[2].items[0]" to the item, for friendlier messages. */
function describe(spec, p) {
  if (!p || p.startsWith('(')) return '';
  let node = spec;
  for (const part of p.match(/[^.[\]]+/g) ?? []) {
    if (node == null) return '';
    node = node[/^\d+$/.test(part) ? Number(part) : part];
  }
  const label = node?.name ?? node?.title;
  return label ? ` «${String(label).slice(0, 50)}»` : '';
}

function printDiagnostics(spec, list, level) {
  const mark = level === 'error' ? '✗ error  ' : '! warning';
  for (const d of list.slice(0, 60)) {
    const extra = d.kind ? `${d.kind}${d.text ? ` "${d.text}"` : ''}` : d.message;
    console.log(`${mark} ${d.path}${describe(spec, d.path)}  ${extra}`);
  }
  if (list.length > 60) console.log(`  … and ${list.length - 60} more`);
}

async function loadAndValidate(specPath) {
  const { spec } = await readSpec(specPath);
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new ExitError(2, 'The spec must be a JSON object.');
  if (typeof spec.type !== 'string') throw new ExitError(2, `The spec needs a "type" field. Available types: ${listTypes().join(', ')}`);
  const type = await loadType(spec.type);
  if (spec.arquichef === '1' && typeof type.migrate === 'function') {
    throw new ExitError(2, `This spec uses format "1". Convert it with: arquichef migrate ${specPath} <new-spec.json>`);
  }
  const schemaErrors = validate(type.schema, spec);
  if (schemaErrors.length) return { spec, type, schemaErrors, lint: null };
  return { spec, type, schemaErrors, lint: type.lint(spec) };
}

function reportValidation({ spec, schemaErrors, lint }, json) {
  if (json) return;
  if (schemaErrors.length) {
    console.log(`Spec does not match the schema (${schemaErrors.length} problem${schemaErrors.length === 1 ? '' : 's'}):`);
    printDiagnostics(spec, schemaErrors, 'error');
    return;
  }
  printDiagnostics(spec, lint.errors, 'error');
  printDiagnostics(spec, lint.warnings, 'warning');
  console.log(`Schema OK · ${lint.stats.elements} elements · ${lint.errors.length} errors · ${lint.warnings.length} warnings`);
}

async function browserPass(type, spec, { skipBrowser, json, scale, wantPng }) {
  const page = type.render(spec);
  const html = renderPage(page);
  if (skipBrowser) return { html, report: null, png: null };
  const chrome = await findChrome();
  if (!chrome) throw new ExitError(4, 'Chrome/Chromium not found. Install it, set ARQUICHEF_CHROME, or pass --skip-browser (layout will not be checked).');
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'arquichef-build-'));
  try {
    const checkFile = path.join(tmp, 'check.html');
    await fs.writeFile(checkFile, renderPage({ ...page, extraScript: MEASURE_SCRIPT }));
    const report = await measurePage(chrome, checkFile, page.width);
    let png = null;
    if (wantPng) {
      const pageFile = path.join(tmp, 'page.html');
      await fs.writeFile(pageFile, html);
      png = await screenshotPage(chrome, pageFile, page.width, Math.max(report.height, 400), scale);
    }
    if (!json) {
      const errs = report.issues.filter((i) => i.severity === 'error');
      const warns = report.issues.filter((i) => i.severity !== 'error');
      printDiagnostics(spec, errs, 'error');
      printDiagnostics(spec, warns, 'warning');
      console.log(`Layout check · ${report.width}×${report.height}px · ${errs.length} errors · ${warns.length} warnings`);
    }
    return { html, report, png };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

async function cmdNew([typeName, target]) {
  if (!typeName || !target) throw new ExitError(1, 'Usage: arquichef new <type> <spec.json>');
  const starter = path.join(typeDir(typeName), 'templates', 'starter.json');
  const dest = path.resolve(target);
  try {
    await fs.copyFile(starter, dest, constants.COPYFILE_EXCL);
  } catch (err) {
    if (err.code === 'EEXIST') throw new ExitError(1, `${dest} already exists; choose another name.`);
    throw err;
  }
  console.log(`Created ${dest} from the ${typeName} starter.`);
}

async function cmdValidate([specPath], flags) {
  if (!specPath) throw new ExitError(1, 'Usage: arquichef validate <spec.json>');
  const res = await loadAndValidate(specPath);
  if (flags.json) console.log(JSON.stringify({ schemaErrors: res.schemaErrors, ...(res.lint ?? {}) }, null, 2));
  reportValidation(res, flags.json);
  if (res.schemaErrors.length || res.lint.errors.length) throw new ExitError(2, '');
}

async function cmdCheck([specPath], flags) {
  if (!specPath) throw new ExitError(1, 'Usage: arquichef check <spec.json>');
  const res = await loadAndValidate(specPath);
  reportValidation(res, flags.json);
  if (res.schemaErrors.length || res.lint.errors.length) throw new ExitError(2, '');
  const { report } = await browserPass(res.type, res.spec, { json: flags.json, wantPng: false });
  if (flags.json) console.log(JSON.stringify({ lint: res.lint, layout: report }, null, 2));
  if (report.issues.some((i) => i.severity === 'error')) throw new ExitError(3, '');
}

async function cmdBuild([specPath], flags) {
  if (!specPath || !flags.out) throw new ExitError(1, 'Usage: arquichef build <spec.json> --out <dir> [--name <base>]');
  const base = flags.name ?? path.basename(specPath).replace(/(\.arquichef)?\.json$/i, '');
  if (!BASE_NAME.test(base)) throw new ExitError(1, `Invalid output name "${base}" (letters, digits, . _ - only).`);
  const scale = flags.scale ? Number(flags.scale) : 2;
  if (!Number.isFinite(scale) || scale < 1 || scale > 4) throw new ExitError(1, '--scale must be between 1 and 4');
  const readmeName = flags.readme ?? 'README.md';
  if (!BASE_NAME.test(readmeName) || !readmeName.endsWith('.md')) throw new ExitError(1, '--readme must be a plain .md file name');

  const res = await loadAndValidate(specPath);
  reportValidation(res, flags.json);
  if (res.schemaErrors.length || res.lint.errors.length) throw new ExitError(2, 'Fix the spec and build again.');

  const { html, report, png } = await browserPass(res.type, res.spec, {
    skipBrowser: Boolean(flags['skip-browser']), json: flags.json, scale, wantPng: true,
  });
  const layoutErrors = report ? report.issues.filter((i) => i.severity === 'error') : [];
  if (layoutErrors.length && !flags['allow-issues']) {
    throw new ExitError(3, 'Layout problems found; nothing was written. Shorten or regroup the reported items (or pass --allow-issues).');
  }

  const files = { html: `${base}.html`, md: readmeName, ...(png ? { png: `${base}.png` } : {}) };
  const outputs = { [files.html]: html, [files.md]: res.type.readme(res.spec, { files }) };
  if (png) outputs[files.png] = png;
  const written = await writeOutputs(flags.out, outputs, { force: Boolean(flags.force) });

  if (flags.json) {
    console.log(JSON.stringify({ ok: true, written, lint: res.lint, layout: report }, null, 2));
  } else {
    for (const f of written) console.log(`wrote ${f}`);
    if (!report) console.log('! warning  layout was NOT checked (--skip-browser); review the HTML by eye.');
  }
}

async function cmdMigrate([from, to]) {
  if (!from || !to) throw new ExitError(1, 'Usage: arquichef migrate <old-spec.json> <new-spec.json>');
  const { spec } = await readSpec(from);
  if (!spec || typeof spec.type !== 'string') throw new ExitError(2, 'The spec needs a "type" field.');
  const type = await loadType(spec.type);
  if (typeof type.migrate !== 'function') throw new ExitError(1, `Type "${spec.type}" has no migration.`);
  if (spec.arquichef !== '1') throw new ExitError(1, `Only format "1" specs need migrating (this one is "${spec.arquichef}").`);
  const { spec: migrated, problems } = type.migrate(spec);
  for (const p of problems) console.log(`! warning ${p}`);
  const errors = validate(type.schema, migrated);
  const dest = path.resolve(to);
  try {
    await fs.writeFile(dest, `${JSON.stringify(migrated, null, 2)}\n`, { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') throw new ExitError(1, `${dest} already exists; choose another name.`);
    throw err;
  }
  console.log(`Wrote ${dest}`);
  if (errors.length) {
    printDiagnostics(migrated, errors, 'error');
    throw new ExitError(2, 'The migrated spec needs manual fixes (see above).');
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  switch (command) {
    case 'types':
      for (const t of listTypes()) console.log(`${t}\t${(await loadType(t)).title}`);
      return;
    case 'new': return cmdNew(positional);
    case 'validate': return cmdValidate(positional, flags);
    case 'check': return cmdCheck(positional, flags);
    case 'build': return cmdBuild(positional, flags);
    case 'migrate': return cmdMigrate(positional);
    case '--version': case 'version':
      console.log(VERSION);
      return;
    default:
      console.log(`ArquiChef ${VERSION}\nUsage: arquichef <types|new|validate|check|build|migrate> …  (see README.md)`);
      if (command && command !== 'help' && command !== '--help') throw new ExitError(1, '');
  }
}

main().catch((err) => {
  if (err instanceof ExitError) {
    if (err.message) console.error(err.message);
    process.exit(err.code);
  }
  if (err instanceof UserError) {
    console.error(err.message);
    process.exit(err.message.includes('Chrome') ? 4 : 1);
  }
  console.error(err.stack ?? String(err));
  process.exit(1);
});
