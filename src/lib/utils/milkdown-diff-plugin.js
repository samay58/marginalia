import { $prose } from '@milkdown/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { editorViewCtx } from '@milkdown/core';

const diffPluginKey = new PluginKey('marginalia-diff');

/**
 * Convert plain text offset to ProseMirror document position
 * @param {import('@milkdown/prose/model').Node} doc
 * @param {number} textOffset - Offset in plain text
 * @returns {number | null} - Position in ProseMirror doc
 */
function textOffsetToDocPos(doc, textOffset) {
  let currentOffset = 0;
  let result = null;

  doc.descendants((node, pos) => {
    if (result !== null) return false;

    if (node.isText && node.text) {
      const nodeEnd = currentOffset + node.text.length;
      if (textOffset >= currentOffset && textOffset <= nodeEnd) {
        result = pos + (textOffset - currentOffset);
        return false;
      }
      currentOffset = nodeEnd;
    } else if (node.isBlock && currentOffset > 0) {
      // Block boundaries count as newlines in plain text
      currentOffset += 1;
      if (textOffset < currentOffset) {
        result = pos;
        return false;
      }
    }
    return true;
  });

  // If we hit the end, return end of doc
  if (result === null && textOffset >= currentOffset) {
    result = doc.content.size;
  }

  // Safety check: ensure result is within document bounds
  if (result !== null && (result < 0 || result > doc.content.size)) {
    return null;
  }

  return result;
}

/**
 * Create a deletion widget (struck-through text)
 */
function createDeletionWidget(change, onClick) {
  const span = document.createElement('span');
  span.className = 'struck';
  span.textContent = change.text;
  span.dataset.changeId = change.id;
  span.dataset.changeText = change.text;
  span.dataset.changeType = 'deletion';

  span.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = span.getBoundingClientRect();
    onClick(change.id, change.text, rect.right + 8, rect.top);
  });

  return span;
}

/**
 * Create decorations from diff result
 */
function createDiffDecorations(doc, diffResult, onClickChange) {
  if (!diffResult || !diffResult.changes || diffResult.changes.length === 0) {
    return DecorationSet.empty;
  }

  const decorations = [];

  for (const change of diffResult.changes) {
    if (!change.text || change.text.trim().length === 0) {
      continue;
    }

    const docPos = textOffsetToDocPos(doc, change.editedOffset);
    if (docPos === null) {
      continue;
    }

    if (change.type === 'deletion') {
      // Widget decoration - shows struck text at the position
      decorations.push(
        Decoration.widget(docPos, () => createDeletionWidget(change, onClickChange), {
          side: -1,
          key: change.id,
        })
      );
    } else if (change.type === 'insertion') {
      // Inline decoration - highlights the inserted text
      const endPos = textOffsetToDocPos(doc, change.editedOffset + change.text.length);
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
