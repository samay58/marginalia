<script>
  /** @type {{ open?: boolean, generalNotes?: string, onNotesInput?: (event: Event & { currentTarget: HTMLTextAreaElement }) => void }} */
  let {
    open = false,
    generalNotes = '',
    onNotesInput = () => {},
  } = $props();
</script>

{#if open}
  <section class="session-drawer glass-surface glass-surface-static">
    <div class="drawer-column">
      <div class="drawer-heading">
        <span class="drawer-kicker">Session notes</span>
        <h2>Guide the next pass</h2>
      </div>
      <textarea
        class="notes-input control-focus"
        value={generalNotes}
        oninput={onNotesInput}
        placeholder="Capture the session-level guidance that should survive beyond any single edit."
      ></textarea>
    </div>
  </section>
{/if}

<style>
  .session-drawer {
    padding: var(--space-5) var(--desk-padding-x) var(--space-5);
    border-top: 1px solid color-mix(in srgb, var(--paper-edge) 86%, transparent);
    background: color-mix(in srgb, var(--glass-bg-static) 96%, transparent);
  }

  .drawer-column {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 48rem;
  }

  .drawer-heading {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .drawer-kicker {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-ghost);
    font-weight: 600;
  }

  .drawer-heading h2 {
    font-family: var(--font-display);
    font-size: 1.15rem;
    color: var(--ink);
    letter-spacing: -0.01em;
  }

  .notes-input {
    width: 100%;
    min-height: 10rem;
    resize: vertical;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in srgb, var(--paper-bright) 68%, transparent);
    padding: var(--space-4);
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.55;
    color: var(--ink);
  }

  .notes-input::placeholder {
    color: var(--ink-ghost);
  }
</style>
