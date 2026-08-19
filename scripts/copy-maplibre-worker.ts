/**
 * Puts MapLibre's worker where the browser can fetch it.
 *
 * MapLibre loads its tile worker as a separate module. Next.js does not emit
 * that chunk at a stable URL, so the request lands on the 404 page and the
 * browser refuses it for having the wrong MIME type — the map then draws its
 * controls and nothing else, which is a confusing way to fail.
 *
 * Copying the file into public/ and pointing setWorkerUrl at it makes the URL
 * ours. Run automatically before dev and build, so it can never drift from the
 * installed version of the library.
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const TARGET_DIR = 'public/vendor';

/**
 * The worker plus the shared chunk it imports. Copying only the worker leaves
 * its `./maplibre-gl-shared.mjs` import resolving to the 404 page, which the
 * browser then rejects for having the wrong MIME type — the same confusing
 * failure this script exists to prevent.
 */
const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

const distDir = join(
  dirname(require.resolve('maplibre-gl/package.json')),
  'dist',
);

mkdirSync(TARGET_DIR, { recursive: true });

for (const file of FILES) {
  copyFileSync(join(distDir, file), join(TARGET_DIR, file));
}

console.log(`Copied ${FILES.join(', ')} to ${TARGET_DIR}.`);
