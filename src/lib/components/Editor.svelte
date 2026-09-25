<script>
  import { onMount, onDestroy } from 'svelte';
  import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
  import { commonmark } from '@milkdown/preset-commonmark';
  import { listener, listenerCtx } from '@milkdown/plugin-listener';
  import * as milkdownUtils from '@milkdown/utils';
  import { createDiffPlugin, triggerDiffUpdate } from '../utils/milkdown-diff-plugin.js';
  import { historyKeymapPlugin, historyPlugin } from '../utils/milkdown-history-plugin.js';
  import { undo as undoCommand } from '@milkdown/prose/history';
  import { buildTextMap } from '../utils/prosemirror-text.js';
  import { summarizeText } from '../utils/text.js';

  /** @typedef {{ annotationId: string, changeId: string, displayIndex: number, top: number, selected: boolean, preview: string }} AnchorMark */

  /** @type {{ initialContent?: string, diffResult?: any, annotationEntries?: any[], selectedAnnotationId?: string | null, selectedChangeId?: string | null, onChange?: (content: string) => void, onPlainTextChange?: (text: string) => void, onInitialRender?: (text: string) => void, onLineChange?: (lineNumber: number) => void, getDiffResult?: () => any, onClickChange?: (changeId: string, text: string, x: number, y: number) => void, onSelectAnchor?: (annotationId: string, x: number, y: number) => void, onScroll?: (scrollTop: number) => void, onRuntimeError?: (code: string, detail: string) => void }} */
  let {
    initialContent = '',
    diffResult = null,
    annotationEntries = [],
    selectedAnnotationId = null,
    selectedChangeId = null,
    onChange = () => {},
    onPlainTextChange = () => {},
    onInitialRender = () => {},
    onLineChange = () => {},
    getDiffResult = () => null,
    onClickChange = () => {},
    onSelectAnchor = () => {},
    onScroll = () => {},
    onRuntimeError = () => {},
  } = $props();

  /**
   * @param {string} code
   * @param {unknown} error
   */
  function reportRuntimeError(code, error) {
    const detail = error instanceof Error ? error.message : String(error);
    onRuntimeError(code, detail);
  }

  /** @type {HTMLDivElement | null} */
  let editorRoot = $state(null);
  /** @type {HTMLDivElement | null} */
  let editorShell = $state(null);
  /** @type {HTMLDivElement | null} */
  let editorFrame = $state(null);

  /** @type {Editor | null} */
  let editor = $state(null);
  /** @type {AnchorMark[]} */
  let anchorMarks = $state([]);
  let isReady = $state(false);
  let isInternalUpdate = false;
  let lastKnownContent = '';
  let hasCalledInitialRender = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let diffUpdateTimeout = null;
  /** @type {ResizeObserver | null} */
  let resizeObserver = null;
  let anchorRefreshHandle = 0;
  const DIFF_DEBOUNCE_MS = 150;

  function getEditorView() {
    if (!editor || !isReady) return null;
    try {
      return editor.ctx.get(editorViewCtx);
    } catch (error) {
      reportRuntimeError('editor_view_unavailable', error);
      return null;
    }
  }

  function getCurrentPlainText() {
    const view = getEditorView();
    if (!view) return '';
    try {
      return buildTextMap(view.state.doc).text;
    } catch (error) {
      reportRuntimeError('editor_plain_text_extract_failed', error);
      return '';
    }
  }

  function queueAnchorRefresh() {
    if (typeof window === 'undefined') return;
    if (anchorRefreshHandle) {
      window.cancelAnimationFrame(anchorRefreshHandle);
    }
    anchorRefreshHandle = window.requestAnimationFrame(() => {
      anchorRefreshHandle = 0;
      refreshAnchors();
    });
  }

  /**
   * @param {number} pos
   * @param {import('@milkdown/prose/view').EditorView} view
   */
  function resolveBlockAnchor(pos, view) {
    const boundedPos = Math.max(1, Math.min(pos, view.state.doc.content.size));
    const resolved = view.domAtPos(boundedPos);
    const element =
      resolved.node instanceof Text
        ? resolved.node.parentElement
        : resolved.node instanceof HTMLElement
          ? resolved.node
          : null;

    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const blockElement = element.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, hr');
    if (!(blockElement instanceof HTMLElement)) {
      return null;
    }

    const resolvedPos = view.state.doc.resolve(boundedPos);
    let blockStart = boundedPos;
    for (let depth = resolvedPos.depth; depth >= 0; depth--) {
      const node = resolvedPos.node(depth);
      if (!node?.isTextblock) continue;
      blockStart = resolvedPos.start(depth);
      break;
    }

    return {
      blockElement,
      blockKey: `pm:${blockStart}`,
    };
  }

  /** @param {string} text */
  function summarize(text) {
    return summarizeText(text, 28);
  }

  function refreshAnchors() {
    const view = getEditorView();
    if (!view || !editorShell || !editorFrame || !annotationEntries?.length) {
      anchorMarks = [];
      return;
    }

    try {
      const textMap = buildTextMap(view.state.doc);
      if (diffResult?._editedText && textMap.text !== diffResult._editedText) {
        // Keep the last stable anchors while the debounced diff catches up.
        return;
      }

      /** @type {Map<string, { top: number, marks: AnchorMark[] }>} */
      const groups = new Map();
      const frameRect = editorFrame.getBoundingClientRect();
      const offsets = textMap.offsets;
      const activeEntries = [...annotationEntries]
        .filter((entry) => entry.status === 'active' && entry.change)
        .sort((left, right) => left.change.editedOffset - right.change.editedOffset);

      for (const entry of activeEntries) {
        const change = entry.change;
        const offsetIndex = Math.max(0, Math.min(change.editedOffset, offsets.length - 1));
        const docPos = offsets[offsetIndex];
        if (typeof docPos !== 'number') continue;

        const block = resolveBlockAnchor(docPos, view);
        if (!block) continue;

        const rect = block.blockElement.getBoundingClientRect();
        const top = rect.top - frameRect.top + editorShell.scrollTop;
        const existing = groups.get(block.blockKey);
        const mark = {
          annotationId: entry.annotation.id,
          changeId: change.id,
          displayIndex: entry.displayIndex,
          top,
          selected: selectedAnnotationId === entry.annotation.id,
          preview: summarize(change.text),
        };

        if (existing) {
          existing.marks.push(mark);
          continue;
        }

        groups.set(block.blockKey, {
          top,
          marks: [mark],
        });
      }

      anchorMarks = [...groups.values()]
        .sort((left, right) => left.top - right.top)
        .flatMap((group) =>
          group.marks.map((mark, index) => ({
            ...mark,
            top: group.top + index * 18,
          }))
        );
    } catch (error) {
      reportRuntimeError('editor_anchor_refresh_failed', error);
      anchorMarks = [];
    }
  }

  function setupObservers() {
    if (typeof ResizeObserver === 'undefined') return;
    resizeObserver = new ResizeObserver(() => {
      queueAnchorRefresh();
    });
    if (editorFrame) resizeObserver.observe(editorFrame);
    if (editorShell) resizeObserver.observe(editorShell);
  }

  /**
   * @param {string} initialContent
   */
  async function initEditor(initialContent) {
    if (!editorRoot) return;

    try {
      editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, editorRoot);
          ctx.set(defaultValueCtx, initialContent || '');

          const listenerManager = ctx.get(listenerCtx);
          listenerManager.markdownUpdated((ctx, markdown) => {
            if (!isInternalUpdate && markdown !== lastKnownContent) {
              lastKnownContent = markdown;
              onChange(markdown);

              const plainText = getCurrentPlainText();
              onPlainTextChange(plainText);

              if (diffUpdateTimeout) {
                clearTimeout(diffUpdateTimeout);
              }
              diffUpdateTimeout = setTimeout(() => {
                if (editor) {
                  try {
                    triggerDiffUpdate(editor);
                    queueAnchorRefresh();
                  } catch (error) {
                    reportRuntimeError('editor_diff_refresh_failed', error);
                  }
                }
              }, DIFF_DEBOUNCE_MS);
            }
          });
        })
        .use(commonmark)
        .use(historyPlugin)
        .use(historyKeymapPlugin)
        .use(listener)
        .use(createDiffPlugin(getDiffResult, onClickChange, () => selectedChangeId))
        .create();

      isReady = true;
      lastKnownContent = initialContent;
      setupObservers();

      setTimeout(() => {
        if (!hasCalledInitialRender) {
          const plainText = getCurrentPlainText();
          if (plainText) {
            hasCalledInitialRender = true;
            onInitialRender(plainText);
          }
          queueAnchorRefresh();
        }
      }, 50);

      editorRoot.addEventListener('click', updateLineNumber, { passive: true });
      editorRoot.addEventListener('keyup', updateLineNumber, { passive: true });
    } catch (error) {
      reportRuntimeError('editor_init_failed', error);
    }
  }

  function updateLineNumber() {
    const view = getEditorView();
    if (!view) return;
    try {
      const pos = view.state.selection.anchor;
      const doc = view.state.doc;
      let line = 1;
      doc.descendants((node, nodePos) => {
        if (nodePos >= pos) return false;
        if (node.isTextblock) line++;
        return true;
      });
      onLineChange(Math.max(1, line));
    } catch (error) {
      reportRuntimeError('editor_line_tracking_failed', error);
    }
  }

  /** @param {Event & { currentTarget: HTMLElement }} event */
  function handleScroll(event) {
    onScroll(event.currentTarget.scrollTop);
  }

  function getLineHeightPx() {
    if (typeof window === 'undefined') return 0;
    const rootStyle = getComputedStyle(document.documentElement);
    const raw = rootStyle.getPropertyValue('--line-height').trim();
    const rootFontSize = parseFloat(rootStyle.fontSize) || 16;
    if (raw.endsWith('rem')) {
      return parseFloat(raw) * rootFontSize;
    }
    if (raw.endsWith('px')) {
      return parseFloat(raw);
    }
    const parsed = parseFloat(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  onMount(() => {
    if (initialContent) {
      initEditor(initialContent);
    }
  });

  onDestroy(() => {
    if (diffUpdateTimeout) {
      clearTimeout(diffUpdateTimeout);
    }
    if (anchorRefreshHandle && typeof window !== 'undefined') {
      window.cancelAnimationFrame(anchorRefreshHandle);
    }
    resizeObserver?.disconnect();
    if (editorRoot) {
      editorRoot.removeEventListener('click', updateLineNumber);
      editorRoot.removeEventListener('keyup', updateLineNumber);
    }
    editor?.destroy();
  });

  // Initialize editor if initialContent arrives after mount (async file load)
  $effect(() => {
    if (!isReady && initialContent && editorRoot) {
      initEditor(initialContent);
    }
  });

  // Refresh decorations when the selected change moves.
  $effect(() => {
    selectedChangeId;
    if (isReady) {
      try {
        if (editor) {
          triggerDiffUpdate(editor);
        }
      } catch (error) {
        reportRuntimeError('editor_diff_refresh_failed', error);
      }
      queueAnchorRefresh();
    }
  });

  $effect(() => {
    annotationEntries;
    selectedAnnotationId;
    if (isReady) {
      queueAnchorRefresh();
    }
  });

  export function getContent() {
    if (!editor || !isReady) return '';
    try {
      return editor.action(milkdownUtils.getMarkdown());
    } catch (error) {
      reportRuntimeError('editor_markdown_read_failed', error);
      return '';
    }
  }

  export function focus() {
    const view = getEditorView();
    view?.focus();
  }

  export function undo() {
    const view = getEditorView();
    if (!view) return;
    undoCommand(view.state, view.dispatch);
    view.focus();
  }

  export function refreshDiff() {
    if (!editor || !isReady) return;
    try {
      triggerDiffUpdate(editor);
      queueAnchorRefresh();
    } catch (error) {
      reportRuntimeError('editor_diff_refresh_failed', error);
    }
  }

  /** @param {string} newContent */
  export function setContent(newContent) {
    if (!editor || !isReady) return;
    try {
      isInternalUpdate = true;
      editor.action(milkdownUtils.replaceAll(newContent));
      lastKnownContent = newContent;
      const plainText = getCurrentPlainText();
      if (plainText) {
        onPlainTextChange(plainText);
        onInitialRender(plainText);
      }
    } catch (error) {
      reportRuntimeError('editor_external_sync_failed', error);
    } finally {
      isInternalUpdate = false;
    }
    try {
      triggerDiffUpdate(editor);
      queueAnchorRefresh();
    } catch (error) {
      reportRuntimeError('editor_diff_refresh_failed', error);
    }
  }

  /** @param {number} scrollTop */
  export function setScrollTop(scrollTop) {
    if (!editorShell) return;
    if (Math.abs(editorShell.scrollTop - scrollTop) < 1) return;
    editorShell.scrollTop = scrollTop;
  }

  /** @param {number} lineNumber */
  export function scrollToLine(lineNumber) {
    if (!editorShell) return;
    const lineHeight = getLineHeightPx() || 28;
    const targetTop = Math.max(0, Math.round((lineNumber - 1) * lineHeight));
    editorShell.scrollTo({ top: targetTop, behavior: 'auto' });
  }

  /** @param {string} changeId */
  export function scrollToChange(changeId) {
    if (!editorShell || !changeId) return;
    const mark = anchorMarks.find((item) => item.changeId === changeId);
    if (mark) {
      editorShell.scrollTo({
        top: Math.max(0, Math.round(mark.top - 96)),
        behavior: 'auto',
      });
      return;
    }
    const change = diffResult?.changes?.find(
      /** @param {import('../utils/diff.js').Change} item */
      (item) => item.id === changeId
    );
    if (change) {
      scrollToLine(change.location.line);
    }
  }

  /**
   * @param {AnchorMark} mark
   * @param {MouseEvent} event
   */
  function handleAnchorClick(mark, event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    onSelectAnchor(mark.annotationId, rect.right + 8, rect.top);
  }
</script>

<div
  class="manuscript-host"
  bind:this={editorShell}
  onscroll={handleScroll}
>
  <div class="editor-frame" bind:this={editorFrame}>
    <div class="anchor-layer" aria-hidden="true">
      {#each anchorMarks as mark (mark.annotationId)}
        <div
          class="anchor-mark"
          style={`top:${mark.top}px;`}
        >
          <button
            type="button"
            class="anchor-hit"
            class:selected={mark.selected}
            onclick={(event) => handleAnchorClick(mark, event)}
            aria-label={`Jump to note ${mark.displayIndex}`}
          >
            <span class="anchor-badge">{mark.displayIndex}</span>
          </button>
        </div>
      {/each}
    </div>

    <div class="editor-surface">
      <div class="editor-root" bind:this={editorRoot}></div>
    </div>
  </div>
</div>

<style>
  .manuscript-host {
    flex: 1;
    width: 100%;
    min-width: 0;
    background: var(--canvas);
    padding: var(--space-12) var(--space-12) 96px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .editor-frame {
    position: relative;
    max-width: calc(var(--measure) + var(--gutter-width));
    margin: 0 auto;
  }

  .editor-surface {
    margin-left: var(--gutter-width);
    min-height: 100%;
  }

  .editor-root {
    min-height: 100%;
  }

  .anchor-layer {
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--gutter-width);
    overflow: visible;
    pointer-events: none;
  }

  .anchor-mark {
    position: absolute;
    left: 0;
    right: 0;
    height: 1.5rem;
    overflow: visible;
  }

  .anchor-hit {
    position: absolute;
    right: var(--space-3);
    top: 0.2rem;
    height: 1.25rem;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    pointer-events: auto;
    overflow: visible;
    border-radius: var(--radius-sm);
  }

  .anchor-hit:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .anchor-badge {
    min-width: max(1.25rem, 2ch);
    height: 1.25rem;
    padding: 0 0.3rem;
    border-radius: var(--radius-sm);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--accent-soft);
    color: var(--accent);
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    white-space: nowrap;
    transition: background-color var(--transition-fast), color var(--transition-fast);
  }

  .anchor-hit:hover .anchor-badge,
  .anchor-hit.selected .anchor-badge {
    background: var(--accent);
    color: var(--on-accent);
  }

  .editor-root :global(.milkdown),
  .editor-root :global(.milkdown .ProseMirror) {
    width: 100%;
    min-width: 0;
    min-height: 100%;
    font-family: var(--font-sans);
    font-size: var(--text-manuscript);
    line-height: var(--line-height);
    color: var(--ink);
    outline: none;
  }

  .editor-root :global(.milkdown .ProseMirror:focus) {
    outline: none;
  }

  .editor-root :global(.milkdown h1) {
    font-size: 30px;
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin: 0 0 var(--space-6);
  }

  .editor-root :global(.milkdown h2) {
    font-size: 22px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.015em;
    margin: var(--space-10) 0 var(--space-3);
  }

  .editor-root :global(.milkdown h3) {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.3;
    margin: var(--space-8) 0 var(--space-2);
  }

  .editor-root :global(.milkdown p) {
    margin: 0 0 1em;
  }

  .editor-root :global(.milkdown ul),
  .editor-root :global(.milkdown ol) {
    margin: 0 0 1em;
    padding-left: 1.5em;
  }

  .editor-root :global(.milkdown li) {
    margin: var(--space-1) 0;
  }

  .editor-root :global(.milkdown li p) {
    margin: 0;
  }

  .editor-root :global(.milkdown li::marker) {
    color: var(--ink-3);
  }

  .editor-root :global(.milkdown strong) {
    font-weight: 600;
  }

  .editor-root :global(.milkdown code) {
    font-family: var(--font-code);
    font-size: 0.88em;
    background: var(--hover);
    padding: 0.1em 0.3em;
    border-radius: 4px;
  }

  .editor-root :global(.milkdown pre) {
    background: var(--hover);
    padding: var(--space-4);
    border-radius: var(--radius);
    overflow-x: auto;
    margin: 0 0 1em;
  }

  .editor-root :global(.milkdown pre code) {
    background: none;
    padding: 0;
  }

  .editor-root :global(.milkdown blockquote) {
    border-left: 2px solid var(--rule-2);
    padding-left: var(--space-4);
    margin: 0 0 1em;
    color: var(--ink-2);
  }

  .editor-root :global(.milkdown a) {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: var(--insert-line);
    text-underline-offset: 2px;
  }

  .editor-root :global(.milkdown hr) {
    border: none;
    border-top: 1px solid var(--rule-2);
    margin: var(--space-10) 0;
  }

  .editor-root :global(.milkdown ::selection) {
    background: var(--accent-soft);
  }

  /* Revision marks. Insertions stay editable text; deletions are read-only widgets. */
  .editor-root :global(.added) {
    color: var(--insert-ink);
    background: var(--insert-bg);
    box-shadow: inset 0 -1.5px 0 var(--insert-line);
    border-radius: 2px;
    white-space: pre-wrap;
    transition: background-color var(--transition-fast);
  }

  .editor-root :global(.added.selected) {
    background: var(--selected-bg);
  }

  .editor-root :global(.struck) {
    display: inline;
    white-space: pre-wrap;
    cursor: pointer;
    user-select: none;
    color: var(--delete-ink);
    text-decoration: line-through;
    text-decoration-color: var(--delete-line);
    text-decoration-thickness: 1.5px;
    text-decoration-skip-ink: none;
    border-radius: 2px;
    padding: 0 0.1em;
    transition: background-color var(--transition-fast);
  }

  .editor-root :global(.struck:hover) {
    background: var(--hover);
  }

  .editor-root :global(.struck.selected) {
    background: var(--selected-bg);
  }

  .editor-root :global(.struck:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
