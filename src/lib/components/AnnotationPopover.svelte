<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  /** @type {{ changeId?: string, text?: string, currentRationale?: string, x?: number, y?: number, visible?: boolean }} */
  let {
    changeId = '',
    text = '',
    currentRationale = '',
    x = 0,
    y = 0,
    visible = false
  } = $props();

  let rationale = $state('');
  let inputEl = $state(null);

  // Category suggestions
  const categories = [
    { label: 'Tone', value: 'tone' },
    { label: 'Clarity', value: 'clarity' },
    { label: 'Accuracy', value: 'accuracy' },
    { label: 'Style', value: 'style' },
    { label: 'Structure', value: 'structure' },
  ];

  let selectedCategory = $state('');

  // Sync local rationale with prop when popover opens
  $effect(() => {
    // Reading both visible and currentRationale makes this effect reactive to both
    const isVisible = visible;
    const propRationale = currentRationale;
    if (isVisible) {
      rationale = propRationale || '';
      if (inputEl) {
        inputEl.focus();
      }
    }
  });

  function handleSubmit() {
    if (rationale.trim()) {
      dispatch('save', {
        changeId,
        rationale: rationale.trim(),
        category: selectedCategory || undefined,
      });
    }
    close();
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  function close() {
    dispatch('close');
    rationale = '';
    selectedCategory = '';
  }

  function handleRemove() {
    dispatch('remove', { changeId });
    close();
  }
</script>

{#if visible}
  <div
    class="popover-backdrop"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="button"
    tabindex="-1"
  ></div>

  <div
    class="popover"
    style="left: {x}px; top: {y}px;"
    role="dialog"
    aria-label="Add annotation"
  >
    <div class="popover-header">
      <span class="popover-title">Add rationale</span>
      {#if currentRationale}
        <button class="remove-btn" onclick={handleRemove} title="Remove annotation">
          ×
        </button>
      {/if}
    </div>

    {#if text}
      <div class="change-preview">
        <span class="preview-text">{text.slice(0, 50)}{text.length > 50 ? '...' : ''}</span>
      </div>
    {/if}

    <input
      bind:this={inputEl}
      type="text"
      class="rationale-input"
      placeholder="e.g., No hedging, Quantify the miss"
      bind:value={rationale}
      onkeydown={handleKeydown}
    />

    <div class="category-row">
      {#each categories as cat}
        <button
          class="category-chip"
          class:selected={selectedCategory === cat.value}
          onclick={() => selectedCategory = selectedCategory === cat.value ? '' : cat.value}
        >
          {cat.label}
        </button>
      {/each}
    </div>

    <div class="popover-footer">
      <button class="cancel-btn" onclick={close}>Cancel</button>
      <button class="save-btn" onclick={handleSubmit} disabled={!rationale.trim()}>
        Save
      </button>
    </div>
  </div>
{/if}

<style>
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
  }

  .popover {
    position: fixed;
    z-index: 201;
    width: 320px;
    background: var(--paper-bright);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    border: var(--border-subtle);
    overflow: hidden;
  }

  .popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-subtle);
  }

  .popover-title {
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    font-weight: 500;
    color: var(--ink);
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--ink-ghost);
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
  }

  .remove-btn:hover {
    background: var(--struck-bg);
    color: var(--struck-text);
  }

  .change-preview {
    padding: var(--space-2) var(--space-4);
    background: var(--paper-matte);
  }

  .preview-text {
    font-family: var(--font-body);
    font-size: var(--text-ui-small);
    color: var(--ink-faded);
    font-style: italic;
  }

  .rationale-input {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: none;
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    color: var(--ink);
    background: transparent;
    outline: none;
  }

  .rationale-input::placeholder {
    color: var(--ink-ghost);
  }

  .category-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-top: var(--border-subtle);
  }

  .category-chip {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-faded);
    background: var(--paper);
    border: var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .category-chip:hover {
    background: var(--paper-matte);
    color: var(--ink);
  }

  .category-chip.selected {
    background: var(--accent-subtle);
    border-color: var(--accent);
    color: var(--accent);
  }

  .popover-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-top: var(--border-subtle);
    background: var(--paper-matte);
  }

  .cancel-btn {
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    color: var(--ink-faded);
    background: none;
    border: none;
    padding: var(--space-1) var(--space-3);
    cursor: pointer;
  }

  .cancel-btn:hover {
    color: var(--ink);
  }

  .save-btn {
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    font-weight: 500;
    color: var(--paper-bright);
    background: var(--accent);
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-1) var(--space-4);
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .save-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
