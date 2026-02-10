import { $prose } from '@milkdown/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { editorViewCtx } from '@milkdown/core';
import { buildTextMap } from './prosemirror-text.js';

const diffPluginKey = new PluginKey('marginalia-diff');

/**
 * @typedef {import('./diff.js').Change} Change
 * @typedef {import('./diff.js').DiffResult} DiffResult
 * @typedef {{ text: string, offsets: number[] }} TextMap
 * @typedef {(changeId: string, text: string, x: number, y: number) => void} ChangeClickHandler
 */

/**
 * Create decorations from diff result
 * Verifies current doc text matches the diffed text to prevent misaligned ranges.
 * Deletions are intentionally not rendered inline to avoid cursor/selection traps.
 */
/**
 * @param {import('@milkdown/prose/model').Node} doc
 * @param {TextMap} textMap
 * @param {DiffResult | null} diffResult
 */
function createDiffDecorations(doc, textMap, diffResult) {
  if (!diffResult || !diffResult.changes || diffResult.changes.length === 0) {
    return DecorationSet.empty;
  }

  const offsets = textMap.offsets;
  const hasSnapshot = typeof diffResult._editedText === 'string';
  const isFresh = !hasSnapshot || textMap.text === diffResult._editedText;

  if (!isFresh) {
    return DecorationSet.empty;
  }

  /** @param {number} offset */
  const offsetToPos = (offset) => {
    // Return null for any invalid offset - widget will be skipped
    if (!offsets || offsets.length === 0) return null;
    if (offset < 0) return null;
    // offsets now has a sentinel at the end, so length is text.length + 1
    if (offset >= offsets.length) return null;
    return offsets[offset];
  };

  const decorations = [];

  for (const change of diffResult.changes) {
    // Skip whitespace-only changes to reduce noise
    if (!change.text || change.text.trim().length === 0) {
      continue;
    }

    const docPos = offsetToPos(change.editedOffset);
    if (docPos === null) {
      continue;
    }

    if (change.type === 'insertion') {
      // Inline decoration - highlights the inserted text
      // Use an exclusive end offset so we highlight the full insertion.
      // offsets[endOffset] maps to the position *after* the last inserted char.
      const endOffset = change.editedOffset + change.text.length;
      let endPos = offsetToPos(endOffset);

      if (endOffset > 0) {
        const lastCharPos = offsetToPos(endOffset - 1);
        if (lastCharPos !== null) {
          const minEndPos = lastCharPos + 1;
          if (endPos === null || endPos < minEndPos) {
            endPos = minEndPos;
          }
        }
      }

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

/** @type {ChangeClickHandler | null} */
let currentClickHandler = null;

/**
 * Create the diff decoration plugin
 */
/**
 * @param {() => DiffResult | null} getDiffResult
 * @param {ChangeClickHandler} onClickChange
 */
export function createDiffPlugin(getDiffResult, onClickChange) {
  currentClickHandler = onClickChange;

  return $prose((ctx) => {
    return new Plugin({
      key: diffPluginKey,

      state: {
        init(_, state) {
          const diffResult = getDiffResult();
          const textMap = buildTextMap(state.doc);
          return createDiffDecorations(state.doc, textMap, diffResult);
        },

        apply(tr, oldDecorations, oldState, newState) {
          if (tr.docChanged || tr.getMeta(diffPluginKey) === 'update') {
            const diffResult = getDiffResult();
            if (!diffResult || !diffResult.changes) {
              return DecorationSet.empty;
            }
            if (diffResult.changes.length === 0) {
              return DecorationSet.empty;
            }
            const textMap = buildTextMap(newState.doc);
            return createDiffDecorations(newState.doc, textMap, diffResult);
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
            const changeEl = target.closest('[data-change-id]');
            if (!(changeEl instanceof HTMLElement)) {
              return false;
            }
            const changeId = changeEl.dataset?.changeId;
            const changeText = changeEl.dataset?.changeText;

            if (changeId && changeText) {
              const rect = changeEl.getBoundingClientRect();
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
/**
 * @param {import('@milkdown/core').Editor} editor
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
