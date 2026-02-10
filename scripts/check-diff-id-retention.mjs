#!/usr/bin/env node

import assert from 'node:assert/strict';
import { computeDiff } from '../src/lib/utils/diff.js';

function findInsertionByText(diff, needle) {
  return diff.changes.find(
    (change) => change.type === 'insertion' && change.text.includes(needle)
  );
}

function findDeletionByText(diff, needle) {
  return diff.changes.find(
    (change) => change.type === 'deletion' && change.text.includes(needle)
  );
}

function testOffsetShiftRetainsId() {
  const original = 'A\nB\nC';
  const firstEdit = 'A\nB changed\nC';
  const secondEdit = 'Intro\nA\nB changed\nC';

  const firstDiff = computeDiff(original, firstEdit, []);
  const secondDiff = computeDiff(original, secondEdit, firstDiff.changes, firstDiff._editedText);

  const firstInsertion = findInsertionByText(firstDiff, 'changed');
  const secondInsertion = findInsertionByText(secondDiff, 'changed');

  assert.ok(firstInsertion, 'expected insertion with "changed" in first diff');
  assert.ok(secondInsertion, 'expected insertion with "changed" in second diff');
  assert.equal(
    secondInsertion.id,
    firstInsertion.id,
    'expected insertion id to survive offset shift'
  );
}

function testExistingChangeKeepsIdentityWhenNewChangeAdded() {
  const original = 'alpha\nbeta\ngamma';
  const firstEdit = 'alpha\nBETA\ngamma';
  const secondEdit = 'alpha\nBETA\ngamma\nnew appendix';

  const firstDiff = computeDiff(original, firstEdit, []);
  const secondDiff = computeDiff(original, secondEdit, firstDiff.changes, firstDiff._editedText);

  const firstDeletion = findDeletionByText(firstDiff, 'beta');
  const firstInsertion = findInsertionByText(firstDiff, 'BETA');
  const secondDeletion = findDeletionByText(secondDiff, 'beta');
  const secondInsertion = findInsertionByText(secondDiff, 'BETA');

  assert.ok(firstDeletion && secondDeletion, 'expected beta deletion to exist in both diffs');
  assert.ok(firstInsertion && secondInsertion, 'expected BETA insertion to exist in both diffs');

  assert.equal(
    secondDeletion.id,
    firstDeletion.id,
    'expected deletion id to remain stable after extra unrelated insertion'
  );
  assert.equal(
    secondInsertion.id,
    firstInsertion.id,
    'expected insertion id to remain stable after extra unrelated insertion'
  );
}

function testNewUnrelatedChangeGetsNewIdentity() {
  const original = 'one\ntwo\nthree';
  const firstEdit = 'one\ntwo updated\nthree';
  const secondEdit = 'prefix\none\ntwo updated\nthree\nsuffix';

  const firstDiff = computeDiff(original, firstEdit, []);
  const secondDiff = computeDiff(original, secondEdit, firstDiff.changes, firstDiff._editedText);

  const firstIds = new Set(firstDiff.changes.map((change) => change.id));
  const newChanges = secondDiff.changes.filter((change) => !firstIds.has(change.id));

  assert.ok(
    newChanges.length > 0,
    'expected at least one newly introduced change id in second diff'
  );
}

function testDuplicateInsertionsKeepDistinctIdsAcrossReflow() {
  const original = 'alpha one\nbridge\nalpha two\nfooter';
  const firstEdit = 'alpha one ++\nbridge\nalpha two ++\nfooter';
  const secondEdit = 'preface\nalpha one ++ EXTRA\nbridge\nalpha two ++\nfooter';

  const firstDiff = computeDiff(original, firstEdit, []);
  const secondDiff = computeDiff(original, secondEdit, firstDiff.changes, firstDiff._editedText);

  const firstInsertionTop = firstDiff.changes.find(
    (change) =>
      change.type === 'insertion' &&
      change.text === ' ++' &&
      change.location.line === 1
  );
  const firstInsertionBottom = firstDiff.changes.find(
    (change) =>
      change.type === 'insertion' &&
      change.text === ' ++' &&
      change.location.line === 3
  );
  const secondInsertionBottom = secondDiff.changes.find(
    (change) =>
      change.type === 'insertion' &&
      change.text === ' ++' &&
      change.location.line === 4
  );

  assert.ok(firstInsertionTop, 'expected top insertion in first diff');
  assert.ok(firstInsertionBottom, 'expected bottom insertion in first diff');
  assert.ok(secondInsertionBottom, 'expected bottom insertion in second diff');
  assert.equal(
    secondInsertionBottom.id,
    firstInsertionBottom.id,
    'expected unchanged duplicate insertion to keep the same id'
  );
  assert.notEqual(
    secondInsertionBottom.id,
    firstInsertionTop.id,
    'expected unchanged duplicate insertion not to inherit sibling id'
  );
}

function main() {
  testOffsetShiftRetainsId();
  testExistingChangeKeepsIdentityWhenNewChangeAdded();
  testNewUnrelatedChangeGetsNewIdentity();
  testDuplicateInsertionsKeepDistinctIdsAcrossReflow();
  console.log('diff-id-retention: all checks passed');
}

main();
