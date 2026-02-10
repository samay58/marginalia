#!/usr/bin/env node

import assert from 'node:assert/strict';
import { computeSemanticChanges } from '../src/lib/utils/semantic-diff.js';

function hasType(changes, type) {
  return changes.some((change) => change.type === type);
}

function testHeadingToParagraph() {
  const original = '# Roadmap\n\nBody text.';
  const edited = 'Roadmap\n\nBody text.';
  const changes = computeSemanticChanges(original, edited);
  assert.ok(hasType(changes, 'block_type'), 'expected block_type change for heading-to-paragraph edit');
}

function testLinkTargetChange() {
  const original = 'Read the [guide](https://example.com/v1).';
  const edited = 'Read the [guide](https://example.com/v2).';
  const changes = computeSemanticChanges(original, edited);
  assert.ok(hasType(changes, 'link_target'), 'expected link_target semantic change');
}

function testFormattingOnlyChange() {
  const original = 'This is **critical** context.';
  const edited = 'This is critical context.';
  const changes = computeSemanticChanges(original, edited);
  assert.ok(hasType(changes, 'formatting'), 'expected formatting semantic change');
}

function testListNestingChange() {
  const original = '- item';
  const edited = '  - item';
  const changes = computeSemanticChanges(original, edited);
  assert.ok(hasType(changes, 'list_nesting'), 'expected list_nesting semantic change');
}

function testCodeFenceLanguageChange() {
  const original = '```js\nconsole.log("hi")\n```';
  const edited = '```ts\nconsole.log("hi")\n```';
  const changes = computeSemanticChanges(original, edited);
  assert.ok(hasType(changes, 'code_fence_language'), 'expected code_fence_language semantic change');
}

function main() {
  testHeadingToParagraph();
  testLinkTargetChange();
  testFormattingOnlyChange();
  testListNestingChange();
  testCodeFenceLanguageChange();
  console.log('semantic-diff: all checks passed');
}

main();
