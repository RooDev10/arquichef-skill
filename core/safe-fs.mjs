// File-system helpers with conservative defaults:
// - specs are size-limited and parsed as plain JSON (never evaluated);
// - outputs go only to an explicit directory, with fixed safe file names;
// - symlinks are never followed when writing;
// - a file is overwritten only if ArquiChef wrote it and nobody changed it since,
//   unless the caller passes force.

import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const MAX_SPEC_BYTES = 2 * 1024 * 1024;
const MANIFEST = '.arquichef-manifest.json';
const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/;

export class UserError extends Error {}

export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

export async function readSpec(specPath) {
  const resolved = path.resolve(specPath);
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new UserError(`Spec not found: ${resolved}`);
  }
  if (!stat.isFile()) throw new UserError(`Spec is not a regular file: ${resolved}`);
  if (stat.size > MAX_SPEC_BYTES) throw new UserError(`Spec is larger than ${MAX_SPEC_BYTES} bytes.`);
  const text = await fs.readFile(resolved, 'utf8');
  try {
    return { path: resolved, spec: JSON.parse(text) };
  } catch (err) {
    throw new UserError(`Spec is not valid JSON: ${err.message}`);
  }
}

async function readManifest(dir) {
  try {
    const raw = await fs.readFile(path.join(dir, MANIFEST), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.files === 'object' ? parsed : { files: {} };
  } catch {
    return { files: {} };
  }
}

/** Ensure the output directory exists and is a real directory, not a symlink. */
export async function prepareOutputDir(dir) {
  const resolved = path.resolve(dir);
  await fs.mkdir(resolved, { recursive: true });
  const stat = await fs.lstat(resolved);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new UserError(`Output path is not a plain directory: ${resolved}`);
  return resolved;
}

/**
 * Write { fileName: Buffer|string } into dir atomically.
 * Refuses to replace files ArquiChef did not create (or that were edited since) unless force.
 */
export async function writeOutputs(dir, files, { force = false } = {}) {
  const outDir = await prepareOutputDir(dir);
  const manifest = await readManifest(outDir);
  const plan = [];

  for (const [name, content] of Object.entries(files)) {
    if (!SAFE_NAME.test(name) || name === MANIFEST) throw new UserError(`Unsafe output file name: ${name}`);
    const target = path.join(outDir, name);
    let existing = null;
    try {
      existing = await fs.lstat(target);
    } catch {
      /* does not exist yet */
    }
    if (existing) {
      if (existing.isSymbolicLink() || !existing.isFile()) throw new UserError(`Refusing to write over a non-regular file: ${target}`);
      const known = manifest.files[name];
      const current = sha256(await fs.readFile(target));
      if (!force && (!known || known !== current)) {
        throw new UserError(`${target} already exists and was not produced by ArquiChef (or was edited after). Re-run with --force to replace it.`);
      }
    }
    plan.push({ name, target, content });
  }

  for (const { name, target, content } of plan) {
    const tmp = path.join(outDir, `.${name}.${randomBytes(6).toString('hex')}.tmp`);
    await fs.writeFile(tmp, content, { flag: 'wx' });
    await fs.rename(tmp, target);
    manifest.files[name] = sha256(typeof content === 'string' ? Buffer.from(content) : content);
  }
  manifest.generator = 'arquichef';
  await fs.writeFile(path.join(outDir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  return plan.map((p) => p.target);
}
