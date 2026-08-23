// Assemble www/ for the native shell.
//
// The web app is served straight from the repo root on GitHub Pages, so there
// is no build step for the PWA. Capacitor needs a directory that holds the web
// assets and nothing else, so this copies the handful of files that matter.
//
// sw.js is deliberately left out: inside a native web view the service worker
// buys nothing (the assets are already local) and a stale one would serve an
// old build after an update.

import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');
const ASSETS = ['index.html', 'manifest.json', 'icon.svg', 'vendor'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const asset of ASSETS) {
  await cp(join(ROOT, asset), join(OUT, asset), { recursive: true });
}

// The native build has no service worker to unregister it, so strip the
// registration rather than shipping a no-op that logs an error on every launch.
const htmlPath = join(OUT, 'index.html');
const html = await import('node:fs/promises').then(fs => fs.readFile(htmlPath, 'utf8'));
await writeFile(
  htmlPath,
  html.replace(
    /\/\/ Register service worker[\s\S]*?^}\n/m,
    '// Service worker is intentionally absent in the native build.\n'
  ),
);

console.log(`www/ built from ${ASSETS.join(', ')}`);
