<script>
  import TrafficLight from './TrafficLight.svelte';
  import WindowControl from './WindowControl.svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  /** @type {{ title: string }} */
  let { title } = $props();

  async function minimize() {
    try { await getCurrentWindow().minimize(); } catch {}
  }
  async function zoom() {
    try { await getCurrentWindow().toggleMaximize(); } catch {}
  }
  async function close() {
    try { await getCurrentWindow().close(); } catch {}
  }
</script>

<div class="titlebar drag-region" data-tauri-drag-region>
  <div class="lights">
    <TrafficLight tone="red" onClick={close} label="Close" />
    <TrafficLight tone="yellow" onClick={minimize} label="Minimize" />
    <TrafficLight tone="blue" onClick={zoom} label="Zoom" />
  </div>

  <div class="center">
    <div class="stripes left">
      {#each Array(7) as _, i}
        <span class:dark={i % 2 === 1}></span>
      {/each}
    </div>
    <span class="label">{title}</span>
    <div class="stripes right">
      {#each Array(7) as _, i}
        <span class:dark={i % 2 === 1}></span>
      {/each}
    </div>
  </div>

  <div class="controls">
    <WindowControl kind="minimize" onClick={minimize} />
    <WindowControl kind="maximize" onClick={zoom} />
    <WindowControl kind="close" onClick={close} />
  </div>
</div>

<style>
  .titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: var(--titlebar-h);
    padding: 0 6px;
    background: var(--navy-chrome);
    border-bottom: 2px solid var(--navy-shadow);
    flex-shrink: 0;
  }
  .lights {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px 0 4px;
    flex-shrink: 0;
  }
  .center {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px;
  }
  .stripes {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 0;
  }
  .stripes span {
    height: 1px;
    background: var(--chrome-highlight);
  }
  .stripes span.dark {
    background: var(--navy-shadow);
  }
  .label {
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--chrome-highlight);
    padding: 0 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px;
    flex-shrink: 0;
  }
</style>
