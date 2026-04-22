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
    gap: 12px;
  }

  .annotation-excerpt {
    margin: 0;
    padding: 8px 10px;
    background: var(--rationale-well-bg);
    border: 1px solid var(--chrome-shadow);
    box-shadow: var(--bevel-sunken-1);
    font-family: var(--font-body);
    font-size: 14px;
    font-style: italic;
    line-height: 20px;
    color: var(--ink);
  }

  .annotation-empty {
    margin: 0;
    font-family: var(--font-body);
    font-size: 14px;
    font-style: italic;
    color: var(--muted);
  }

  .annotation-input {
    width: 100%;
    min-height: 96px;
    padding: 10px 12px;
    background: var(--chrome-highlight);
    border: 1px solid var(--chrome-shadow);
    box-shadow: var(--bevel-sunken-1);
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 22px;
    color: var(--ink);
    resize: vertical;
    outline: none;
  }

  .annotation-input::placeholder {
    color: var(--muted);
    font-style: italic;
  }

  .annotation-input:focus {
    box-shadow:
      var(--bevel-sunken-1),
      inset 0 0 0 1px var(--link);
  }

  .annotation-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .annotation-actions-left,
  .annotation-actions-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .annotation-remove,
  .annotation-cancel,
  .annotation-save {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 72px;
    height: 28px;
    padding: 0 14px;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    font-family: var(--font-chrome);
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
    white-space: nowrap;
  }

  .annotation-remove:focus-visible,
  .annotation-cancel:focus-visible,
  .annotation-save:focus-visible {
    outline: 2px solid var(--link);
    outline-offset: 2px;
  }

  .annotation-remove:active,
  .annotation-cancel:active,
  .annotation-save:active {
    box-shadow: var(--bevel-sunken-1);
  }

  .annotation-save {
    background: var(--chip-green-bg);
    border-color: var(--chip-green-border);
    color: var(--chip-green-text);
  }

  .annotation-save:disabled {
    background: var(--button-face);
    color: var(--muted);
    cursor: not-allowed;
    box-shadow: var(--bevel-raised-1);
    opacity: 0.7;
  }

  .annotation-remove {
    background: var(--chip-red-bg);
    border-color: var(--chip-red-border);
    color: var(--chip-red-text);
  }
</style>
