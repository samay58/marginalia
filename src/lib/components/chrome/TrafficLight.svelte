<script>
  /** @typedef {'red' | 'yellow' | 'blue'} Tone */
  /** @type {{ tone: Tone, onClick?: (e: MouseEvent) => void, label?: string }} */
  let { tone, onClick, label } = $props();

  const fill = {
    red: 'var(--traffic-red)',
    yellow: 'var(--traffic-yellow)',
    blue: 'var(--traffic-blue)'
  };
</script>

<button
  type="button"
  class="dot"
  style:background-color={fill[tone]}
  aria-label={label ?? tone}
  data-tauri-drag-region="false"
  onclick={onClick}
></button>

<style>
  .dot {
    width: 16px;
    height: 16px;
    border-radius: 16px;
    border: 1px solid var(--navy-shadow);
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.55),
      inset -1px -1px 0 rgba(0, 0, 0, 0.35);
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .dot:active {
    box-shadow:
      inset 1px 1px 0 rgba(0, 0, 0, 0.35),
      inset -1px -1px 0 rgba(255, 255, 255, 0.55);
  }
</style>
