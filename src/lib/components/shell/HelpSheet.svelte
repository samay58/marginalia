<script>
  import { SHORTCUTS } from '$lib/review/keymap.js';

  /** @type {{ open: boolean, onClose: () => void }} */
  let { open, onClose } = $props();

  /** @type {HTMLDivElement | null} */
  let sheet = $state(null);

  $effect(() => {
    if (open) queueMicrotask(() => sheet?.focus());
  });
</script>

{#if open}
  <div class="scrim" role="presentation" onclick={onClose}></div>
  <div
    class="sheet"
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-title"
    tabindex="-1"
    bind:this={sheet}
  >
    <header>
      <h2 id="help-title">Keyboard shortcuts</h2>
      <button type="button" class="btn icon-btn" aria-label="Close" onclick={onClose}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
    </header>
    <dl>
      {#each SHORTCUTS as shortcut}
        <div class="row">
          <dt>{shortcut.help}</dt>
          <dd><kbd>{shortcut.keys}</kbd></dd>
        </div>
      {/each}
    </dl>
    <p class="note">Click any edit, in the text or the list, to select it.</p>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    z-index: 40;
  }

  .sheet {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(440px, calc(100vw - 48px));
    padding: var(--space-5) var(--space-6) var(--space-6);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    z-index: 41;
    animation: rise var(--dur) var(--ease);
  }

  .sheet:focus {
    outline: none;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 calc(-1 * var(--space-2)) var(--space-3) 0;
  }

  h2 {
    font-size: var(--text-md);
    font-weight: 600;
  }

  dl {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    font-size: var(--text-sm);
  }

  dt {
    color: var(--ink-2);
  }

  dd kbd {
    font-size: var(--text-sm);
    color: var(--ink);
  }

  .note {
    margin-top: var(--space-5);
    font-size: var(--text-xs);
    color: var(--ink-3);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 4px));
    }
  }
</style>
