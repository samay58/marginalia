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
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: var(--desk-rail-width) minmax(0, 1fr) var(--desk-right-width);
    gap: var(--desk-gap);
    padding: var(--space-4) var(--desk-padding-x) var(--space-4);
    height: clamp(8rem, 24vh, 13rem);
    max-height: min(32vh, 15rem);
    min-height: 0;
    overflow: hidden;
    border-top: 1px solid color-mix(in srgb, var(--paper-edge) 86%, transparent);
    background:
      linear-gradient(
        to bottom,
        color-mix(in srgb, var(--paper-matte) 58%, transparent),
        color-mix(in srgb, var(--glass-bg-static) 94%, transparent)
      );
  }

  .drawer-column {
    grid-column: 2 / 4;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-width: calc(var(--content-max-width) + var(--desk-gap) + var(--desk-right-width));
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
    font-size: 1rem;
    color: var(--ink);
    letter-spacing: 0;
  }

  .notes-input {
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    resize: none;
    border: 1px solid color-mix(in srgb, var(--paper-edge) 78%, transparent);
    border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--paper-bright) 48%, transparent);
    padding: var(--space-3);
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.55;
    color: var(--ink);
    box-shadow: inset 0 1px 2px rgba(44, 40, 37, 0.04);
  }

  .notes-input::placeholder {
    color: var(--ink-ghost);
  }

  @media (max-width: 1180px) {
    .session-drawer {
      grid-template-columns: var(--desk-rail-width) minmax(0, 1fr);
    }

    .drawer-column {
      grid-column: 2;
    }
  }

  @media (max-width: 760px) {
    .session-drawer {
      grid-template-columns: minmax(0, 1fr);
    }

    .drawer-column {
      grid-column: 1;
    }
  }
</style>
