<script>
  /** @type {{ title: string, folder?: string, mode: 'review' | 'focus', onModeChange: (mode: 'review' | 'focus') => void, onHelp: () => void, onDone: () => void }} */
  let { title, folder = '', mode, onModeChange, onHelp, onDone } = $props();

  const modes = /** @type {const} */ ([
    { id: 'review', label: 'Review' },
    { id: 'focus', label: 'Focus' },
  ]);
</script>

<header class="topbar" data-tauri-drag-region>
  <div class="title" data-tauri-drag-region>
    <span class="name" data-tauri-drag-region>{title}</span>
    {#if folder}<span class="folder" data-tauri-drag-region>{folder}</span>{/if}
  </div>

  <div class="segmented" role="radiogroup" aria-label="View">
    {#each modes as item}
      <button
        type="button"
        role="radio"
        aria-checked={mode === item.id}
        class:active={mode === item.id}
        onclick={() => onModeChange(item.id)}
      >
        {item.label}
      </button>
    {/each}
  </div>

  <div class="actions">
    <button type="button" class="btn icon-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" onclick={onHelp}>?</button>
    <button type="button" class="btn btn-primary" onclick={onDone}>Done</button>
  </div>
</header>

<style>
  .topbar {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-4);
    height: var(--topbar-h);
    padding: 0 var(--space-3) 0 var(--topbar-inset);
    border-bottom: 1px solid var(--rule);
    background: var(--canvas);
    flex-shrink: 0;
  }

  .title {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .name {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder {
    font-size: var(--text-sm);
    color: var(--ink-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .segmented {
    display: inline-flex;
    padding: 2px;
    border-radius: var(--radius);
    background: var(--hover);
  }

  .segmented button {
    height: 26px;
    padding: 0 var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-2);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .segmented button:hover {
    color: var(--ink);
  }

  .segmented button.active {
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 0 0 1px var(--rule), 0 1px 2px rgb(0 0 0 / 6%);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-1);
  }
</style>
