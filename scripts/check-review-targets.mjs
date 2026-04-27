#!/usr/bin/env node

import assert from 'node:assert/strict';
import { computeDiff } from '../src/lib/utils/diff.js';
import { computeSemanticChanges } from '../src/lib/utils/semantic-diff.js';
import {
  createChangeGroups,
  createGlobalReviewTarget,
  createRangeReviewTarget,
  createReviewTargetFromGroup,
  createReviewTargetFromSemanticChange,
  createRationaleDraft,
  resolveReviewTargets,
} from '../src/lib/utils/review-targets.js';

function testReplacementGroupBecomesDurableTarget() {
  const original = 'We should maybe ship this soon.';
  const edited = 'We should ship this today.';
  const diff = computeDiff(original, edited, []);
  const groups = createChangeGroups(diff.changes, edited);
  const replacement = groups.find((group) => group.kind === 'replacement');

  assert.ok(replacement, 'expected deletion plus insertion to produce a replacement group');
  const target = createReviewTargetFromGroup(replacement, {
    editedText: edited,
    documentEpoch: 3,
  });

  assert.equal(target.kind, 'change_group');
  assert.equal(target.changeIds.length, replacement.changeIds.length);
  assert.notEqual(target.id, replacement.changeIds[0], 'target id must not be the raw diff id');
  assert.equal(target.status, 'active');
  assert.equal(target.createdDocumentEpoch, 3);
  assert.ok(target.descriptor.afterExcerpt.includes('today'));
}

function testTargetResolutionMarksAmbiguousRepeatedEditsStale() {
  const original = 'alpha\nbridge\nalpha';
  const edited = 'alpha revised\nbridge\nalpha revised';
  const diff = computeDiff(original, edited, []);
  const groups = createChangeGroups(diff.changes, edited);
  const firstGroup = groups.find((group) => group.descriptor.lineStart === 1);
  assert.ok(firstGroup, 'expected first repeated edit group');

  const target = createReviewTargetFromGroup(firstGroup, {
    editedText: edited,
    documentEpoch: 1,
  });
  const drifted = {
    ...target,
    changeIds: [],
    descriptor: {
      ...target.descriptor,
      blockKey: '',
      contextBefore: '',
      contextAfter: '',
    },
  };

  const resolved = resolveReviewTargets([drifted], { ...diff, groups }, edited);
  assert.equal(resolved[0]?.status, 'stale', 'ambiguous repeated edits should become stale');
  assert.equal(resolved[0]?.resolution.staleReason, 'ambiguous');
}

function testAllTargetKindsAndDraftSnapshot() {
  const original = '# Title\n\nRead the [guide](https://example.com/v1).';
  const edited = 'Title\n\nRead the [guide](https://example.com/v2).';
  const semanticChanges = computeSemanticChanges(original, edited);
  const semanticChange = semanticChanges.find((change) => change.type === 'link_target');
  assert.ok(semanticChange, 'expected semantic link target change');

  const rangeTarget = createRangeReviewTarget({
    editedText: edited,
    selectedText: 'Title',
    offsetStart: 0,
    offsetEnd: 5,
    documentEpoch: 4,
  });
  const semanticTarget = createReviewTargetFromSemanticChange(semanticChange, {
    documentEpoch: 4,
  });
  const globalTarget = createGlobalReviewTarget({
    note: 'Overall, prefer concrete timing.',
    documentEpoch: 4,
  });

  assert.equal(rangeTarget.kind, 'range');
  assert.equal(semanticTarget.kind, 'semantic_change');
  assert.equal(globalTarget.kind, 'global');

  const draft = createRationaleDraft({
    targetId: rangeTarget.id,
    targetSnapshot: rangeTarget.descriptor,
    documentEpoch: 4,
    text: 'Make the title plain.',
  });

  assert.equal(draft.targetId, rangeTarget.id);
  assert.deepEqual(draft.targetSnapshot, rangeTarget.descriptor);
  assert.equal(draft.createdDocumentEpoch, 4);
  assert.equal(draft.status, 'active');
}

function main() {
  testReplacementGroupBecomesDurableTarget();
  testTargetResolutionMarksAmbiguousRepeatedEditsStale();
  testAllTargetKindsAndDraftSnapshot();
  console.log('review-targets: all checks passed');
}

main();
