<script>
  import AnnotationEditor from './AnnotationEditor.svelte';

  /** @typedef {import('../utils/diff.js').Change} Change */

  /** @type {{ selectedChange?: Change | null, selectedAnnotationEntry?: any, annotationEntries?: any[], lintFindings?: Array<any>, densityMode?: 'review' | 'manuscript', isComposing?: boolean, composerDraft?: string, onSelectChange?: (change: Change) => void, onSelectAnnotation?: (annotationId: string) => void, onStartCompose?: () => void, onDraftInput?: (value: string) => void, onSaveCompose?: () => void, onCancelCompose?: () => void, onRemoveSelected?: () => void, onReattachSelected?: () => void }} */
  let {
    selectedChange = null,
    selectedAnnotationEntry = null,
    annotationEntries = [],
    lintFindings = [],
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

  const relatedLintFindings = $derived.by(() => {
    if (!selectedChange) return [];
    return lintFindings.filter((finding) => finding.line === selectedChange.location.line).slice(0, 2);
  });

  export function focusComposer() {
    editorRef?.focusEditor?.();
  }
</script>

<aside
  class="annotation-column glass-surface glass-surface-static"
  class:density-review={densityMode === 'review'}
>
  <header class="annotation-header">
    <div>
      <span class="annotation-kicker">Rationales</span>
      <h2>Capture the human reason</h2>
    </div>
  </header>

  <div class="annotation-scroll">
    <section class="annotation-feature">
      {#if isComposing}
        <div class="annotation-feature-meta">
          <span class="annotation-badge">Composing</span>
          <span class="annotation-line">
            {#if selectedChange}
              L{selectedChange.location.line}
            {:else}
              Note draft
            {/if}
          </span>
        </div>

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
        <div class="annotation-feature-meta">
          <span class="annotation-badge stale">Stale note</span>
          <span class="annotation-line">Needs confirmation</span>
        </div>

        <div class="annotation-summary-card stale">
          <p class="annotation-summary-copy">{selectedAnnotationEntry.annotation.rationale}</p>
          {#if selectedAnnotationEntry.annotation.target.excerpt}
            <p class="annotation-summary-meta">Last target: “{selectedAnnotationEntry.annotation.target.excerpt}”</p>
          {/if}
          <p class="annotation-summary-meta">
            This note no longer maps cleanly to a single edit.
          </p>
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
        <div class="annotation-feature-meta">
          <span class="annotation-badge">
            {selectedAnnotationEntry ? 'Saved note' : 'Selected edit'}
          </span>
          <span class="annotation-line">L{selectedChange.location.line}</span>
        </div>

        <div class="annotation-summary-card">
          <p class="annotation-summary-excerpt">“{selectedChange.text}”</p>
          {#if selectedAnnotationEntry}
            <p class="annotation-summary-copy">{selectedAnnotationEntry.annotation.rationale}</p>
            {#if selectedAnnotationEntry.annotation.matchedRule}
              <p class="annotation-summary-meta">Matches WRITING.md: {selectedAnnotationEntry.annotation.matchedRule}</p>
            {/if}
          {:else}
            <p class="annotation-summary-meta">
              No rationale saved yet. Add one only when the why matters downstream.
            </p>
          {/if}
        </div>

        {#if relatedLintFindings.length > 0}
          <div class="annotation-inline-notes">
            {#each relatedLintFindings as finding}
              <div class="annotation-inline-note">
                <span>{finding.label}</span>
                <p>{finding.snippet}</p>
              </div>
            {/each}
          </div>
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
        <div class="annotation-empty-state">
          <p>Select an edit from the rail to review it.</p>
          <span>Use ⌘/ only when you actually want to write a rationale.</span>
        </div>
      {/if}
    </section>

    <section class="annotation-section">
      <div class="section-heading">Saved notes</div>
      {#if annotationEntries.length === 0}
        <p class="section-empty">No rationales yet. Keep the important ones; skip the obvious.</p>
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
                  {:else}
                    Needs review
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

  .annotation-header {
    padding: var(--space-5) var(--space-5) var(--space-4);
    border-bottom: 1px solid color-mix(in srgb, var(--paper-edge) 86%, transparent);
  }

  .annotation-kicker,
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

  .annotation-header h2 {
    margin-top: 0.45rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    color: var(--ink);
    letter-spacing: -0.01em;
  }

  .annotation-scroll {
    flex: 1;
    overflow: auto;
    padding: var(--space-5);
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

  .annotation-feature-meta,
  .note-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .annotation-badge,
  .annotation-line,
  .note-line {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
  }

  .annotation-badge.stale {
    color: color-mix(in srgb, var(--delete-ink) 88%, var(--ink));
  }

  .annotation-empty-state,
  .annotation-summary-card {
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: var(--radius-xl);
    padding: var(--space-4);
    background: color-mix(in srgb, var(--paper-bright) 58%, transparent);
  }

  .annotation-summary-card.stale {
    border-color: color-mix(in srgb, var(--delete-line) 58%, transparent);
    background: color-mix(in srgb, var(--delete-bg) 32%, var(--paper-bright));
  }

  .annotation-empty-state p,
  .annotation-summary-excerpt,
  .annotation-summary-copy,
  .note-card p,
  .annotation-inline-note p {
    font-family: var(--font-body);
    font-size: var(--text-annotation);
    line-height: 1.5;
    color: var(--annotation-ink);
  }

  .annotation-summary-excerpt {
    font-style: italic;
  }

  .annotation-summary-copy {
    margin-top: 0.65rem;
  }

  .annotation-empty-state span,
  .section-empty,
  .annotation-summary-meta {
    display: block;
    margin-top: 0.45rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    line-height: 1.45;
  }

  .annotation-inline-notes,
  .note-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .annotation-inline-note {
    border-top: 1px solid color-mix(in srgb, var(--paper-edge) 78%, transparent);
    padding-top: var(--space-2);
  }

  .annotation-inline-note span {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--slop-ink);
    text-transform: uppercase;
    letter-spacing: 0.04em;
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

  .density-review .annotation-header,
  .density-review .annotation-scroll {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
</style>
