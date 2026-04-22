<script>
  /** @type {{ tabs: Array<{ id: string, label: string }>, activeId: string, onSelect?: (id: string) => void }} */
  let { tabs, activeId, onSelect } = $props();
</script>

<div class="strip">
  {#each tabs as tab}
    <button
      type="button"
      class="tab"
      class:active={tab.id === activeId}
      onclick={() => onSelect?.(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    align-items: flex-end;
    height: var(--tabstrip-h);
    background: var(--tab-inactive);
    border-bottom: 2px solid var(--chrome-shadow);
    box-shadow: inset 0 1px 0 var(--chrome-highlight);
    padding: 4px 6px 0 6px;
    gap: 2px;
    flex-shrink: 0;
  }
  .tab {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 26px;
    background: var(--tab-inactive);
    border: 1px solid var(--navy-shadow);
    box-shadow:
      inset 1px 1px 0 var(--chrome-highlight),
      inset -1px -1px 0 var(--chrome-shadow);
    font-family: var(--font-chrome);
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
    white-space: nowrap;
    cursor: pointer;
  }
  .tab.active {
    height: 34px;
    background: var(--window-body);
    border-bottom: 1px solid var(--window-body);
    box-shadow:
      inset 1px 1px 0 var(--chrome-highlight),
      inset -1px 0 0 var(--chrome-shadow);
    margin-bottom: -1px;
    font-weight: 700;
    color: var(--ink);
  }
</style>
