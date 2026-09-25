/**
 * Bundle generator for Marginalia
 * Creates the output files that Claude will read
 */

import DiffMatchPatch from 'diff-match-patch';
import { createChangeGroups } from './review-targets.js';

const dmp = new DiffMatchPatch();
const textEncoder = new TextEncoder();
const BUNDLE_FORMAT_VERSION = '3.1';
const PROVENANCE_SCHEMA_VERSION = '1.1';

/**
 * @typedef {import('./annotations.js').ResolvedAnnotation} ResolvedAnnotation
 * @typedef {import('./diff.js').Change} Change
 * @typedef {import('./diff.js').DiffResult} DiffResult
 * @typedef {import('./semantic-diff.js').SemanticChange} SemanticChange
 */

/**
 * Generate timestamp for bundle naming
 * @returns {string}
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Extract the base filename without extension
 * @param {string} path
 * @returns {string}
 */
function getBaseName(path) {
  const filename = path.split('/').pop() || 'untitled';
  return filename.replace(/\.[^.]+$/, '');
}

/**
 * @param {string} content
 * @returns {number}
 */
function byteLength(content) {
  return textEncoder.encode(content).length;
}

/**
 * Fallback hash for environments where Web Crypto is unavailable.
 * Not cryptographically secure, but deterministic.
 * @param {string} content
 * @returns {string}
 */
function fallbackHashHex(content) {
  let hash = 2166136261;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * @param {string} content
 * @returns {Promise<string>}
 */
async function sha256Hex(content) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    return fallbackHashHex(content);
  }
  const data = textEncoder.encode(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {Record<string, string>} files
 * @returns {Promise<Record<string, string>>}
 */
async function hashArtifacts(files) {
  const entries = await Promise.all(
    Object.entries(files).map(async ([filename, content]) => [filename, await sha256Hex(content)])
  );
  return Object.fromEntries(entries);
}

/**
 * @param {Record<string, string>} files
 * @returns {Record<string, number>}
 */
function measureArtifacts(files) {
  return Object.fromEntries(
    Object.entries(files).map(([filename, content]) => [filename, byteLength(content)])
  );
}

/**
 * Generate machine-readable patch between original and final content.
 * @param {string} originalContent
 * @param {string} editedContent
 * @returns {string}
 */
export function generatePatchContent(originalContent, editedContent) {
  const patches = dmp.patch_make(originalContent, editedContent);
  return dmp.patch_toText(patches);
}

/**
 * Generate changes.json content
 * @param {string} sourceFile
 * @param {DiffResult} diffResult
 * @param {SemanticChange[]} semanticChanges
 * @param {number} sessionDuration - Duration in seconds
 * @param {string | null} principlesPath
 * @returns {object}
 */
export function generateChangesJson(
  sourceFile,
  diffResult,
  semanticChanges,
  sessionDuration,
  principlesPath
) {
  return {
    marginalia_version: '1.0',
    bundle_format_version: BUNDLE_FORMAT_VERSION,
    source_file: sourceFile,
    reviewed_at: new Date().toISOString(),
    session_duration_seconds: sessionDuration,
    principles_path: principlesPath || null,
    changes: diffResult.changes.map(change => ({
      id: change.id,
      type: change.type,
      text: change.text,
      location: change.location,
    })),
    change_groups: (
      /** @type {any} */ (diffResult).groups ||
      createChangeGroups(diffResult.changes || [], diffResult._editedText || '')
    ).map(
      (/** @type {any} */ group) => ({
        id: group.id,
        kind: group.kind,
        change_ids: group.changeIds,
        descriptor: {
          type_signature: group.descriptor?.typeSignature || null,
          before_excerpt: group.descriptor?.beforeExcerpt || '',
          after_excerpt: group.descriptor?.afterExcerpt || '',
          line_start: group.descriptor?.lineStart ?? null,
          line_end: group.descriptor?.lineEnd ?? null,
        },
      })
    ),
    semantic_changes: semanticChanges.map((change) => ({
      id: change.id,
      type: change.type,
      line: change.line,
      context: change.context,
      before: change.before,
      after: change.after,
    })),
  };
}

/**
 * @param {SemanticChange} change
 * @returns {string}
 */
function formatSemanticChange(change) {
  switch (change.type) {
    case 'block_type':
      return `Line ${change.line}: block type changed (${change.before?.block_type ?? 'unknown'} -> ${change.after?.block_type ?? 'unknown'}) for "${change.context}".`;
    case 'heading_level':
      return `Line ${change.line}: heading level changed (${change.before?.level ?? '?'} -> ${change.after?.level ?? '?'}) for "${change.context}".`;
    case 'list_nesting':
      return `Line ${change.line}: list nesting changed (indent ${change.before?.indent ?? '?'} -> ${change.after?.indent ?? '?'}) for "${change.context}".`;
    case 'list_kind':
      return `Line ${change.line}: list kind changed (${change.before?.list_kind ?? 'unknown'} -> ${change.after?.list_kind ?? 'unknown'}) for "${change.context}".`;
    case 'link_target':
      return `Line ${change.line}: link target changed for "${change.before?.link_text ?? change.context}" (${change.before?.url ?? 'unknown'} -> ${change.after?.url ?? 'unknown'}).`;
    case 'formatting':
      return `Line ${change.line}: formatting-only change detected for "${change.context}".`;
    case 'code_fence_language':
      return `Line ${change.line}: code fence language changed (${change.before?.language ?? 'none'} -> ${change.after?.language ?? 'none'}).`;
    case 'table_structure':
      return `Line ${change.line}: table structure changed (columns ${change.before?.columns ?? '?'} -> ${change.after?.columns ?? '?'}).`;
    default:
      return `Line ${change.line}: semantic change (${change.type}) for "${change.context}".`;
  }
}

/**
 * Generate annotations.json content
 * @param {ResolvedAnnotation[]} annotations
 * @param {string} generalNotes
 * @returns {object}
 */
export function generateAnnotationsJson(annotations, generalNotes) {
  return {
    schema_version: '3.1',
    annotations: annotations.map((entry) => {
      const entryAny = /** @type {any} */ (entry);
      const annotationAny = /** @type {any} */ (entry.annotation);
      return {
        id: entry.annotation.id,
        rationale: entry.annotation.rationale,
        priority: annotationAny.priority || 'medium',
        status: entry.status,
        matched_rule: entry.annotation.matchedRule || null,
        reason: entry.reason || null,
        created_at: entry.annotation.createdAt,
        updated_at: entry.annotation.updatedAt,
        target: {
          target_id: annotationAny.targetId || entryAny.reviewTarget?.id || null,
          target_kind: annotationAny.targetKind || entryAny.reviewTarget?.kind || null,
          change_id: entry.annotation.target.changeId,
          resolved_change_id: entry.resolvedChangeId,
          type: entry.annotation.target.type,
          excerpt: entry.annotation.target.excerpt,
          resolved_excerpt: entry.change?.text || null,
          line: entry.annotation.target.line,
          before_line: entry.annotation.target.beforeLine,
          line_text: entry.annotation.target.lineText,
          after_line: entry.annotation.target.afterLine,
          block_key: entry.annotation.target.blockKey,
          snapshot: annotationAny.targetSnapshot || entryAny.reviewTarget?.descriptor || null,
          resolution_strategy:
            annotationAny.resolution?.strategy ||
            entryAny.reviewTarget?.resolution?.strategy ||
            (entry.status === 'active' ? 'exact' : 'none'),
          resolution_confidence:
            annotationAny.resolution?.confidence ??
            entryAny.reviewTarget?.resolution?.confidence ??
            (entry.status === 'active' ? 1 : 0),
          stale_reason:
            annotationAny.resolution?.staleReason ||
            entryAny.reviewTarget?.resolution?.staleReason ||
            (entry.status === 'stale' ? entry.reason || 'missing' : null),
        },
      };
    }),
    general_notes: generalNotes || '',
  };
}

/**
 * Generate provenance.json content for forensic/debug-friendly review lineage.
 * @param {object} options
 * @param {string} options.bundleName
 * @param {string} options.filePath
 * @param {Date} options.startTime
 * @param {number} options.sessionDuration
 * @param {DiffResult} options.diffResult
 * @param {SemanticChange[]} options.semanticChanges
 * @param {ResolvedAnnotation[]} options.annotations
 * @param {any[]} [options.reviewTargets]
 * @param {string | null | undefined} options.principlesPath
 * @param {string} options.patchContent
 * @param {Record<string, string>} options.artifactHashes
 * @param {Record<string, number>} options.artifactBytes
 * @returns {object}
 */
export function generateProvenanceJson({
  bundleName,
  filePath,
  startTime,
  sessionDuration,
  diffResult,
  semanticChanges,
  annotations,
  reviewTargets = [],
  principlesPath,
  patchContent,
  artifactHashes,
  artifactBytes,
}) {
  const patchHunkCount = (patchContent.match(/^@@/gm) || []).length;

  return {
    schema_version: PROVENANCE_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    bundle: {
      format_version: BUNDLE_FORMAT_VERSION,
      name: bundleName,
      source_file: filePath,
      source_basename: getBaseName(filePath),
      principles_path: principlesPath || null,
      session_started_at: startTime.toISOString(),
      session_duration_seconds: sessionDuration,
    },
    engines: {
      text_diff: 'diff-match-patch@1.0.5',
      semantic_diff: 'marginalia-semantic-diff-v1',
      patch_format: 'diff-match-patch',
      hash_algorithm: 'sha256',
    },
    counts: {
      text_changes: diffResult.changes.length,
      deletions: diffResult.deletions,
      insertions: diffResult.insertions,
      semantic_changes: semanticChanges.length,
      annotations_total: annotations.length,
      annotations_active: annotations.filter((entry) => entry.status === 'active').length,
      annotations_stale: annotations.filter((entry) => entry.status === 'stale').length,
      review_targets_total: reviewTargets.length,
      review_targets_active: reviewTargets.filter((target) => target.status === 'active').length,
      review_targets_stale: reviewTargets.filter((target) => target.status === 'stale').length,
      patch_hunks: patchHunkCount,
    },
    artifacts: Object.keys(artifactHashes)
      .sort()
      .map((filename) => ({
        file: filename,
        sha256: artifactHashes[filename],
        bytes: artifactBytes[filename] ?? 0,
      })),
  };
}

/**
 * Generate summary_for_agent.md content
 * @param {string} filename
 * @param {DiffResult} diffResult
 * @param {SemanticChange[]} semanticChanges
 * @param {ResolvedAnnotation[]} annotations
 * @param {string} generalNotes
 * @param {number} sessionDuration
 * @returns {string}
 */
export function generateSummaryMarkdown(
  filename,
  diffResult,
  semanticChanges,
  annotations,
  generalNotes,
  sessionDuration
) {
  const minutesLabel = sessionDuration < 60 ? 'under a minute' : `${Math.round(sessionDuration / 60)} min`;
  const active = annotations.filter((entry) => entry.status === 'active');
  const stale = annotations.filter((entry) => entry.status === 'stale');
  const groups = createChangeGroups(diffResult.changes || []);
  const explainedChangeIds = new Set(
    active.flatMap((entry) => [entry.change?.id, entry.resolvedChangeId, entry.annotation.target.changeId]).filter(Boolean)
  );
  const unexplained = groups.filter((group) => !group.changeIds.some((id) => explainedChangeIds.has(id)));
  const notes = (generalNotes || '').trim();

  const lines = [];
  lines.push(`# Review of ${filename}`);
  lines.push('');
  lines.push(
    `The user made ${plural(groups.length, 'edit')} and explained ${active.length}. ` +
      `The review took ${minutesLabel}.`
  );
  lines.push('');
  lines.push(
    'Start from final.md, which is the user\'s version of the draft. Use the reasons below to understand ' +
      'what they want, and apply the same judgment to the rest of the draft and to future drafts.'
  );
  lines.push('');

  if (notes) {
    lines.push('## Session notes');
    lines.push('');
    lines.push(notes);
    lines.push('');
  }

  lines.push('## Explained edits');
  lines.push('');
  if (active.length === 0) {
    lines.push('None. The user edited without giving reasons.');
    lines.push('');
  }
  active.forEach((entry, index) => {
    const edit = describeAnnotatedEdit(entry);
    lines.push(`${index + 1}. ${edit.kind}${edit.line ? `, line ${edit.line}` : ''}`);
    for (const [label, text] of edit.parts) {
      lines.push(`   ${label}: ${quote(text)}`);
    }
    lines.push(`   Why: ${oneLine(entry.annotation.rationale)}`);
    lines.push('');
  });

  if (unexplained.length > 0) {
    lines.push('## Other edits');
    lines.push('');
    for (const group of unexplained) {
      const edit = describeGroup(group);
      const detail = edit.parts.map(([label, text]) => `${label.toLowerCase()} ${quote(text)}`).join(', ');
      lines.push(`- Line ${edit.line}, ${detail}`);
    }
    lines.push('');
  }

  if (semanticChanges.length > 0) {
    lines.push('## Structure changes');
    lines.push('');
    for (const change of semanticChanges) {
      lines.push(`- ${formatSemanticChange(change)}`);
    }
    lines.push('');
  }

  if (stale.length > 0) {
    lines.push('## Stale reasons');
    lines.push('');
    lines.push('These no longer match an edit in final.md. Treat them as general guidance, not instructions for a specific line.');
    lines.push('');
    for (const entry of stale) {
      const excerpt = entry.annotation.target.excerpt;
      lines.push(`- ${oneLine(entry.annotation.rationale)}${excerpt ? ` (was attached to ${quote(excerpt)})` : ''}`);
    }
    lines.push('');
  }

  lines.push('## Files');
  lines.push('');
  lines.push('- final.md: the user\'s version');
  lines.push('- changes.patch: exact line diff from original.md');
  lines.push('- annotations.json, changes.json, provenance.json: the same review as structured data');

  return lines.join('\n');
}

/** @param {number} count @param {string} noun */
function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** @param {string} text */
function oneLine(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/** @param {string} text */
function quote(text) {
  const flat = oneLine(text);
  return `"${flat.length > 240 ? `${flat.slice(0, 239)}…` : flat}"`;
}

/**
 * @param {string} before
 * @param {string} after
 * @returns {{ kind: string, parts: Array<[string, string]> }}
 */
function describeBeforeAfter(before, after) {
  if (before.trim() && after.trim()) return { kind: 'Replaced', parts: [['Before', before], ['After', after]] };
  if (before.trim()) return { kind: 'Deleted', parts: [['Removed', before]] };
  if (after.trim()) return { kind: 'Inserted', parts: [['Added', after]] };
  return { kind: 'Note on the whole draft', parts: [] };
}

/** @param {any} group */
function describeGroup(group) {
  return {
    ...describeBeforeAfter(group.descriptor?.beforeExcerpt || '', group.descriptor?.afterExcerpt || ''),
    line: group.descriptor?.lineStart ?? group.changes?.[0]?.location?.line ?? 1,
  };
}

/** @param {ResolvedAnnotation} entry */
function describeAnnotatedEdit(entry) {
  const entryAny = /** @type {any} */ (entry);
  const annotationAny = /** @type {any} */ (entry.annotation);
  const descriptor = annotationAny.targetSnapshot || entryAny.reviewTarget?.descriptor || null;
  const change = entry.change || null;
  const line = change?.location?.line ?? descriptor?.lineStart ?? entry.annotation.target.line ?? null;
  if (descriptor && (descriptor.beforeExcerpt || descriptor.afterExcerpt)) {
    return { ...describeBeforeAfter(descriptor.beforeExcerpt || '', descriptor.afterExcerpt || ''), line };
  }
  const text = change?.text || entry.annotation.target.excerpt || '';
  const type = change?.type || entry.annotation.target.type;
  return { ...describeBeforeAfter(type === 'deletion' ? text : '', type === 'deletion' ? '' : text), line };
}

/**
 * Generate the complete bundle
 * @param {object} options
 * @param {string} options.filePath
 * @param {string} options.originalContent
 * @param {string} options.editedContent
 * @param {DiffResult} options.diffResult
 * @param {SemanticChange[]} options.semanticChanges
 * @param {ResolvedAnnotation[]} options.annotations
 * @param {any[]} [options.reviewTargets]
 * @param {string} options.generalNotes
 * @param {Date} options.startTime
 * @param {string | null} [options.principlesPath]
 * @returns {Promise<{ bundleName: string, files: Record<string, string> }>} Bundle with all file contents
 */
export async function generateBundle({
  filePath,
  originalContent,
  editedContent,
  diffResult,
  semanticChanges = [],
  annotations,
  reviewTargets = [],
  generalNotes,
  startTime,
  principlesPath,
}) {
  const filename = filePath.split('/').pop() || 'untitled.md';
  const baseName = getBaseName(filePath);
  const timestamp = getTimestamp();
  const bundleName = `${timestamp}_${baseName}`;
  const sessionDuration = Math.round((Date.now() - startTime.getTime()) / 1000);

  const changesJson = JSON.stringify(
    generateChangesJson(
      filePath,
      diffResult,
      semanticChanges,
      sessionDuration,
      principlesPath ?? null
    ),
    null,
    2
  );
  const annotationsJson = JSON.stringify(
    generateAnnotationsJson(annotations, generalNotes),
    null,
    2
  );
  const summaryForAgent = generateSummaryMarkdown(
    filename,
    diffResult,
    semanticChanges,
    annotations,
    generalNotes,
    sessionDuration
  );
  const patchContent = generatePatchContent(originalContent, editedContent);

  const baseFiles = {
    'original.md': originalContent,
    'final.md': editedContent,
    'changes.json': changesJson,
    'annotations.json': annotationsJson,
    'summary_for_agent.md': summaryForAgent,
    'changes.patch': patchContent,
  };
  const artifactHashes = await hashArtifacts(baseFiles);
  const artifactBytes = measureArtifacts(baseFiles);

  const provenanceJson = JSON.stringify(
    generateProvenanceJson({
      bundleName,
      filePath,
      startTime,
      sessionDuration,
      diffResult,
      semanticChanges,
      annotations,
      reviewTargets,
          principlesPath,
      patchContent,
      artifactHashes,
      artifactBytes,
    }),
    null,
    2
  );

  return {
    bundleName,
    files: {
      ...baseFiles,
      'provenance.json': provenanceJson,
    },
  };
}

export default {
  generateBundle,
  generatePatchContent,
  generateProvenanceJson,
  generateChangesJson,
  generateAnnotationsJson,
  generateSummaryMarkdown,
};
