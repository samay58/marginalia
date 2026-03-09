<script>
  const categories = [
    { label: 'Tone', value: 'tone' },
    { label: 'Clarity', value: 'clarity' },
    { label: 'Accuracy', value: 'accuracy' },
    { label: 'Style', value: 'style' },
    { label: 'Structure', value: 'structure' },
  ];

  /** @type {{ changeId?: string, excerpt?: string, currentRationale?: string, currentCategory?: string, emptyLabel?: string, saveLabel?: string, autofocus?: boolean, onSave?: (data: { changeId: string, rationale: string, category?: string }) => void, onRemove?: (data: { changeId: string }) => void }} */
  let {
    changeId = '',
    excerpt = '',
    currentRationale = '',
    currentCategory = '',
    emptyLabel = 'Capture why this change matters.',
    saveLabel = 'Save rationale',
    autofocus = false,
    onSave = () => {},
    onRemove = () => {},
  } = $props();

  let rationale = $state('');
  let selectedCategory = $state('');
  /** @type {HTMLTextAreaElement | null} */
  let textareaEl = $state(null);

  $effect(() => {
    changeId;
    currentRationale;
    currentCategory;
    rationale = currentRationale || '';
    selectedCategory = currentCategory || '';
  });

  $effect(() => {
    autofocus;
    changeId;
    if (autofocus && textareaEl) {
      queueMicrotask(() => {
        textareaEl?.focus();
      });
    }
  });

  function handleSave() {
    const trimmed = rationale.trim();
    if (!changeId || !trimmed) return;
    onSave({
      changeId,
      rationale: trimmed,
      category: selectedCategory || undefined,
    });
  }

  function handleRemove() {
    if (!changeId) return;
    onRemove({ changeId });
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSave();
    }
  }

  export function focusEditor() {
    textareaEl?.focus();
  }
</script>

<div class="annotation-editor">
  {#if excerpt}
    <p class="annotation-excerpt">“{excerpt}”</p>
  {:else}
    <p class="annotation-empty">{emptyLabel}</p>
  {/if}

  <textarea
    bind:this={textareaEl}
    class="annotation-input control-focus"
    rows="4"
    bind:value={rationale}
    placeholder="Remove the hedging. Say the point directly."
    onkeydown={handleKeydown}
  ></textarea>

  <div class="annotation-categories">
    {#each categories as category}
      <button
        type="button"
        class="category-chip control-motion control-focus"
        class:selected={selectedCategory === category.value}
        onclick={() => {
          selectedCategory = selectedCategory === category.value ? '' : category.value;
        }}
      >
        {category.label}
      </button>
    {/each}
  </div>

  <div class="annotation-actions">
    <button
      type="button"
      class="annotation-remove control-motion control-focus"
      onclick={handleRemove}
      disabled={!currentRationale}
    >
      Remove
    </button>
    <button
      type="button"
      class="annotation-save control-motion control-focus control-raise"
      onclick={handleSave}
      disabled={!changeId || !rationale.trim()}
    >
      {saveLabel}
    </button>
  </div>
</div>

<style>
  .annotation-editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .annotation-excerpt,
  .annotation-empty {
    font-family: var(--font-body);
    font-size: var(--text-ui-small);
    line-height: 1.45;
    font-style: italic;
    color: var(--annotation-muted);
  }

  .annotation-empty {
    color: var(--ink-ghost);
  }

  .annotation-input {
    width: 100%;
    min-height: 6.25rem;
    resize: vertical;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in srgb, var(--paper-bright) 72%, transparent);
    color: var(--annotation-ink);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-body);
    font-size: var(--text-annotation);
    font-style: italic;
    line-height: 1.45;
  }

  .annotation-input::placeholder {
    color: var(--annotation-muted);
  }

  .annotation-categories {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .category-chip {
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-faded);
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    padding: 0.3rem 0.65rem;
    cursor: pointer;
  }

  .category-chip:hover {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--ink-ghost) 80%, transparent);
  }

  .category-chip.selected {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    background: color-mix(in srgb, var(--accent-subtle) 85%, transparent);
  }

  .annotation-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .annotation-remove,
  .annotation-save {
    border-radius: 999px;
    padding: 0.45rem 0.85rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    border: 1px solid transparent;
    cursor: pointer;
  }

  .annotation-remove {
    color: var(--ink-ghost);
    background: transparent;
    border-color: color-mix(in srgb, var(--paper-edge) 90%, transparent);
  }

  .annotation-remove:hover:not(:disabled) {
    color: var(--delete-ink);
    border-color: color-mix(in srgb, var(--delete-ink) 40%, transparent);
    background: color-mix(in srgb, var(--delete-bg) 75%, transparent);
  }

  .annotation-save {
    color: var(--paper-bright);
    background: var(--accent);
  }

  .annotation-save:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .annotation-remove:disabled,
  .annotation-save:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
