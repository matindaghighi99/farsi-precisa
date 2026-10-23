/* Cache-busting stamper.
   Rewrites every local  assets/*.css | assets/*.js  reference (and the
   logo and favicons, images/rahno-*.svg|png) in the .html
   files at the site root to  assets/x.css?v=<hash>  where <hash> comes from
   that file's contents. Unchanged files keep their long browser cache;
   edited ones bust it immediately.

   Run before committing CSS/JS changes:  node stamp-assets.mjs
*/
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const hashCache = new Map();

function assetHash(full) {
  if (hashCache.has(full)) return hashCache.get(full);
  if (!existsSync(full)) return null; // broken reference — leave it untouched
  const h = createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 8);
  hashCache.set(full, h);
  return h;
}

// (href|src)="assets/name.css" or "images/rahno-….svg", with an optional existing ?query
const REF = /((?:href|src)=")(assets\/[^"?]+\.(?:css|js)|images\/rahno-[^"?]+\.(?:svg|png|webp))(?:\?[^"]*)?(")/g;

let filesChanged = 0;
let refsStamped = 0;
for (const file of readdirSync(root).filter((f) => f.endsWith('.html'))) {
  const full = resolve(root, file);
  const original = readFileSync(full, 'utf8');
  const updated = original.replace(REF, (match, pre, asset, post) => {
    const h = assetHash(resolve(root, asset));
    if (!h) return match;
    refsStamped++;
    return pre + asset + '?v=' + h + post;
  });
  if (updated !== original) {
    writeFileSync(full, updated);
    filesChanged++;
  }
}

console.log(`stamp-assets: updated ${filesChanged} HTML file(s), ${refsStamped} asset reference(s).`);
