<script>
  import { onMount, onDestroy } from 'svelte';
  import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
  import { commonmark } from '@milkdown/preset-commonmark';
  import { listener, listenerCtx } from '@milkdown/plugin-listener';
  import * as milkdownUtils from '@milkdown/utils';
  import { createDiffPlugin, triggerDiffUpdate } from '../utils/milkdown-diff-plugin.js';
  import { historyKeymapPlugin, historyPlugin } from '../utils/milkdown-history-plugin.js';
  import { createSlopPlugin, triggerSlopUpdate } from '../utils/milkdown-slop-plugin.js';
  import { buildTextMap } from '../utils/prosemirror-text.js';
  import { summarizeText } from '../utils/text.js';

  /** @typedef {{ annotationId: string, changeId: string, displayIndex: number, top: number, selected: boolean, preview: string }} AnchorMark */

  /** @type {{ content?: string, diffResult?: any, annotationEntries?: any[], selectedAnnotationId?: string | null, slopLines?: Set<number>, selectedChangeId?: string | null, densityMode?: 'review' | 'manuscript', onChange?: (content: string) => void, onPlainTextChange?: (text: string) => void, onInitialRender?: (text: string) => void, onLineChange?: (lineNumber: number) => void, getDiffResult?: () => any, onClickChange?: (changeId: string, text: string, x: number, y: number) => void, onSelectAnchor?: (annotationId: string, x: number, y: number) => void, onScroll?: (scrollTop: number) => void, getSlopMatchers?: () => any[], onRuntimeError?: (code: string, detail: string) => void }} */
  let {
    content = '',
    diffResult = null,
    annotationEntries = [],
    selectedAnnotationId = null,
    slopLines = new Set(),
    selectedChangeId = null,
    densityMode = 'manuscript',
    onChange = () => {},
    onPlainTextChange = () => {},
    onInitialRender = () => {},
    onLineChange = () => {},
    getDiffResult = () => null,
    onClickChange = () => {},
    onSelectAnchor = () => {},
    onScroll = () => {},
    getSlopMatchers = () => [],
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
        anchorMarks = [];
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
        .use(createSlopPlugin(getSlopMatchers))
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
    if (content) {
      initEditor(content);
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

  $effect(() => {
    const currentContent = content;

    if (!currentContent) return;

    if (!isReady && currentContent && editorRoot) {
      initEditor(currentContent);
      return;
    }

    if (isReady && editor && currentContent !== lastKnownContent) {
      try {
        isInternalUpdate = true;
        editor.action(milkdownUtils.replaceAll(currentContent));
        lastKnownContent = currentContent;
        setTimeout(() => {
          isInternalUpdate = false;
          if (editor) {
            triggerDiffUpdate(editor);
            queueAnchorRefresh();
          }
        }, 0);
      } catch (error) {
        reportRuntimeError('editor_external_sync_failed', error);
        isInternalUpdate = false;
      }
    }
  });

  $effect(() => {
    diffResult;
    selectedChangeId;
    slopLines;
    densityMode;
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

  export function refreshDiff() {
    if (!editor || !isReady) return;
    try {
      triggerDiffUpdate(editor);
      queueAnchorRefresh();
    } catch (error) {
      reportRuntimeError('editor_diff_refresh_failed', error);
    }
  }

  export function refreshSlop() {
    if (!editor || !isReady) return;
    try {
      triggerSlopUpdate(editor);
      queueAnchorRefresh();
    } catch (error) {
      reportRuntimeError('editor_slop_refresh_failed', error);
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
  class="editor-shell"
  class:density-review={densityMode === 'review'}
  class:density-manuscript={densityMode === 'manuscript'}
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
            class="anchor-hit control-motion control-focus"
            class:selected={mark.selected}
            onclick={(event) => handleAnchorClick(mark, event)}
            aria-label={`Jump to note ${mark.displayIndex}`}
          >
            <span class="anchor-line"></span>
            <span class="anchor-badge">{mark.displayIndex}</span>
            {#if mark.selected && mark.preview}
              <span class="anchor-ghost">{mark.preview}</span>
            {/if}
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
  .editor-shell {
    flex: 1;
    overflow: auto;
    padding-bottom: var(--space-12);
  }

  .editor-frame {
    position: relative;
    width: min(100%, calc(var(--content-max-width) + var(--gutter-width) + 2rem));
    margin: 0 auto;
    padding-top: var(--space-12);
    padding-bottom: var(--space-12);
  }

  .editor-shell.density-review .editor-frame {
    padding-top: var(--space-9);
  }

  .editor-surface {
    margin-left: var(--gutter-width);
    max-width: var(--content-max-width);
    min-height: 100%;
  }

  .editor-root {
    min-height: 100%;
  }

  .anchor-layer {
    position: absolute;
    inset: 0 auto 0 0;
    width: var(--gutter-width);
  }

  .anchor-mark {
    position: absolute;
    inset-inline: 0.35rem 0.5rem;
    height: 1.1rem;
  }

  .anchor-hit {
    position: relative;
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    cursor: pointer;
    pointer-events: auto;
  }

  .anchor-line {
    position: absolute;
    right: 0.5rem;
    top: 0;
    width: 3px;
    height: 1.1rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 78%, transparent);
  }

  .anchor-hit.selected .anchor-line {
    width: 4px;
  }

  .anchor-badge {
    position: absolute;
    right: -0.1rem;
    top: -0.05rem;
    min-width: 1.2rem;
    height: 1.2rem;
    border-radius: 999px;
    padding: 0 0.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--accent) 88%, var(--paper-bright));
    color: var(--paper-bright);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--paper-bright) 85%, transparent);
  }

  .anchor-ghost {
    position: absolute;
    right: 1.8rem;
    top: -0.05rem;
    max-width: calc(var(--gutter-width) - 2.2rem);
    font-family: var(--font-body);
    font-size: 0.675rem;
    line-height: 1.2;
    color: var(--delete-ink);
    opacity: 0.7;
    text-align: right;
  }

  .editor-root :global(.milkdown) {
    font-family: var(--font-body);
    color: var(--ink);
    line-height: var(--line-height);
    outline: none;
  }

  .editor-root :global(.milkdown .editor),
  .editor-root :global(.milkdown .ProseMirror),
  .editor-root :global(.milkdown .ProseMirror:focus) {
    outline: none;
  }

  .editor-root :global(.milkdown .ProseMirror) {
    min-height: 100%;
  }

  .editor-root :global(.milkdown h1) {
    font-family: var(--font-display);
    font-size: var(--text-title);
    font-weight: 600;
    color: var(--ink);
    margin: 0 0 var(--space-2);
    line-height: 1.25;
    letter-spacing: -0.02em;
  }

  .editor-root :global(.milkdown h2) {
    font-family: var(--font-display);
    font-size: var(--text-heading);
    font-weight: 600;
    color: var(--ink);
    margin: var(--space-8) 0 var(--space-3);
    line-height: 1.35;
  }

  .editor-root :global(.milkdown h3) {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ink);
    margin: var(--space-6) 0 var(--space-2);
  }

  .editor-root :global(.milkdown p) {
    margin: var(--space-5) 0;
    line-height: var(--line-height);
    font-size: 1.125rem;
  }

  .editor-shell.density-review .editor-root :global(.milkdown p) {
    margin: var(--space-4) 0;
    font-size: 1.0625rem;
  }

  .editor-root :global(.milkdown ul),
  .editor-root :global(.milkdown ol) {
    margin: var(--space-5) 0;
    padding-left: var(--space-7);
  }

  .editor-root :global(.milkdown li) {
    margin: var(--space-2) 0;
  }

  .editor-root :global(.milkdown ul li::marker) {
    color: var(--ink-faded);
  }

  .editor-root :global(.milkdown strong) {
    font-weight: 600;
    color: var(--ink);
  }

  .editor-root :global(.milkdown em) {
    font-style: italic;
  }

  .editor-root :global(.milkdown code) {
    font-family: var(--font-mono);
    font-size: 0.875em;
    background: color-mix(in srgb, var(--paper-matte) 95%, transparent);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    color: var(--ink);
  }

  .editor-root :global(.milkdown pre) {
    background: color-mix(in srgb, var(--paper-matte) 96%, transparent);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    overflow-x: auto;
    margin: var(--space-6) 0;
  }

  .editor-root :global(.milkdown pre code) {
    background: none;
    padding: 0;
  }

  .editor-root :global(.milkdown blockquote) {
    border-left: 3px solid var(--ink-whisper);
    padding-left: var(--space-4);
    margin: var(--space-6) 0;
    color: var(--ink-faded);
    font-style: italic;
  }

  .editor-root :global(.milkdown a) {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: var(--accent-subtle);
    text-underline-offset: 2px;
  }

  .editor-root :global(.milkdown a:hover) {
    text-decoration-color: var(--accent);
  }

  .editor-root :global(.milkdown hr) {
    border: none;
    border-top: 1px solid var(--paper-edge);
    margin: var(--space-10) 0;
  }

  .editor-root :global(.milkdown ::selection) {
    background: color-mix(in srgb, var(--accent-subtle) 80%, transparent);
  }

  .editor-root :global(.added) {
    background-color: color-mix(in srgb, var(--insert-bg) 95%, transparent);
    color: var(--insert-ink);
    padding: 1px 2px;
    border-radius: 3px;
    cursor: pointer;
    white-space: pre-wrap;
    box-shadow: inset 0 -1px 0 color-mix(in srgb, var(--insert-line) 95%, transparent);
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .editor-root :global(.added.selected) {
    background-color: color-mix(in srgb, var(--insert-bg) 100%, var(--paper-bright));
    box-shadow:
      inset 0 -1px 0 color-mix(in srgb, var(--insert-line) 100%, transparent),
      0 0 0 1px color-mix(in srgb, var(--insert-line) 38%, transparent);
  }

  .editor-root :global(.added:hover) {
    background-color: color-mix(in srgb, var(--insert-bg) 100%, transparent);
  }

  .editor-root :global(.struck) {
    display: inline;
    white-space: pre-wrap;
    cursor: pointer;
    user-select: none;
    vertical-align: baseline;
    color: var(--struck-text);
    background: color-mix(in srgb, var(--struck-bg) 92%, transparent);
    border-radius: 0.35rem;
    padding: 0.03rem 0.18rem;
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--struck-line) 96%, var(--struck-text));
    text-decoration-thickness: 1.4px;
    text-decoration-skip-ink: none;
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--struck-line) 24%, transparent),
      inset 0 -1px 0 color-mix(in srgb, var(--struck-line) 36%, transparent);
    transition:
      background-color var(--transition-fast),
      box-shadow var(--transition-fast),
      color var(--transition-fast);
  }

  .editor-root :global(.struck:hover) {
    background: color-mix(in srgb, var(--struck-bg) 100%, transparent);
  }

  .editor-root :global(.struck.selected) {
    background: color-mix(in srgb, var(--struck-bg) 100%, var(--paper-bright));
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--struck-line) 48%, transparent),
      0 0 0 1px color-mix(in srgb, var(--struck-line) 22%, transparent);
  }

  .editor-root :global(.struck:focus-visible) {
    outline: none;
  }

  .editor-root :global(.struck:focus-visible) {
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--struck-line) 48%, transparent),
      0 0 0 2px color-mix(in srgb, var(--focus-ring) 36%, transparent);
  }

  .editor-root :global(.slop-violation) {
    box-shadow: inset 0 -2px 0 color-mix(in srgb, var(--slop-line) 95%, transparent);
    border-radius: 2px;
    padding: 0 1px;
  }
</style>
