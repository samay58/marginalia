<script>
  import AnnotationEditor from './AnnotationEditor.svelte';

  /** @typedef {import('../utils/diff.js').Change} Change */
  /** @typedef {import('../stores/app.js').Annotation} Annotation */

  /** @type {{ selectedChange?: Change | null, annotations?: Map<string, Annotation>, annotatedChanges?: Array<{ change: Change, annotation: Annotation | undefined }>, lintFindings?: Array<any>, densityMode?: 'review' | 'manuscript', onSelectChange?: (change: Change) => void, onSave?: (data: { changeId: string, rationale: string, category?: string }) => void, onRemove?: (data: { changeId: string }) => void }} */
  let {
    selectedChange = null,
    annotations = new Map(),
    annotatedChanges = [],
    lintFindings = [],
    densityMode = 'manuscript',
    onSelectChange = () => {},
    onSave = () => {},
    onRemove = () => {},
  } = $props();

  /** @type {AnnotationEditor | null} */
  let editorRef = $state(null);

  const selectedAnnotation = $derived.by(() =>
    selectedChange ? annotations.get(selectedChange.id) || null : null
  );

  const relatedLintFindings = $derived.by(() => {
    if (!selectedChange) return [];
    return lintFindings.filter((finding) => finding.line === selectedChange.location.line).slice(0, 3);
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
      <span class="annotation-kicker">Annotations</span>
      <h2>Why this edit matters</h2>
    </div>
  </header>

  <div class="annotation-scroll">
    <section class="annotation-feature">
      {#if selectedChange}
        <div class="annotation-feature-meta">
          <span class="annotation-badge">
            {selectedChange.type === 'deletion' ? 'Edit' : 'Edit'}
          </span>
          <span class="annotation-line">L{selectedChange.location.line}</span>
        </div>

        <AnnotationEditor
          bind:this={editorRef}
          changeId={selectedChange.id}
          excerpt={selectedChange.text}
          currentRationale={selectedAnnotation?.rationale || ''}
          currentCategory={selectedAnnotation?.category || ''}
          autofocus={true}
          saveLabel={selectedAnnotation ? 'Update rationale' : 'Save rationale'}
          onSave={onSave}
          onRemove={onRemove}
        />
      {:else}
        <div class="annotation-empty-state">
          <p>Select a change to capture the thinking behind it.</p>
          <span>Use the rail, anchor marks, or ⌘/.</span>
        </div>
      {/if}
    </section>

    {#if relatedLintFindings.length > 0}
      <section class="annotation-section">
        <div class="section-heading">Related slop</div>
        <div class="note-stack">
          {#each relatedLintFindings as finding}
            <article class="note-card slop-card">
              <span class="note-label">{finding.label}</span>
              <p>{finding.snippet}</p>
            </article>
          {/each}
        </div>
      </section>
    {/if}

    <section class="annotation-section">
      <div class="section-heading">Saved notes</div>
      {#if annotatedChanges.length === 0}
        <p class="section-empty">No rationales yet. Save the important ones so the agent gets the why, not just the diff.</p>
      {:else}
        <div class="note-stack">
          {#each annotatedChanges as entry, index}
            <button
              type="button"
              class="note-card control-motion control-focus"
              class:selected={selectedChange?.id === entry.change.id}
              class:density-manuscript={densityMode === 'manuscript'}
              onclick={() => onSelectChange(entry.change)}
            >
              <div class="note-card-top">
                <span class="note-label">Edit {index + 1}</span>
                <span class="note-line">L{entry.change.location.line}</span>
              </div>
              <p>{entry.annotation?.rationale || ''}</p>
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
    color: var(--delete-ink);
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

  .annotation-feature {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .annotation-feature-meta {
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

  .annotation-empty-state {
    border: 1px dashed color-mix(in srgb, var(--paper-edge) 95%, transparent);
    border-radius: var(--radius-xl);
    padding: var(--space-4);
    background: color-mix(in srgb, var(--paper-bright) 40%, transparent);
  }

  .annotation-empty-state p {
    font-family: var(--font-body);
    font-size: var(--text-annotation);
    color: var(--annotation-ink);
    font-style: italic;
  }

  .annotation-empty-state span,
  .section-empty {
    display: block;
    margin-top: 0.4rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    line-height: 1.45;
  }

  .annotation-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .note-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .note-card {
    width: 100%;
    text-align: left;
    padding: 0.8rem 0.95rem;
    border-radius: var(--radius-xl);
    border: 1px solid color-mix(in srgb, var(--chrome-border) 95%, transparent);
    background: color-mix(in srgb, var(--paper-bright) 70%, transparent);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), var(--shadow-note);
  }

  .note-card.density-manuscript {
    border-radius: var(--radius-lg);
    box-shadow: none;
    background: transparent;
    border-color: color-mix(in srgb, var(--paper-edge) 85%, transparent);
  }

  .note-card.selected {
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    background: color-mix(in srgb, var(--accent-subtle) 32%, var(--paper-bright));
  }

  .note-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    margin-bottom: 0.35rem;
  }

  .note-card p {
    font-family: var(--font-body);
    font-size: var(--text-annotation);
    line-height: 1.45;
    color: var(--annotation-ink);
    font-style: italic;
  }

  .slop-card {
    border-color: color-mix(in srgb, var(--slop-line) 70%, transparent);
    background: color-mix(in srgb, var(--slop-bg) 78%, var(--paper-bright));
    box-shadow: none;
  }

  .slop-card .note-label {
    color: color-mix(in srgb, var(--slop-ink) 85%, var(--ink));
  }

  .density-review .annotation-header,
  .density-review .annotation-scroll {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
</style>
