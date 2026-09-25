<script>
  import AnnotationEditor from './AnnotationEditor.svelte';

  /** @typedef {import('../utils/diff.js').Change} Change */

  /** @type {{ onClose?: () => void, selectedChange?: Change | null, selectedAnnotationEntry?: any, annotationEntries?: any[], isComposing?: boolean, composerDraft?: string, onSelectChange?: (change: Change) => void, onSelectAnnotation?: (annotationId: string) => void, onStartCompose?: () => void, onDraftInput?: (value: string) => void, onSaveCompose?: () => void, onCancelCompose?: () => void, onRemoveSelected?: () => void, onReattachSelected?: () => void }} */
  let {
    onClose = () => {},
    selectedChange = null,
    selectedAnnotationEntry = null,
    annotationEntries = [],
    isComposing = false,
    composerDraft = '',
    onSelectChange = () => {},
    onSelectAnnotation = () => {},
    onStartCompose = () => {},
    onDraftInput = () => {},
    onSaveCompose = () => {},
    onCancelCompose = () => {},
    onRemoveSelected = () => {},
    onReattachSelected = () => {},
  } = $props();

  /** @type {AnnotationEditor | null} */
  let editorRef = $state(null);

  export function focusComposer() {
    editorRef?.focusEditor?.();
  }
</script>

<aside class="rationale-panel" aria-label="Rationale">
  <header class="panel-head">
    <h2>Rationale</h2>
    <button type="button" class="btn icon-btn" aria-label="Hide rationale panel" title="Hide (⌘⇧R)" onclick={onClose}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
    </button>
  </header>

  <div class="panel-body">
    <section class="focus">
      {#if isComposing}
        <AnnotationEditor
          bind:this={editorRef}
          excerpt={selectedChange?.text || selectedAnnotationEntry?.annotation.target.excerpt || ''}
          value={composerDraft}
          autofocus={true}
          canRemove={!!selectedAnnotationEntry}
          saveLabel={selectedAnnotationEntry ? 'Update' : 'Save'}
          onInput={onDraftInput}
          onSave={onSaveCompose}
          onCancel={onCancelCompose}
          onRemove={onRemoveSelected}
        />
      {:else if selectedAnnotationEntry?.status === 'stale'}
        <p class="meta">Stale. The edit this explained has changed.</p>
        <p class="rationale">{selectedAnnotationEntry.annotation.rationale}</p>
        <div class="actions">
          {#if selectedChange}
            <button type="button" class="btn btn-primary" onclick={onReattachSelected}>Attach to selected edit</button>
          {/if}
          <button type="button" class="btn" onclick={onStartCompose}>Edit</button>
          <button type="button" class="btn btn-danger" onclick={onRemoveSelected}>Dismiss</button>
        </div>
      {:else if selectedChange}
        <p class="excerpt" class:deleted={selectedChange.type === 'deletion'}>“{selectedChange.text.trim()}”</p>
        {#if selectedAnnotationEntry}
          <p class="rationale">{selectedAnnotationEntry.annotation.rationale}</p>
        {/if}
        <div class="actions">
          {#if selectedAnnotationEntry}
            <button type="button" class="btn" onclick={onStartCompose}>Edit</button>
            <button type="button" class="btn btn-danger" onclick={onRemoveSelected}>Remove</button>
          {:else}
            <button type="button" class="btn btn-primary" onclick={onStartCompose}>
              Add rationale <kbd>⌘/</kbd>
            </button>
          {/if}
        </div>
      {:else}
        <p class="meta">Select an edit, in the text or the list, to explain it.</p>
      {/if}
    </section>

    {#if annotationEntries.length > 0}
      <section class="saved">
        <h3>Saved <span class="count">{annotationEntries.length}</span></h3>
        <ol>
          {#each annotationEntries as entry (entry.annotation.id)}
            <li>
              <button
                type="button"
                class="saved-item"
                class:selected={selectedAnnotationEntry?.annotation.id === entry.annotation.id}
                onclick={() =>
                  entry.status === 'active' && entry.change
                    ? onSelectChange(entry.change)
                    : onSelectAnnotation(entry.annotation.id)}
              >
                <span class="saved-meta">
                  {entry.status === 'active'
                    ? [entry.displayIndex, entry.change && `Line ${entry.change.location.line}`].filter(Boolean).join(' · ')
                    : 'Stale'}
                </span>
                <span class="saved-text">{entry.annotation.rationale}</span>
              </button>
            </li>
          {/each}
        </ol>
      </section>
    {/if}
  </div>
</aside>

<style>
  .rationale-panel {
    display: flex;
    flex-direction: column;
    width: var(--rationale-w);
    flex-shrink: 0;
    min-height: 0;
    border-left: 1px solid var(--rule);
    background: var(--canvas);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-3) var(--space-2) var(--space-5);
  }

  h2 {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-2);
  }

  .panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--space-5) var(--space-8);
  }

  .focus {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-2);
  }

  .excerpt {
    font-size: var(--text-md);
    color: var(--insert-ink);
    overflow-wrap: anywhere;
  }

  .excerpt.deleted {
    color: var(--delete-ink);
    text-decoration: line-through;
    text-decoration-color: var(--delete-line);
  }

  .rationale {
    font-size: var(--text-md);
    line-height: 1.5;
    color: var(--ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: var(--text-sm);
    color: var(--ink-3);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-left: calc(-1 * var(--space-3));
  }

  .actions .btn-primary {
    margin-left: var(--space-3);
  }

  .btn-primary kbd {
    color: inherit;
    opacity: 0.7;
  }

  .saved {
    margin-top: var(--space-8);
    padding-top: var(--space-5);
    border-top: 1px solid var(--rule);
  }

  h3 {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-2);
    margin-bottom: var(--space-2);
  }

  .count {
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
    margin-left: var(--space-1);
  }

  ol {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0 calc(-1 * var(--space-2));
  }

  .saved-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .saved-item:hover {
    background: var(--hover);
  }

  .saved-item.selected {
    background: var(--selected-bg);
  }

  .saved-meta {
    font-size: var(--text-xs);
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }

  .saved-text {
    font-size: var(--text-sm);
    color: var(--ink);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
