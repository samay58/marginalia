<script>
  /** @type {{ children: import('svelte').Snippet }} */
  let { children } = $props();
</script>

<div class="ground">
  <div class="window">
    {@render children()}
  </div>
</div>

<style>
  .ground {
    background: var(--desktop-ground);
    padding: var(--window-pad);
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }
  .window {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--window-body);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-window-2);
    overflow: hidden;
  }
</style>
