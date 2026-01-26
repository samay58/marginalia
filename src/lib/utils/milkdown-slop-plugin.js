import { $prose } from '@milkdown/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import { editorViewCtx } from '@milkdown/core';
import { buildTextMap } from './prosemirror-text.js';

const slopPluginKey = new PluginKey('marginalia-slop');

/**
 * @typedef {{ label?: string, pattern: string, flags?: string, category?: string | null }} SlopMatcher
 */

/**
 * @param {import('@milkdown/prose/model').Node} doc
 * @param {SlopMatcher[]} matchers
 */
function createSlopDecorations(doc, matchers) {
  if (!matchers || matchers.length === 0) return DecorationSet.empty;

  const textMap = buildTextMap(doc);
  const text = textMap.text;
  const offsets = textMap.offsets;
  if (!text) return DecorationSet.empty;

  /** @param {number} offset */
  const offsetToPos = (offset) => {
    if (!offsets || offsets.length === 0) return doc.content.size;
    if (offset < 0) return null;
    if (offset >= offsets.length) return doc.content.size;
    return offsets[offset];
  };

  const decorations = [];

  for (const matcher of matchers) {
    if (!matcher?.pattern) continue;
    const regex = new RegExp(matcher.pattern, matcher.flags || '');
    for (const match of text.matchAll(regex)) {
      if (match.index === undefined) continue;
      const start = match.index;
      const end = start + match[0].length;
      const startPos = offsetToPos(start);
      const endPos = offsetToPos(end);
      if (startPos === null || endPos === null || endPos <= startPos) continue;
      decorations.push(
        Decoration.inline(startPos, endPos, {
          class: 'slop-violation',
          'data-violation': matcher.label,
        })
      );
    }
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * @param {() => SlopMatcher[]} getMatchers
 */
export function createSlopPlugin(getMatchers) {
  return $prose(() => {
    return new Plugin({
      key: slopPluginKey,
      state: {
        init(_, state) {
          const matchers = getMatchers();
          return createSlopDecorations(state.doc, matchers);
        },
        apply(tr, oldDecorations, oldState, newState) {
          if (tr.docChanged || tr.getMeta(slopPluginKey) === 'update') {
            const matchers = getMatchers();
            return createSlopDecorations(newState.doc, matchers);
          }
          return oldDecorations.map(tr.mapping, tr.doc);
        },
      },
      props: {
        decorations(state) {
          return this.getState(state);
        },
      },
    });
  });
}

/**
 * @param {import('@milkdown/core').Editor} editor
 */
export function triggerSlopUpdate(editor) {
  try {
    const view = editor.ctx.get(editorViewCtx);
    if (view) {
      const tr = view.state.tr.setMeta(slopPluginKey, 'update');
      view.dispatch(tr);
    }
  } catch (e) {
    console.error('Failed to trigger slop update:', e);
  }
}

export default { createSlopPlugin, triggerSlopUpdate, slopPluginKey };
