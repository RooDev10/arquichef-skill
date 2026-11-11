// Headless Chrome adapter used to measure layouts and export PNGs.
//
// Safety properties:
// - the binary is resolved from a fixed list (or ARQUICHEF_CHROME) and spawned
//   directly, never through a shell, with a fixed argument list;
// - every run uses a fresh temporary profile that is deleted afterwards;
// - Chrome's sandbox stays enabled and background networking is disabled; the
//   pages themselves carry a CSP that blocks all network access;
// - runs are time-limited and their output is size-limited.

import { spawn } from 'node:child_process';
import { constants, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { UserError } from './safe-fs.mjs';

const CANDIDATES = {
  linux: ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser'],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
};

const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

async function isExecutable(file) {
  try {
    await fs.access(file, constants.X_OK);
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}

export async function findChrome() {
  const override = process.env.ARQUICHEF_CHROME;
  if (override) {
    if (!path.isAbsolute(override) || !(await isExecutable(override))) {
      throw new UserError('ARQUICHEF_CHROME must be an absolute path to an executable Chrome/Chromium binary.');
    }
    return override;
  }
  const list = CANDIDATES[process.platform] ?? CANDIDATES.linux;
  for (const candidate of list) {
    if (path.isAbsolute(candidate)) {
      if (await isExecutable(candidate)) return candidate;
      continue;
    }
    for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
      if (!dir) continue;
      const full = path.join(dir, candidate);
      if (await isExecutable(full)) return full;
    }
  }
  return null;
}

async function runChrome(bin, args, { timeoutMs = 90_000 } = {}) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'arquichef-chrome-'));
  const base = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--mute-audio',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
  ];
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(bin, [...base, ...args], { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
      const chunks = [];
      let size = 0;
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new UserError(`Chrome did not finish within ${timeoutMs / 1000}s.`));
      }, timeoutMs);
      child.stdout.on('data', (c) => {
        size += c.length;
        if (size > MAX_OUTPUT_BYTES) {
          child.kill('SIGKILL');
          return;
        }
        chunks.push(c);
      });
      child.stderr.on('data', (c) => {
        if (stderr.length < 4000) stderr += c.toString();
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(new UserError(`Could not start Chrome: ${err.message}`));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new UserError(`Chrome exited with code ${code}. ${stderr.trim().slice(0, 600)}`));
        else resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
  } finally {
    await fs.rm(profile, { recursive: true, force: true });
  }
}

/** Load a page with the measuring script and return its JSON report. */
export async function measurePage(bin, htmlFile, width) {
  const dom = await runChrome(bin, [
    `--window-size=${width},1200`,
    '--virtual-time-budget=3000',
    '--run-all-compositor-stages-before-draw',
    '--dump-dom',
    pathToFileURL(htmlFile).href,
  ]);
  const match = /id="arquichef-report"[^>]*data-report="([A-Za-z0-9+/=]+)"|data-report="([A-Za-z0-9+/=]+)"[^>]*id="arquichef-report"/.exec(dom);
  if (!match) throw new UserError('The measuring script did not produce a report (Chrome may have blocked scripts).');
  return JSON.parse(Buffer.from(match[1] ?? match[2], 'base64').toString('utf8'));
}

/** Screenshot a page at an exact size. Returns the PNG bytes. */
export async function screenshotPage(bin, htmlFile, width, height, scale) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'arquichef-shot-'));
  const out = path.join(dir, 'shot.png');
  try {
    await runChrome(bin, [
      `--window-size=${width},${height}`,
      `--force-device-scale-factor=${scale}`,
      '--virtual-time-budget=2000',
      '--default-background-color=ffffffff',
      `--screenshot=${out}`,
      pathToFileURL(htmlFile).href,
    ]);
    return await fs.readFile(out);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
