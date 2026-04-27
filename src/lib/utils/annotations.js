const MIN_REATTACH_SCORE = 0.74;
const MIN_SCORE_MARGIN = 0.12;

/**
 * @typedef {import('./diff.js').Change} Change
 */

/**
 * @typedef {Object} AnnotationTarget
 * @property {string | null} changeId
 * @property {'deletion' | 'insertion' | null} type
 * @property {string} excerpt
 * @property {number | null} line
 * @property {string} beforeLine
 * @property {string} lineText
 * @property {string} afterLine
 * @property {string} blockKey
 */

/**
 * @typedef {Object} AnnotationRecord
 * @property {string} id
 * @property {string | null} targetId
 * @property {'change' | 'change_group' | 'range' | 'semantic_change' | 'global' | null} targetKind
 * @property {string} rationale
 * @property {string | null} matchedRule
 * @property {AnnotationTarget} target
 * @property {any} targetSnapshot
 * @property {'low' | 'medium' | 'high'} priority
 * @property {{ status?: 'active' | 'stale', strategy?: string, confidence?: number, staleReason?: string } | null} resolution
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ResolvedAnnotation
 * @property {AnnotationRecord} annotation
 * @property {'active' | 'stale'} status
 * @property {Change | null} change
 * @property {any} [reviewTarget]
 * @property {AnnotationTarget} target
 * @property {string | null} resolvedChangeId
 * @property {string | null} reason
 */

function createIdFragment() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * @param {string} text
 * @returns {string}
 */
function hashText(text) {
  const input = normalize(text);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `a_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
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
  for (let index = 0; index < text.length - 1; index++) {
    const gram = text.slice(index, index + 2);
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

  const leftBigrams = buildBigrams(a);
  const rightBigrams = buildBigrams(b);
  if (leftBigrams.size === 0 || rightBigrams.size === 0) return 0;

  let intersection = 0;
  let leftCount = 0;
  let rightCount = 0;

  for (const count of leftBigrams.values()) leftCount += count;
  for (const count of rightBigrams.values()) rightCount += count;

  for (const [gram, count] of leftBigrams) {
    intersection += Math.min(count, rightBigrams.get(gram) || 0);
  }

  return (2 * intersection) / (leftCount + rightCount);
}

/**
 * @param {number | null | undefined} line
 * @param {number} lineCount
 * @returns {number}
 */
function clampLineNumber(line, lineCount) {
  const candidate = typeof line === 'number' ? line : 1;
  if (!Number.isFinite(candidate)) return 1;
  return Math.max(1, Math.min(Math.round(candidate), Math.max(1, lineCount)));
}

/**
 * @param {string} text
 * @param {number | null | undefined} lineNumber
 */
function getLineContext(text, lineNumber) {
  const lines = String(text || '').split(/\r?\n/);
  const safeLine = clampLineNumber(lineNumber, lines.length);
  const beforeLine = lines[safeLine - 2] || '';
  const lineText = lines[safeLine - 1] || '';
  const afterLine = lines[safeLine] || '';
  return {
    line: safeLine,
    beforeLine,
    lineText,
    afterLine,
    blockKey: hashText([beforeLine, lineText, afterLine].join('\n')),
  };
}

/**
 * @param {Change} change
 * @param {string} editedText
 * @returns {AnnotationTarget}
 */
export function buildAnnotationTarget(change, editedText) {
  const context = getLineContext(editedText, change.location?.line || 1);
  return {
    changeId: change.id,
    type: change.type === 'deletion' || change.type === 'insertion' ? change.type : null,
    excerpt: change.text || '',
    line: context.line,
    beforeLine: context.beforeLine,
    lineText: context.lineText,
    afterLine: context.afterLine,
    blockKey: context.blockKey,
  };
}

/**
 * Build annotation target using pre-split lines array (avoids repeated splits).
 * @param {Change} change
 * @param {string[]} lines
 * @returns {AnnotationTarget}
 */
function buildAnnotationTargetFromLines(change, lines) {
  const lineNumber = change.location?.line || 1;
  const safeLine = clampLineNumber(lineNumber, lines.length);
  const beforeLine = lines[safeLine - 2] || '';
  const lineText = lines[safeLine - 1] || '';
  const afterLine = lines[safeLine] || '';
  return {
    changeId: change.id,
    type: change.type === 'deletion' || change.type === 'insertion' ? change.type : null,
    excerpt: change.text || '',
    line: safeLine,
    beforeLine,
    lineText,
    afterLine,
    blockKey: hashText([beforeLine, lineText, afterLine].join('\n')),
  };
}

/**
 * @returns {string}
 */
export function createAnnotationId() {
  return `note_${Date.now().toString(36)}_${createIdFragment()}`;
}

/**
 * @param {{ change?: Change | null, editedText: string, rationale: string, matchedRule?: string | null, annotationId?: string | null, createdAt?: string | null, updatedAt?: string | null, reviewTarget?: any, targetId?: string | null, targetKind?: string | null, targetSnapshot?: any, priority?: 'low' | 'medium' | 'high' }} options
 * @returns {AnnotationRecord}
 */
export function createAnnotationRecord({
  change = null,
  editedText,
  rationale,
  matchedRule = null,
  annotationId = null,
  createdAt = null,
  updatedAt = null,
  reviewTarget = null,
  targetId = null,
  targetKind = null,
  targetSnapshot = null,
  priority = 'medium',
}) {
  const timestamp = new Date().toISOString();
  const descriptor = reviewTarget?.descriptor || targetSnapshot || null;
  const fallbackChange = change || null;
  return {
    id: annotationId || createAnnotationId(),
    targetId: reviewTarget?.id || targetId || null,
    targetKind: reviewTarget?.kind || targetKind || null,
    rationale: rationale.trim(),
    matchedRule,
    target: fallbackChange
      ? buildAnnotationTarget(fallbackChange, editedText)
      : {
          changeId: null,
          type: null,
          excerpt: descriptor?.afterExcerpt || descriptor?.beforeExcerpt || '',
          line: descriptor?.lineStart ?? null,
          beforeLine: descriptor?.blockTextBefore || '',
          lineText: descriptor?.blockTextAfter || '',
          afterLine: '',
          blockKey: descriptor?.blockKey || '',
        },
    targetSnapshot: descriptor,
    priority,
    resolution: {
      status: 'active',
      strategy: reviewTarget?.resolution?.strategy || 'exact',
      confidence: reviewTarget?.resolution?.confidence ?? 1,
    },
    createdAt: createdAt || timestamp,
    updatedAt: updatedAt || timestamp,
  };
}

/**
 * @param {AnnotationRecord} annotation
 * @param {Change} change
 * @param {string} editedText
 * @param {any} [reviewTarget]
 * @returns {AnnotationRecord}
 */
export function reanchorAnnotation(annotation, change, editedText, reviewTarget = null) {
  const target = reviewTarget?.descriptor || annotation.targetSnapshot || null;
  return {
    ...annotation,
    targetId: reviewTarget?.id || annotation.targetId || null,
    targetKind: reviewTarget?.kind || annotation.targetKind || null,
    target: buildAnnotationTarget(change, editedText),
    targetSnapshot: target,
    resolution: {
      status: 'active',
      strategy: 'manual',
      confidence: 1,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {unknown} change
 * @returns {boolean}
 */
export function isVisibleChange(change) {
  const candidate = /** @type {{ text?: string } | null} */ (change && typeof change === 'object' ? change : null);
  return !!candidate?.text && candidate.text.trim().length > 0;
}

const PUNCTUATION_ONLY = /^[\s\p{P}\p{S}]+$/u;

/**
 * A change is trivial if its text is one word or fewer, or punctuation-only.
 * @param {unknown} change
 * @returns {boolean}
 */
export function isTrivialChange(change) {
  const candidate = /** @type {{ text?: string } | null} */ (change && typeof change === 'object' ? change : null);
  if (!candidate?.text) return true;
  const trimmed = candidate.text.trim();
  if (!trimmed) return true;
  if (PUNCTUATION_ONLY.test(trimmed)) return true;
  const words = trimmed.split(/\s+/);
  return words.length <= 1;
}

/**
 * @param {any} annotation
 * @returns {AnnotationRecord}
 */
export function normalizeAnnotationRecord(annotation) {
  const createdAt = annotation?.createdAt || annotation?.created_at || new Date().toISOString();
  const updatedAt = annotation?.updatedAt || annotation?.updated_at || createdAt;
  const target = annotation?.target || {};
  return {
    id: annotation?.id || createAnnotationId(),
    targetId: annotation?.targetId ?? annotation?.target_id ?? null,
    targetKind: annotation?.targetKind ?? annotation?.target_kind ?? null,
    rationale: String(annotation?.rationale || '').trim(),
    matchedRule: annotation?.matchedRule ?? annotation?.matched_rule ?? null,
    target: {
      changeId: target?.changeId ?? target?.change_id ?? null,
      type: target?.type === 'deletion' || target?.type === 'insertion' ? target.type : null,
      excerpt: String(target?.excerpt || ''),
      line: Number.isFinite(target?.line) ? target.line : null,
      beforeLine: String(target?.beforeLine ?? target?.before_line ?? ''),
      lineText: String(target?.lineText ?? target?.line_text ?? ''),
      afterLine: String(target?.afterLine ?? target?.after_line ?? ''),
      blockKey: String(target?.blockKey ?? target?.block_key ?? ''),
    },
    targetSnapshot: annotation?.targetSnapshot ?? annotation?.target_snapshot ?? null,
    priority:
      annotation?.priority === 'low' || annotation?.priority === 'high' || annotation?.priority === 'medium'
        ? annotation.priority
        : 'medium',
    resolution: annotation?.resolution || null,
    createdAt,
    updatedAt,
  };
}

/**
 * @param {AnnotationTarget} target
 * @param {AnnotationTarget} descriptor
 * @returns {number}
 */
function scoreDescriptorMatch(target, descriptor) {
  if (target.type && descriptor.type && target.type !== descriptor.type) {
    return Number.NEGATIVE_INFINITY;
  }

  const excerptScore = similarity(target.excerpt, descriptor.excerpt);
  if (excerptScore < 0.58) {
    return Number.NEGATIVE_INFINITY;
  }

  const lineScore = similarity(target.lineText, descriptor.lineText);
  const beforeScore = similarity(target.beforeLine, descriptor.beforeLine);
  const afterScore = similarity(target.afterLine, descriptor.afterLine);
  const blockBonus = target.blockKey && target.blockKey === descriptor.blockKey ? 0.14 : 0;
  const linePenalty =
    typeof target.line === 'number' && typeof descriptor.line === 'number'
      ? Math.min(Math.abs(target.line - descriptor.line), 4) * 0.03
      : 0;

  return excerptScore * 0.6 + lineScore * 0.18 + beforeScore * 0.08 + afterScore * 0.08 + blockBonus - linePenalty;
}

/**
 * @param {AnnotationRecord[]} annotations
 * @param {import('./diff.js').DiffResult | null} diffResult
 * @param {string} editedText
 * @param {any[]} [reviewTargets]
 * @returns {ResolvedAnnotation[]}
 */
export function resolveAnnotations(annotations, diffResult, editedText, reviewTargets = []) {
  const visibleChanges = (diffResult?.changes || []).filter(isVisibleChange);
  const lines = String(editedText || '').split(/\r?\n/);
  const descriptors = visibleChanges.map((change) => ({
    change,
    target: buildAnnotationTargetFromLines(change, lines),
  }));
  const targetsById = new Map((reviewTargets || []).map((target) => [target.id, target]));
  const changesById = new Map(visibleChanges.map((change) => [change.id, change]));

  return (annotations || []).map((annotation) => {
    const normalized = normalizeAnnotationRecord(annotation);

    if (normalized.targetId && targetsById.has(normalized.targetId)) {
      const reviewTarget = targetsById.get(normalized.targetId);
      if (reviewTarget?.status === 'active') {
        const resolvedChangeId =
          reviewTarget.changeIds?.find((/** @type {string} */ changeId) => changesById.has(changeId)) ||
          normalized.target.changeId ||
          null;
        const change = resolvedChangeId ? changesById.get(resolvedChangeId) || null : null;
        return {
          annotation: {
            ...normalized,
            targetSnapshot: normalized.targetSnapshot || reviewTarget.descriptor,
            resolution: {
              status: 'active',
              strategy: reviewTarget.resolution?.strategy || 'exact',
              confidence: reviewTarget.resolution?.confidence ?? 1,
            },
          },
          status: 'active',
          change,
          reviewTarget,
          target: change ? buildAnnotationTargetFromLines(change, lines) : normalized.target,
          resolvedChangeId,
          reason: reviewTarget.resolution?.strategy === 'heuristic' ? 'reattached' : null,
        };
      }

      return {
        annotation: {
          ...normalized,
          targetSnapshot: normalized.targetSnapshot || reviewTarget?.descriptor || null,
          resolution: {
            status: 'stale',
            strategy: reviewTarget?.resolution?.strategy || 'none',
            confidence: reviewTarget?.resolution?.confidence ?? 0,
            staleReason: reviewTarget?.resolution?.staleReason || 'missing',
          },
        },
        status: 'stale',
        change: null,
        reviewTarget,
        target: normalized.target,
        resolvedChangeId: null,
        reason: reviewTarget?.resolution?.staleReason || 'missing',
      };
    }

    const exact = descriptors.find(({ change }) => change.id === normalized.target.changeId);
    if (exact) {
      return {
        annotation: {
          ...normalized,
          resolution: { status: 'active', strategy: 'exact', confidence: 1 },
        },
        status: 'active',
        change: exact.change,
        target: exact.target,
        resolvedChangeId: exact.change.id,
        reason: null,
      };
    }

    const scored = descriptors
      .map((descriptor) => ({
        descriptor,
        score: scoreDescriptorMatch(normalized.target, descriptor.target),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score);

    const best = scored[0];
    const runnerUp = scored[1];

    if (
      best &&
      best.score >= MIN_REATTACH_SCORE &&
      (!runnerUp || best.score - runnerUp.score >= MIN_SCORE_MARGIN)
    ) {
      return {
        annotation: {
          ...normalized,
          resolution: { status: 'active', strategy: 'heuristic', confidence: best.score },
        },
        status: 'active',
        change: best.descriptor.change,
        target: best.descriptor.target,
        resolvedChangeId: best.descriptor.change.id,
        reason: 'reattached',
      };
    }

    return {
      annotation: {
        ...normalized,
        resolution: {
          status: 'stale',
          strategy: 'none',
          confidence: best ? best.score : 0,
          staleReason: best ? 'ambiguous' : 'missing',
        },
      },
      status: 'stale',
      change: null,
      target: normalized.target,
      resolvedChangeId: null,
      reason: best ? 'ambiguous' : 'missing',
    };
  });
}

/**
 * @param {ResolvedAnnotation[]} entries
 * @returns {ResolvedAnnotation[]}
 */
export function sortResolvedAnnotations(entries) {
  return [...(entries || [])].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === 'active' ? -1 : 1;
    }

    if (left.status === 'active' && left.change && right.change) {
      return left.change.editedOffset - right.change.editedOffset;
    }

    return String(right.annotation.updatedAt || '').localeCompare(String(left.annotation.updatedAt || ''));
  });
}
