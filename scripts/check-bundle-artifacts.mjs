#!/usr/bin/env node

import assert from 'node:assert/strict';
import DiffMatchPatch from 'diff-match-patch';
import { computeDiff } from '../src/lib/utils/diff.js';
import { computeSemanticChanges } from '../src/lib/utils/semantic-diff.js';
import { generateBundle } from '../src/lib/utils/bundle.js';

const dmp = new DiffMatchPatch();
const textEncoder = new TextEncoder();

/**
 * @param {string} content
 * @returns {Promise<string>}
 */
async function sha256Hex(content) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('crypto.subtle is required for bundle hash verification');
  }
  const data = textEncoder.encode(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {any} provenance
 * @returns {Map<string, { sha256: string, bytes: number }>}
 */
function artifactMap(provenance) {
  const map = new Map();
  for (const artifact of provenance.artifacts || []) {
    map.set(artifact.file, {
      sha256: artifact.sha256,
      bytes: artifact.bytes,
    });
  }
  return map;
}

async function testBundleProvenanceAndPatch() {
  const filePath = '/tmp/chapter-draft.md';
  const original = [
    '# Draft',
    '',
    'Read the [guide](https://example.com/v1).',
    '',
    '- Ship v1',
    '',
    'The tone is **friendly**.',
  ].join('\n');

  const edited = [
    '# Draft',
    '',
    'Read the [guide](https://example.com/v2).',
    '',
    '- Ship v1',
    '- Add migration notes',
    '',
    'The tone is friendly.',
  ].join('\n');

  const diffResult = computeDiff(original, edited, []);
  const semanticChanges = computeSemanticChanges(original, edited);
  const annotations = new Map();

  const listInsertion = diffResult.changes.find(
    (change) => change.type === 'insertion' && change.text.includes('migration notes')
  );
  if (listInsertion) {
    annotations.set(listInsertion.id, {
      rationale: 'Flag migration work explicitly to reduce rollout ambiguity.',
      category: 'clarity',
      writingMdRule: null,
      principleCandidate: true,
    });
  }

  const bundle = await generateBundle({
    filePath,
    originalContent: original,
    editedContent: edited,
    diffResult,
    semanticChanges,
    annotations,
    generalNotes: 'Keep this section factual and direct.',
    startTime: new Date(Date.now() - 150_000),
    principlesPath: '/tmp/WRITING.md',
    lintFindings: [],
  });

  assert.ok(bundle.files['changes.patch'], 'expected changes.patch in bundle output');
  assert.ok(bundle.files['provenance.json'], 'expected provenance.json in bundle output');

  const patches = dmp.patch_fromText(bundle.files['changes.patch']);
  const [patchedText, patchResults] = dmp.patch_apply(patches, original);
  assert.ok(
    patchResults.every(Boolean),
    'expected each patch hunk to apply cleanly to original content'
  );
  assert.equal(patchedText, edited, 'expected patch to reconstruct final content');

  const provenance = JSON.parse(bundle.files['provenance.json']);
  assert.equal(provenance.schema_version, '1.0', 'unexpected provenance schema version');
  assert.equal(provenance.bundle.format_version, '2.0', 'unexpected bundle format version');
  assert.equal(provenance.bundle.source_file, filePath, 'source file mismatch in provenance');
  assert.equal(
    provenance.counts.semantic_changes,
    semanticChanges.length,
    'semantic change count mismatch'
  );
  assert.equal(
    provenance.counts.text_changes,
    diffResult.changes.length,
    'text change count mismatch'
  );

  const artifactHashes = artifactMap(provenance);
  const hashedFiles = [
    'original.md',
    'final.md',
    'changes.json',
    'annotations.json',
    'summary_for_agent.md',
    'changes.patch',
  ];

  for (const filename of hashedFiles) {
    const artifact = artifactHashes.get(filename);
    assert.ok(artifact, `missing provenance entry for ${filename}`);
    const expectedHash = await sha256Hex(bundle.files[filename]);
    assert.equal(artifact.sha256, expectedHash, `hash mismatch for ${filename}`);
    assert.equal(
      artifact.bytes,
      textEncoder.encode(bundle.files[filename]).length,
      `byte count mismatch for ${filename}`
    );
  }

  assert.ok(
    !artifactHashes.has('provenance.json'),
    'provenance should not recursively hash itself'
  );

  const changesJson = JSON.parse(bundle.files['changes.json']);
  assert.equal(changesJson.bundle_format_version, '2.0', 'changes.json missing format marker');
  assert.ok(Array.isArray(changesJson.semantic_changes), 'expected semantic_changes array');
}

async function main() {
  await testBundleProvenanceAndPatch();
  console.log('bundle-artifacts: all checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
