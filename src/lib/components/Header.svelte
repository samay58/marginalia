<script>
  /** @type {{ filename?: string, hasChanges?: boolean, editCount?: number, densityMode?: 'review' | 'manuscript', onSetDensity?: (mode: 'review' | 'manuscript') => void, onDone?: () => void }} */
  let {
    filename = 'Untitled',
    hasChanges = false,
    editCount = 0,
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
    {#if editCount > 0}
      <span class="edit-count">{editCount} edit{editCount === 1 ? '' : 's'}</span>
    {:else if hasChanges}
      <span class="modified-indicator" title="Unsaved changes">Unsaved</span>
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
    padding: 0 var(--desk-padding-x);
    background: transparent;
    border-bottom: 1px solid color-mix(in srgb, var(--chrome-border) 95%, transparent);
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
    font-size: 0.8125rem;
    color: var(--ink-ghost);
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .edit-count,
  .modified-indicator {
    font-family: var(--font-ui);
    font-size: 0.6875rem;
    line-height: 1;
    color: var(--delete-ink);
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
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
    border-radius: 999px;
    background: color-mix(in srgb, var(--paper-matte) 76%, transparent);
    border: 1px solid color-mix(in srgb, var(--paper-edge) 92%, transparent);
  }

  .density-option {
    border: none;
    border-radius: 999px;
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
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .hint {
    font-family: var(--font-mono);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    padding: var(--space-1) var(--space-2);
    background: color-mix(in srgb, var(--paper-matte) 92%, transparent);
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 92%, transparent);
  }

  .done-button {
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    font-weight: 500;
    color: var(--paper-bright);
    background: var(--accent);
    border: none;
    border-radius: 999px;
    padding: 0.45rem 0.95rem;
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
