#!/usr/bin/env node

import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { markdownToPlainText } from '../src/lib/utils/markdown-plain-text.js';
import {
  editedContent,
  editedPlainText,
  initializeWithContent,
  originalContent,
  originalPlainText,
  restoreFromSnapshot,
} from '../src/lib/stores/review-session.js';

const originalMarkdown = `<!-- REVIEW -->
# Marginalia Self Test

This maybe explains the plan but does not say the point directly.

Read the [guide](https://example.com/v1).

- Ship the draft
`;

const editedMarkdown = `<!-- REVIEW -->

# Marginalia Self Test

This maybe, could potentially be what the plan is about the plan but does not say

The point is made but is stale.
`;

function testMarkdownProjection() {
  assert.equal(
    markdownToPlainText(originalMarkdown),
    [
      'Marginalia Self Test',
      'This maybe explains the plan but does not say the point directly.',
      'Read the guide.',
      'Ship the draft',
    ].join('\n')
  );
}

function testFreshLoadSeedsCleanBaseline() {
  initializeWithContent('/tmp/marginalia-self-test-draft.md', originalMarkdown);
  assert.equal(get(originalContent), originalMarkdown);
  assert.equal(get(editedContent), originalMarkdown);
  assert.equal(get(originalPlainText), markdownToPlainText(originalMarkdown));
  assert.equal(get(editedPlainText), markdownToPlainText(originalMarkdown));
}

function testRecoveryDoesNotTrustContaminatedOriginalPlainText() {
  restoreFromSnapshot({
    filePath: '/tmp/marginalia-self-test-draft.md',
    originalContent: originalMarkdown,
    editedContent: editedMarkdown,
    originalPlainText:
      'Marginalia Self Test\nThis maybe what the plan is about the plan but does not say the point directly.\nThe draft is good.',
    editedPlainText: markdownToPlainText(editedMarkdown),
  });

  assert.equal(get(originalContent), originalMarkdown);
  assert.equal(get(editedContent), editedMarkdown);
  assert.equal(
    get(originalPlainText),
    markdownToPlainText(originalMarkdown),
    'recovered original plain text must be derived from original markdown, not stale snapshot text'
  );
  assert.ok(!get(originalPlainText).includes('what the plan is about'));
}

function main() {
  testMarkdownProjection();
  testFreshLoadSeedsCleanBaseline();
  testRecoveryDoesNotTrustContaminatedOriginalPlainText();
  console.log('plain-text-baseline: all checks passed');
}

main();
