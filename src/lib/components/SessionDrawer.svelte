<script>
  /** @type {{ open?: boolean, generalNotes?: string, onNotesInput?: (event: Event & { currentTarget: HTMLTextAreaElement }) => void }} */
  let {
    open = false,
    generalNotes = '',
    onNotesInput = () => {},
  } = $props();

  /** @type {HTMLTextAreaElement | null} */
  let textarea = $state(null);

  $effect(() => {
    if (open) queueMicrotask(() => textarea?.focus());
  });
</script>

{#if open}
  <section class="session-notes" aria-labelledby="session-notes-title">
    <header>
      <h2 id="session-notes-title">Session notes</h2>
      <p>Guidance for the whole draft. The agent reads this before your edits.</p>
    </header>
    <textarea
      bind:this={textarea}
      class="field"
      value={generalNotes}
      oninput={onNotesInput}
      placeholder="Shorter overall. Lead with the ask."
    ></textarea>
  </section>
{/if}

<style>
  .session-notes {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: clamp(8rem, 24vh, 13rem);
    min-height: 0;
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--rule);
    background: var(--canvas);
    flex-shrink: 0;
    animation: rise var(--dur) var(--ease);
  }

  header {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }

  h2 {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-2);
  }

  p {
    font-size: var(--text-xs);
    color: var(--ink-3);
  }

  textarea {
    flex: 1;
    min-height: 0;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
</style>
