#!/usr/bin/env node
// Fails when a stylesheet or component reads a custom property nobody defines.
// An undefined var() silently resolves to nothing, which is how a theme swap
// can blank out buttons without any other check noticing.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(svelte|css|js)$/.test(name) ? [path] : [];
  });
}

const files = walk('src');
const defined = new Set();
/** @type {Map<string, Set<string>>} */
const used = new Map();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const [, name] of source.matchAll(/(?:^|[\s;{])(--[\w-]+)\s*:/gm)) defined.add(name);
  for (const [, name] of source.matchAll(/setProperty\(\s*['"](--[\w-]+)/g)) defined.add(name);
  // var(--x, fallback) is safe by construction, so only bare reads count.
  for (const [, name] of source.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
    if (!used.has(name)) used.set(name, new Set());
    used.get(name).add(file);
  }
}

const missing = [...used].filter(([name]) => !defined.has(name));
if (missing.length > 0) {
  for (const [name, where] of missing) {
    console.error(`undefined ${name} in ${[...where].join(', ')}`);
  }
  process.exit(1);
}
console.log(`css-tokens: ${used.size} custom properties, all defined`);
