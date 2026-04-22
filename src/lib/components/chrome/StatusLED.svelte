<script>
  /** @type {{ label: string, on?: boolean }} */
  let { label, on = true } = $props();
</script>

<span class="led-chip">
  <span class="dot" class:on></span>
  <span class="lab">{label}</span>
</span>

<style>
  .led-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: var(--chip-green-bg);
    border: 1px solid var(--chip-green-border);
    box-shadow: var(--bevel-raised-chip);
  }
  .dot {
    width: 8px;
    height: 8px;
    background: var(--led-green);
    border: 1px solid var(--chip-green-text);
    box-shadow: inset 1px 1px 0 var(--led-highlight);
    flex-shrink: 0;
  }
  .dot:not(.on) {
    background: var(--muted);
    box-shadow: none;
  }
  .lab {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--chip-green-text);
    white-space: nowrap;
  }
</style>
