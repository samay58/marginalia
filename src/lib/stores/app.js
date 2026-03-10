import { writable, derived } from 'svelte/store';
import { computeDiff, groupChanges, getLinesWithChanges, summarizeChanges } from '../utils/diff.js';
import {
  createAnnotationId,
  isVisibleChange,
  normalizeAnnotationRecord,
  resolveAnnotations,
  sortResolvedAnnotations,
} from '../utils/annotations.js';

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
 * @property {string} rationale - Short rationale text
 * @property {string | null} matchedRule - Matching WRITING.md rule if any
 * @property {AnnotationTarget} target - Current target metadata
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

/** @type {import('svelte/store').Writable<AnnotationRecord[]>} */
export const annotations = writable([]);

/** @type {import('svelte/store').Writable<Array<{ label: string, pattern: string, flags: string }>>} */
export const slopMatchers = writable([]);

/** @type {import('svelte/store').Writable<string>} */
export const generalNotes = writable('');

/** @type {import('svelte/store').Writable<Date>} */
export const startTime = writable(new Date());

/** @type {import('svelte/store').Writable<string | null>} */
export const selectedChangeId = writable(null);

/** @type {import('svelte/store').Writable<number | null>} */
export const currentLine = writable(1);

// Derived stores

/** @type {import('../utils/diff.js').DiffResult | null} */
let previousDiffSnapshot = null;
/** @type {string} */
let previousOriginalForSnapshot = '';

/** Computed diff between original and edited PLAIN TEXT (what user sees) */
export const diffResult = derived(
  [originalPlainText, editedPlainText],
  ([$originalText, $editedText]) => {
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
      const empty = {
        changes: [],
        deletions: 0,
        insertions: 0,
        _originalText: $originalText,
        _editedText: $editedText,
      };
      previousDiffSnapshot = empty;
      return empty;
    }
    const next = computeDiff(
      $originalText,
      $editedText,
      previousDiffSnapshot?.changes || [],
      previousDiffSnapshot?._editedText || ''
    );
    previousDiffSnapshot = next;
    return next;
  }
);

/** Whether the document has been modified */
export const hasChanges = derived(
  [originalContent, editedContent],
  ([$original, $edited]) => $original !== $edited
);

/** Diff changes that are actually rendered in the UI */
export const visibleChanges = derived(diffResult, ($diff) => {
  if (!$diff) return [];
  return $diff.changes.filter(isVisibleChange);
});

/** Grouped changes for display */
export const changeGroups = derived(visibleChanges, ($changes) => {
  if (!$changes) return [];
  return groupChanges($changes);
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

/** Saved annotations resolved against the current diff */
export const resolvedAnnotations = derived(
  [annotations, diffResult, editedPlainText],
  ([$annotations, $diff, $editedText]) => {
    if (!$annotations || $annotations.length === 0) return [];
    return sortResolvedAnnotations(resolveAnnotations($annotations, $diff, $editedText || ''));
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

/** Find the active annotation entry for the selected change */
export const selectedAnnotation = derived(
  [annotationEntries, selectedChangeId],
  ([$entries, $selectedChangeId]) => {
    if (!$selectedChangeId) return null;
    return (
      $entries.find(
        (entry) =>
          entry.status === 'active' &&
          entry.change &&
          entry.change.id === $selectedChangeId
      ) || null
    );
  }
);

/** Lines that violate tone or WRITING.md bans */
export const linesWithSlop = derived(
  [editedPlainText, slopMatchers],
  ([$text, $matchers]) => {
    if (!$text || !$matchers || $matchers.length === 0) return new Set();
    const lines = $text.split(/\r?\n/);
    const result = new Set();
    const compiled = $matchers.map((matcher) => ({
      label: matcher.label,
      regex: new RegExp(matcher.pattern, matcher.flags),
    }));
    lines.forEach((line, index) => {
      for (const matcher of compiled) {
        if (!matcher?.regex) continue;
        matcher.regex.lastIndex = 0;
        if (matcher.regex.test(line)) {
          result.add(index + 1);
          break;
        }
      }
    });
    return result;
  }
);

// Actions

/**
 * Initialize the app with file content
 * @param {string} path - File path
 * @param {string} content - File content (markdown)
 */
export function initializeWithContent(path, content) {
  const name = path.split('/').pop() || 'Untitled';
  previousDiffSnapshot = null;
  previousOriginalForSnapshot = '';
  filename.set(name);
  filePath.set(path);
  originalContent.set(content);
  editedContent.set(content);
  // Plain text will be set after editor renders
  originalPlainText.set('');
  editedPlainText.set('');
  annotations.set([]);
  generalNotes.set('');
  startTime.set(new Date());
  selectedChangeId.set(null);
  currentLine.set(1);
}

/**
 * Restore state from a previously persisted session snapshot.
 * @param {object} snapshot
 * @param {string} snapshot.filePath
 * @param {string} [snapshot.filename]
 * @param {string} [snapshot.originalContent]
 * @param {string} [snapshot.editedContent]
 * @param {string} [snapshot.originalPlainText]
 * @param {string} [snapshot.editedPlainText]
 * @param {string} [snapshot.generalNotes]
 * @param {Array<any>} [snapshot.annotations]
 * @param {string} [snapshot.startedAt]
 * @param {string | null} [snapshot.selectedChangeId]
 */
export function restoreFromSnapshot(snapshot) {
  const restoredFilePath = snapshot.filePath || '';
  const restoredFilename =
    snapshot.filename || restoredFilePath.split('/').pop() || 'Untitled';
  const restoredOriginal = snapshot.originalContent || '';
  const restoredEdited = snapshot.editedContent ?? restoredOriginal;
  const restoredOriginalPlain = snapshot.originalPlainText || '';
  const restoredEditedPlain =
    snapshot.editedPlainText || restoredOriginalPlain || '';

  /** @type {AnnotationRecord[]} */
  const restoredAnnotations = [];
  if (Array.isArray(snapshot.annotations)) {
    for (const entry of snapshot.annotations) {
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
            createdAt: snapshot.startedAt || new Date().toISOString(),
            updatedAt: snapshot.startedAt || new Date().toISOString(),
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

  filename.set(restoredFilename);
  filePath.set(restoredFilePath);
  originalContent.set(restoredOriginal);
  editedContent.set(restoredEdited);
  originalPlainText.set(restoredOriginalPlain);
  editedPlainText.set(restoredEditedPlain);
  annotations.set(restoredAnnotations);
  generalNotes.set(snapshot.generalNotes || '');
  startTime.set(snapshot.startedAt ? new Date(snapshot.startedAt) : new Date());
  selectedChangeId.set(
    typeof snapshot.selectedChangeId === 'string' && snapshot.selectedChangeId.length > 0
      ? snapshot.selectedChangeId
      : null
  );
  currentLine.set(1);
}

/**
 * Set the original plain text (called after first render)
 * @param {string} text
 */
export function setOriginalPlainText(text) {
  originalPlainText.set(text);
  editedPlainText.set(text);
}

/**
 * Update the edited plain text (called on each edit)
 * @param {string} text
 */
export function updatePlainText(text) {
  editedPlainText.set(text);
}

/**
 * Update the edited content
 * @param {string} content
 */
export function updateContent(content) {
  editedContent.set(content);
}

/**
 * Update slop matchers used for WRITING.md violations
 * @param {Array<{ label: string, pattern: string, flags: string }>} matchers
 */
export function setSlopMatchers(matchers) {
  slopMatchers.set(matchers || []);
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
 * Select a change by stable diff ID.
 * @param {string | null} changeId
 */
export function setSelectedChange(changeId) {
  selectedChangeId.set(changeId || null);
}

export function clearSelectedChange() {
  selectedChangeId.set(null);
}

/**
 * Reset the store to initial state
 */
export function reset() {
  previousDiffSnapshot = null;
  previousOriginalForSnapshot = '';
  filename.set('Untitled');
  filePath.set('');
  originalContent.set('');
  editedContent.set('');
  originalPlainText.set('');
  editedPlainText.set('');
  annotations.set([]);
  generalNotes.set('');
  startTime.set(new Date());
  selectedChangeId.set(null);
  currentLine.set(1);
}
