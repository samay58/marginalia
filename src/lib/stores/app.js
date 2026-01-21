import { writable, derived } from 'svelte/store';
import { computeDiff, groupChanges, getLinesWithChanges, summarizeChanges } from '../utils/diff.js';

/**
 * @typedef {Object} Annotation
 * @property {string[]} changeIds - IDs of changes this annotation applies to
 * @property {string} rationale - Short rationale text
 * @property {string} [category] - Category like "tone", "clarity", etc.
 * @property {string | null} [writingMdRule] - Matching WRITING.md rule if any
 * @property {boolean} [principleCandidate] - Whether this is a candidate for WRITING.md
 */

/**
 * @typedef {Object} AppState
 * @property {string} filename - Name of the file being reviewed
 * @property {string} filePath - Full path to the file
 * @property {string} originalContent - Original content from file
 * @property {string} editedContent - Current edited content
 * @property {import('../utils/diff.js').DiffResult | null} diffResult - Computed diff
 * @property {Map<string, Annotation>} annotations - Map of change ID to annotation
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

/** @type {import('svelte/store').Writable<Map<string, Annotation>>} */
export const annotations = writable(new Map());

/** @type {import('svelte/store').Writable<Array<{ label: string, pattern: string, flags: string }>>} */
export const slopMatchers = writable([]);

/** @type {import('svelte/store').Writable<string>} */
export const generalNotes = writable('');

/** @type {import('svelte/store').Writable<Date>} */
export const startTime = writable(new Date());

/** @type {import('svelte/store').Writable<number | null>} */
export const activeChangeId = writable(null);

/** @type {import('svelte/store').Writable<number | null>} */
export const currentLine = writable(1);

// Derived stores

/** Computed diff between original and edited PLAIN TEXT (what user sees) */
export const diffResult = derived(
  [originalPlainText, editedPlainText],
  ([$originalText, $editedText]) => {
    // Wait until both stores have content (avoid race condition during initialization)
    if (!$originalText || !$editedText) {
      return null;
    }
    if ($originalText === $editedText) {
      return { changes: [], deletions: 0, insertions: 0 };
    }
    return computeDiff($originalText, $editedText);
  }
);

/** Whether the document has been modified */
export const hasChanges = derived(
  [originalContent, editedContent],
  ([$original, $edited]) => $original !== $edited
);

/** Grouped changes for display */
export const changeGroups = derived(diffResult, ($diff) => {
  if (!$diff) return [];
  return groupChanges($diff.changes);
});

/** Lines that have changes */
export const linesWithChanges = derived(diffResult, ($diff) => {
  if (!$diff) return new Set();
  return getLinesWithChanges($diff.changes);
});

/** Summary text */
export const changeSummary = derived(diffResult, ($diff) => {
  if (!$diff) return 'No changes';
  return summarizeChanges($diff);
});

/** Lines that have annotations */
export const linesWithAnnotations = derived(
  [diffResult, annotations],
  ([$diff, $annotations]) => {
    if (!$diff) return new Set();
    const lines = new Set();
    for (const [changeId, annotation] of $annotations) {
      const change = $diff.changes.find((c) => c.id === changeId);
      if (change) {
        lines.add(change.location.line);
      }
    }
    return lines;
  }
);

/** Lines that violate WRITING.md bans */
export const linesWithSlop = derived(
  [originalPlainText, slopMatchers, hasChanges],
  ([$text, $matchers, $hasChanges]) => {
    if ($hasChanges) return new Set();
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
  filename.set(name);
  filePath.set(path);
  originalContent.set(content);
  editedContent.set(content);
  // Plain text will be set after editor renders
  originalPlainText.set('');
  editedPlainText.set('');
  annotations.set(new Map());
  generalNotes.set('');
  startTime.set(new Date());
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
 * Add or update an annotation for a change
 * @param {string} changeId
 * @param {Annotation} annotation
 */
export function setAnnotation(changeId, annotation) {
  annotations.update((map) => {
    const newMap = new Map(map);
    newMap.set(changeId, annotation);
    return newMap;
  });
}

/**
 * Remove an annotation
 * @param {string} changeId
 */
export function removeAnnotation(changeId) {
  annotations.update((map) => {
    const newMap = new Map(map);
    newMap.delete(changeId);
    return newMap;
  });
}

/**
 * Update general notes
 * @param {string} notes
 */
export function updateGeneralNotes(notes) {
  generalNotes.set(notes);
}

/**
 * Reset the store to initial state
 */
export function reset() {
  filename.set('Untitled');
  filePath.set('');
  originalContent.set('');
  editedContent.set('');
  originalPlainText.set('');
  editedPlainText.set('');
  annotations.set(new Map());
  generalNotes.set('');
  startTime.set(new Date());
  activeChangeId.set(null);
  currentLine.set(1);
}
