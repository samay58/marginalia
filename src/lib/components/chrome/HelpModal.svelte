<script>
  /** @type {{ open: boolean, onClose: () => void }} */
  let { open, onClose } = $props();

  const shortcuts = [
    { keys: '⌘ G', label: 'Toggle session notes' },
    { keys: '⌘ /', label: 'New rationale on selected edit' },
    { keys: '⌘ ⇧ O', label: 'Toggle references' },
    { keys: '⌘ O', label: 'Open another draft' },
    { keys: '⌘ Z / ⌘ ⇧ Z', label: 'Undo / Redo' },
    { keys: '⌘ ⇧ R', label: 'Toggle Rationale panel' },
    { keys: '⌘ Enter', label: 'Finalize review' },
    { keys: 'ESC', label: 'Finalize or dismiss popover' }
  ];
</script>

{#if open}
  <div
    class="backdrop"
    role="button"
    tabindex="0"
    aria-label="Close help"
    onclick={onClose}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
  >
    <div
      class="modal"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="help-title"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="titlebar">
        <span class="title" id="help-title">Keyboard Shortcuts</span>
        <button class="close" type="button" aria-label="Close" onclick={onClose}>✕</button>
      </div>
      <ul class="kb-list">
        {#each shortcuts as s}
          <li>
            <span class="k">{s.keys}</span>
            <span class="l">{s.label}</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    width: 420px;
    background: var(--window-body);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-window-2);
    display: flex;
    flex-direction: column;
  }
  .titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 34px;
    background: var(--navy-chrome);
    padding: 0 10px;
    border-bottom: 2px solid var(--navy-shadow);
    flex-shrink: 0;
  }
  .title {
    flex: 1;
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chrome-highlight);
  }
  .close {
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    width: 22px;
    height: 22px;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .close:active { box-shadow: var(--bevel-sunken-1); }
  .kb-list {
    list-style: none;
    padding: 12px 16px;
    margin: 0;
  }
  .kb-list li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
  }
  .k {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 56px;
    height: 22px;
    padding: 0 8px;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    color: var(--ink);
    white-space: nowrap;
  }
  .l {
    font-family: var(--font-chrome);
    font-size: 13px;
    color: var(--ink);
  }
</style>
