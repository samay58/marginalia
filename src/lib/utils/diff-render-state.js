const textEncoder = new TextEncoder();

/**
 * @param {string} text
 * @returns {string}
 */
export function hashText(text) {
  const input = String(text ?? '');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * @param {string} text
 * @returns {number}
 */
export function byteLength(text) {
  return textEncoder.encode(String(text ?? '')).length;
}

/**
 * @typedef {Object} DiffSnapshot
 * @property {number} epoch
 * @property {number} documentEpoch
 * @property {string} originalPlainTextHash
 * @property {string} editedPlainTextHash
 * @property {string} originalText
 * @property {string} editedText
 * @property {Array<any>} changes
 * @property {Array<any>} groups
 * @property {Array<any>} semanticChanges
 * @property {string} createdAt
 */

/**
 * @param {object} options
 * @param {number} [options.epoch]
 * @param {number} [options.documentEpoch]
 * @param {string} options.originalText
 * @param {string} options.editedText
 * @param {Array<any>} [options.changes]
 * @param {Array<any>} [options.groups]
 * @param {Array<any>} [options.semanticChanges]
 * @returns {DiffSnapshot}
 */
export function createDiffSnapshot({
  epoch = 0,
  documentEpoch = 0,
  originalText,
  editedText,
  changes = [],
  groups = [],
  semanticChanges = [],
}) {
  return {
    epoch,
    documentEpoch,
    originalPlainTextHash: hashText(originalText),
    editedPlainTextHash: hashText(editedText),
    originalText,
    editedText,
    changes,
    groups,
    semanticChanges,
    createdAt: new Date().toISOString(),
  };
}

/**
 * @param {any} diffSnapshot
 * @param {string} currentText
 * @returns {boolean}
 */
export function isDiffSnapshotFresh(diffSnapshot, currentText) {
  if (!diffSnapshot) return false;
  const editedText =
    typeof diffSnapshot.editedText === 'string'
      ? diffSnapshot.editedText
      : typeof diffSnapshot._editedText === 'string'
        ? diffSnapshot._editedText
        : null;
  if (editedText !== null) {
    return editedText === currentText;
  }
  if (typeof diffSnapshot.editedPlainTextHash === 'string') {
    return diffSnapshot.editedPlainTextHash === hashText(currentText);
  }
  return true;
}

/**
 * @param {object} options
 * @param {any} options.diffSnapshot
 * @param {string} options.currentText
 * @param {boolean} options.hasStableDecorations
 * @returns {{ action: 'rebuild' | 'preserve' | 'clear', diffStatus: 'clean' | 'pending' | 'stale', reason: string | null }}
 */
export function getDecorationUpdateDecision({
  diffSnapshot,
  currentText,
  hasStableDecorations,
}) {
  const changes = diffSnapshot?.changes || [];
  if (!diffSnapshot || changes.length === 0) {
    return {
      action: 'clear',
      diffStatus: 'clean',
      reason: 'no_changes',
    };
  }

  if (isDiffSnapshotFresh(diffSnapshot, currentText)) {
    return {
      action: 'rebuild',
      diffStatus: 'clean',
      reason: null,
    };
  }

  if (hasStableDecorations) {
    return {
      action: 'preserve',
      diffStatus: 'pending',
      reason: 'snapshot_text_mismatch',
    };
  }

  return {
    action: 'clear',
    diffStatus: 'stale',
    reason: 'snapshot_text_mismatch',
  };
}

export default {
  byteLength,
  createDiffSnapshot,
  getDecorationUpdateDecision,
  hashText,
  isDiffSnapshotFresh,
};
