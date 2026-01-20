<script>
  import { linesWithChanges, linesWithAnnotations, currentLine } from '../stores/app.js';

  /** @type {{ lineCount?: number, onLineClick?: (line: number) => void }} */
  let {
    lineCount = 1,
    onLineClick = () => {}
  } = $props();
</script>

<div class="gutter no-select">
  {#each Array(lineCount) as _, i}
    {@const lineNum = i + 1}
    {@const hasChange = $linesWithChanges.has(lineNum)}
    {@const hasAnnotation = $linesWithAnnotations.has(lineNum)}
    {@const isActive = $currentLine === lineNum}
    <button
      class="line-number"
      class:active={isActive}
      class:has-change={hasChange}
      onclick={() => onLineClick(lineNum)}
    >
      <span class="number">{lineNum}</span>
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
    background: var(--paper-matte);
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

  .indicator.filled {
    color: var(--accent);
  }

  .line-number:hover .indicator:not(.filled) {
    color: var(--ink-faded);
  }
</style>
