<script>
  /** @type {{ editCount?: number, slopCount?: number, annotationCount?: number, autosaveLabel?: string, degradedMode?: boolean, drawerOpen?: boolean, compactLayout?: boolean, rightPaneMode?: 'annotations' | 'reference', hasReferences?: boolean, onToggleDrawer?: () => void, onToggleReference?: () => void }} */
  let {
    editCount = 0,
    slopCount = 0,
    annotationCount = 0,
    autosaveLabel = '',
    degradedMode = false,
    drawerOpen = false,
    compactLayout = false,
    rightPaneMode = 'annotations',
    hasReferences = false,
    onToggleDrawer = () => {},
    onToggleReference = () => {},
  } = $props();

  const referenceLabel = $derived.by(() => {
    if (compactLayout) return hasReferences ? 'reference' : 'add ref';
    return rightPaneMode === 'reference' ? 'annotations' : 'reference';
  });
</script>

<footer class="status-bar glass-surface glass-surface-focal">
  <div class="status-summary">
    <span>{editCount} edit{editCount === 1 ? '' : 's'}</span>
    <span>{slopCount} slop hint{slopCount === 1 ? '' : 's'}</span>
    <span>{annotationCount} annotation{annotationCount === 1 ? '' : 's'}</span>
  </div>

  <div class="status-health">
    {#if autosaveLabel}
      <span class="health-pill" class:warning={degradedMode}>{autosaveLabel}</span>
    {/if}
    {#if degradedMode}
      <span class="health-pill warning">Degraded mode</span>
    {/if}
  </div>

  <div class="status-actions">
    <button type="button" class="status-action control-motion control-focus" onclick={onToggleDrawer}>
      <span class="key-pill">⌘G</span>
      <span>{drawerOpen ? 'hide notes' : 'notes'}</span>
    </button>
    <span class="status-action">
      <span class="key-pill">⌘/</span>
      <span>rationale</span>
    </span>
    <button
      type="button"
      class="status-action control-motion control-focus"
      onclick={onToggleReference}
    >
      <span class="key-pill">⌘⇧O</span>
      <span>{referenceLabel}</span>
    </button>
    <span class="status-action">
      <span class="key-pill">⌘Z</span>
      <span>undo</span>
    </span>
    <span class="status-action emphasis">
      <span class="key-pill">Esc</span>
      <span>done</span>
    </span>
  </div>
</footer>

<style>
  .status-bar {
    height: var(--status-bar-height);
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: var(--space-4);
    padding: 0 var(--desk-padding-x);
    border-top: 1px solid color-mix(in srgb, var(--chrome-border) 95%, transparent);
    background: var(--status-bg);
    box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.08);
  }

  .status-summary,
  .status-health,
  .status-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .status-summary {
    font-family: var(--font-ui);
    font-size: var(--text-status);
    color: var(--ink-ghost);
    white-space: nowrap;
  }

  .status-health {
    justify-self: center;
  }

  .health-pill {
    border-radius: 999px;
    padding: 0.2rem 0.5rem;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--ink-faded);
    white-space: nowrap;
  }

  .health-pill.warning {
    color: color-mix(in srgb, var(--slop-ink) 78%, var(--ink));
    border-color: color-mix(in srgb, var(--slop-line) 75%, transparent);
    background: color-mix(in srgb, var(--slop-bg) 80%, transparent);
  }

  .status-actions {
    justify-self: end;
    gap: var(--space-4);
    white-space: nowrap;
  }

  .status-action {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: transparent;
    border: none;
    color: var(--ink-ghost);
    font-family: var(--font-ui);
    font-size: var(--text-status);
    padding: 0;
  }

  button.status-action {
    cursor: pointer;
  }

  button.status-action:hover {
    color: var(--ink);
  }

  .status-action.emphasis {
    color: var(--ink-faded);
  }

  .key-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.85rem;
    border-radius: 4px;
    padding: 0.15rem 0.4rem;
    background: color-mix(in srgb, var(--paper-matte) 92%, transparent);
    color: var(--ink-faded);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
  }

  @media (max-width: 1200px) {
    .status-bar {
      grid-template-columns: 1fr;
      height: auto;
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
    }

    .status-health {
      justify-self: start;
    }

    .status-actions {
      justify-self: start;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
  }
</style>
