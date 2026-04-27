import { writable, derived, get } from 'svelte/store';
import { computeDiff, getLinesWithChanges, summarizeChanges } from '../utils/diff.js';
import {
  createAnnotationId,
  isVisibleChange,
  isTrivialChange,
  normalizeAnnotationRecord,
  resolveAnnotations,
  sortResolvedAnnotations,
} from '../utils/annotations.js';
import { createDiffSnapshot } from '../utils/diff-render-state.js';
import {
  createChangeGroups,
  createGlobalReviewTarget,
  createRationaleDraft,
  createReviewTargetFromChange,
  createReviewTargetFromGroup,
  findTargetForChangeId,
  resolveReviewTargets,
} from '../utils/review-targets.js';
import { markdownToPlainText } from '../utils/markdown-plain-text.js';

/**
 * @typedef {Object} AnnotationTarget
 * @property {string | null} changeId - Last resolved change id
 * @property {'deletion' | 'insertion' | null} type - Last resolved change type
 * @property {string} excerpt - Changed text excerpt
 * @property {number | null} line - Line hint in the edited document
 * @property {string} beforeLine - Previous line context
 * @property {string} lineText - Current line context
 * @property {string} afterLine - Next line context
 * @property {string} blockKey - Context hash for stable remapping
 */

/**
 * @typedef {Object} AnnotationRecord
 * @property {string} id - Stable annotation id
 * @property {string | null} targetId - Durable review target id
 * @property {'change' | 'change_group' | 'range' | 'semantic_change' | 'global' | null} targetKind - Durable review target kind
 * @property {string} rationale - Short rationale text
 * @property {string | null} matchedRule - Matching WRITING.md rule if any
 * @property {AnnotationTarget} target - Current target metadata
 * @property {any} targetSnapshot - Captured target descriptor
 * @property {'low' | 'medium' | 'high'} priority - Rationale priority
 * @property {any} resolution - Target resolution metadata
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} AppState
 * @property {string} filename - Name of the file being reviewed
 * @property {string} filePath - Full path to the file
 * @property {string} originalContent - Original content from file
 * @property {string} editedContent - Current edited content
 * @property {import('../utils/diff.js').DiffResult | null} diffResult - Computed diff
 * @property {AnnotationRecord[]} annotations - Saved annotation records
 * @property {string} generalNotes - Session-level notes
 * @property {Date} startTime - When the session started
 * @property {boolean} isDirty - Whether there are unsaved changes
 */

/** @type {import('svelte/store').Writable<string>} */
export const filename = writable('Untitled');

/** @type {import('svelte/store').Writable<string>} */
export const filePath = writable('');

/** @type {import('svelte/store').Writable<string>} */
export const originalContent = writable('');

/** @type {import('svelte/store').Writable<string>} */
export const editedContent = writable('');

/** Plain text extracted from rendered document - for accurate diffing */
/** @type {import('svelte/store').Writable<string>} */
export const originalPlainText = writable('');

/** @type {import('svelte/store').Writable<string>} */
export const editedPlainText = writable('');

/** Debounced copy of editedPlainText for expensive derived stores (diff, annotation resolution) */
/** @type {import('svelte/store').Writable<string>} */
export const debouncedEditedPlainText = writable('');

/** @type {ReturnType<typeof setTimeout> | null} */
let debounceTimer = null;
const DIFF_DEBOUNCE_MS = 120;

/** @type {import('svelte/store').Writable<AnnotationRecord[]>} */
export const annotations = writable([]);

/** @type {import('svelte/store').Writable<string>} */
export const generalNotes = writable('');

/** @type {import('svelte/store').Writable<Date>} */
export const startTime = writable(new Date());

/** @type {import('svelte/store').Writable<'loading' | 'reviewing' | 'finalizing' | 'degraded'>} */
export const reviewStatus = writable('loading');

/** @type {import('svelte/store').Writable<number>} */
export const documentEpoch = writable(0);

/** @type {import('svelte/store').Writable<number>} */
export const diffEpoch = writable(0);

/** @type {import('svelte/store').Writable<number>} */
export const renderEpoch = writable(0);

/** @type {import('svelte/store').Writable<'clean' | 'pending' | 'stale' | 'failed'>} */
export const diffStatus = writable('clean');

/** @type {import('svelte/store').Writable<Array<any>>} */
export const reviewTargets = writable([]);

/** @type {import('svelte/store').Writable<Record<string, any>>} */
export const rationaleDrafts = writable({});

/** @type {import('svelte/store').Writable<string | null>} */
export const selectedChangeId = writable(null);

/** @type {import('svelte/store').Writable<string | null>} */
export const selectedTargetId = writable(null);

/** @type {import('svelte/store').Writable<number | null>} */
export const currentLine = writable(1);

// Derived stores

/** @type {import('../utils/diff.js').DiffResult | null} */
let previousDiffSnapshot = null;
/** @type {string} */
let previousOriginalForSnapshot = '';
let nextDiffEpoch = 0;

/** Computed diff between original and edited PLAIN TEXT (what user sees) */
export const diffResult = derived(
  [originalPlainText, debouncedEditedPlainText, documentEpoch],
  ([$originalText, $editedText, $documentEpoch]) => {
    // Wait until both stores have content (avoid race condition during initialization)
    if (!$originalText || !$editedText) {
      previousDiffSnapshot = null;
      previousOriginalForSnapshot = '';
      return null;
    }

    if ($originalText !== previousOriginalForSnapshot) {
      previousDiffSnapshot = null;
      previousOriginalForSnapshot = $originalText;
    }

    if ($originalText === $editedText) {
      const epoch = nextDiffEpoch++;
      const empty = {
        ...createDiffSnapshot({
          epoch,
          documentEpoch: $documentEpoch,
          originalText: $originalText,
          editedText: $editedText,
          changes: [],
          groups: [],
        }),
        deletions: 0,
        insertions: 0,
        _originalText: $originalText,
        _editedText: $editedText,
      };
      previousDiffSnapshot = empty;
      diffEpoch.set(epoch);
      diffStatus.set('clean');
      return empty;
    }
    const next = computeDiff(
      $originalText,
      $editedText,
      previousDiffSnapshot?.changes || [],
      previousDiffSnapshot?._editedText || ''
    );
    const groups = createChangeGroups(next.changes, $editedText);
    const epoch = nextDiffEpoch++;
    const snapshot = {
      ...next,
      ...createDiffSnapshot({
        epoch,
        documentEpoch: $documentEpoch,
        originalText: $originalText,
        editedText: $editedText,
        changes: next.changes,
        groups,
      }),
      groups,
      _originalText: $originalText,
      _editedText: $editedText,
    };
    previousDiffSnapshot = snapshot;
    diffEpoch.set(epoch);
    diffStatus.set('clean');
    return snapshot;
  }
);

/** Whether the document has been modified */
export const hasChanges = derived(
  [originalContent, editedContent],
  ([$original, $edited]) => $original !== $edited
);

/** Diff changes that are actually rendered in the UI (non-whitespace) */
export const visibleChanges = derived(diffResult, ($diff) => {
  if (!$diff) return [];
  return $diff.changes.filter(isVisibleChange);
});

/** Substantive changes (visible minus trivial single-word edits) */
export const substantiveChanges = derived(visibleChanges, ($changes) => {
  return $changes.filter((change) => !isTrivialChange(change));
});

/** Count of trivial changes filtered from the rail */
export const trivialChangeCount = derived(visibleChanges, ($changes) => {
  return $changes.filter((change) => isTrivialChange(change)).length;
});

/** The trivial changes themselves (for expand view) */
export const trivialChanges = derived(visibleChanges, ($changes) => {
  return $changes.filter((change) => isTrivialChange(change));
});

/** Grouped changes for display */
export const changeGroups = derived(visibleChanges, ($changes) => {
  if (!$changes) return [];
  return createChangeGroups($changes, get(debouncedEditedPlainText) || '');
});

export const substantiveChangeGroups = derived(changeGroups, ($groups) => {
  return ($groups || []).filter((group) =>
    (group.changes || []).some((/** @type {any} */ change) => !isTrivialChange(change))
  );
});

/** Lines that have changes */
export const linesWithChanges = derived(visibleChanges, ($changes) => {
  if (!$changes) return new Set();
  return getLinesWithChanges($changes);
});

/** Summary text */
export const changeSummary = derived(diffResult, ($diff) => {
  if (!$diff) return 'No changes';
  return summarizeChanges($diff);
});

/** Selected change object */
export const selectedChange = derived(
  [visibleChanges, selectedChangeId],
  ([$changes, $selectedChangeId]) => {
    if (!$changes || !$selectedChangeId) return null;
    return $changes.find((change) => change.id === $selectedChangeId) || null;
  }
);

export const resolvedReviewTargets = derived(
  [reviewTargets, diffResult, debouncedEditedPlainText],
  ([$targets, $diff, $editedText]) => {
    return resolveReviewTargets($targets || [], $diff, $editedText || '');
  }
);

export const selectedTarget = derived(
  [resolvedReviewTargets, selectedTargetId],
  ([$targets, $selectedTargetId]) => {
    if (!$selectedTargetId) return null;
    return $targets.find((target) => target.id === $selectedTargetId) || null;
  }
);

/** Saved annotations resolved against the current diff */
export const resolvedAnnotations = derived(
  [annotations, diffResult, debouncedEditedPlainText, resolvedReviewTargets],
  ([$annotations, $diff, $editedText, $targets]) => {
    if (!$annotations || $annotations.length === 0) return [];
    return sortResolvedAnnotations(resolveAnnotations($annotations, $diff, $editedText || '', $targets));
  }
);

/** Annotation entries with stable display ordering */
export const annotationEntries = derived(resolvedAnnotations, ($entries) =>
  $entries.map((entry, index) => ({
    ...entry,
    displayIndex: index + 1,
  }))
);

/** Change ids that currently have an active saved annotation */
export const annotatedChangeIds = derived(annotationEntries, ($entries) => {
  const ids = new Set();
  for (const entry of $entries) {
    if (entry.status === 'active' && entry.change) {
      ids.add(entry.change.id);
    }
  }
  return ids;
});

export const annotatedTargetIds = derived(annotationEntries, ($entries) => {
  const ids = new Set();
  for (const entry of $entries) {
    if (entry.status === 'active' && entry.annotation?.targetId) {
      ids.add(entry.annotation.targetId);
    }
  }
  return ids;
});

/** Find the active annotation entry for the selected change */
export const selectedAnnotation = derived(
  [annotationEntries, selectedChangeId, selectedTargetId],
  ([$entries, $selectedChangeId, $selectedTargetId]) => {
    if (!$selectedChangeId && !$selectedTargetId) return null;
    return (
      $entries.find(
        (entry) =>
          entry.status === 'active' &&
          (($selectedTargetId && entry.annotation?.targetId === $selectedTargetId) ||
            (entry.change && entry.change.id === $selectedChangeId))
      ) || null
    );
  }
);

export const reviewSession = derived(
  [
    filename,
    filePath,
    originalContent,
    editedContent,
    originalPlainText,
    editedPlainText,
    diffResult,
    reviewTargets,
    annotations,
    rationaleDrafts,
    selectedChangeId,
    selectedTargetId,
    generalNotes,
    reviewStatus,
    documentEpoch,
    diffEpoch,
    renderEpoch,
    diffStatus,
  ],
  ([
    $filename,
    $filePath,
    $originalContent,
    $editedContent,
    $originalPlainText,
    $editedPlainText,
    $diffResult,
    $reviewTargets,
    $annotations,
    $rationaleDrafts,
    $selectedChangeId,
    $selectedTargetId,
    $generalNotes,
    $reviewStatus,
    $documentEpoch,
    $diffEpoch,
    $renderEpoch,
    $diffStatus,
  ]) => ({
    sessionId: '',
    status: $reviewStatus,
    documentEpoch: $documentEpoch,
    diffEpoch: $diffEpoch,
    renderEpoch: $renderEpoch,
    file: { path: $filePath, filename: $filename },
    original: {
      markdown: $originalContent,
      plainText: $originalPlainText,
    },
    current: {
      markdown: $editedContent,
      plainText: $editedPlainText,
    },
    diff: {
      status: $diffStatus,
      snapshot: $diffResult,
      previousStableSnapshot: previousDiffSnapshot,
    },
    reviewTargets: Object.fromEntries(($reviewTargets || []).map((target) => [target.id, target])),
    annotations: Object.fromEntries(($annotations || []).map((annotation) => [annotation.id, annotation])),
    rationaleDrafts: $rationaleDrafts,
    selection: {
      selectedTargetId: $selectedTargetId,
      selectedChangeId: $selectedChangeId,
      selectedAnnotationId: null,
    },
    generalNotes: $generalNotes,
  })
);

// Actions

/**
 * Initialize the app with file content
 * @param {string} path - File path
 * @param {string} content - File content (markdown)
 */
export function initializeWithContent(path, content) {
  const name = path.split('/').pop() || 'Untitled';
  const projectedPlainText = markdownToPlainText(content);
  previousDiffSnapshot = null;
  previousOriginalForSnapshot = projectedPlainText;
  nextDiffEpoch = 0;
  filename.set(name);
  filePath.set(path);
  originalContent.set(content);
  editedContent.set(content);
  originalPlainText.set(projectedPlainText);
  editedPlainText.set(projectedPlainText);
  debouncedEditedPlainText.set(projectedPlainText);
  annotations.set([]);
  reviewTargets.set([]);
  rationaleDrafts.set({});
  generalNotes.set('');
  startTime.set(new Date());
  reviewStatus.set('reviewing');
  documentEpoch.set(0);
  diffEpoch.set(0);
  renderEpoch.set(0);
  diffStatus.set('clean');
  selectedChangeId.set(null);
  selectedTargetId.set(null);
  currentLine.set(1);
}

/**
 * Restore state from a previously persisted session snapshot.
 * @param {any} snapshot
 */
export function restoreFromSnapshot(snapshot) {
  const saved = /** @type {any} */ (snapshot || {});
  const restoredFilePath = saved.filePath || '';
  const restoredFilename =
    saved.filename || restoredFilePath.split('/').pop() || 'Untitled';
  const restoredOriginal = saved.originalContent || '';
  const restoredEdited = saved.editedContent ?? restoredOriginal;
  const restoredOriginalPlain = markdownToPlainText(restoredOriginal) || saved.originalPlainText || '';
  const restoredEditedPlain =
    saved.editedPlainText || restoredOriginalPlain || '';

  /** @type {AnnotationRecord[]} */
  const restoredAnnotations = [];
  if (Array.isArray(saved.annotations)) {
    for (const entry of saved.annotations) {
      if (!entry) continue;
      if (entry.annotation && typeof entry.changeId === 'string') {
        restoredAnnotations.push(
          normalizeAnnotationRecord({
            id: entry.annotation.id || createAnnotationId(),
            rationale: entry.annotation.rationale || '',
            matchedRule: entry.annotation.writingMdRule || null,
            target: {
              changeId: entry.changeId,
              type: entry.annotation.type || null,
              excerpt: entry.annotation.excerpt || '',
              line: entry.annotation.line || null,
              beforeLine: '',
              lineText: '',
              afterLine: '',
              blockKey: '',
            },
            createdAt: saved.startedAt || new Date().toISOString(),
            updatedAt: saved.startedAt || new Date().toISOString(),
          })
        );
        continue;
      }
      if (entry.id && entry.target) {
        restoredAnnotations.push(normalizeAnnotationRecord(entry));
      }
    }
  }

  previousDiffSnapshot = null;
  previousOriginalForSnapshot = restoredOriginalPlain;
  nextDiffEpoch = Number.isFinite(saved.diffEpoch) ? saved.diffEpoch + 1 : 0;

  filename.set(restoredFilename);
  filePath.set(restoredFilePath);
  originalContent.set(restoredOriginal);
  editedContent.set(restoredEdited);
  originalPlainText.set(restoredOriginalPlain);
  editedPlainText.set(restoredEditedPlain);
  debouncedEditedPlainText.set(restoredEditedPlain);
  annotations.set(restoredAnnotations);
  reviewTargets.set(
    Array.isArray(saved.reviewTargets || saved.review_targets)
      ? (saved.reviewTargets || saved.review_targets)
      : []
  );
  rationaleDrafts.set(
    saved.rationaleDrafts && typeof saved.rationaleDrafts === 'object'
      ? saved.rationaleDrafts
      : saved.rationale_drafts && typeof saved.rationale_drafts === 'object'
        ? saved.rationale_drafts
        : {}
  );
  generalNotes.set(saved.generalNotes || '');
  startTime.set(saved.startedAt ? new Date(saved.startedAt) : new Date());
  reviewStatus.set('reviewing');
  documentEpoch.set(Number.isFinite(saved.documentEpoch) ? saved.documentEpoch : 0);
  diffEpoch.set(Number.isFinite(saved.diffEpoch) ? saved.diffEpoch : 0);
  renderEpoch.set(Number.isFinite(saved.renderEpoch) ? saved.renderEpoch : 0);
  diffStatus.set(saved.diffStatus || saved.diff_status || 'clean');
  selectedChangeId.set(
    typeof saved.selectedChangeId === 'string' && saved.selectedChangeId.length > 0
      ? saved.selectedChangeId
      : null
  );
  selectedTargetId.set(
    typeof saved.selectedTargetId === 'string' && saved.selectedTargetId.length > 0
      ? saved.selectedTargetId
      : typeof saved.selected_target_id === 'string' && saved.selected_target_id.length > 0
        ? saved.selected_target_id
        : null
  );
  currentLine.set(1);
}

/**
 * Set the original plain text (called after first render)
 * @param {string} text
 */
export function setOriginalPlainText(text) {
  previousDiffSnapshot = null;
  previousOriginalForSnapshot = text;
  nextDiffEpoch = 0;
  originalPlainText.set(text);
  editedPlainText.set(text);
  debouncedEditedPlainText.set(text);
  documentEpoch.set(0);
  diffEpoch.set(0);
  renderEpoch.set(0);
  diffStatus.set('clean');
}

/**
 * Update the edited plain text (called on each edit).
 * Sets editedPlainText immediately (editor needs it) and debounces
 * the expensive derived chain (diff, annotation resolution).
 * @param {string} text
 */
export function updatePlainText(text) {
  editedPlainText.set(text);
  documentEpoch.update((epoch) => epoch + 1);
  diffStatus.set('pending');
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedEditedPlainText.set(text);
  }, DIFF_DEBOUNCE_MS);
}

/**
 * Update the edited content
 * @param {string} content
 */
export function updateContent(content) {
  editedContent.set(content);
}

/**
 * Add a new annotation record
 * @param {AnnotationRecord} annotation
 */
export function addAnnotation(annotation) {
  annotations.update((records) => [...records, normalizeAnnotationRecord(annotation)]);
}

/**
 * Update an annotation record in place
 * @param {string} annotationId
 * @param {Partial<AnnotationRecord>} patch
 */
export function updateAnnotation(annotationId, patch) {
  annotations.update((records) =>
    records.map((record) =>
      record.id === annotationId
        ? normalizeAnnotationRecord({
            ...record,
            ...patch,
            target: patch?.target ? { ...record.target, ...patch.target } : record.target,
          })
        : record
    )
  );
}

/**
 * Remove an annotation
 * @param {string} annotationId
 */
export function removeAnnotation(annotationId) {
  annotations.update((records) => records.filter((record) => record.id !== annotationId));
}

/**
 * Update general notes
 * @param {string} notes
 */
export function updateGeneralNotes(notes) {
  generalNotes.set(notes);
}

/**
 * @param {any} target
 * @returns {any}
 */
function upsertReviewTarget(target) {
  if (!target?.id) return target;
  reviewTargets.update((targets) => {
    const existingIndex = targets.findIndex((candidate) => candidate.id === target.id);
    if (existingIndex < 0) return [...targets, target];
    return targets.map((candidate, index) => (index === existingIndex ? { ...candidate, ...target } : candidate));
  });
  return target;
}

/**
 * @param {any} group
 * @returns {any}
 */
export function ensureTargetForGroup(group) {
  if (!group) return null;
  const existing =
    get(resolvedReviewTargets).find(
      (target) =>
        target.kind === 'change_group' &&
        (group.changeIds || []).some((/** @type {string} */ changeId) => (target.changeIds || []).includes(changeId))
    ) || null;
  if (existing) {
    selectedTargetId.set(existing.id);
    return existing;
  }

  const target = createReviewTargetFromGroup(group, {
    editedText: get(debouncedEditedPlainText) || get(editedPlainText) || '',
    documentEpoch: get(documentEpoch),
  });
  upsertReviewTarget(target);
  selectedTargetId.set(target.id);
  return target;
}

/**
 * @param {import('../utils/diff.js').Change | null} change
 * @returns {any}
 */
export function ensureTargetForChange(change) {
  if (!change) return null;
  const existing = findTargetForChangeId(get(resolvedReviewTargets), change.id);
  if (existing) {
    selectedTargetId.set(existing.id);
    return existing;
  }
  const group =
    get(changeGroups).find((candidate) => (candidate.changeIds || []).includes(change.id)) || null;
  if (group) {
    return ensureTargetForGroup(group);
  }

  const target = createReviewTargetFromChange(change, {
    editedText: get(debouncedEditedPlainText) || get(editedPlainText) || '',
    documentEpoch: get(documentEpoch),
  });
  upsertReviewTarget(target);
  selectedTargetId.set(target.id);
  return target;
}

/**
 * @param {string} note
 * @returns {any}
 */
export function ensureGlobalTarget(note) {
  const existing = get(resolvedReviewTargets).find((target) => target.kind === 'global') || null;
  if (existing) return existing;
  const target = createGlobalReviewTarget({
    note,
    documentEpoch: get(documentEpoch),
  });
  upsertReviewTarget(target);
  return target;
}

/**
 * @param {string | null} targetId
 */
export function setSelectedTarget(targetId) {
  selectedTargetId.set(targetId || null);
}

/**
 * @param {string} targetId
 * @param {string} [initialText]
 * @returns {any}
 */
export function startRationaleForTarget(targetId, initialText = '') {
  const target = get(resolvedReviewTargets).find((candidate) => candidate.id === targetId) || null;
  if (!target) return null;
  const draft = createRationaleDraft({
    targetId,
    targetSnapshot: target.descriptor,
    documentEpoch: get(documentEpoch),
    text: initialText,
  });
  rationaleDrafts.update((drafts) => ({
    ...drafts,
    [draft.id]: draft,
  }));
  selectedTargetId.set(targetId);
  return draft;
}

/**
 * @param {string} draftId
 * @param {string} text
 */
export function updateRationaleDraftText(draftId, text) {
  rationaleDrafts.update((drafts) => {
    const draft = drafts[draftId];
    if (!draft) return drafts;
    return {
      ...drafts,
      [draftId]: {
        ...draft,
        text,
        updatedAt: new Date().toISOString(),
      },
    };
  });
}

/**
 * @param {string} draftId
 */
export function discardRationaleDraft(draftId) {
  rationaleDrafts.update((drafts) => {
    const { [draftId]: _discarded, ...rest } = drafts;
    return rest;
  });
}

export function markRenderCommitted() {
  renderEpoch.update((epoch) => epoch + 1);
}

/**
 * @param {'loading' | 'reviewing' | 'finalizing' | 'degraded'} status
 */
export function setReviewStatus(status) {
  reviewStatus.set(status);
}

/**
 * Select a change by stable diff ID.
 * @param {string | null} changeId
 */
export function setSelectedChange(changeId) {
  selectedChangeId.set(changeId || null);
  if (!changeId) {
    selectedTargetId.set(null);
    return;
  }
  const change = get(visibleChanges).find((candidate) => candidate.id === changeId) || null;
  if (change) {
    ensureTargetForChange(change);
  }
}

export function clearSelectedChange() {
  selectedChangeId.set(null);
  selectedTargetId.set(null);
}

/**
 * Reset the store to initial state
 */
export function reset() {
  previousDiffSnapshot = null;
  previousOriginalForSnapshot = '';
  nextDiffEpoch = 0;
  filename.set('Untitled');
  filePath.set('');
  originalContent.set('');
  editedContent.set('');
  originalPlainText.set('');
  editedPlainText.set('');
  debouncedEditedPlainText.set('');
  if (debounceTimer) clearTimeout(debounceTimer);
  annotations.set([]);
  reviewTargets.set([]);
  rationaleDrafts.set({});
  generalNotes.set('');
  startTime.set(new Date());
  reviewStatus.set('loading');
  documentEpoch.set(0);
  diffEpoch.set(0);
  renderEpoch.set(0);
  diffStatus.set('clean');
  selectedChangeId.set(null);
  selectedTargetId.set(null);
  currentLine.set(1);
}
