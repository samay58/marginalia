<script>
  /** @type {{ open?: boolean, generalNotes?: string, toneLintEnabled?: boolean, liveLintFindings?: Array<any>, mutedLintCount?: number, onNotesInput?: (event: Event & { currentTarget: HTMLTextAreaElement }) => void, onToneLintToggle?: (event: Event & { currentTarget: HTMLInputElement }) => void, onIgnoreLintRule?: (ruleId: string) => void, onClearIgnored?: () => void }} */
  let {
    open = false,
    generalNotes = '',
    toneLintEnabled = true,
    liveLintFindings = [],
    mutedLintCount = 0,
    onNotesInput = () => {},
    onToneLintToggle = () => {},
    onIgnoreLintRule = () => {},
    onClearIgnored = () => {},
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

    <div class="drawer-column lint-column">
      <div class="drawer-heading drawer-heading-inline">
        <div>
          <span class="drawer-kicker">Tone lint</span>
          <h2>{liveLintFindings.length} active flag{liveLintFindings.length === 1 ? '' : 's'}</h2>
        </div>
        <label class="lint-toggle control-focus">
          <input
            type="checkbox"
            checked={toneLintEnabled}
            onchange={onToneLintToggle}
          />
          <span>Enabled</span>
        </label>
      </div>

      {#if mutedLintCount > 0}
        <div class="lint-muted-row">
          <span>{mutedLintCount} rule{mutedLintCount === 1 ? '' : 's'} ignored this session</span>
          <button
            type="button"
            class="lint-clear control-motion control-focus"
            onclick={onClearIgnored}
          >
            Clear
          </button>
        </div>
      {/if}

      {#if liveLintFindings.length === 0}
        <p class="lint-empty">No active lint flags.</p>
      {:else}
        <ul class="lint-list">
          {#each liveLintFindings as finding, idx (`${finding.rule_id}-${finding.line}-${idx}`)}
            <li class="lint-item">
              <div class="lint-item-top">
                <span class="lint-label">{finding.label}</span>
                <span class="lint-line">L{finding.line}</span>
              </div>
              <p class="lint-snippet">“{finding.snippet}”</p>
              {#if finding.suggestion}
                <p class="lint-suggestion">{finding.suggestion}</p>
              {/if}
              <button
                type="button"
                class="lint-ignore control-motion control-focus"
                onclick={() => onIgnoreLintRule(finding.rule_id)}
              >
                Ignore for session
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>
{/if}

<style>
  .session-drawer {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
    gap: var(--space-6);
    padding: var(--space-5) var(--desk-padding-x) var(--space-5);
    border-top: 1px solid color-mix(in srgb, var(--paper-edge) 86%, transparent);
    background: color-mix(in srgb, var(--glass-bg-static) 96%, transparent);
  }

  .drawer-column {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .drawer-heading {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .drawer-heading-inline {
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .drawer-kicker,
  .lint-label {
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

  .lint-column {
    min-height: 0;
  }

  .lint-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--ink-faded);
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    padding: 0.25rem 0.35rem;
    border-radius: var(--radius-sm);
  }

  .lint-toggle input[type='checkbox'] {
    accent-color: var(--accent);
  }

  .lint-muted-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    color: var(--ink-faded);
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
  }

  .lint-clear,
  .lint-ignore {
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: 999px;
    background: transparent;
    color: var(--ink-faded);
    padding: 0.3rem 0.7rem;
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    cursor: pointer;
  }

  .lint-clear:hover,
  .lint-ignore:hover {
    color: var(--ink);
    border-color: color-mix(in srgb, var(--ink-ghost) 80%, transparent);
  }

  .lint-empty {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
  }

  .lint-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    overflow: auto;
    padding-right: 0.15rem;
  }

  .lint-item {
    border: 1px solid color-mix(in srgb, var(--paper-edge) 90%, transparent);
    border-radius: var(--radius-xl);
    background: color-mix(in srgb, var(--paper-bright) 68%, transparent);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .lint-item-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .lint-line {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--ink-ghost);
  }

  .lint-snippet,
  .lint-suggestion {
    font-family: var(--font-body);
    font-size: 0.95rem;
    line-height: 1.45;
    color: var(--annotation-ink);
    font-style: italic;
  }

  @media (max-width: 1100px) {
    .session-drawer {
      grid-template-columns: 1fr;
    }
  }
</style>
