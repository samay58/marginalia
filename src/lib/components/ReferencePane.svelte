<script>
  /** @type {{ referenceFiles?: Array<{ path: string, name: string, content: string }>, activeReferenceIndex?: number, onSelectIndex?: (index: number) => void, onPickReferenceFile?: () => void }} */
  let {
    referenceFiles = [],
    activeReferenceIndex = 0,
    onSelectIndex = () => {},
    onPickReferenceFile = () => {},
  } = $props();
</script>

<aside class="reference-pane glass-surface glass-surface-static">
  <header class="reference-header">
    <div>
      <span class="reference-kicker">Reference</span>
      <h2>Supporting context</h2>
    </div>
    <button
      type="button"
      class="reference-add control-motion control-focus control-raise"
      onclick={onPickReferenceFile}
      aria-label="Add reference file"
      title="Add reference file (⌘⇧O)"
    >
      ⌘⇧O
    </button>
  </header>

  {#if referenceFiles.length === 0}
    <div class="reference-empty">
      <p>Add a reference file with ⌘⇧O.</p>
      <span>Up to three files stay handy while you review.</span>
    </div>
  {:else}
    <div class="reference-tabs">
      {#each referenceFiles as ref, index}
        <button
          type="button"
          class="reference-tab control-motion control-focus"
          class:active={index === activeReferenceIndex}
          onclick={() => onSelectIndex(index)}
          title={ref.path}
        >
          {ref.name}
        </button>
      {/each}
    </div>

    <div class="reference-content">
      <pre>{referenceFiles[activeReferenceIndex]?.content}</pre>
    </div>
  {/if}
</aside>

<style>
  .reference-pane {
    width: var(--desk-right-width);
    border-left: 1px solid color-mix(in srgb, var(--paper-edge) 86%, transparent);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: color-mix(in srgb, var(--glass-bg-static) 96%, transparent);
  }

  .reference-header {
    padding: var(--space-5) var(--space-5) var(--space-4);
    border-bottom: 1px solid color-mix(in srgb, var(--paper-edge) 86%, transparent);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .reference-kicker {
    display: inline-flex;
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-ghost);
    font-weight: 600;
  }

  .reference-header h2 {
    margin-top: 0.45rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
    color: var(--ink);
    letter-spacing: -0.01em;
  }

  .reference-add {
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-faded);
    padding: 0.45rem 0.7rem;
    font-family: var(--font-mono);
    font-size: var(--text-ui-small);
    cursor: pointer;
  }

  .reference-add:hover {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--ink-ghost) 80%, transparent);
  }

  .reference-empty {
    padding: var(--space-5);
  }

  .reference-empty p {
    font-family: var(--font-body);
    font-size: var(--text-annotation);
    color: var(--annotation-ink);
    font-style: italic;
  }

  .reference-empty span {
    display: block;
    margin-top: 0.45rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
  }

  .reference-tabs {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid color-mix(in srgb, var(--paper-edge) 86%, transparent);
    overflow-x: auto;
  }

  .reference-tab {
    flex-shrink: 0;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-faded);
    padding: 0.35rem 0.75rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    cursor: pointer;
  }

  .reference-tab.active {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--accent) 38%, transparent);
    background: color-mix(in srgb, var(--accent-subtle) 24%, transparent);
  }

  .reference-content {
    flex: 1;
    overflow: auto;
    padding: var(--space-4) var(--space-5) var(--space-5);
  }

  .reference-content pre {
    margin: 0;
    white-space: pre-wrap;
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.65;
    color: var(--ink);
  }
</style>
