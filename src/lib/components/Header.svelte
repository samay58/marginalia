<script>
  /** @type {{ filename?: string, hasChanges?: boolean, densityMode?: 'review' | 'manuscript', onSetDensity?: (mode: 'review' | 'manuscript') => void, onDone?: () => void }} */
  let {
    filename = 'Untitled',
    hasChanges = false,
    densityMode = 'manuscript',
    onSetDensity = () => {},
    onDone = () => {}
  } = $props();
</script>

<header class="header no-select glass-surface glass-surface-focal" data-tauri-drag-region>
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
    <div class="density-switch" role="group" aria-label="Density mode">
      <button
        class="density-option control-motion control-focus"
        class:active={densityMode === 'review'}
        onclick={() => onSetDensity('review')}
      >
        Review
      </button>
      <button
        class="density-option control-motion control-focus"
        class:active={densityMode === 'manuscript'}
        onclick={() => onSetDensity('manuscript')}
      >
        Manuscript
      </button>
    </div>
    <span class="hint">Esc</span>
    <button class="done-button control-motion control-focus control-raise" onclick={onDone}>
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

  .density-switch {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--paper-matte) 70%, transparent);
    border: 1px solid var(--paper-edge);
  }

  .density-option {
    border: none;
    border-radius: calc(var(--radius-md) - 2px);
    background: transparent;
    color: var(--ink-faded);
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    padding: 3px 8px;
    cursor: pointer;
  }

  .density-option:hover {
    color: var(--ink);
  }

  .density-option.active {
    background: var(--paper-bright);
    color: var(--ink);
    box-shadow: var(--shadow-sm);
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

  @media (max-width: 860px) {
    .density-switch {
      display: none;
    }
  }

</style>
