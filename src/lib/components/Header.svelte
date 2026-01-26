<script>
  /** @type {{ filename?: string, hasChanges?: boolean, onDone?: () => void }} */
  let {
    filename = 'Untitled',
    hasChanges = false,
    onDone = () => {}
  } = $props();
</script>

<header class="header no-select glass-surface" data-tauri-drag-region>
  <div class="traffic-lights-space">
    <!-- Space for macOS traffic lights -->
  </div>

  <div class="filename" data-tauri-drag-region>
    <span class="filename-text">{filename}</span>
    {#if hasChanges}
      <span class="modified-indicator" title="Unsaved changes">●</span>
    {/if}
  </div>

  <div class="header-actions">
    <span class="hint">Esc</span>
    <button class="done-button" onclick={onDone}>
      Done
    </button>
  </div>
</header>

<style>
  .header {
    height: var(--header-height);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--space-4);
    background: transparent;
    border-bottom: var(--border-subtle);
    position: relative;
    z-index: 100;
  }

  .traffic-lights-space {
    /* Reserve space for macOS traffic lights */
    width: 70px;
    flex-shrink: 0;
  }

  .filename {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .filename-text {
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    color: var(--ink);
    font-weight: 500;
  }

  .modified-indicator {
    color: var(--accent);
    font-size: 10px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .hint {
    font-family: var(--font-mono);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    padding: var(--space-1) var(--space-2);
    background: var(--paper);
    border-radius: var(--radius-sm);
    border: var(--border-subtle);
  }

  .done-button {
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

  .done-button:hover {
    background: var(--accent-hover);
  }

  .done-button:active {
    transform: scale(0.98);
  }
</style>
