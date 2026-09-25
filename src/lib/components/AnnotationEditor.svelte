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
    <p class="excerpt">“{excerpt}”</p>
  {:else}
    <p class="excerpt">{emptyLabel}</p>
  {/if}

  <textarea
    bind:this={textareaEl}
    class="field"
    rows="5"
    value={value}
    placeholder="Why did you make this change?"
    oninput={handleInput}
    onkeydown={handleKeydown}
  ></textarea>

  <div class="actions">
    {#if canRemove}
      <button type="button" class="btn btn-danger" onclick={onRemove}>Remove</button>
    {/if}
    <span class="spacer"></span>
    <button type="button" class="btn" onclick={onCancel}>Cancel</button>
    <button type="button" class="btn btn-primary" onclick={onSave} disabled={!value.trim()}>
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

  .excerpt {
    font-size: var(--text-sm);
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .spacer {
    flex: 1;
  }
</style>
