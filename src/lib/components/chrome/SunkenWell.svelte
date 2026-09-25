<script>
  /** @type {{ children: import('svelte').Snippet, pad?: string }} */
  let { children, pad = '14px 12px' } = $props();
</script>

<div class="well" style:padding={pad}>
  {@render children()}
</div>

<style>
  .well {
    background: var(--rationale-well-bg);
    border: 1px solid var(--chrome-shadow);
    box-shadow: var(--bevel-sunken-1);
  }
</style>
