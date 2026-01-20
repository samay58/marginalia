<script>
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
  import { EditorState, Compartment } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { markdown } from '@codemirror/lang-markdown';

  /** @type {{ content?: string, onChange?: (content: string) => void, onLineChange?: (lineNumber: number) => void }} */
  let {
    content = '',
    onChange = () => {},
    onLineChange = () => {}
  } = $props();

  /** @type {HTMLDivElement} */
  let editorContainer;

  /** @type {EditorView | null} */
  let view = $state(null);

  const themeCompartment = new Compartment();

  // Custom theme matching our design tokens
  const marginaliaTheme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '16px',
      fontFamily: 'Charter, "Bitstream Charter", Cambria, serif',
    },
    '.cm-content': {
      padding: '16px 0',
      caretColor: 'var(--ink)',
      fontFamily: 'inherit',
      lineHeight: '1.6875rem',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--ink)',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: 'var(--accent)',
    },
    '.cm-scroller': {
      fontFamily: 'inherit',
      lineHeight: '1.6875rem',
      overflow: 'auto',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--paper-matte)',
      color: 'var(--ink-ghost)',
      border: 'none',
      borderRight: '1px solid var(--paper-edge)',
      fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
      fontSize: '12px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 8px',
      minWidth: '40px',
      textAlign: 'right',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--paper)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(193, 127, 36, 0.05)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'var(--accent-subtle)',
    },
    '.cm-line': {
      padding: '0 16px',
    },
    // Struck text (deletions)
    '.cm-struck': {
      backgroundColor: 'var(--struck-bg)',
      color: 'var(--struck-text)',
      textDecoration: 'line-through',
      textDecorationColor: 'var(--struck-line)',
    },
    // Added text (insertions)
    '.cm-added': {
      backgroundColor: 'var(--added-bg)',
      color: 'var(--added-text)',
    },
    // Markdown styling
    '.cm-header': {
      fontFamily: '"Iowan Old Style", Palatino, Georgia, serif',
      fontWeight: '600',
    },
    '.cm-header-1': {
      fontSize: '1.875rem',
    },
    '.cm-header-2': {
      fontSize: '1.375rem',
    },
    '.cm-strong': {
      fontWeight: '600',
    },
    '.cm-emphasis': {
      fontStyle: 'italic',
    },
  }, { dark: false });

  // Dark theme variant
  const marginaliaDarkTheme = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '16px',
      fontFamily: 'Charter, "Bitstream Charter", Cambria, serif',
    },
    '.cm-content': {
      padding: '16px 0',
      caretColor: 'var(--ink)',
      fontFamily: 'inherit',
      lineHeight: '1.6875rem',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--ink)',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: 'var(--accent)',
    },
    '.cm-scroller': {
      fontFamily: 'inherit',
      lineHeight: '1.6875rem',
      overflow: 'auto',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--paper-matte)',
      color: 'var(--ink-ghost)',
      border: 'none',
      borderRight: '1px solid var(--paper-edge)',
      fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
      fontSize: '12px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 8px',
      minWidth: '40px',
      textAlign: 'right',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--paper-bright)',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(219, 160, 68, 0.08)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'var(--accent-subtle)',
    },
    '.cm-line': {
      padding: '0 16px',
    },
    '.cm-struck': {
      backgroundColor: 'var(--struck-bg)',
      color: 'var(--struck-text)',
      textDecoration: 'line-through',
      textDecorationColor: 'var(--struck-line)',
    },
    '.cm-added': {
      backgroundColor: 'var(--added-bg)',
      color: 'var(--added-text)',
    },
    '.cm-header': {
      fontFamily: '"Iowan Old Style", Palatino, Georgia, serif',
      fontWeight: '600',
    },
    '.cm-header-1': {
      fontSize: '1.875rem',
    },
    '.cm-header-2': {
      fontSize: '1.375rem',
    },
    '.cm-strong': {
      fontWeight: '600',
    },
    '.cm-emphasis': {
      fontStyle: 'italic',
    },
  }, { dark: true });

  onMount(() => {
    const isDark = document.documentElement.classList.contains('dark');

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        markdown(),
        themeCompartment.of(isDark ? marginaliaDarkTheme : marginaliaTheme),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
          if (update.selectionSet) {
            const line = update.state.doc.lineAt(update.state.selection.main.head).number;
            onLineChange(line);
          }
        }),
        EditorView.lineWrapping,
      ],
    });

    view = new EditorView({
      state,
      parent: editorContainer,
    });

    // Watch for dark mode changes
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      view?.dispatch({
        effects: themeCompartment.reconfigure(isDark ? marginaliaDarkTheme : marginaliaTheme)
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  });

  onDestroy(() => {
    view?.destroy();
  });

  // Update content when prop changes externally
  $effect(() => {
    if (view && content !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      });
    }
  });

  // Export method to get current content
  export function getContent() {
    return view?.state.doc.toString() ?? '';
  }

  // Export method to focus editor
  export function focus() {
    view?.focus();
  }
</script>

<div class="editor-wrapper" bind:this={editorContainer}></div>

<style>
  .editor-wrapper {
    flex: 1;
    overflow: hidden;
    background: var(--paper);
  }

  .editor-wrapper :global(.cm-editor) {
    height: 100%;
  }

  .editor-wrapper :global(.cm-editor.cm-focused) {
    outline: none;
  }
</style>
