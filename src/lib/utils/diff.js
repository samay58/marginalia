import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

/**
 * @typedef {Object} Change
 * @property {string} id - Unique identifier for the change
 * @property {'deletion' | 'insertion' | 'equal'} type - Type of change
 * @property {string} text - The text content
 * @property {number} editedOffset - Character position in the edited document
 * @property {{ line: number, col: number }} location - Position in the document (legacy)
 */

/**
 * @typedef {Object} DiffResult
 * @property {Change[]} changes - List of all changes
 * @property {number} deletions - Number of deletions
 * @property {number} insertions - Number of insertions
 * @property {string} [_originalText] - Original text snapshot for verification
 * @property {string} [_editedText] - Edited text snapshot for verification
 */

/**
 * Generate a deterministic ID seed for a change based on content and position.
 * This is used for newly discovered changes. Existing IDs are preserved by
 * reconcileChangeIds when we can match against the previous diff snapshot.
 * @param {string} type - 'deletion' or 'insertion'
 * @param {string} text - The changed text
 * @param {number} offset - Position in edited document
 * @returns {string}
 */
function generateChangeId(type, text, offset) {
  const input = `${type}|${offset}|${text.length}|${text}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return 'c_' + Math.abs(hash).toString(36);
}

/**
 * Normalize text for fuzzy matching.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Build a multiset of character bigrams.
 * @param {string} text
 * @returns {Map<string, number>}
 */
function buildBigrams(text) {
  /** @type {Map<string, number>} */
  const grams = new Map();
  if (!text) return grams;
  if (text.length === 1) {
    grams.set(text, 1);
    return grams;
  }
  for (let i = 0; i < text.length - 1; i++) {
    const gram = text.slice(i, i + 2);
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  return grams;
}

/**
 * Compute a Sørensen-Dice-like similarity score for changed text.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function textSimilarity(a, b) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }

  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);
  if (leftBigrams.size === 0 || rightBigrams.size === 0) return 0;

  let intersection = 0;
  let leftCount = 0;
  let rightCount = 0;

  for (const count of leftBigrams.values()) leftCount += count;
  for (const count of rightBigrams.values()) rightCount += count;

  for (const [gram, leftGramCount] of leftBigrams) {
    const rightGramCount = rightBigrams.get(gram) || 0;
    intersection += Math.min(leftGramCount, rightGramCount);
  }

  return (2 * intersection) / (leftCount + rightCount);
}

/**
 * Build a local context anchor around a change offset.
 * Anchors help us keep IDs stable when multiple changes have similar text.
 * @param {string} text
 * @param {number} offset
 * @param {number} [radius]
 * @returns {{ before: string, after: string }}
 */
function buildContextAnchor(text, offset, radius = 32) {
  if (!text || offset < 0) {
    return { before: '', after: '' };
  }
  const start = Math.max(0, offset - radius);
  const end = Math.min(text.length, offset + radius);
  return {
    before: normalizeText(text.slice(start, offset)),
    after: normalizeText(text.slice(offset, end)),
  };
}

/**
 * Score how similar two context anchors are.
 * @param {{ before: string, after: string }} left
 * @param {{ before: string, after: string }} right
 * @returns {number}
 */
function anchorSimilarity(left, right) {
  const before = left.before && right.before ? textSimilarity(left.before, right.before) : 0;
  const after = left.after && right.after ? textSimilarity(left.after, right.after) : 0;
  const signals = (left.before && right.before ? 1 : 0) + (left.after && right.after ? 1 : 0);
  if (signals === 0) return 0;
  return (before + after) / signals;
}

/**
 * Reconcile change IDs with a previous change set so annotations survive
 * routine offset shifts while the user keeps editing.
 * @param {Change[]} nextChanges
 * @param {Change[]} previousChanges
 * @param {string} editedText
 * @param {string} previousEditedText
 * @returns {Change[]}
 */
function reconcileChangeIds(nextChanges, previousChanges, editedText, previousEditedText) {
  if (!Array.isArray(previousChanges) || previousChanges.length === 0) {
    return nextChanges;
  }

  /** @type {Map<string, Change[]>} */
  const previousByType = new Map();
  for (const prev of previousChanges) {
    const bucket = previousByType.get(prev.type) || [];
    bucket.push(prev);
    previousByType.set(prev.type, bucket);
  }

  const usedPreviousIds = new Set();
  const MIN_SIMILARITY = 0.34;
  const DISTANCE_WEIGHT = 0.00015;
  const TEXT_WEIGHT = 0.74;
  const ANCHOR_WEIGHT = 0.26;
  const hasPreviousContext = typeof previousEditedText === 'string' && previousEditedText.length > 0;

  /** @type {Map<string, { before: string, after: string }>} */
  const previousAnchorsById = new Map();
  if (hasPreviousContext) {
    for (const previous of previousChanges) {
      previousAnchorsById.set(
        previous.id,
        buildContextAnchor(previousEditedText, previous.editedOffset)
      );
    }
  }

  return nextChanges.map((change) => {
    const candidates = previousByType.get(change.type);
    if (!candidates || candidates.length === 0) {
      return change;
    }

    const changeAnchor = buildContextAnchor(editedText, change.editedOffset);
    let bestCandidate = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestSimilarity = 0;

    for (const candidate of candidates) {
      if (usedPreviousIds.has(candidate.id)) continue;
      const textScore = textSimilarity(change.text, candidate.text);
      if (textScore <= 0) continue;
      if (textScore < MIN_SIMILARITY) continue;

      const candidateAnchor = previousAnchorsById.get(candidate.id) || { before: '', after: '' };
      const contextScore = hasPreviousContext ? anchorSimilarity(changeAnchor, candidateAnchor) : 0;
      const distance = Math.abs(candidate.editedOffset - change.editedOffset);
      const score =
        textScore * TEXT_WEIGHT + contextScore * ANCHOR_WEIGHT - distance * DISTANCE_WEIGHT;
      if (score > bestScore) {
        bestScore = score;
        bestSimilarity = textScore;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate || bestSimilarity < MIN_SIMILARITY) {
      return change;
    }

    usedPreviousIds.add(bestCandidate.id);
    return {
      ...change,
      id: bestCandidate.id,
    };
  });
}

/**
 * Convert a character offset to line/col in text
 * @param {string} text - The text to compute position in
 * @param {number} offset - Character offset
 * @returns {{ line: number, col: number }}
 */
function offsetToLocation(text, offset) {
  let line = 1;
  let col = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      col = 0;
    } else {
      col++;
    }
  }
  return { line, col };
}

/**
 * Compute the diff between original and edited text
 * @param {string} original - The original text
 * @param {string} edited - The edited text
 * @param {Change[]} [previousChanges] - Previous change snapshot for ID reconciliation
 * @param {string} [previousEditedText] - Previous edited text snapshot for context-aware matching
 * @returns {DiffResult}
 */
export function computeDiff(original, edited, previousChanges = [], previousEditedText = '') {
  // Compute the diff
  /** @type {Array<[number, string]>} */
  const diffs = /** @type {Array<[number, string]>} */ (dmp.diff_main(original, edited));

  // Cleanup for better semantics (combines adjacent changes)
  dmp.diff_cleanupSemantic(diffs);

  /** @type {Change[]} */
  const changes = [];
  let deletions = 0;
  let insertions = 0;

  // Track position in EDITED document (where decorations will appear)
  let editedOffset = 0;

  for (const [operation, text] of diffs) {
    if (operation === -1) {
      // Deletion - text was removed, show at current edited position
      changes.push({
        id: generateChangeId('deletion', text, editedOffset),
        type: 'deletion',
        text,
        // editedOffset is where this deletion "happened" in the edited doc
        editedOffset,
        location: offsetToLocation(edited, editedOffset),
      });
      deletions++;
      // Don't advance editedOffset - deleted text isn't in edited doc
    } else if (operation === 1) {
      // Insertion - new text exists in edited doc
      changes.push({
        id: generateChangeId('insertion', text, editedOffset),
        type: 'insertion',
        text,
        editedOffset,
        location: offsetToLocation(edited, editedOffset),
      });
      insertions++;
      // Advance editedOffset by insertion length
      editedOffset += text.length;
    } else {
      // Equal - text exists in both, advance editedOffset
      editedOffset += text.length;
    }
  }

  return {
    changes: reconcileChangeIds(
      changes.filter(c => c.type !== 'equal'),
      previousChanges,
      edited,
      previousEditedText
    ),
    deletions,
    insertions,
    // Attach text snapshots for decoration verification
    _originalText: original,
    _editedText: edited,
  };
}

/**
 * Find contiguous change groups (deletion followed by insertion at same position)
 * These represent replacements
 * @param {Change[]} changes
 * @returns {Change[][]}
 */
export function groupChanges(changes) {
  /** @type {Change[][]} */
  const groups = [];
  /** @type {Change[]} */
  let currentGroup = [];

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const prevChange = changes[i - 1];

    if (currentGroup.length === 0) {
      currentGroup.push(change);
    } else {
      // Check if this change is adjacent to the previous one
      const lastInGroup = currentGroup[currentGroup.length - 1];
      const sameLocation =
        lastInGroup.location.line === change.location.line &&
        lastInGroup.location.col === change.location.col;
      const isReplacementPair =
        lastInGroup.type === 'deletion' && change.type === 'insertion' && sameLocation;

      if (isReplacementPair) {
        currentGroup.push(change);
      } else {
        groups.push(currentGroup);
        currentGroup = [change];
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Get lines that have changes
 * @param {Change[]} changes
 * @returns {Set<number>}
 */
export function getLinesWithChanges(changes) {
  const lines = new Set();
  for (const change of changes) {
    lines.add(change.location.line);
    // For multi-line changes, add all lines
    const newlines = (change.text.match(/\n/g) || []).length;
    for (let i = 1; i <= newlines; i++) {
      lines.add(change.location.line + i);
    }
  }
  return lines;
}

/**
 * Create a summary of changes for display
 * @param {DiffResult} diffResult
 * @returns {string}
 */
export function summarizeChanges(diffResult) {
  const parts = [];
  if (diffResult.deletions > 0) {
    parts.push(`${diffResult.deletions} deletion${diffResult.deletions > 1 ? 's' : ''}`);
  }
  if (diffResult.insertions > 0) {
    parts.push(`${diffResult.insertions} insertion${diffResult.insertions > 1 ? 's' : ''}`);
  }
  return parts.join(', ') || 'No changes';
}

export default {
  computeDiff,
  groupChanges,
  getLinesWithChanges,
  summarizeChanges,
};
