<script>
  /** @type {{ referenceFiles?: Array<{ path: string, name: string, content: string }>, activeReferenceIndex?: number, onSelectIndex?: (index: number) => void, onPickReferenceFile?: () => void }} */
  let {
    referenceFiles = [],
    activeReferenceIndex = 0,
    onSelectIndex = () => {},
    onPickReferenceFile = () => {},
  } = $props();
</script>

<aside class="reference-pane" aria-label="References">
  <header>
    <h2>References</h2>
    <button type="button" class="btn" onclick={onPickReferenceFile} title="Add a reference file">Add file</button>
  </header>

  {#if referenceFiles.length === 0}
    <p class="empty">Keep up to three files beside the draft while you review.</p>
  {:else}
    <div class="tabs" role="tablist">
      {#each referenceFiles as ref, index}
        <button
          type="button"
          role="tab"
          aria-selected={index === activeReferenceIndex}
          class="tab"
          class:active={index === activeReferenceIndex}
          onclick={() => onSelectIndex(index)}
          title={ref.path}
        >
          {ref.name}
        </button>
      {/each}
    </div>

    <pre class="content">{referenceFiles[activeReferenceIndex]?.content}</pre>
  {/if}
</aside>

<style>
  .reference-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4) var(--space-3) var(--space-2) var(--space-5);
  }

  h2 {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-2);
  }

  .empty {
    padding: 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--ink-3);
  }

  .tabs {
    display: flex;
    gap: 2px;
    padding: 0 var(--space-3) var(--space-2);
    overflow-x: auto;
  }

  .tab {
    height: 28px;
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--text-xs);
    color: var(--ink-2);
    white-space: nowrap;
    cursor: pointer;
  }

  .tab:hover {
    background: var(--hover);
  }

  .tab.active {
    background: var(--press);
    color: var(--ink);
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: 0;
    padding: var(--space-3) var(--space-5) var(--space-8);
    border-top: 1px solid var(--rule);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
