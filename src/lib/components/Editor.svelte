<script>
  import { onMount, onDestroy } from 'svelte';
  import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/core';
  import { commonmark } from '@milkdown/preset-commonmark';
  import { listener, listenerCtx } from '@milkdown/plugin-listener';
  import { replaceAll, getMarkdown } from '@milkdown/utils';
  import { createDiffPlugin, triggerDiffUpdate } from '../utils/milkdown-diff-plugin.js';
  import { createSlopPlugin, triggerSlopUpdate } from '../utils/milkdown-slop-plugin.js';
  import { buildTextMap } from '../utils/prosemirror-text.js';

  /** @type {{ content?: string, onChange?: (content: string) => void, onPlainTextChange?: (text: string) => void, onInitialRender?: (text: string) => void, onLineChange?: (lineNumber: number) => void, getDiffResult?: () => any, onClickChange?: (changeId: string, text: string, x: number, y: number) => void, onScroll?: (scrollTop: number) => void, getSlopMatchers?: () => any[] }} */
  let {
    content = '',
    onChange = () => {},
    onPlainTextChange = () => {},
    onInitialRender = () => {},
    onLineChange = () => {},
    getDiffResult = () => null,
    onClickChange = () => {},
    onScroll = () => {},
    getSlopMatchers = () => []
  } = $props();

  /** @type {HTMLDivElement} */
  let editorContainer;

  /** @type {Editor | null} */
  let editor = $state(null);
  let isReady = $state(false);
  let isInternalUpdate = false;
  let lastKnownContent = '';
  let hasCalledInitialRender = false;

  /**
   * Get current plain text from editor
   */
  function getCurrentPlainText() {
    if (!editor || !isReady) return '';
    try {
      const view = editor.ctx.get(editorViewCtx);
      if (view) {
        return buildTextMap(view.state.doc).text;
      }
    } catch (e) {
      console.error('Failed to extract plain text:', e);
    }
    return '';
  }

  async function initEditor(initialContent) {
    if (!editorContainer) return;

    try {
      editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, editorContainer);
          ctx.set(defaultValueCtx, initialContent || '');

          // Set up listener for content changes (user edits)
          const listenerManager = ctx.get(listenerCtx);
          listenerManager.markdownUpdated((ctx, markdown, prevMarkdown) => {
            // Only propagate changes from user edits, not programmatic updates
            if (!isInternalUpdate && markdown !== lastKnownContent) {
              lastKnownContent = markdown;
              onChange(markdown);

              // Also send plain text for accurate diffing
              const plainText = getCurrentPlainText();
              if (plainText) {
                onPlainTextChange(plainText);
              }

              // Schedule diff decoration update after stores have processed the change.
              // The plugin's apply() runs during docChanged but with stale diff data.
              // Text verification in the plugin returns empty decorations for stale diffs.
              // This rAF triggers a second pass with fresh diff data from updated stores.
              requestAnimationFrame(() => {
                if (editor) {
                  triggerDiffUpdate(editor);
                }
              });
            }
          });
        })
        .use(commonmark)
        .use(listener)
        .use(createDiffPlugin(getDiffResult, onClickChange))
        .use(createSlopPlugin(getSlopMatchers))
        .create();

      isReady = true;
      lastKnownContent = initialContent;

      // Extract initial plain text and notify parent
      setTimeout(() => {
        if (!hasCalledInitialRender) {
          const plainText = getCurrentPlainText();
          if (plainText) {
            hasCalledInitialRender = true;
            onInitialRender(plainText);
          }
        }
      }, 50);

      // Track cursor position for line number updates
      editorContainer.addEventListener('click', updateLineNumber);
      editorContainer.addEventListener('keyup', updateLineNumber);
    } catch (e) {
      console.error('Failed to initialize Milkdown:', e);
    }
  }

  function updateLineNumber() {
    if (!editor || !isReady) return;
    try {
      const view = editor.ctx.get(editorViewCtx);
      if (view) {
        const pos = view.state.selection.anchor;
        const doc = view.state.doc;
        let line = 1;
        doc.descendants((node, nodePos) => {
          if (nodePos >= pos) return false;
          if (node.isBlock) line++;
          return true;
        });
        onLineChange(Math.max(1, line));
      }
    } catch (e) {
      // Ignore errors during initialization
    }
  }

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
    // Initialize with content if available, otherwise wait for content prop
    if (content) {
      initEditor(content);
    }
  });

  onDestroy(() => {
    if (editorContainer) {
      editorContainer.removeEventListener('click', updateLineNumber);
      editorContainer.removeEventListener('keyup', updateLineNumber);
    }
    if (editor) {
      editor.destroy();
    }
  });

  // React to content prop changes
  $effect(() => {
    const currentContent = content;

    if (!currentContent) return;

    // First time content arrives and editor not initialized yet
    if (!isReady && currentContent && editorContainer) {
      initEditor(currentContent);
      return;
    }

    // Content changed externally after initialization
    // Only update if it's actually different from what we have
    if (isReady && editor && currentContent !== lastKnownContent) {
      try {
        isInternalUpdate = true;
        editor.action(replaceAll(currentContent));
        lastKnownContent = currentContent;
        // Use setTimeout to ensure flag is cleared after async Milkdown updates
        setTimeout(() => {
          isInternalUpdate = false;
          // Trigger diff update after content sync
          if (editor) {
            triggerDiffUpdate(editor);
          }
        }, 0);
      } catch (e) {
        console.error('Failed to update editor content:', e);
        isInternalUpdate = false;
      }
    }
  });


  // Export method to get current content
  export function getContent() {
    if (!editor || !isReady) return '';
    try {
      return editor.action(getMarkdown());
    } catch (e) {
      return '';
    }
  }

  // Export method to focus editor
  export function focus() {
    if (!editor || !isReady) return;
    try {
      const view = editor.ctx.get(editorViewCtx);
      view?.focus();
    } catch (e) {
      // Ignore
    }
  }

  // Export method to refresh diff decorations
  export function refreshDiff() {
    if (!editor || !isReady) return;
    try {
      triggerDiffUpdate(editor);
    } catch (e) {
      console.error('Failed to refresh diff:', e);
    }
  }

  export function refreshSlop() {
    if (!editor || !isReady) return;
    try {
      triggerSlopUpdate(editor);
    } catch (e) {
      console.error('Failed to refresh slop:', e);
    }
  }

  export function setScrollTop(scrollTop) {
    if (!editorContainer) return;
    if (Math.abs(editorContainer.scrollTop - scrollTop) < 1) return;
    editorContainer.scrollTop = scrollTop;
  }

  export function scrollToLine(lineNumber) {
    if (!editorContainer) return;
    const lineHeight = getLineHeightPx() || 27;
    const targetTop = Math.max(0, Math.round((lineNumber - 1) * lineHeight));
    editorContainer.scrollTo({ top: targetTop, behavior: 'auto' });
  }
</script>

<div class="editor-wrapper" bind:this={editorContainer} onscroll={handleScroll}></div>

<style>
  .editor-wrapper {
    flex: 1;
    overflow: auto;
    background: var(--paper);
    padding: var(--space-4);
    max-width: var(--content-max-width);
    margin: 0 auto;
  }

  /* Milkdown prose styling - Paper & Ink theme */
  .editor-wrapper :global(.milkdown) {
    font-family: var(--font-body);
    color: var(--ink);
    line-height: var(--line-height);
    outline: none;
  }

  .editor-wrapper :global(.milkdown .editor) {
    outline: none;
  }

  .editor-wrapper :global(.milkdown .ProseMirror) {
    outline: none;
    min-height: 100%;
  }

  .editor-wrapper :global(.milkdown .ProseMirror:focus) {
    outline: none;
  }

  /* Headings - Iowan Old Style for editorial feel */
  .editor-wrapper :global(.milkdown h1) {
    font-family: var(--font-display);
    font-size: var(--text-title);
    font-weight: 600;
    color: var(--ink);
    margin: var(--space-6) 0 var(--space-4);
    line-height: 1.3;
  }

  .editor-wrapper :global(.milkdown h2) {
    font-family: var(--font-display);
    font-size: var(--text-heading);
    font-weight: 600;
    color: var(--ink);
    margin: var(--space-6) 0 var(--space-3);
    line-height: 1.4;
  }

  .editor-wrapper :global(.milkdown h3) {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ink);
    margin: var(--space-4) 0 var(--space-2);
  }

  /* Paragraphs */
  .editor-wrapper :global(.milkdown p) {
    margin: var(--space-3) 0;
    line-height: var(--line-height);
  }

  /* Lists */
  .editor-wrapper :global(.milkdown ul),
  .editor-wrapper :global(.milkdown ol) {
    margin: var(--space-3) 0;
    padding-left: var(--space-6);
  }

  .editor-wrapper :global(.milkdown li) {
    margin: var(--space-2) 0;
  }

  .editor-wrapper :global(.milkdown ul li::marker) {
    color: var(--ink-faded);
  }

  /* Emphasis */
  .editor-wrapper :global(.milkdown strong) {
    font-weight: 600;
    color: var(--ink);
  }

  .editor-wrapper :global(.milkdown em) {
    font-style: italic;
  }

  /* Code */
  .editor-wrapper :global(.milkdown code) {
    font-family: var(--font-mono);
    font-size: 0.875em;
    background: var(--paper-matte);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    color: var(--ink);
  }

  .editor-wrapper :global(.milkdown pre) {
    background: var(--paper-matte);
    padding: var(--space-4);
    border-radius: 6px;
    overflow-x: auto;
    margin: var(--space-4) 0;
  }

  .editor-wrapper :global(.milkdown pre code) {
    background: none;
    padding: 0;
  }

  /* Blockquotes */
  .editor-wrapper :global(.milkdown blockquote) {
    border-left: 3px solid var(--ink-whisper);
    padding-left: var(--space-4);
    margin: var(--space-4) 0;
    color: var(--ink-faded);
    font-style: italic;
  }

  /* Links */
  .editor-wrapper :global(.milkdown a) {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: var(--accent-subtle);
    text-underline-offset: 2px;
  }

  .editor-wrapper :global(.milkdown a:hover) {
    text-decoration-color: var(--accent);
  }

  /* Horizontal rules */
  .editor-wrapper :global(.milkdown hr) {
    border: none;
    border-top: 1px solid var(--paper-edge);
    margin: var(--space-8) 0;
  }

  /* Selection */
  .editor-wrapper :global(.milkdown ::selection) {
    background: var(--accent-subtle);
  }

  /* Diff decorations - these will be applied via plugin */
  .editor-wrapper :global(.struck) {
    background-color: var(--struck-bg);
    color: var(--struck-text);
    text-decoration: line-through;
    text-decoration-color: var(--struck-line);
    padding: 1px 2px;
    border-radius: 2px;
    cursor: pointer;
  }

  .editor-wrapper :global(.added) {
    background-color: var(--added-bg);
    color: var(--added-text);
    padding: 1px 2px;
    border-radius: 2px;
    cursor: pointer;
  }

  .editor-wrapper :global(.struck:hover),
  .editor-wrapper :global(.added:hover) {
    filter: brightness(0.95);
  }

  .editor-wrapper :global(.slop-violation) {
    background: var(--accent-subtle);
    box-shadow: inset 0 -1px 0 var(--accent);
    border-radius: 2px;
    padding: 0 1px;
  }
</style>
