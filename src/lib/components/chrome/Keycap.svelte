<script>
  /** @type {{ keys: string, label: string, onClick?: () => void }} */
  let { keys, label, onClick } = $props();
</script>

{#if onClick}
  <button type="button" class="kc kc-btn" onclick={onClick}>
    <span class="cap">{keys}</span>
    <span class="lab">{label}</span>
  </button>
{:else}
  <span class="kc">
    <span class="cap">{keys}</span>
    <span class="lab">{label}</span>
  </span>
{/if}

<style>
  .kc, .kc-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: default;
  }
  .kc-btn { cursor: pointer; }
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
  .kc-btn:active .cap { box-shadow: var(--bevel-sunken-1); }
  .lab {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink);
    white-space: nowrap;
  }
</style>
