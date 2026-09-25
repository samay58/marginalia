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

<aside class="rail">
  <div class="label">CHANGES</div>
  <div class="summary">
    <span>{sortedGroups.length} {sortedGroups.length === 1 ? 'edit' : 'edits'}</span>
    <span class="muted">{annotationCount} noted</span>
    <span class="chipRow" aria-label="Change counts">
      <span class="chip added">+{insertionCount}</span>
      <span class="chip removed">&minus;{deletionCount}</span>
    </span>
  </div>
  <div class="divider"></div>

  {#if sortedGroups.length === 0 && trivialCount === 0}
    <div class="empty">No edits yet. Start editing to populate the review index.</div>
  {:else}
    <ol class="change-list">
      {#each sortedGroups as group}
        {@const firstChange = group.changes?.[0]}
        {@const annotated = isGroupAnnotated(group)}
        {@const nearCursor = isGroupNearCursor(group)}
        {@const selected = (selectedTargetId && group.targetId === selectedTargetId) || group.changeIds?.includes(selectedChangeId)}
        <li class="change-row">
          <button
            type="button"
            class="change-item"
            class:selected
            class:annotated
            class:near-cursor={nearCursor && !selected}
            aria-pressed={selected}
            onclick={(event) => handleGroupSelect(event, group)}
          >
            <span
              class="type-icon"
              class:deletion={firstChange?.type === 'deletion'}
              class:insertion={firstChange?.type === 'insertion'}
            >{groupIcon(group)}</span>
            <span class="change-text">{truncate(groupText(group), 40)}</span>
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
            class="trivial-toggle"
            onclick={() => trivialExpanded = !trivialExpanded}
          >
            {trivialExpanded ? 'Hide' : `${trivialCount} minor edit${trivialCount === 1 ? '' : 's'}`}
          </button>
        </li>
        {#if trivialExpanded}
          {#each sortedTrivial as change}
            {@const selected = selectedChangeId === change.id}
            <li class="change-row">
              <button
                type="button"
                class="change-item trivial"
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
  .rail {
    display: flex;
    flex-direction: column;
    width: var(--rail-w);
    flex-shrink: 0;
    background: var(--window-body);
    border-right: 2px solid var(--chrome-shadow);
    box-shadow: inset -1px 0 0 var(--chrome-highlight);
    padding: 18px 14px;
    overflow-y: auto;
  }
  .label {
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 11px;
    color: var(--ink);
    letter-spacing: 0.18em;
  }
  .summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-top: 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--ink);
  }
  .summary .muted {
    color: var(--muted);
  }
  .chipRow {
    margin-left: auto;
    display: flex;
    gap: 6px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 20px;
    padding: 0 6px;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 11px;
    box-shadow: var(--bevel-raised-chip);
    flex-shrink: 0;
  }
  .chip.added {
    background: var(--chip-green-bg);
    border: 1px solid var(--chip-green-border);
    color: var(--chip-green-text);
  }
  .chip.removed {
    background: var(--chip-red-bg);
    border: 1px solid var(--chip-red-border);
    color: var(--chip-red-text);
  }
  .divider {
    height: 2px;
    border-top: 1px solid var(--chrome-shadow);
    border-bottom: 1px solid var(--chrome-highlight);
    background: transparent;
    margin-top: 20px;
  }
  .empty {
    margin-top: 18px;
    padding: 14px 12px;
    background: var(--rationale-well-bg);
    border: 1px solid var(--chrome-shadow);
    box-shadow: var(--bevel-sunken-1);
    font-family: var(--font-chrome);
    font-size: 12px;
    font-style: italic;
    color: var(--muted);
    line-height: 18px;
  }

  .change-list {
    list-style: none;
    margin: 0;
    padding: 8px 0 0 0;
    display: flex;
    flex-direction: column;
  }

  .change-row + .change-row {
    border-top: 1px solid var(--chrome-shadow);
  }

  .change-item {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 6px 4px;
    cursor: pointer;
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    font-family: var(--font-chrome);
    color: var(--ink);
  }
  .change-item:hover {
    background: var(--chrome-highlight);
  }
  .change-item:focus-visible,
  .trivial-toggle:focus-visible {
    outline: 2px solid var(--navy-chrome);
    outline-offset: -2px;
  }
  .change-item.selected {
    background: var(--chrome-highlight);
    box-shadow: var(--bevel-sunken-1);
  }
  .change-item.near-cursor:not(.selected) {
    background: color-mix(in srgb, var(--chrome-highlight) 50%, transparent);
  }
  .change-item.trivial {
    opacity: 0.7;
  }

  .type-icon {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    width: 12px;
    text-align: center;
    color: var(--muted);
  }
  .type-icon.deletion {
    color: var(--chip-red-text);
  }
  .type-icon.insertion {
    color: var(--chip-green-text);
  }

  .change-text {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
    color: var(--ink);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .annotation-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    background: var(--navy-chrome);
    margin-left: auto;
  }

  .trivial-row {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid var(--chrome-shadow);
  }

  .trivial-toggle {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 4px 4px;
    font-family: var(--font-chrome);
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--muted);
    cursor: pointer;
  }
  .trivial-toggle:hover {
    color: var(--ink);
  }
</style>
