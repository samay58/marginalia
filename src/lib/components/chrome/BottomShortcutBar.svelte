<script>
  import Keycap from './Keycap.svelte';
  import StatusLED from './StatusLED.svelte';

  /** @type {{ edits: number, annotations: number, saved: boolean }} */
  let { edits, annotations, saved } = $props();

  const shortcuts = [
    { keys: '⌘ G', label: 'notes' },
    { keys: '⌘ /', label: 'rationale' },
    { keys: '⌘ ⇧ O', label: 'add ref' },
    { keys: '⌘ Z', label: 'undo' },
    { keys: 'ESC', label: 'done' }
  ];
</script>

<div class="bar">
  <div class="status">
    <span class="count">{edits} edits</span>
    <span class="count muted">{annotations} annotations</span>
    <StatusLED label={saved ? 'SAVED' : 'UNSAVED'} on={saved} />
  </div>
  <div class="spacer"></div>
  <div class="shortcuts">
    {#each shortcuts as s}
      <Keycap keys={s.keys} label={s.label} />
    {/each}
  </div>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    height: var(--bottombar-h);
    background: var(--window-body);
    border-top: 2px solid var(--chrome-shadow);
    box-shadow: inset 0 1px 0 var(--chrome-highlight);
    padding: 0 14px;
    gap: 18px;
    flex-shrink: 0;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .count {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink);
    white-space: nowrap;
  }
  .count.muted {
    color: var(--muted);
  }
  .spacer {
    flex: 1;
  }
  .shortcuts {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
</style>
