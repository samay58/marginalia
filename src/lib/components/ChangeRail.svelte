<script>
  /**
   * @typedef {import('../utils/diff.js').Change} Change
   * @typedef {import('../utils/diff.js').DiffResult} DiffResult
   */

  /** @type {{ changes?: Change[], trivialChanges?: Change[], trivialCount?: number, annotationChangeIds?: Set<string>, annotationCount?: number, selectedChangeId?: string | null, currentLine?: number | null, onSelectChange?: (change: Change, x: number, y: number) => void }} */
  let {
    changes = [],
    trivialChanges = [],
    trivialCount = 0,
    annotationChangeIds = new Set(),
    annotationCount = 0,
    selectedChangeId = null,
    currentLine = /** @type {number | null} */ (1),
    onSelectChange = () => {},
  } = $props();

  let trivialExpanded = $state(false);

  const sortedChanges = $derived.by(() => {
    return [...changes].sort((left, right) => left.editedOffset - right.editedOffset);
  });

  const sortedTrivial = $derived.by(() => {
    return [...trivialChanges].sort((left, right) => left.editedOffset - right.editedOffset);
  });

  const insertionCount = $derived.by(
    () => sortedChanges.filter((change) => change.type === 'insertion').length
  );

  const deletionCount = $derived.by(
    () => sortedChanges.filter((change) => change.type === 'deletion').length
  );

  /**
   * @param {Change} change
   * @returns {string}
   */
  function typeIcon(change) {
    if (change.type === 'deletion') return '\u2212';
    if (change.type === 'insertion') return '+';
    return '~';
  }

  /**
   * @param {string} text
   * @param {number} max
   * @returns {string}
   */
  function truncate(text, max) {
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    return trimmed.slice(0, max) + '\u2026';
  }

  /**
   * @param {Change} change
   */
  function isNearCursor(change) {
    const line = typeof currentLine === 'number' ? currentLine : 1;
    return Math.abs((change.location?.line ?? 1) - line) <= 1;
  }

  /**
   * @param {MouseEvent} event
   * @param {Change} change
   */
  function handleSelect(event, change) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    onSelectChange(change, rect.right + 8, rect.top);
  }
</script>

<aside class="change-rail">
  <header class="rail-header">
    <div class="rail-heading">
      <span class="rail-kicker">Changes</span>
      <div class="rail-tallies">
        <span>{sortedChanges.length} edits</span>
        <span>{annotationCount} noted</span>
      </div>
    </div>
    <div class="rail-counts" aria-label="Change counts">
      <span class="count-pill insertion">+{insertionCount}</span>
      <span class="count-pill deletion">&minus;{deletionCount}</span>
    </div>
  </header>

  {#if sortedChanges.length === 0 && trivialCount === 0}
    <div class="empty-state">
      <p>No edits yet. Start editing to populate the review index.</p>
    </div>
  {:else}
    <ol class="change-list">
      {#each sortedChanges as change}
        {@const annotated = annotationChangeIds.has(change.id)}
        {@const nearCursor = isNearCursor(change)}
        {@const selected = selectedChangeId === change.id}
        <li>
          <button
            type="button"
            class="change-item control-motion control-focus"
            class:selected
            class:annotated
            class:near-cursor={nearCursor && !selected}
            aria-pressed={selected}
            onclick={(event) => handleSelect(event, change)}
          >
            <span class="type-icon" class:deletion={change.type === 'deletion'} class:insertion={change.type === 'insertion'}>{typeIcon(change)}</span>
            <span class="change-text">{truncate(change.text, 40)}</span>
            {#if annotated}
              <span class="annotation-dot"></span>
            {/if}
          </button>
        </li>
      {/each}

      {#if trivialCount > 0}
        <li class="trivial-row">
          <button
            type="button"
            class="trivial-toggle control-motion control-focus"
            onclick={() => trivialExpanded = !trivialExpanded}
          >
            {trivialExpanded ? 'Hide' : `${trivialCount} minor edit${trivialCount === 1 ? '' : 's'}`}
          </button>
        </li>
        {#if trivialExpanded}
          {#each sortedTrivial as change}
            {@const selected = selectedChangeId === change.id}
            <li>
              <button
                type="button"
                class="change-item trivial control-motion control-focus"
                class:selected
                aria-pressed={selected}
                onclick={(event) => handleSelect(event, change)}
              >
                <span class="type-icon" class:deletion={change.type === 'deletion'} class:insertion={change.type === 'insertion'}>{typeIcon(change)}</span>
                <span class="change-text">{truncate(change.text, 40)}</span>
              </button>
            </li>
          {/each}
        {/if}
      {/if}
    </ol>
  {/if}
</aside>

<style>
  .change-rail {
    width: var(--desk-rail-width);
    padding-top: 3.5rem;
    padding-left: 2.25rem;
    padding-right: 1.5rem;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
  }

  .rail-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid color-mix(in srgb, var(--paper-edge) 95%, transparent);
  }

  .rail-heading {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .rail-kicker {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }

  .rail-tallies {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
  }

  .rail-counts {
    display: flex;
    gap: 0.35rem;
  }

  .count-pill {
    border-radius: 999px;
    padding: 0.18rem 0.45rem;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    border: 1px solid transparent;
  }

  .count-pill.insertion {
    color: var(--insert-ink);
    background: color-mix(in srgb, var(--insert-bg) 92%, transparent);
    border-color: color-mix(in srgb, var(--insert-line) 85%, transparent);
  }

  .count-pill.deletion {
    color: var(--delete-ink);
    background: color-mix(in srgb, var(--delete-bg) 92%, transparent);
    border-color: color-mix(in srgb, var(--delete-line) 85%, transparent);
  }

  .empty-state {
    padding-top: var(--space-4);
  }

  .empty-state p {
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    line-height: 1.45;
    color: var(--ink-ghost);
  }

  .change-list {
    list-style: none;
    margin: 0;
    padding: var(--space-2) 0 var(--space-12);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .change-item {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0.4rem 0;
    cursor: pointer;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    min-width: 0;
  }

  .change-item:hover {
    color: var(--ink);
  }

  .change-item.selected {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    background: color-mix(in srgb, var(--paper-bright) 50%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
    border-radius: var(--radius-xl);
  }

  .change-item.near-cursor:not(.selected) {
    padding-left: 0.35rem;
  }

  .change-item.annotated:not(.selected) {
    color: var(--annotation-ink);
  }

  .change-item.trivial {
    opacity: 0.6;
  }

  .type-icon {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
    width: 1rem;
    text-align: center;
    color: var(--ink-ghost);
  }

  .type-icon.deletion {
    color: var(--delete-ink);
  }

  .type-icon.insertion {
    color: var(--insert-ink);
  }

  .change-text {
    font-family: var(--font-body);
    font-size: 0.75rem;
    line-height: 1.35;
    color: var(--annotation-ink);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .annotation-dot {
    flex-shrink: 0;
    width: 5px;
    height: 5px;
    border-radius: 999px;
    background: var(--accent);
    margin-left: auto;
  }

  .trivial-row {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid color-mix(in srgb, var(--paper-edge) 70%, transparent);
  }

  .trivial-toggle {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0.3rem 0;
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    cursor: pointer;
  }

  .trivial-toggle:hover {
    color: var(--ink-faded);
  }
</style>
