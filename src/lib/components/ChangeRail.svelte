<script>
  /**
   * @typedef {import('../utils/diff.js').Change} Change
   * @typedef {import('../utils/diff.js').DiffResult} DiffResult
   */

  /** @type {{ changes?: Change[], groups?: any[], trivialChanges?: Change[], trivialCount?: number, annotationChangeIds?: Set<string>, annotationTargetIds?: Set<string>, annotationCount?: number, selectedChangeId?: string | null, selectedTargetId?: string | null, currentLine?: number | null, onSelectChange?: (change: Change, x: number, y: number) => void, onSelectGroup?: (group: any, x: number, y: number) => void }} */
  let {
    changes = [],
    groups = [],
    trivialChanges = [],
    trivialCount = 0,
    annotationChangeIds = new Set(),
    annotationTargetIds = new Set(),
    annotationCount = 0,
    selectedChangeId = null,
    selectedTargetId = null,
    currentLine = /** @type {number | null} */ (1),
    onSelectChange = () => {},
    onSelectGroup = () => {},
  } = $props();

  let trivialExpanded = $state(false);

  const sortedChanges = $derived.by(() => {
    return [...changes].sort((left, right) => left.editedOffset - right.editedOffset);
  });

  const sortedGroups = $derived.by(() => {
    if (groups?.length) {
      return [...groups].sort(
        (left, right) =>
          (left.descriptor?.editedOffsetStart ?? left.changes?.[0]?.editedOffset ?? 0) -
          (right.descriptor?.editedOffsetStart ?? right.changes?.[0]?.editedOffset ?? 0)
      );
    }
    return sortedChanges.map((change) => ({
      id: change.id,
      kind: 'single',
      changeIds: [change.id],
      changes: [change],
      descriptor: {
        afterExcerpt: change.type === 'insertion' ? change.text : '',
        beforeExcerpt: change.type === 'deletion' ? change.text : '',
        lineStart: change.location?.line ?? 1,
      },
    }));
  });

  const sortedTrivial = $derived.by(() => {
    return [...trivialChanges].sort((left, right) => left.editedOffset - right.editedOffset);
  });

  const insertionCount = $derived.by(
    () => sortedGroups.flatMap((group) => group.changes || []).filter((change) => change.type === 'insertion').length
  );

  const deletionCount = $derived.by(
    () => sortedGroups.flatMap((group) => group.changes || []).filter((change) => change.type === 'deletion').length
  );

  /**
   * @param {Change} change
   * @returns {string}
   */
  function typeIcon(change) {
    if (change.type === 'deletion') return '−';
    if (change.type === 'insertion') return '+';
    return '~';
  }

  /** @param {any} group */
  function groupIcon(group) {
    if (group.kind === 'replacement' || group.kind === 'adjacent_rewrite' || group.kind === 'block_rewrite') return '~';
    const change = group.changes?.[0];
    return typeIcon(change || {});
  }

  /** @param {any} group */
  function groupText(group) {
    const after = group.descriptor?.afterExcerpt || '';
    const before = group.descriptor?.beforeExcerpt || '';
    return after || before || group.changes?.map((/** @type {any} */ change) => change.text).join(' ') || '';
  }

  /** @param {any} group */
  function isGroupAnnotated(group) {
    if (annotationTargetIds.has(group.targetId)) return true;
    return (group.changeIds || []).some((/** @type {string} */ id) => annotationChangeIds.has(id));
  }

  /**
   * @param {string} text
   * @param {number} max
   * @returns {string}
   */
  function truncate(text, max) {
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    return trimmed.slice(0, max) + '…';
  }

  /** @param {any} group */
  function isGroupNearCursor(group) {
    const line = typeof currentLine === 'number' ? currentLine : 1;
    const groupLine = group.descriptor?.lineStart ?? group.changes?.[0]?.location?.line ?? 1;
    return Math.abs(groupLine - line) <= 1;
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

  /**
   * @param {MouseEvent} event
   * @param {any} group
   */
  function handleGroupSelect(event, group) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const rect = target.getBoundingClientRect();
    onSelectGroup(group, rect.right + 8, rect.top);
    if (groups?.length) return;
    const change = group.changes?.[0] || null;
    if (change) onSelectChange(change, rect.right + 8, rect.top);
  }
</script>

<aside class="rail" aria-label="Changes">
  <header class="rail-head">
    <h2>Changes</h2>
    {#if sortedGroups.length > 0}
      <span class="tally">
        <span class="plus">+{insertionCount}</span>
        <span>&minus;{deletionCount}</span>
        {#if annotationCount > 0}<span>· {annotationCount} noted</span>{/if}
      </span>
    {/if}
  </header>

  {#if sortedGroups.length === 0 && trivialCount === 0}
    <p class="empty">No edits yet. Change the draft and each edit appears here.</p>
  {:else}
    <ol class="change-list">
      {#each sortedGroups as group}
        {@const firstChange = group.changes?.[0]}
        {@const annotated = isGroupAnnotated(group)}
        {@const nearCursor = isGroupNearCursor(group)}
        {@const selected = (selectedTargetId && group.targetId === selectedTargetId) || group.changeIds?.includes(selectedChangeId)}
        <li>
          <button
            type="button"
            class="change-item"
            class:selected
            class:near-cursor={nearCursor && !selected}
            aria-pressed={selected}
            onclick={(event) => handleGroupSelect(event, group)}
          >
            <span
              class="type-icon"
              class:deletion={firstChange?.type === 'deletion'}
              class:insertion={firstChange?.type === 'insertion'}
              aria-hidden="true"
            >{groupIcon(group)}</span>
            <span class="change-text">{truncate(groupText(group), 60)}</span>
            {#if annotated}<span class="noted">Noted</span>{/if}
          </button>
        </li>
      {/each}

      {#if trivialCount > 0}
        <li class="trivial-row">
          <button
            type="button"
            class="trivial-toggle"
            aria-expanded={trivialExpanded}
            onclick={() => (trivialExpanded = !trivialExpanded)}
          >
            {trivialCount} minor edit{trivialCount === 1 ? '' : 's'}
            <span class="chevron" class:open={trivialExpanded} aria-hidden="true">›</span>
          </button>
        </li>
        {#if trivialExpanded}
          {#each sortedTrivial as change}
            {@const selected = selectedChangeId === change.id}
            <li>
              <button
                type="button"
                class="change-item trivial"
                class:selected
                aria-pressed={selected}
                onclick={(event) => handleSelect(event, change)}
              >
                <span class="type-icon" class:deletion={change.type === 'deletion'} class:insertion={change.type === 'insertion'} aria-hidden="true">{typeIcon(change)}</span>
                <span class="change-text">{truncate(change.text, 60)}</span>
                {#if annotationChangeIds.has(change.id)}<span class="noted">Noted</span>{/if}
              </button>
            </li>
          {/each}
        {/if}
      {/if}
    </ol>
  {/if}
</aside>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    width: var(--rail-w);
    flex-shrink: 0;
    min-height: 0;
    border-right: 1px solid var(--rule);
    background: var(--canvas);
    padding: var(--space-4) var(--space-3) var(--space-8);
    overflow-y: auto;
  }

  .rail-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
    padding: 0 var(--space-2) var(--space-3);
  }

  h2 {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-2);
  }

  .tally {
    display: flex;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--ink-3);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .tally .plus {
    color: var(--insert-ink);
  }

  .empty {
    padding: 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--ink-3);
  }

  .change-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .change-item {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    padding: 6px var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .change-item:hover,
  .change-item.near-cursor {
    background: var(--hover);
  }

  .change-item.selected {
    background: var(--selected-bg);
  }

  .type-icon {
    flex-shrink: 0;
    width: 10px;
    font-size: var(--text-sm);
    font-weight: 500;
    text-align: center;
    color: var(--ink-3);
  }

  .type-icon.insertion {
    color: var(--insert-ink);
  }

  .change-text {
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .change-item.trivial .change-text {
    color: var(--ink-2);
  }

  .noted {
    flex-shrink: 0;
    font-size: var(--text-xs);
    color: var(--ink-3);
  }

  .trivial-row {
    margin-top: var(--space-3);
  }

  .trivial-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 4px var(--space-2);
    border: none;
    border-radius: var(--radius);
    background: transparent;
    font-size: var(--text-xs);
    color: var(--ink-3);
    cursor: pointer;
  }

  .trivial-toggle:hover {
    color: var(--ink);
    background: var(--hover);
  }

  .chevron {
    display: inline-block;
    transition: transform var(--transition-fast);
  }

  .chevron.open {
    transform: rotate(90deg);
  }
</style>
