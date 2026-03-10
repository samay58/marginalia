<script>
  /**
   * @typedef {import('../utils/diff.js').Change} Change
   * @typedef {import('../utils/diff.js').DiffResult} DiffResult
   */

  import { summarizeText } from '../utils/text.js';

  /** @type {{ changes?: Change[], annotationChangeIds?: Set<string>, annotationCount?: number, slopLines?: Set<number>, selectedChangeId?: string | null, currentLine?: number | null, onSelectChange?: (change: Change, x: number, y: number) => void }} */
  let {
    changes = [],
    annotationChangeIds = new Set(),
    annotationCount = 0,
    slopLines = new Set(),
    selectedChangeId = null,
    currentLine = /** @type {number | null} */ (1),
    onSelectChange = () => {},
  } = $props();

  const sortedChanges = $derived.by(() => {
    return [...changes].sort((left, right) => left.editedOffset - right.editedOffset);
  });

  const insertionCount = $derived.by(
    () => sortedChanges.filter((change) => change.type === 'insertion').length
  );

  const deletionCount = $derived.by(
    () => sortedChanges.filter((change) => change.type === 'deletion').length
  );

  /** @param {string} text */
  function summarize(text) {
    return summarizeText(text, 48, '(whitespace change)');
  }

  /**
   * @param {Change} change
   */
  function isNearCursor(change) {
    const line = typeof currentLine === 'number' ? currentLine : 1;
    return Math.abs((change.location?.line ?? 1) - line) <= 1;
  }

  /**
   * @param {Change} change
   */
  function labelFor(change) {
    const excerpt = change.text.trim();
    if (slopLines.has(change.location.line)) {
      return excerpt ? 'Flagged phrasing' : 'Slop pattern';
    }

    if (change.type === 'deletion') {
      if (excerpt.length > 70) {
        return 'Cut overwriting';
      }
      return 'Trimmed language';
    }

    if (excerpt.length > 70) {
      return 'Added sharper detail';
    }
    return 'Refined phrasing';
  }

  /**
   * @param {Change} change
   */
  function markerTone(change) {
    if (slopLines.has(change.location.line)) return 'slop';
    return change.type === 'deletion' ? 'deletion' : 'insertion';
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
        <span>{slopLines.size} flagged</span>
      </div>
    </div>
    <div class="rail-counts" aria-label="Change counts">
      <span class="count-pill insertion">+{insertionCount}</span>
      <span class="count-pill deletion">-{deletionCount}</span>
    </div>
  </header>

  {#if sortedChanges.length === 0}
    <div class="empty-state">
      <p>No edits yet. Start editing to populate the review index.</p>
    </div>
  {:else}
    <ol class="change-list">
      {#each sortedChanges as change, index}
        {@const annotated = annotationChangeIds.has(change.id)}
        {@const nearCursor = isNearCursor(change)}
        {@const selected = selectedChangeId === change.id}
        {@const tone = markerTone(change)}
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
            <div class="change-row-top">
              <div class="change-title">
                <span class="marker" class:deletion={tone === 'deletion'} class:insertion={tone === 'insertion'} class:slop={tone === 'slop'}></span>
                <span>{labelFor(change)}</span>
              </div>
              <div class="change-meta">
                <span class="change-index">{index + 1}</span>
                {#if annotated}
                  <span class="annotation-indicator">Note</span>
                {/if}
              </div>
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
    border-radius: var(--radius-xl);
    padding: 0.7rem 0;
    cursor: pointer;
  }

  .change-item:hover {
    color: var(--ink);
  }

  .change-item.selected {
    padding-left: 0.65rem;
    padding-right: 0.65rem;
    background: color-mix(in srgb, var(--paper-bright) 50%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  }

  .change-item.near-cursor:not(.selected) {
    padding-left: 0.45rem;
  }

  .change-item.annotated:not(.selected) {
    color: var(--annotation-ink);
  }

  .change-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .change-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    font-family: var(--font-ui);
    font-size: 0.6875rem;
    line-height: 1.3;
    color: var(--annotation-ink);
    font-weight: 600;
  }

  .marker {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--ink-ghost);
  }

  .marker.deletion {
    background: var(--delete-ink);
  }

  .marker.insertion {
    background: var(--insert-ink);
  }

  .marker.slop {
    background: var(--slop-ink);
  }

  .change-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  .change-index,
  .annotation-indicator {
    font-family: var(--font-ui);
    font-size: 0.625rem;
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-ghost);
  }

  .annotation-indicator {
    color: var(--accent);
  }

  .change-preview {
    margin-top: 0.2rem;
    padding-left: 0.65rem;
    font-family: var(--font-body);
    font-size: 0.75rem;
    line-height: 1.35;
    font-style: italic;
    color: var(--annotation-muted);
  }
</style>
