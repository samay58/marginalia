#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  createDiffSnapshot,
  getDecorationUpdateDecision,
  hashText,
} from '../src/lib/utils/diff-render-state.js';

function testFreshSnapshotRebuildsDecorations() {
  const snapshot = createDiffSnapshot({
    epoch: 2,
    documentEpoch: 7,
    originalText: 'alpha',
    editedText: 'alpha beta',
    changes: [{ id: 'c1', type: 'insertion', text: ' beta' }],
  });

  const decision = getDecorationUpdateDecision({
    diffSnapshot: snapshot,
    currentText: 'alpha beta',
    hasStableDecorations: true,
  });

  assert.equal(decision.action, 'rebuild');
  assert.equal(decision.diffStatus, 'clean');
}

function testStaleSnapshotPreservesLastStableDecorations() {
  const snapshot = createDiffSnapshot({
    epoch: 2,
    documentEpoch: 7,
    originalText: 'alpha',
    editedText: 'alpha beta',
    changes: [{ id: 'c1', type: 'insertion', text: ' beta' }],
  });

  const decision = getDecorationUpdateDecision({
    diffSnapshot: snapshot,
    currentText: 'alpha beta gamma',
    hasStableDecorations: true,
  });

  assert.equal(decision.action, 'preserve');
  assert.equal(decision.diffStatus, 'pending');
  assert.equal(decision.reason, 'snapshot_text_mismatch');
}

function testStaleSnapshotWithoutStableDecorationsClears() {
  const snapshot = createDiffSnapshot({
    epoch: 2,
    documentEpoch: 7,
    originalText: 'alpha',
    editedText: 'alpha beta',
    changes: [{ id: 'c1', type: 'insertion', text: ' beta' }],
  });

  const decision = getDecorationUpdateDecision({
    diffSnapshot: snapshot,
    currentText: 'alpha beta gamma',
    hasStableDecorations: false,
  });

  assert.equal(decision.action, 'clear');
  assert.equal(decision.diffStatus, 'stale');
}

function testHashTextIsStable() {
  assert.equal(hashText('alpha beta'), hashText('alpha beta'));
  assert.notEqual(hashText('alpha beta'), hashText('alpha  beta'));
}

function main() {
  testFreshSnapshotRebuildsDecorations();
  testStaleSnapshotPreservesLastStableDecorations();
  testStaleSnapshotWithoutStableDecorationsClears();
  testHashTextIsStable();
  console.log('diff-render-state: all checks passed');
}

main();
