// Diagram type registry. A type is a folder under types/ with a type.mjs that
// exports: id, title, schema, render(spec), lint(spec), readme(spec, { files }).
// Only folders inside the bundled types/ directory are ever loaded; a spec can
// name a type but cannot point the loader at arbitrary code.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { UserError } from './safe-fs.mjs';

const TYPES_DIR = fileURLToPath(new URL('../types/', import.meta.url));
const NAME = /^[a-z][a-z0-9-]{0,40}$/;
const REQUIRED_EXPORTS = ['id', 'title', 'schema', 'render', 'lint', 'readme'];

export function listTypes() {
  return readdirSync(TYPES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && NAME.test(d.name) && existsSync(path.join(TYPES_DIR, d.name, 'type.mjs')))
    .map((d) => d.name)
    .sort();
}

export function typeDir(name) {
  if (!NAME.test(String(name)) || !listTypes().includes(name)) {
    throw new UserError(`Unknown diagram type "${name}". Available: ${listTypes().join(', ')}`);
  }
  return path.join(TYPES_DIR, name);
}

export async function loadType(name) {
  const dir = typeDir(name);
  const mod = await import(pathToFileURL(path.join(dir, 'type.mjs')).href);
  const missing = REQUIRED_EXPORTS.filter((k) => !(k in mod));
  if (missing.length) throw new Error(`Type "${name}" is missing exports: ${missing.join(', ')}`);
  if (mod.id !== name) throw new Error(`Type folder "${name}" exports id "${mod.id}".`);
  return mod;
}
