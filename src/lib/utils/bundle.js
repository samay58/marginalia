/**
 * Bundle generator for Marginalia
 * Creates the output files that Claude will read
 */

/**
 * @typedef {import('../stores/app.js').Annotation} Annotation
 * @typedef {import('./diff.js').Change} Change
 * @typedef {import('./diff.js').DiffResult} DiffResult
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
 * Generate changes.json content
 * @param {string} sourceFile
 * @param {DiffResult} diffResult
 * @param {number} sessionDuration - Duration in seconds
 * @param {string | null} principlesPath
 * @returns {object}
 */
export function generateChangesJson(sourceFile, diffResult, sessionDuration, principlesPath) {
  return {
    marginalia_version: '1.0',
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
  };
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
 * Generate summary_for_agent.md content
 * @param {string} filename
 * @param {DiffResult} diffResult
 * @param {Map<string, Annotation>} annotations
 * @param {string} generalNotes
 * @param {number} sessionDuration
 * @returns {string}
 */
export function generateSummaryMarkdown(filename, diffResult, annotations, generalNotes, sessionDuration) {
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
 * @param {Map<string, Annotation>} options.annotations
 * @param {string} options.generalNotes
 * @param {Date} options.startTime
 * @param {string | null} [options.principlesPath]
 * @returns {object} Bundle with all file contents
 */
export function generateBundle({
  filePath,
  originalContent,
  editedContent,
  diffResult,
  annotations,
  generalNotes,
  startTime,
  principlesPath,
}) {
  const filename = filePath.split('/').pop() || 'untitled.md';
  const baseName = getBaseName(filePath);
  const timestamp = getTimestamp();
  const bundleName = `${timestamp}_${baseName}`;
  const sessionDuration = Math.round((Date.now() - startTime.getTime()) / 1000);

  return {
    bundleName,
    files: {
      'original.md': originalContent,
      'final.md': editedContent,
      'changes.json': JSON.stringify(
        generateChangesJson(filePath, diffResult, sessionDuration, principlesPath),
        null,
        2
      ),
      'annotations.json': JSON.stringify(
        generateAnnotationsJson(annotations, diffResult, generalNotes),
        null,
        2
      ),
      'summary_for_agent.md': generateSummaryMarkdown(
        filename,
        diffResult,
        annotations,
        generalNotes,
        sessionDuration
      ),
    },
  };
}

export default {
  generateBundle,
  generateChangesJson,
  generateAnnotationsJson,
  generateSummaryMarkdown,
};
