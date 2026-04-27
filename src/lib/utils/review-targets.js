import { hashText } from './diff-render-state.js';

const REATTACH_THRESHOLD = 0.74;
const REATTACH_MARGIN = 0.12;

/**
 * @typedef {import('./diff.js').Change} Change
 * @typedef {import('./semantic-diff.js').SemanticChange} SemanticChange
 *
 * @typedef {Object} TargetDescriptor
 * @property {string} typeSignature
 * @property {string} beforeExcerpt
 * @property {string} afterExcerpt
 * @property {string} normalizedExcerpt
 * @property {string | null | undefined} [blockKey]
 * @property {string | null | undefined} [blockTextBefore]
 * @property {string | null | undefined} [blockTextAfter]
 * @property {number | null | undefined} [lineStart]
 * @property {number | null | undefined} [lineEnd]
 * @property {number | null | undefined} [editedOffsetStart]
 * @property {number | null | undefined} [editedOffsetEnd]
 * @property {string | null | undefined} [contextBefore]
 * @property {string | null | undefined} [contextAfter]
 * @property {string | null | undefined} [markdownPath]
 * @property {number | null | undefined} [prosemirrorPosStart]
 * @property {number | null | undefined} [prosemirrorPosEnd]
 * @property {string | null | undefined} [preview]
 * @property {string | null | undefined} [lastChangeId]
 *
 * @typedef {Object} ChangeGroup
 * @property {string} id
 * @property {string[]} changeIds
 * @property {Change[]} changes
 * @property {'single' | 'replacement' | 'adjacent_rewrite' | 'block_rewrite'} kind
 * @property {TargetDescriptor} descriptor
 *
 * @typedef {Object} ReviewTarget
 * @property {string} id
 * @property {'change' | 'change_group' | 'range' | 'semantic_change' | 'global'} kind
 * @property {'active' | 'pending' | 'stale' | 'deleted'} status
 * @property {string} createdAt
 * @property {number} createdDocumentEpoch
 * @property {number} lastResolvedDocumentEpoch
 * @property {string[]} changeIds
 * @property {string[]} [semanticChangeIds]
 * @property {TargetDescriptor} descriptor
 * @property {{ strategy: 'exact' | 'mapped' | 'heuristic' | 'manual' | 'none', confidence: number, staleReason?: 'missing' | 'ambiguous' | 'changed_too_much' | 'deleted' }} resolution
 *
 * @typedef {Object} RationaleDraft
 * @property {string} id
 * @property {string} targetId
 * @property {TargetDescriptor} targetSnapshot
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} createdDocumentEpoch
 * @property {string} text
 * @property {'low' | 'medium' | 'high'} priority
 * @property {'active' | 'saved' | 'discarded'} status
 */

/**
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * @param {string} text
 * @returns {Map<string, number>}
 */
function bigrams(text) {
  const normalized = normalize(text);
  const grams = new Map();
  if (!normalized) return grams;
  if (normalized.length === 1) {
    grams.set(normalized, 1);
    return grams;
  }
  for (let index = 0; index < normalized.length - 1; index++) {
    const gram = normalized.slice(index, index + 2);
    grams.set(gram, (grams.get(gram) || 0) + 1);
  }
  return grams;
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function similarity(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }

  const leftGrams = bigrams(a);
  const rightGrams = bigrams(b);
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;

  let intersection = 0;
  let leftCount = 0;
  let rightCount = 0;
  for (const count of leftGrams.values()) leftCount += count;
  for (const count of rightGrams.values()) rightCount += count;
  for (const [gram, count] of leftGrams) {
    intersection += Math.min(count, rightGrams.get(gram) || 0);
  }
  return (2 * intersection) / (leftCount + rightCount);
}

/**
 * @param {string} text
 * @param {number} offset
 * @param {number} [radius]
 */
function contextAround(text, offset, radius = 72) {
  const source = String(text ?? '');
  const bounded = Math.max(0, Math.min(offset || 0, source.length));
  return {
    before: source.slice(Math.max(0, bounded - radius), bounded),
    after: source.slice(bounded, Math.min(source.length, bounded + radius)),
  };
}

/**
 * @param {string} text
 * @param {number | null | undefined} lineNumber
 */
function lineContext(text, lineNumber) {
  const lines = String(text ?? '').split(/\r?\n/);
  const line = Math.max(1, Math.min(Math.round(lineNumber || 1), Math.max(1, lines.length)));
  const beforeLine = lines[line - 2] || '';
  const lineText = lines[line - 1] || '';
  const afterLine = lines[line] || '';
  return {
    line,
    beforeLine,
    lineText,
    afterLine,
    blockKey: hashText([beforeLine, lineText, afterLine].join('\n')),
  };
}

/**
 * @param {Change[]} changes
 * @returns {'single' | 'replacement' | 'adjacent_rewrite' | 'block_rewrite'}
 */
function classifyGroup(changes) {
  if (changes.length <= 1) return 'single';
  const lines = new Set(changes.map((change) => change.location?.line ?? 1));
  const hasDeletion = changes.some((change) => change.type === 'deletion');
  const hasInsertion = changes.some((change) => change.type === 'insertion');
  if (lines.size > 1) return 'block_rewrite';
  if (hasDeletion && hasInsertion) return 'replacement';
  return 'adjacent_rewrite';
}

/**
 * @param {Change[]} changes
 * @param {string} editedText
 * @returns {TargetDescriptor}
 */
function buildDescriptorFromChanges(changes, editedText) {
  const sorted = [...changes].sort((left, right) => left.editedOffset - right.editedOffset);
  const first = sorted[0] || null;
  const last = sorted[sorted.length - 1] || first;
  const beforeExcerpt = sorted
    .filter((change) => change.type === 'deletion')
    .map((change) => change.text)
    .join('');
  const afterExcerpt = sorted
    .filter((change) => change.type === 'insertion')
    .map((change) => change.text)
    .join('');
  const fallbackExcerpt = sorted.map((change) => change.text).join('');
  const offsetStart = first?.editedOffset ?? 0;
  const offsetEnd = Math.max(
    offsetStart,
    ...sorted.map((change) =>
      change.type === 'insertion' ? change.editedOffset + change.text.length : change.editedOffset
    )
  );
  const lineStart = Math.min(...sorted.map((change) => change.location?.line ?? 1));
  const lineEnd = Math.max(...sorted.map((change) => change.location?.line ?? lineStart));
  const context = contextAround(editedText, offsetStart);
  const line = lineContext(editedText, lineStart);
  const typeSignature = sorted.map((change) => change.type).join('+') || 'change';
  const normalizedExcerpt = normalize([beforeExcerpt, afterExcerpt || fallbackExcerpt].join(' -> '));

  return {
    typeSignature,
    beforeExcerpt,
    afterExcerpt,
    normalizedExcerpt,
    blockKey: line.blockKey,
    blockTextBefore: line.beforeLine,
    blockTextAfter: line.lineText,
    lineStart,
    lineEnd,
    editedOffsetStart: offsetStart,
    editedOffsetEnd: offsetEnd,
    contextBefore: context.before,
    contextAfter: context.after,
    markdownPath: null,
    prosemirrorPosStart: null,
    prosemirrorPosEnd: null,
    preview: normalize(afterExcerpt || beforeExcerpt || fallbackExcerpt),
    lastChangeId: last?.id || null,
  };
}

/**
 * @param {string} kind
 * @param {any} descriptor
 * @param {number} documentEpoch
 */
function makeTargetId(kind, descriptor, documentEpoch) {
  const seed = [
    kind,
    descriptor.typeSignature,
    descriptor.normalizedExcerpt,
    descriptor.blockKey || '',
    descriptor.lineStart ?? '',
    documentEpoch,
  ].join('|');
  return `rt_${kind}_${hashText(seed).slice(2, 10)}`;
}

/**
 * @param {Change[]} changes
 * @param {string} editedText
 * @returns {ChangeGroup}
 */
function createChangeGroup(changes, editedText) {
  const sorted = [...changes].sort((left, right) => left.editedOffset - right.editedOffset);
  const kind = classifyGroup(sorted);
  const descriptor = buildDescriptorFromChanges(sorted, editedText);
  const id = `cg_${hashText(
    [kind, descriptor.normalizedExcerpt, descriptor.blockKey, descriptor.lineStart].join('|')
  ).slice(2, 10)}`;
  return {
    id,
    changeIds: sorted.map((change) => change.id),
    changes: sorted,
    kind,
    descriptor,
  };
}

/**
 * @param {Change[]} changes
 * @param {string} editedText
 * @returns {ChangeGroup[]}
 */
export function createChangeGroups(changes, editedText = '') {
  const visible = [...(changes || [])]
    .filter((change) => change?.text && change.text.trim().length > 0)
    .sort((left, right) => left.editedOffset - right.editedOffset);
  const groups = [];
  let index = 0;

  while (index < visible.length) {
    const current = visible[index];
    const next = visible[index + 1];
    if (
      next &&
      current.location?.line === next.location?.line &&
      current.location?.col === next.location?.col &&
      current.type === 'deletion' &&
      next.type === 'insertion'
    ) {
      groups.push(createChangeGroup([current, next], editedText));
      index += 2;
      continue;
    }

    groups.push(createChangeGroup([current], editedText));
    index += 1;
  }

  return groups;
}

/**
 * @param {ChangeGroup} group
 * @param {{ editedText: string, documentEpoch: number }} options
 * @returns {ReviewTarget}
 */
export function createReviewTargetFromGroup(group, { editedText, documentEpoch }) {
  const descriptor = group.descriptor || buildDescriptorFromChanges(group.changes || [], editedText);
  const timestamp = new Date().toISOString();
  return {
    id: makeTargetId('change_group', descriptor, documentEpoch),
    kind: 'change_group',
    status: 'active',
    createdAt: timestamp,
    createdDocumentEpoch: documentEpoch,
    lastResolvedDocumentEpoch: documentEpoch,
    changeIds: [...(group.changeIds || [])],
    semanticChangeIds: [],
    descriptor,
    resolution: {
      strategy: 'exact',
      confidence: 1,
    },
  };
}

/**
 * @param {Change} change
 * @param {{ editedText: string, documentEpoch: number }} options
 * @returns {ReviewTarget}
 */
export function createReviewTargetFromChange(change, options) {
  return createReviewTargetFromGroup(
    createChangeGroup([change], options.editedText),
    options
  );
}

/**
 * @param {{ editedText: string, selectedText: string, offsetStart: number, offsetEnd: number, documentEpoch: number }} options
 * @returns {ReviewTarget}
 */
export function createRangeReviewTarget({
  editedText,
  selectedText,
  offsetStart,
  offsetEnd,
  documentEpoch,
}) {
  const context = contextAround(editedText, offsetStart);
  const line = lineContext(editedText, editedText.slice(0, offsetStart).split(/\r?\n/).length);
  const descriptor = {
    typeSignature: 'range',
    beforeExcerpt: '',
    afterExcerpt: selectedText || editedText.slice(offsetStart, offsetEnd),
    normalizedExcerpt: normalize(selectedText || editedText.slice(offsetStart, offsetEnd)),
    blockKey: line.blockKey,
    blockTextBefore: line.beforeLine,
    blockTextAfter: line.lineText,
    lineStart: line.line,
    lineEnd: line.line,
    editedOffsetStart: offsetStart,
    editedOffsetEnd: offsetEnd,
    contextBefore: context.before,
    contextAfter: context.after,
    markdownPath: null,
    prosemirrorPosStart: null,
    prosemirrorPosEnd: null,
    preview: normalize(selectedText),
  };
  const timestamp = new Date().toISOString();
  return {
    id: makeTargetId('range', descriptor, documentEpoch),
    kind: 'range',
    status: 'active',
    createdAt: timestamp,
    createdDocumentEpoch: documentEpoch,
    lastResolvedDocumentEpoch: documentEpoch,
    changeIds: [],
    semanticChangeIds: [],
    descriptor,
    resolution: { strategy: 'exact', confidence: 1 },
  };
}

/**
 * @param {SemanticChange} semanticChange
 * @param {{ documentEpoch: number }} options
 * @returns {ReviewTarget}
 */
export function createReviewTargetFromSemanticChange(semanticChange, { documentEpoch }) {
  const before = JSON.stringify(semanticChange.before ?? {});
  const after = JSON.stringify(semanticChange.after ?? {});
  const descriptor = {
    typeSignature: `semantic:${semanticChange.type}`,
    beforeExcerpt: before,
    afterExcerpt: after,
    normalizedExcerpt: normalize(`${semanticChange.context} ${before} ${after}`),
    blockKey: hashText(`${semanticChange.line}|${semanticChange.context}`),
    blockTextBefore: '',
    blockTextAfter: semanticChange.context || '',
    lineStart: semanticChange.line,
    lineEnd: semanticChange.line,
    editedOffsetStart: null,
    editedOffsetEnd: null,
    contextBefore: '',
    contextAfter: '',
    markdownPath: null,
    prosemirrorPosStart: null,
    prosemirrorPosEnd: null,
    preview: semanticChange.context || semanticChange.type,
  };
  const timestamp = new Date().toISOString();
  return {
    id: makeTargetId('semantic_change', descriptor, documentEpoch),
    kind: 'semantic_change',
    status: 'active',
    createdAt: timestamp,
    createdDocumentEpoch: documentEpoch,
    lastResolvedDocumentEpoch: documentEpoch,
    changeIds: [],
    semanticChangeIds: [semanticChange.id],
    descriptor,
    resolution: { strategy: 'exact', confidence: 1 },
  };
}

/**
 * @param {{ note: string, documentEpoch: number }} options
 * @returns {ReviewTarget}
 */
export function createGlobalReviewTarget({ note, documentEpoch }) {
  const descriptor = {
    typeSignature: 'global',
    beforeExcerpt: '',
    afterExcerpt: note || 'Session note',
    normalizedExcerpt: normalize(note || 'Session note'),
    blockKey: 'global',
    blockTextBefore: '',
    blockTextAfter: '',
    lineStart: null,
    lineEnd: null,
    editedOffsetStart: null,
    editedOffsetEnd: null,
    contextBefore: '',
    contextAfter: '',
    markdownPath: null,
    prosemirrorPosStart: null,
    prosemirrorPosEnd: null,
    preview: normalize(note || 'Session note'),
  };
  const timestamp = new Date().toISOString();
  return {
    id: makeTargetId('global', descriptor, documentEpoch),
    kind: 'global',
    status: 'active',
    createdAt: timestamp,
    createdDocumentEpoch: documentEpoch,
    lastResolvedDocumentEpoch: documentEpoch,
    changeIds: [],
    semanticChangeIds: [],
    descriptor,
    resolution: { strategy: 'none', confidence: 1 },
  };
}

/**
 * @param {any} targetDescriptor
 * @param {any} groupDescriptor
 */
function scoreDescriptor(targetDescriptor, groupDescriptor) {
  const excerptScore = similarity(
    targetDescriptor.normalizedExcerpt || targetDescriptor.afterExcerpt || targetDescriptor.beforeExcerpt,
    groupDescriptor.normalizedExcerpt || groupDescriptor.afterExcerpt || groupDescriptor.beforeExcerpt
  );
  if (excerptScore < 0.58) return Number.NEGATIVE_INFINITY;

  const blockScore =
    targetDescriptor.blockKey && targetDescriptor.blockKey === groupDescriptor.blockKey ? 0.16 : 0;
  const contextScore =
    similarity(targetDescriptor.contextBefore || '', groupDescriptor.contextBefore || '') * 0.08 +
    similarity(targetDescriptor.contextAfter || '', groupDescriptor.contextAfter || '') * 0.08;
  const linePenalty =
    typeof targetDescriptor.lineStart === 'number' && typeof groupDescriptor.lineStart === 'number'
      ? Math.min(Math.abs(targetDescriptor.lineStart - groupDescriptor.lineStart), 6) * 0.03
      : 0;

  return excerptScore * 0.76 + blockScore + contextScore - linePenalty;
}

/**
 * @param {ReviewTarget[]} targets
 * @param {any} diffSnapshot
 * @param {string} editedText
 * @returns {ReviewTarget[]}
 */
export function resolveReviewTargets(targets, diffSnapshot, editedText = '') {
  const groups = Array.isArray(diffSnapshot?.groups) && diffSnapshot.groups.length > 0
    ? diffSnapshot.groups
    : createChangeGroups(diffSnapshot?.changes || [], editedText);
  const changesById = new Set((/** @type {Change[]} */ (diffSnapshot?.changes || [])).map((change) => change.id));
  const groupsByChangeId = new Map();
  for (const group of groups) {
    for (const changeId of group.changeIds || []) {
      groupsByChangeId.set(changeId, group);
    }
  }

  return (targets || []).map((target) => {
    if (target.kind === 'global' || target.kind === 'range' || target.kind === 'semantic_change') {
      return {
        ...target,
        status: target.status === 'deleted' ? 'deleted' : 'active',
        resolution: target.resolution || { strategy: 'none', confidence: 1 },
      };
    }

    const hasExact = (target.changeIds || []).length > 0 &&
      target.changeIds.every((/** @type {string} */ changeId) => changesById.has(changeId));
    if (hasExact) {
      return {
        ...target,
        status: 'active',
        lastResolvedDocumentEpoch: diffSnapshot?.documentEpoch ?? target.lastResolvedDocumentEpoch,
        resolution: { strategy: 'exact', confidence: 1 },
      };
    }

    const scored = groups
      .map((/** @type {ChangeGroup} */ group) => ({
        group,
        score: scoreDescriptor(target.descriptor || {}, group.descriptor || {}),
      }))
      .filter((/** @type {{ score: number }} */ entry) => Number.isFinite(entry.score))
      .sort((/** @type {{ score: number }} */ left, /** @type {{ score: number }} */ right) => right.score - left.score);
    const best = scored[0];
    const runnerUp = scored[1];

    if (
      best &&
      best.score >= REATTACH_THRESHOLD &&
      (!runnerUp || best.score - runnerUp.score >= REATTACH_MARGIN)
    ) {
      return {
        ...target,
        status: 'active',
        changeIds: [...(best.group.changeIds || [])],
        descriptor: best.group.descriptor || target.descriptor,
        lastResolvedDocumentEpoch: diffSnapshot?.documentEpoch ?? target.lastResolvedDocumentEpoch,
        resolution: {
          strategy: 'heuristic',
          confidence: Math.max(0, Math.min(1, best.score)),
        },
      };
    }

    return {
      ...target,
      status: 'stale',
      resolution: {
        strategy: 'none',
        confidence: best ? Math.max(0, Math.min(1, best.score)) : 0,
        staleReason: best ? 'ambiguous' : 'missing',
      },
    };
  });
}

/**
 * @param {object} options
 * @param {string} options.targetId
 * @param {any} options.targetSnapshot
 * @param {number} options.documentEpoch
 * @param {string} [options.text]
 * @param {'low' | 'medium' | 'high'} [options.priority]
 * @returns {RationaleDraft}
 */
export function createRationaleDraft({
  targetId,
  targetSnapshot,
  documentEpoch,
  text = '',
  priority = 'medium',
}) {
  const timestamp = new Date().toISOString();
  return {
    id: `draft_${Date.now().toString(36)}_${hashText(`${targetId}|${timestamp}`).slice(2, 8)}`,
    targetId,
    targetSnapshot,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdDocumentEpoch: documentEpoch,
    text,
    priority,
    status: 'active',
  };
}

/**
 * @param {ReviewTarget[]} targets
 * @param {string} changeId
 */
export function findTargetForChangeId(targets, changeId) {
  return (targets || []).find((target) => (target.changeIds || []).includes(changeId)) || null;
}

export default {
  createChangeGroups,
  createGlobalReviewTarget,
  createRangeReviewTarget,
  createRationaleDraft,
  createReviewTargetFromChange,
  createReviewTargetFromGroup,
  createReviewTargetFromSemanticChange,
  findTargetForChangeId,
  resolveReviewTargets,
};
