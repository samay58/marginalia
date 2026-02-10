<script>
  /**
   * @typedef {import('../utils/diff.js').Change} Change
   * @typedef {import('../utils/diff.js').DiffResult} DiffResult
   */

  /** @type {{ diffResult?: DiffResult | null, annotations?: Map<string, import('../stores/app.js').Annotation>, currentLine?: number | null, onSelectChange?: (change: Change, x: number, y: number) => void }} */
  let {
    diffResult = null,
    annotations = new Map(),
    currentLine = /** @type {number | null} */ (1),
    onSelectChange = () => {},
  } = $props();

  const sortedChanges = $derived.by(() => {
    const changes = diffResult?.changes ?? [];
    return [...changes].sort((a, b) => a.editedOffset - b.editedOffset);
  });

  const insertionCount = $derived.by(
    () => sortedChanges.filter((change) => change.type === 'insertion').length
  );
  const deletionCount = $derived.by(
    () => sortedChanges.filter((change) => change.type === 'deletion').length
  );

  /**
   * @param {string} text
   * @param {number} [limit]
   */
  function summarize(text, limit = 100) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return '(whitespace change)';
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit)}...`;
  }

  /**
   * @param {Change} change
   */
  function isNearCursor(change) {
    const line = typeof currentLine === 'number' ? currentLine : 1;
    return Math.abs((change.location?.line ?? 1) - line) <= 0;
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

<aside class="change-rail glass-surface glass-surface-static">
  <header class="rail-header">
    <div>
      <h2>Changes</h2>
      <p>Stable list of edits in document order.</p>
    </div>
    <div class="rail-counts">
      <span class="chip insertion">+{insertionCount}</span>
      <span class="chip deletion">-{deletionCount}</span>
    </div>
  </header>

  {#if sortedChanges.length === 0}
    <div class="empty-state">
      <p>No edits yet.</p>
      <p>Start typing to populate the rail.</p>
    </div>
  {:else}
    <ol class="change-list">
      {#each sortedChanges as change, index}
        {@const annotated = annotations.has(change.id)}
        {@const nearCursor = isNearCursor(change)}
        <li>
          <button
            class="change-item control-motion control-focus"
            class:annotated
            class:near-cursor={nearCursor}
            onclick={(event) => handleSelect(event, change)}
          >
            <div class="change-item-meta">
              <span class="kind" class:insertion={change.type === 'insertion'} class:deletion={change.type === 'deletion'}>
                {change.type === 'insertion' ? 'Insert' : 'Delete'}
              </span>
              <span class="line-ref">L{change.location.line}</span>
              <span class="index">#{index + 1}</span>
              {#if annotated}
                <span class="annotation-dot" title="Has rationale">●</span>
              {/if}
            </div>
            <p class="change-preview">{summarize(change.text)}</p>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
</aside>

<style>
  .change-rail {
    width: var(--density-rail-width);
    border-right: var(--border-subtle);
    background: transparent;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
  }

  .rail-header {
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .rail-header h2 {
    font-family: var(--font-ui);
    font-size: var(--text-ui);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--ink-faded);
    margin: 0;
  }

  .rail-header p {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    margin-top: 2px;
  }

  .rail-counts {
    display: flex;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .chip {
    border-radius: 999px;
    padding: 2px 8px;
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    border: 1px solid transparent;
  }

  .chip.insertion {
    color: var(--added-text);
    background: var(--added-bg);
    border-color: color-mix(in srgb, var(--added-text) 20%, transparent);
  }

  .chip.deletion {
    color: var(--struck-text);
    background: var(--struck-bg);
    border-color: color-mix(in srgb, var(--struck-text) 22%, transparent);
  }

  .empty-state {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .empty-state p:first-child {
    font-family: var(--font-ui);
    color: var(--ink-faded);
    font-size: var(--text-ui);
  }

  .empty-state p:last-child {
    font-family: var(--font-ui);
    color: var(--ink-ghost);
    font-size: var(--text-ui-small);
  }

  .change-list {
    list-style: none;
    margin: 0;
    padding: var(--space-2);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .change-item {
    width: 100%;
    text-align: left;
    border: 1px solid var(--paper-edge);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--paper-bright) 70%, transparent);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    transition: border-color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
  }

  .change-item:hover {
    border-color: var(--ink-whisper);
    background: var(--paper);
  }

  .change-item:active {
    transform: translateY(1px);
  }

  .change-item.near-cursor {
    border-color: var(--accent-subtle);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent);
  }

  .change-item.control-focus:focus-visible {
    border-color: color-mix(in srgb, var(--accent) 40%, var(--paper-edge));
  }

  .change-item.control-focus.near-cursor:focus-visible {
    box-shadow:
      var(--focus-ring),
      0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent);
  }

  .change-item.annotated {
    background: color-mix(in srgb, var(--accent-subtle) 20%, var(--paper-bright));
  }

  .change-item-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: 6px;
  }

  .kind {
    border-radius: 4px;
    padding: 1px 6px;
    font-family: var(--font-ui);
    font-size: 0.6875rem;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    border: 1px solid transparent;
  }

  .kind.insertion {
    color: var(--added-text);
    background: var(--added-bg);
    border-color: color-mix(in srgb, var(--added-text) 18%, transparent);
  }

  .kind.deletion {
    color: var(--struck-text);
    background: var(--struck-bg);
    border-color: color-mix(in srgb, var(--struck-text) 18%, transparent);
  }

  .line-ref,
  .index {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--ink-ghost);
  }

  .line-ref {
    margin-left: auto;
  }

  .annotation-dot {
    color: var(--accent);
    font-size: 0.625rem;
  }

  .change-preview {
    font-family: var(--font-body);
    font-size: var(--density-change-preview-size);
    line-height: 1.35;
    color: var(--ink);
    margin: 0;
  }

  @media (max-width: 900px) {
    .change-rail {
      width: 240px;
    }
  }
</style>
