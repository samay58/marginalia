/**
 * Bundle generator for Marginalia
 * Creates the output files that Claude will read
 */

import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();
const textEncoder = new TextEncoder();
const BUNDLE_FORMAT_VERSION = '2.0';
const PROVENANCE_SCHEMA_VERSION = '1.0';

/**
 * @typedef {import('../stores/app.js').Annotation} Annotation
 * @typedef {import('./diff.js').Change} Change
 * @typedef {import('./diff.js').DiffResult} DiffResult
 * @typedef {import('./semantic-diff.js').SemanticChange} SemanticChange
 * @typedef {{ label: string, line: number, match: string, snippet: string, category?: string | null, suggestion?: string | null }} LintFinding
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
 * @param {Map<string, Annotation>} annotations
 * @param {DiffResult} diffResult
 * @param {string} generalNotes
 * @returns {object}
 */
export function generateAnnotationsJson(annotations, diffResult, generalNotes) {
  // Convert annotations map to array format
  const annotationsList = [];
  const principleCandidates = new Map();

  for (const [changeId, annotation] of annotations) {
    const change = diffResult.changes.find(c => c.id === changeId);

    annotationsList.push({
      change_ids: [changeId],
      rationale: annotation.rationale,
      category: annotation.category || null,
      writing_md_rule: annotation.writingMdRule || null,
      principle_candidate: annotation.principleCandidate || false,
    });

    // Track principle candidates
    if (annotation.principleCandidate) {
      const key = annotation.rationale.toLowerCase();
      if (principleCandidates.has(key)) {
        const existing = principleCandidates.get(key);
        existing.occurrences++;
        if (change) {
          existing.examples.push(change.text.slice(0, 50));
        }
      } else {
        principleCandidates.set(key, {
          text: annotation.rationale,
          occurrences: 1,
          examples: change ? [change.text.slice(0, 50)] : [],
        });
      }
    }
  }

  return {
    annotations: annotationsList,
    general_notes: generalNotes || '',
    principle_candidates: Array.from(principleCandidates.values()),
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
 * @param {Map<string, Annotation>} options.annotations
 * @param {LintFinding[]} options.lintFindings
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
  lintFindings,
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
      annotations: annotations.size,
      lint_findings: lintFindings.length,
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
 * @param {Map<string, Annotation>} annotations
 * @param {string} generalNotes
 * @param {number} sessionDuration
 * @param {LintFinding[]} [lintFindings]
 * @returns {string}
 */
export function generateSummaryMarkdown(
  filename,
  diffResult,
  semanticChanges,
  annotations,
  generalNotes,
  sessionDuration,
  lintFindings = []
) {
  const lines = [];
  const minutes = Math.round(sessionDuration / 60);

  lines.push(`# Review: ${filename}`);
  lines.push(`${new Date().toISOString().slice(0, 10)} · ${minutes} min`);
  lines.push('');

  // Changes summary
  lines.push('## Changes');
  const parts = [];
  if (diffResult.deletions > 0) {
    parts.push(`${diffResult.deletions} deletion${diffResult.deletions > 1 ? 's' : ''}`);
  }
  if (diffResult.insertions > 0) {
    parts.push(`${diffResult.insertions} insertion${diffResult.insertions > 1 ? 's' : ''}`);
  }
  lines.push(parts.join(', ') || 'No changes');
  lines.push('');

  if (semanticChanges.length > 0) {
    lines.push('## Structural & Semantic Changes');
    for (const change of semanticChanges) {
      lines.push(`- ${formatSemanticChange(change)}`);
    }
    lines.push('');
  }

  // Feedback by priority
  lines.push('## Feedback (by priority)');

  // Group annotations by whether they match WRITING.md rules
  const important = [];
  const other = [];

  for (const [changeId, annotation] of annotations) {
    const change = diffResult.changes.find(c => c.id === changeId);
    const entry = {
      change,
      annotation,
    };

    if (annotation.writingMdRule) {
      important.push(entry);
    } else {
      other.push(entry);
    }
  }

  let num = 1;

  for (const { change, annotation } of important) {
    lines.push(`${num}. [IMPORTANT] ${annotation.rationale}`);
    if (change) {
      const preview = change.text.slice(0, 40);
      lines.push(`   - "${preview}${change.text.length > 40 ? '...' : ''}"`);
    }
    if (annotation.writingMdRule) {
      lines.push(`   - Matches WRITING.md: ${annotation.writingMdRule}`);
    }
    lines.push('');
    num++;
  }

  for (const { change, annotation } of other) {
    lines.push(`${num}. ${annotation.rationale}`);
    if (change) {
      const preview = change.text.slice(0, 40);
      lines.push(`   - "${preview}${change.text.length > 40 ? '...' : ''}"`);
    }
    if (annotation.category) {
      lines.push(`   - Category: ${annotation.category}`);
    }
    lines.push('');
    num++;
  }

  if (lintFindings.length > 0) {
    lines.push('## Tone & Slop Flags');
    for (const finding of lintFindings) {
      const category = finding.category ? `[${finding.category}] ` : '';
      const preview = finding.snippet || finding.match;
      lines.push(`- ${category}${finding.label} (line ${finding.line}): "${preview}"`);
      if (finding.suggestion) {
        lines.push(`  - Suggestion: ${finding.suggestion}`);
      }
    }
    lines.push('');
  }

  // General notes
  if (generalNotes) {
    lines.push('## General');
    lines.push(generalNotes);
    lines.push('');
  }

  // Principle candidates
  const candidates = [];
  for (const annotation of annotations.values()) {
    if (annotation.principleCandidate) {
      candidates.push(annotation.rationale);
    }
  }

  if (candidates.length > 0) {
    lines.push('## Principle Candidates');
    for (const candidate of candidates) {
      lines.push(`- "${candidate}" → Review via /reflect`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate the complete bundle
 * @param {object} options
 * @param {string} options.filePath
 * @param {string} options.originalContent
 * @param {string} options.editedContent
 * @param {DiffResult} options.diffResult
 * @param {SemanticChange[]} options.semanticChanges
 * @param {Map<string, Annotation>} options.annotations
 * @param {string} options.generalNotes
 * @param {Date} options.startTime
 * @param {string | null} [options.principlesPath]
 * @param {LintFinding[]} [options.lintFindings]
 * @returns {Promise<{ bundleName: string, files: Record<string, string> }>} Bundle with all file contents
 */
export async function generateBundle({
  filePath,
  originalContent,
  editedContent,
  diffResult,
  semanticChanges = [],
  annotations,
  generalNotes,
  startTime,
  principlesPath,
  lintFindings = [],
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
    generateAnnotationsJson(annotations, diffResult, generalNotes),
    null,
    2
  );
  const summaryForAgent = generateSummaryMarkdown(
    filename,
    diffResult,
    semanticChanges,
    annotations,
    generalNotes,
    sessionDuration,
    lintFindings
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
      lintFindings,
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
