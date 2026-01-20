import { Decoration, DecorationSet, ViewPlugin, WidgetType } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';

/**
 * @typedef {Object} DecorationRange
 * @property {number} from - Start position
 * @property {number} to - End position
 * @property {'struck' | 'added'} type - Decoration type
 * @property {string} [changeId] - Associated change ID
 */

// Effect to update decorations
export const setDecorations = StateEffect.define();

// Decoration marks
const struckMark = Decoration.mark({ class: 'cm-struck' });
const addedMark = Decoration.mark({ class: 'cm-added' });

/**
 * State field that holds the diff decorations
 */
export const diffDecorations = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setDecorations)) {
        decorations = buildDecorations(effect.value, tr.state.doc);
      }
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Build decoration set from ranges
 * @param {DecorationRange[]} ranges
 * @param {import('@codemirror/state').Text} doc
 * @returns {DecorationSet}
 */
function buildDecorations(ranges, doc) {
  const builder = new RangeSetBuilder();

  // Sort ranges by position
  const sorted = [...ranges].sort((a, b) => a.from - b.from);

  for (const range of sorted) {
    // Clamp to document bounds
    const from = Math.max(0, Math.min(range.from, doc.length));
    const to = Math.max(from, Math.min(range.to, doc.length));

    if (from < to) {
      const mark = range.type === 'struck' ? struckMark : addedMark;
      builder.add(from, to, mark);
    }
  }

  return builder.finish();
}

/**
 * Widget for showing deleted text inline (strikethrough)
 */
class DeletedTextWidget extends WidgetType {
  constructor(text) {
    super();
    this.text = text;
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-struck cm-deleted-widget';
    span.textContent = this.text;
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Create a widget decoration for deleted text
 * @param {number} pos - Position to insert the widget
 * @param {string} text - Deleted text to show
 * @returns {Decoration}
 */
export function deletedTextWidget(pos, text) {
  return Decoration.widget({
    widget: new DeletedTextWidget(text),
    side: -1, // Before the cursor position
  });
}

/**
 * Convert diff changes to decoration ranges for the edited document
 * This is the key function that maps changes to editor positions
 *
 * @param {string} original - Original text
 * @param {string} edited - Edited text (current editor content)
 * @param {import('./diff.js').Change[]} changes - Diff changes
 * @returns {DecorationRange[]}
 */
export function changesToDecorations(original, edited, changes) {
  /** @type {DecorationRange[]} */
  const decorations = [];

  // We need to map positions from original to edited
  // For now, we'll use a simpler approach: scan through the diffs
  // and compute positions in the edited document

  let editedPos = 0;
  let originalPos = 0;

  // This is a simplified implementation that works for contiguous changes
  // For a full implementation, we'd need to track positions more carefully

  for (const change of changes) {
    if (change.type === 'deletion') {
      // Deletions appear as strikethrough text inserted at the edit position
      // We'll need a widget for this in the full implementation
      // For now, skip deletions (they're shown as widgets)
    } else if (change.type === 'insertion') {
      // Find the insertion in the edited text
      const text = change.text;
      const searchStart = Math.max(0, editedPos - 50);
      const idx = edited.indexOf(text, searchStart);

      if (idx !== -1) {
        decorations.push({
          from: idx,
          to: idx + text.length,
          type: 'added',
          changeId: change.id,
        });
      }
    }
  }

  return decorations;
}

/**
 * Create an extension that provides the diff decorations functionality
 */
export function diffDecorationsExtension() {
  return diffDecorations;
}

// Need to import EditorView for the provide function
import { EditorView } from '@codemirror/view';
