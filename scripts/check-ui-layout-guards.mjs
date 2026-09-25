#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editor = readFileSync('src/lib/components/Editor.svelte', 'utf8');
const drawer = readFileSync('src/lib/components/SessionDrawer.svelte', 'utf8');
const footer = readFileSync('src/lib/components/chrome/BottomShortcutBar.svelte', 'utf8');

function assertContains(source, needle, message) {
  assert.ok(source.includes(needle), message || `expected ${needle}`);
}

function testAnnotationAnchorRail() {
  assertContains(editor, '.anchor-layer', 'editor must render a dedicated annotation anchor layer');
  assertContains(editor, 'overflow: visible;', 'anchor layer/markers must not clip badges');
  assertContains(editor, 'pointer-events: none;', 'anchor layer should not block manuscript editing');
  assertContains(editor, 'pointer-events: auto;', 'anchor hit targets must remain clickable');
  assertContains(editor, 'min-width: max(1.35rem, 2ch);', 'anchor badges must support multi-digit note numbers');
  assertContains(editor, 'font-variant-numeric: tabular-nums;', 'anchor badge numbers should stay stable');
  assert.ok(!editor.includes('anchor-ghost'), 'gutter must not render clipped rationale preview text');
}

function testSessionDrawerResizesWithViewport() {
  assertContains(drawer, 'height: clamp(8rem, 24vh, 13rem);', 'session drawer needs viewport-relative height');
  assertContains(drawer, 'max-height: min(32vh, 15rem);', 'session drawer must not swallow the manuscript');
  assertContains(drawer, 'overflow: hidden;', 'session drawer should contain its own textarea');
  assertContains(drawer, 'min-height: 0;', 'drawer flex children must be allowed to shrink');
  assertContains(drawer, 'flex: 1 1 auto;', 'notes textarea should fill available drawer height');
  assertContains(drawer, 'resize: none;', 'manual textarea resize should not fight window resize');
}

function testFooterStaysReadable() {
  assertContains(footer, 'height: var(--bottombar-h);', 'footer needs a fixed-height row');
  assertContains(footer, 'flex-shrink: 0;', 'footer must not collapse when the window is short');
  assertContains(footer, 'font-size: 12px;', 'footer counts should remain readable');
}

function main() {
  testAnnotationAnchorRail();
  testSessionDrawerResizesWithViewport();
  testFooterStaysReadable();
  console.log('ui-layout-guards: all checks passed');
}

main();
