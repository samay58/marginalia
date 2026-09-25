<script>
  /** @type {{ label: string, on?: boolean, warn?: boolean }} */
  let { label, on = true, warn = false } = $props();
</script>

<span class="led-chip" class:warn role="status" aria-live="polite">
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
  .led-chip.warn {
    background: var(--chip-red-bg);
    border-color: var(--chip-red-border);
  }
  .led-chip.warn .dot {
    background: var(--chip-red-text);
    border-color: var(--chip-red-text);
  }
  .led-chip.warn .lab {
    color: var(--chip-red-text);
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
