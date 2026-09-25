<script>
  import { pickShortcuts } from '$lib/review/keymap.js';

  /** @type {{ edits: number, rationales: number, saveState: 'none' | 'saving' | 'saved' | 'error', onShortcut: (id: string) => void }} */
  let { edits, rationales, saveState, onShortcut } = $props();

  const hints = pickShortcuts(['rationale', 'notes', 'references', 'undo']);
  const saveLabel = $derived(
    { none: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved' }[saveState]
  );
</script>

<footer class="statusbar">
  <p class="summary">
    <span>{edits} {edits === 1 ? 'edit' : 'edits'}</span>
    <span>{rationales} {rationales === 1 ? 'rationale' : 'rationales'}</span>
    {#if saveLabel}
      <span
        class="save"
        class:error={saveState === 'error'}
        role="status"
        title={saveState === 'error' ? 'Autosave failed. Your edits are still in the window.' : undefined}
      >{saveLabel}</span>
    {/if}
  </p>

  <nav class="hints" aria-label="Shortcuts">
    {#each hints as hint}
      <button type="button" class="hint" onclick={() => onShortcut(hint.id)}>
        {hint.label} <kbd>{hint.keys}</kbd>
      </button>
    {/each}
  </nav>
</footer>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    height: var(--bottombar-h);
    padding: 0 var(--space-2) 0 var(--space-5);
    border-top: 1px solid var(--rule);
    background: var(--canvas);
    flex-shrink: 0;
  }

  .summary {
    display: flex;
    gap: var(--space-4);
    font-size: var(--text-xs);
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .save.error {
    color: var(--danger);
  }

  .hints {
    display: flex;
    gap: 2px;
    min-width: 0;
    overflow: hidden;
  }

  .hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--text-xs);
    color: var(--ink-2);
    white-space: nowrap;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .hint:hover {
    background: var(--hover);
    color: var(--ink);
  }
</style>
