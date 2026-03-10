<script>
  /** @type {{ excerpt?: string, value?: string, emptyLabel?: string, saveLabel?: string, autofocus?: boolean, canRemove?: boolean, onInput?: (value: string) => void, onSave?: () => void, onCancel?: () => void, onRemove?: () => void }} */
  let {
    excerpt = '',
    value = '',
    emptyLabel = 'Capture why this change matters.',
    saveLabel = 'Save rationale',
    autofocus = false,
    canRemove = false,
    onInput = () => {},
    onSave = () => {},
    onCancel = () => {},
    onRemove = () => {},
  } = $props();

  /** @type {HTMLTextAreaElement | null} */
  let textareaEl = $state(null);

  $effect(() => {
    autofocus;
    if (autofocus && textareaEl) {
      queueMicrotask(() => {
        textareaEl?.focus();
      });
    }
  });

  /** @param {Event & { currentTarget: HTMLTextAreaElement }} event */
  function handleInput(event) {
    onInput(event.currentTarget.value);
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onSave();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
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
    rows="5"
    value={value}
    placeholder="Remove the hedging. Say the point directly."
    oninput={handleInput}
    onkeydown={handleKeydown}
  ></textarea>

  <div class="annotation-actions">
    <div class="annotation-actions-left">
      {#if canRemove}
        <button
          type="button"
          class="annotation-remove control-motion control-focus"
          onclick={onRemove}
        >
          Remove
        </button>
      {/if}
    </div>

    <div class="annotation-actions-right">
      <button
        type="button"
        class="annotation-cancel control-motion control-focus"
        onclick={onCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        class="annotation-save control-motion control-focus control-raise"
        onclick={onSave}
        disabled={!value.trim()}
      >
        {saveLabel}
      </button>
    </div>
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
    line-height: 1.5;
    font-style: italic;
    color: var(--annotation-muted);
  }

  .annotation-empty {
    color: var(--ink-ghost);
  }

  .annotation-input {
    width: 100%;
    min-height: 7rem;
    resize: vertical;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in srgb, var(--paper-bright) 74%, transparent);
    color: var(--annotation-ink);
    padding: var(--space-3) var(--space-4);
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.55;
  }

  .annotation-input::placeholder {
    color: var(--annotation-muted);
  }

  .annotation-actions,
  .annotation-actions-right {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .annotation-actions {
    justify-content: space-between;
  }

  .annotation-remove,
  .annotation-cancel,
  .annotation-save {
    border-radius: 999px;
    padding: 0.45rem 0.9rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    border: 1px solid transparent;
    cursor: pointer;
  }

  .annotation-remove,
  .annotation-cancel {
    color: var(--ink-faded);
    background: transparent;
    border-color: color-mix(in srgb, var(--paper-edge) 90%, transparent);
  }

  .annotation-remove:hover,
  .annotation-cancel:hover {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--ink-ghost) 80%, transparent);
  }

  .annotation-save {
    color: var(--paper-bright);
    background: var(--accent);
  }

  .annotation-save:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .annotation-save:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
