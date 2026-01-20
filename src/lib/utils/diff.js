import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();

/**
 * @typedef {Object} Change
 * @property {string} id - Unique identifier for the change
 * @property {'deletion' | 'insertion' | 'equal'} type - Type of change
 * @property {string} text - The text content
 * @property {{ line: number, col: number }} location - Position in the document
 */

/**
 * @typedef {Object} DiffResult
 * @property {Change[]} changes - List of all changes
 * @property {number} deletions - Number of deletions
 * @property {number} insertions - Number of insertions
 */

/**
 * Generate a unique ID for a change
 * @returns {string}
 */
function generateChangeId() {
  return 'c_' + Math.random().toString(36).substring(2, 8);
}

/**
 * Compute the diff between original and edited text
 * @param {string} original - The original text
 * @param {string} edited - The edited text
 * @returns {DiffResult}
 */
export function computeDiff(original, edited) {
  // Compute the diff
  const diffs = dmp.diff_main(original, edited);

  // Cleanup for better semantics (combines adjacent changes)
  dmp.diff_cleanupSemantic(diffs);

  /** @type {Change[]} */
  const changes = [];
  let deletions = 0;
  let insertions = 0;

  // Track position in original document for locations
  let line = 1;
  let col = 0;
  let originalOffset = 0;

  for (const [operation, text] of diffs) {
    const location = { line, col };

    if (operation === -1) {
      // Deletion
      changes.push({
        id: generateChangeId(),
        type: 'deletion',
        text,
        location,
      });
      deletions++;

      // Update position based on deleted text
      for (const char of text) {
        if (char === '\n') {
          line++;
          col = 0;
        } else {
          col++;
        }
      }
      originalOffset += text.length;
    } else if (operation === 1) {
      // Insertion
      changes.push({
        id: generateChangeId(),
        type: 'insertion',
        text,
        location,
      });
      insertions++;
      // Don't update position for insertions (they happen "at" the current position)
    } else {
      // Equal - no change, but update position
      for (const char of text) {
        if (char === '\n') {
          line++;
          col = 0;
        } else {
          col++;
        }
      }
      originalOffset += text.length;
    }
  }

  return {
    changes: changes.filter(c => c.type !== 'equal'),
    deletions,
    insertions,
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
