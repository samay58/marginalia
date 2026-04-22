<script>
  /** @type {{ onClick?: (e: MouseEvent) => void, children: import('svelte').Snippet }} */
  let { onClick, children } = $props();
</script>

<button type="button" class="btn" onclick={onClick}>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    padding: 5px 12px;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    font-family: var(--font-chrome);
    font-size: 12px;
    font-weight: 700;
    color: var(--ink);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:active {
    box-shadow: var(--bevel-sunken-1);
    padding: 6px 11px 4px 13px;
  }
</style>
