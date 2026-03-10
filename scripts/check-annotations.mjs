#!/usr/bin/env node

import assert from 'node:assert/strict';
import { computeDiff } from '../src/lib/utils/diff.js';
import {
  createAnnotationRecord,
  isVisibleChange,
  resolveAnnotations,
} from '../src/lib/utils/annotations.js';

function testExactAnnotationResolution() {
  const original = 'alpha\nbeta\ngamma';
  const edited = 'alpha\nbeta refined\ngamma';
  const diff = computeDiff(original, edited, []);
  const change = diff.changes.find((entry) => entry.type === 'insertion' && entry.text.includes('refined'));
  assert.ok(change, 'expected insertion change');

  const annotation = createAnnotationRecord({
    change,
    editedText: edited,
    rationale: 'Name the refinement explicitly.',
  });

  const resolved = resolveAnnotations([annotation], diff, edited);
  assert.equal(resolved[0]?.status, 'active', 'expected exact annotation to stay active');
  assert.equal(resolved[0]?.resolvedChangeId, change.id, 'expected exact annotation to preserve change id');
}

function testAnnotationReattachesAfterOffsetShift() {
  const original = 'alpha\nbeta\ngamma';
  const firstEdit = 'alpha\nbeta refined\ngamma';
  const secondEdit = 'intro\nalpha\nbeta refined\ngamma';

  const firstDiff = computeDiff(original, firstEdit, []);
  const annotatedChange = firstDiff.changes.find(
    (entry) => entry.type === 'insertion' && entry.text.includes('refined')
  );
  assert.ok(annotatedChange, 'expected annotated change in first diff');

  const annotation = createAnnotationRecord({
    change: annotatedChange,
    editedText: firstEdit,
    rationale: 'Keep the stronger wording.',
  });

  const secondDiff = computeDiff(original, secondEdit, firstDiff.changes, firstDiff._editedText);
  const resolved = resolveAnnotations([annotation], secondDiff, secondEdit);

  assert.equal(resolved[0]?.status, 'active', 'expected annotation to reattach after offset shift');
  assert.ok(resolved[0]?.resolvedChangeId, 'expected a resolved change id after offset shift');
}

function testAmbiguousDuplicateChangeBecomesStale() {
  const original = 'alpha\nbridge\nalpha';
  const edited = 'alpha revised\nbridge\nalpha revised';
  const diff = computeDiff(original, edited, []);
  const visibleChanges = diff.changes.filter(isVisibleChange);
  const topChange = visibleChanges.find(
    (entry) => entry.type === 'insertion' && entry.location.line === 1 && entry.text.includes('revised')
  );
  assert.ok(topChange, 'expected top change to annotate');

  const annotation = createAnnotationRecord({
    change: topChange,
    editedText: edited,
    rationale: 'Clarify the alpha line.',
  });

  const drifted = {
    ...annotation,
    target: {
      ...annotation.target,
      changeId: null,
      blockKey: '',
      beforeLine: '',
      lineText: 'alpha revised',
      afterLine: '',
    },
  };

  const resolved = resolveAnnotations([drifted], diff, edited);
  assert.equal(resolved[0]?.status, 'stale', 'expected ambiguous duplicate change to go stale');
}

function testWhitespaceOnlyChangeDoesNotCreateActiveTarget() {
  const original = 'alpha';
  const edited = 'alpha ';
  const diff = computeDiff(original, edited, []);
  assert.equal(diff.changes.filter(isVisibleChange).length, 0, 'expected whitespace-only diff to be invisible');
}

function main() {
  testExactAnnotationResolution();
  testAnnotationReattachesAfterOffsetShift();
  testAmbiguousDuplicateChangeBecomesStale();
  testWhitespaceOnlyChangeDoesNotCreateActiveTarget();
  console.log('annotations: all checks passed');
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
