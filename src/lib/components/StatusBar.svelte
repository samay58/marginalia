<script>
  /** @type {{ editCount?: number, annotationCount?: number, autosaveLabel?: string, diffStatus?: 'clean' | 'pending' | 'stale' | 'failed', degradedMode?: boolean, drawerOpen?: boolean, compactLayout?: boolean, hasReferences?: boolean, onToggleDrawer?: () => void, onToggleReference?: () => void }} */
  let {
    editCount = 0,
    annotationCount = 0,
    autosaveLabel = '',
    diffStatus = 'clean',
    degradedMode = false,
    drawerOpen = false,
    compactLayout = false,
    hasReferences = false,
    onToggleDrawer = () => {},
    onToggleReference = () => {},
  } = $props();

  const referenceLabel = $derived.by(() => {
    return hasReferences ? 'reference' : 'add ref';
  });
</script>

<footer class="status-bar glass-surface glass-surface-focal">
  <div class="status-summary">
    <span>{editCount} edit{editCount === 1 ? '' : 's'}</span>
    <span>{annotationCount} annotation{annotationCount === 1 ? '' : 's'}</span>
  </div>

  <div class="status-health">
    {#if autosaveLabel}
      <span class="health-pill" class:warning={degradedMode}>{autosaveLabel}</span>
    {/if}
    {#if diffStatus !== 'clean'}
      <span class="health-pill pending" class:warning={diffStatus === 'stale' || diffStatus === 'failed'}>
        diff {diffStatus}
      </span>
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
    flex: 0 0 var(--status-bar-height);
    display: grid;
    grid-template-columns: auto auto 1fr;
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--desk-padding-x);
    border-top: 1px solid color-mix(in srgb, var(--chrome-border) 95%, transparent);
    background: color-mix(in srgb, var(--paper-bright) 84%, var(--paper-matte));
    box-shadow: 0 -1px 6px rgba(44, 40, 37, 0.07);
  }

  .status-summary,
  .status-health,
  .status-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .status-summary {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    color: var(--ink-faded);
    white-space: nowrap;
  }

  .status-health {
    justify-self: center;
  }

  .health-pill {
    border-radius: 999px;
    padding: 0.12rem 0.4rem;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    color: var(--ink-faded);
    white-space: nowrap;
  }

  .health-pill.warning {
    color: color-mix(in srgb, var(--slop-ink) 78%, var(--ink));
    border-color: color-mix(in srgb, var(--slop-line) 75%, transparent);
    background: color-mix(in srgb, var(--slop-bg) 80%, transparent);
  }

  .health-pill.pending:not(.warning) {
    color: var(--insert-ink);
    border-color: color-mix(in srgb, var(--insert-line) 75%, transparent);
    background: color-mix(in srgb, var(--insert-bg) 72%, transparent);
  }

  .status-actions {
    justify-self: end;
    gap: var(--space-3);
    white-space: nowrap;
  }

  .status-action {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: transparent;
    border: none;
    color: var(--ink-ghost);
    font-family: var(--font-ui);
    font-size: 0.72rem;
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
    min-width: 1.55rem;
    border-radius: 4px;
    padding: 0.08rem 0.3rem;
    background: color-mix(in srgb, var(--paper-matte) 96%, var(--paper-bright));
    color: var(--ink-faded);
    font-family: var(--font-mono);
    font-size: 0.625rem;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
  }

  @media (max-width: 1200px) {
    .status-bar {
      grid-template-columns: 1fr;
      height: auto;
      padding-top: 0.4rem;
      padding-bottom: 0.4rem;
    }

    .status-health {
      justify-self: start;
    }

    .status-actions {
      justify-self: start;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  }
</style>
