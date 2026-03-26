<script>
  import AnnotationEditor from './AnnotationEditor.svelte';

  /** @typedef {import('../utils/diff.js').Change} Change */

  /** @type {{ selectedChange?: Change | null, selectedAnnotationEntry?: any, annotationEntries?: any[], densityMode?: 'review' | 'manuscript', isComposing?: boolean, composerDraft?: string, onSelectChange?: (change: Change) => void, onSelectAnnotation?: (annotationId: string) => void, onStartCompose?: () => void, onDraftInput?: (value: string) => void, onSaveCompose?: () => void, onCancelCompose?: () => void, onRemoveSelected?: () => void, onReattachSelected?: () => void }} */
  let {
    selectedChange = null,
    selectedAnnotationEntry = null,
    annotationEntries = [],
    densityMode = 'manuscript',
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

<aside
  class="annotation-column glass-surface glass-surface-static"
  class:density-review={densityMode === 'review'}
>
  <div class="annotation-scroll">
    <section class="annotation-feature">
      {#if isComposing}
        <AnnotationEditor
          bind:this={editorRef}
          excerpt={selectedChange?.text || selectedAnnotationEntry?.annotation.target.excerpt || ''}
          value={composerDraft}
          autofocus={true}
          canRemove={!!selectedAnnotationEntry}
          saveLabel={selectedAnnotationEntry ? 'Update rationale' : 'Save rationale'}
          onInput={onDraftInput}
          onSave={onSaveCompose}
          onCancel={onCancelCompose}
          onRemove={onRemoveSelected}
        />
      {:else if selectedAnnotationEntry?.status === 'stale'}
        <div class="stale-card">
          <span class="stale-badge">Stale note</span>
          <p class="rationale-text">{selectedAnnotationEntry.annotation.rationale}</p>
        </div>

        <div class="annotation-actions-row">
          {#if selectedChange}
            <button
              type="button"
              class="annotation-primary control-motion control-focus control-raise"
              onclick={onReattachSelected}
            >
              Attach to selected edit
            </button>
          {/if}
          <button
            type="button"
            class="annotation-secondary control-motion control-focus"
            onclick={onStartCompose}
          >
            Edit note
          </button>
          <button
            type="button"
            class="annotation-secondary destructive control-motion control-focus"
            onclick={onRemoveSelected}
          >
            Dismiss
          </button>
        </div>
      {:else if selectedChange}
        <p class="excerpt-text">"{selectedChange.text}"</p>
        {#if selectedAnnotationEntry}
          <p class="rationale-text">{selectedAnnotationEntry.annotation.rationale}</p>
        {/if}

        <div class="annotation-actions-row">
          <button
            type="button"
            class="annotation-primary control-motion control-focus control-raise"
            onclick={onStartCompose}
          >
            {selectedAnnotationEntry ? 'Edit rationale' : 'Add rationale'}
          </button>
          {#if selectedAnnotationEntry}
            <button
              type="button"
              class="annotation-secondary destructive control-motion control-focus"
              onclick={onRemoveSelected}
            >
              Remove
            </button>
          {/if}
        </div>
      {:else}
        <p class="empty-hint">Select an edit to review it.</p>
      {/if}
    </section>

    <section class="annotation-section">
      <div class="section-heading">Saved notes</div>
      {#if annotationEntries.length === 0}
        <p class="section-empty">No rationales yet.</p>
      {:else}
        <div class="note-stack">
          {#each annotationEntries as entry}
            <button
              type="button"
              class="note-card control-motion control-focus"
              class:selected={selectedAnnotationEntry?.annotation.id === entry.annotation.id}
              class:stale={entry.status === 'stale'}
              class:density-manuscript={densityMode === 'manuscript'}
              onclick={() =>
                entry.status === 'active' && entry.change
                  ? onSelectChange(entry.change)
                  : onSelectAnnotation(entry.annotation.id)}
            >
              <div class="note-card-top">
                <span class="note-label">
                  {entry.status === 'active' ? `Note ${entry.displayIndex}` : 'Stale'}
                </span>
                <span class="note-line">
                  {#if entry.status === 'active' && entry.change}
                    L{entry.change.location.line}
                  {/if}
                </span>
              </div>
              <p>{entry.annotation.rationale}</p>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</aside>

<style>
  .annotation-column {
    width: var(--desk-right-width);
    border-left: 1px solid color-mix(in srgb, var(--paper-edge) 86%, transparent);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: color-mix(in srgb, var(--glass-bg-static) 96%, transparent);
  }

  .annotation-scroll {
    flex: 1;
    overflow: auto;
    padding: var(--space-5) var(--space-5) var(--space-10);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .annotation-feature,
  .annotation-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-heading,
  .note-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-ghost);
    font-weight: 600;
  }

  .note-line {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
  }

  .excerpt-text {
    font-family: var(--font-body);
    font-size: var(--text-annotation);
    line-height: 1.5;
    color: var(--annotation-ink);
    font-style: italic;
  }

  .rationale-text,
  .note-card p {
    font-family: var(--font-body);
    font-size: var(--text-annotation);
    line-height: 1.5;
    color: var(--annotation-ink);
  }

  .empty-hint,
  .section-empty {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    line-height: 1.45;
  }

  .stale-card {
    border: 1px solid color-mix(in srgb, var(--delete-line) 58%, transparent);
    border-radius: var(--radius-xl);
    padding: var(--space-4);
    background: color-mix(in srgb, var(--delete-bg) 32%, var(--paper-bright));
  }

  .stale-badge {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: color-mix(in srgb, var(--delete-ink) 88%, var(--ink));
  }

  .note-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .annotation-actions-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .annotation-primary,
  .annotation-secondary {
    border-radius: 999px;
    padding: 0.45rem 0.9rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    border: 1px solid transparent;
    cursor: pointer;
  }

  .annotation-primary {
    color: var(--paper-bright);
    background: var(--accent);
  }

  .annotation-primary:hover {
    background: var(--accent-hover);
  }

  .annotation-secondary {
    color: var(--ink-faded);
    background: transparent;
    border-color: color-mix(in srgb, var(--paper-edge) 90%, transparent);
  }

  .annotation-secondary:hover {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--ink-ghost) 80%, transparent);
  }

  .annotation-secondary.destructive:hover {
    color: var(--delete-ink);
    border-color: color-mix(in srgb, var(--delete-ink) 45%, transparent);
  }

  .note-card {
    width: 100%;
    text-align: left;
    padding: 0.8rem 0.95rem;
    border-radius: var(--radius-xl);
    border: 1px solid color-mix(in srgb, var(--paper-edge) 88%, transparent);
    background: color-mix(in srgb, var(--paper-bright) 64%, transparent);
  }

  .note-card.density-manuscript {
    background: transparent;
  }

  .note-card.selected {
    border-color: color-mix(in srgb, var(--accent) 44%, transparent);
    background: color-mix(in srgb, var(--accent-subtle) 28%, var(--paper-bright));
  }

  .note-card.stale {
    border-color: color-mix(in srgb, var(--delete-line) 52%, transparent);
  }

  .note-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .density-review .annotation-scroll {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
</style>
