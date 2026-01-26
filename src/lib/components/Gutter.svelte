<script>
  import { linesWithChanges, linesWithAnnotations, linesWithSlop, currentLine } from '../stores/app.js';

  /** @type {{ lineCount?: number, onLineClick?: (line: number, x: number, y: number) => void, onScroll?: (scrollTop: number) => void }} */
  let {
    lineCount = 1,
    onLineClick = () => {},
    onScroll = () => {}
  } = $props();

  /** @type {HTMLDivElement | null} */
  let gutterEl = $state(null);

  /** @param {Event & { currentTarget: HTMLElement }} event */
  function handleScroll(event) {
    onScroll(event.currentTarget.scrollTop);
  }

  /** @param {number} scrollTop */
  export function setScrollTop(scrollTop) {
    if (!gutterEl) return;
    if (Math.abs(gutterEl.scrollTop - scrollTop) < 1) return;
    gutterEl.scrollTop = scrollTop;
  }

  /** @param {number} lineNumber */
  export function getLineRect(lineNumber) {
    if (!gutterEl) return null;
    const target = gutterEl.querySelector(`[data-line="${lineNumber}"]`);
    return target ? target.getBoundingClientRect() : null;
  }
</script>

<div class="gutter no-select glass-surface" bind:this={gutterEl} onscroll={handleScroll}>
  {#each Array(lineCount) as _, i}
    {@const lineNum = i + 1}
    {@const hasChange = $linesWithChanges.has(lineNum)}
    {@const hasAnnotation = $linesWithAnnotations.has(lineNum)}
    {@const hasSlop = $linesWithSlop.has(lineNum)}
    {@const isActive = $currentLine === lineNum}
    <button
      class="line-number"
      class:active={isActive}
      class:has-change={hasChange}
      data-line={lineNum}
      onclick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onLineClick(lineNum, rect.right + 8, rect.top);
      }}
    >
      <span class="number">{lineNum}</span>
      {#if hasSlop}
        <span class="slop-flag" title="Tone or WRITING.md flag">!</span>
      {/if}
      {#if hasChange}
        <span
          class="indicator"
          class:filled={hasAnnotation}
          title={hasAnnotation ? 'Has rationale' : 'Edit without rationale'}
        >
          {hasAnnotation ? '●' : '○'}
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .gutter {
    width: var(--gutter-width);
    background: transparent;
    border-right: var(--border-subtle);
    padding-top: var(--space-4);
    overflow-y: auto;
    flex-shrink: 0;
  }

  .line-number {
    height: var(--line-height);
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: var(--space-2);
    gap: var(--space-1);
    background: none;
    border: none;
    cursor: default;
    transition: background var(--transition-fast);
  }

  .line-number.has-change {
    cursor: pointer;
  }

  .line-number.has-change:hover {
    background: var(--paper);
  }

  .line-number.active {
    background: var(--paper);
  }

  .number {
    font-family: var(--font-mono);
    font-size: var(--text-ui-small);
    color: var(--ink-ghost);
    min-width: 1.5rem;
    text-align: right;
  }

  .line-number.active .number {
    color: var(--ink-faded);
  }

  .indicator {
    font-size: 8px;
    color: var(--ink-ghost);
    width: 12px;
    text-align: center;
    transition: color var(--transition-fast);
  }

  .slop-flag {
    font-family: var(--font-ui);
    font-size: 10px;
    color: var(--accent);
    width: 10px;
    text-align: center;
  }

  .indicator.filled {
    color: var(--accent);
  }

  .line-number:hover .indicator:not(.filled) {
    color: var(--ink-faded);
  }
</style>
