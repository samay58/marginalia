<script>
  /** @typedef {'minimize' | 'maximize' | 'close'} Kind */
  /** @type {{ kind: Kind, onClick?: (e: MouseEvent) => void, size?: number, onNavy?: boolean }} */
  let { kind, onClick, size = 24, onNavy = true } = $props();
</script>

<button
  type="button"
  class="ctl"
  style:width="{size}px"
  style:height="{size}px"
  style:color={onNavy ? 'var(--chrome-highlight)' : 'var(--ink)'}
  aria-label={kind}
  data-tauri-drag-region="false"
  onclick={onClick}
>
  {#if kind === 'minimize'}
    <span class="bar" style:background-color="var(--ink)"></span>
  {:else if kind === 'maximize'}
    <span class="box" style:border-color="var(--ink)"></span>
  {:else}
    <span class="x">✕</span>
  {/if}
</button>

<style>
  .ctl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .ctl:active {
    box-shadow: var(--bevel-sunken-1);
  }
  .bar {
    width: 10px;
    height: 2px;
    margin-top: 8px;
  }
  .box {
    width: 12px;
    height: 10px;
    background: transparent;
    border: 2px solid;
  }
  .x {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    line-height: 13px;
    color: var(--ink);
  }
</style>
