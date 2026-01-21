import { $prose } from '@milkdown/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { editorViewCtx } from '@milkdown/core';
import { buildTextMap } from './prosemirror-text.js';

const diffPluginKey = new PluginKey('marginalia-diff');

/**
 * Create a deletion widget (struck-through text)
 */
function createDeletionWidget(change, onClick) {
  const span = document.createElement('span');
  span.className = 'struck';
  span.textContent = change.text;
  span.setAttribute('contenteditable', 'false');
  span.dataset.changeId = change.id;
  span.dataset.changeText = change.text;
  span.dataset.changeType = 'deletion';

  return span;
}

/**
 * Create decorations from diff result
 * Verifies current doc text matches the diffed text to prevent misaligned widgets
 */
function createDiffDecorations(doc, diffResult, onClickChange) {
  if (!diffResult || !diffResult.changes || diffResult.changes.length === 0) {
    return DecorationSet.empty;
  }

  const textMap = buildTextMap(doc);
  const offsets = textMap.offsets;

  // Safety check: if current doc text doesn't match what was diffed,
  // return empty decorations (stale diff, will recompute on next cycle)
  if (diffResult._editedText && textMap.text !== diffResult._editedText) {
    return DecorationSet.empty;
  }
  const offsetToPos = (offset) => {
    // Return null for any invalid offset - widget will be skipped
    // With text verification above, this shouldn't happen, but it's a safety net
    if (!offsets || offsets.length === 0) return null;
    if (offset < 0) return null;
    if (offset >= offsets.length) return null;
    return offsets[offset];
  };

  const decorations = [];

  for (const change of diffResult.changes) {
    if (!change.text || change.text.trim().length === 0) {
      continue;
    }

    const docPos = offsetToPos(change.editedOffset);
    if (docPos === null) {
      continue;
    }

    if (change.type === 'deletion') {
      // Widget decoration - shows struck text at the position
      decorations.push(
        Decoration.widget(docPos, () => createDeletionWidget(change, onClickChange), {
          side: -1,
          key: change.id,
          ignoreSelection: true,
        })
      );
    } else if (change.type === 'insertion') {
      // Inline decoration - highlights the inserted text
      const endPos = offsetToPos(change.editedOffset + change.text.length);
      if (endPos !== null && endPos > docPos) {
        decorations.push(
          Decoration.inline(docPos, endPos, {
            class: 'added',
            'data-change-id': change.id,
            'data-change-text': change.text,
            'data-change-type': 'insertion',
          })
        );
      }
    }
  }

  return DecorationSet.create(doc, decorations);
}

let currentClickHandler = null;

/**
 * Create the diff decoration plugin
 */
export function createDiffPlugin(getDiffResult, onClickChange) {
  currentClickHandler = onClickChange;

  return $prose((ctx) => {
    return new Plugin({
      key: diffPluginKey,

      state: {
        init(_, state) {
          const diffResult = getDiffResult();
          return createDiffDecorations(state.doc, diffResult, currentClickHandler);
        },

        apply(tr, oldDecorations, oldState, newState) {
          if (tr.docChanged || tr.getMeta(diffPluginKey) === 'update') {
            const diffResult = getDiffResult();
            return createDiffDecorations(newState.doc, diffResult, currentClickHandler);
          }
          return oldDecorations.map(tr.mapping, tr.doc);
        },
      },

      props: {
        decorations(state) {
          return this.getState(state);
        },

        handleClick(view, pos, event) {
          const target = event.target;
          if (target instanceof HTMLElement && currentClickHandler) {
            const changeId = target.dataset.changeId;
            const changeText = target.dataset.changeText;

            if (changeId && changeText) {
              const rect = target.getBoundingClientRect();
              // Position popover to the right of the element
              currentClickHandler(changeId, changeText, rect.right + 8, rect.top);
              return true;
            }
          }
          return false;
        },
      },
    });
  });
}

/**
 * Trigger a diff update
 */
export function triggerDiffUpdate(editor) {
  try {
    const view = editor.ctx.get(editorViewCtx);
    if (view) {
      const tr = view.state.tr.setMeta(diffPluginKey, 'update');
      view.dispatch(tr);
    }
  } catch (e) {
    console.error('Failed to trigger diff update:', e);
  }
}

export default { createDiffPlugin, triggerDiffUpdate, diffPluginKey };
