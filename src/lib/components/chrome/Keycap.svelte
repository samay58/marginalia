<script>
  /** @type {{ keys: string, label: string }} */
  let { keys, label } = $props();
</script>

<span class="kc">
  <span class="cap">{keys}</span>
  <span class="lab">{label}</span>
</span>

<style>
  .kc {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }
  .cap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 26px;
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
  .lab {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink);
    white-space: nowrap;
  }
</style>
