<script>
  import AnnotationEditor from './AnnotationEditor.svelte';
  import BeveledButton from './chrome/BeveledButton.svelte';
  import SunkenWell from './chrome/SunkenWell.svelte';

  /** @typedef {import('../utils/diff.js').Change} Change */

  /** @type {{ minimized?: boolean, maximized?: boolean, onMinimize?: () => void, onMaximize?: () => void, onClose?: () => void, selectedChange?: Change | null, selectedAnnotationEntry?: any, annotationEntries?: any[], densityMode?: 'review' | 'manuscript', isComposing?: boolean, composerDraft?: string, onSelectChange?: (change: Change) => void, onSelectAnnotation?: (annotationId: string) => void, onStartCompose?: () => void, onDraftInput?: (value: string) => void, onSaveCompose?: () => void, onCancelCompose?: () => void, onRemoveSelected?: () => void, onReattachSelected?: () => void }} */
  let {
    minimized = false,
    maximized = false,
    onMinimize = () => {},
    onMaximize = () => {},
    onClose = () => {},
    selectedChange = null,
    selectedAnnotationEntry = null,
    annotationEntries = [],
    densityMode = 'manuscript',
    isComposing = false,
    composerDraft = '',
    onSelectChange = () => {},
    onSelectAnnotation = () => {},
    onStartCompose = () => {},
    onDraftInput = () => {},
    onSaveCompose = () => {},
    onCancelCompose = () => {},
    onRemoveSelected = () => {},
    onReattachSelected = () => {},
  } = $props();

  /** @type {AnnotationEditor | null} */
  let editorRef = $state(null);

  export function focusComposer() {
    editorRef?.focusEditor?.();
  }

  const stripes = [0, 1, 2, 3, 4];
</script>

<aside class="rationale-panel" class:density-review={densityMode === 'review'} class:minimized class:maximized>
  <div class="rat-titlebar">
    <span class="rat-title">Rationale</span>
    <div class="rat-stripes">
      {#each stripes as _, i}<span class:dark={i % 2 === 1}></span>{/each}
    </div>
    <div class="rat-ctls">
      <button class="rat-ctl" aria-label="Minimize" onclick={onMinimize}><span class="rat-bar"></span></button>
      <button class="rat-ctl" aria-label="Maximize" onclick={onMaximize}><span class="rat-box"></span></button>
      <button class="rat-ctl rat-x" aria-label="Close" onclick={onClose}>✕</button>
    </div>
  </div>

  <div class="rat-toolbar">
    <BeveledButton onClick={onStartCompose}>+ New note</BeveledButton>
  </div>

  <div class="rat-body">
    <SunkenWell pad="18px 16px">
      {#if !isComposing && !selectedChange && !selectedAnnotationEntry && annotationEntries.length === 0}
        <p class="rat-empty">No rationales yet.</p>
      {:else}
      <div class="rat-feature">
        {#if isComposing}
          <AnnotationEditor
            bind:this={editorRef}
            excerpt={selectedChange?.text || selectedAnnotationEntry?.annotation.target.excerpt || ''}
            value={composerDraft}
            autofocus={true}
            canRemove={!!selectedAnnotationEntry}
            saveLabel={selectedAnnotationEntry ? 'Update rationale' : 'Save rationale'}
            onInput={onDraftInput}
            onSave={onSaveCompose}
            onCancel={onCancelCompose}
            onRemove={onRemoveSelected}
          />
        {:else if selectedAnnotationEntry?.status === 'stale'}
          <div class="stale-card">
            <span class="stale-badge">Stale note</span>
            <p class="rationale-text">{selectedAnnotationEntry.annotation.rationale}</p>
          </div>

          <div class="annotation-actions-row">
            {#if selectedChange}
              <button
                type="button"
                class="annotation-primary"
                onclick={onReattachSelected}
              >
                Attach to selected edit
              </button>
            {/if}
            <button
              type="button"
              class="annotation-secondary"
              onclick={onStartCompose}
            >
              Edit note
            </button>
            <button
              type="button"
              class="annotation-secondary destructive"
              onclick={onRemoveSelected}
            >
              Dismiss
            </button>
          </div>
        {:else if selectedChange}
          <p class="excerpt-text">"{selectedChange.text}"</p>
          {#if selectedAnnotationEntry}
            <p class="rationale-text">{selectedAnnotationEntry.annotation.rationale}</p>
          {/if}

          <div class="annotation-actions-row">
            <button
              type="button"
              class="annotation-primary"
              onclick={onStartCompose}
            >
              {selectedAnnotationEntry ? 'Edit rationale' : 'Add rationale'}
            </button>
            {#if selectedAnnotationEntry}
              <button
                type="button"
                class="annotation-secondary destructive"
                onclick={onRemoveSelected}
              >
                Remove
              </button>
            {/if}
          </div>
        {:else}
          <p class="rat-empty">Select an edit to review it.</p>
        {/if}
      </div>

      <div class="rat-section">
        <div class="section-heading">Saved notes</div>
        {#if annotationEntries.length === 0}
          <p class="rat-empty">No rationales yet.</p>
        {:else}
          <div class="note-stack">
            {#each annotationEntries as entry}
              <button
                type="button"
                class="note-card"
                class:selected={selectedAnnotationEntry?.annotation.id === entry.annotation.id}
                class:stale={entry.status === 'stale'}
                onclick={() =>
                  entry.status === 'active' && entry.change
                    ? onSelectChange(entry.change)
                    : onSelectAnnotation(entry.annotation.id)}
              >
                <div class="note-card-top">
                  <span class="note-label">
                    {entry.status === 'active' ? `Note ${entry.displayIndex}` : 'Stale'}
                  </span>
                  <span class="note-line">
                    {#if entry.status === 'active' && entry.change}
                      L{entry.change.location.line}
                    {/if}
                  </span>
                </div>
                <p>{entry.annotation.rationale}</p>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      {/if}
    </SunkenWell>
  </div>

  <div class="rat-grip" aria-hidden="true">
    <span></span><span></span><span></span>
    <span class="off"></span><span></span><span></span>
    <span class="off"></span><span class="off"></span><span></span>
  </div>
</aside>

<style>
  .rationale-panel {
    display: flex;
    flex-direction: column;
    width: var(--rationale-w);
    flex-shrink: 0;
    background: var(--window-body);
    border-left: 1px solid var(--navy-shadow);
    box-shadow: inset 1px 0 0 var(--chrome-highlight);
    position: relative;
    overflow: hidden;
  }
  .rationale-panel.minimized {
    height: 34px;
    align-self: flex-start;
  }
  .rationale-panel.maximized {
    flex: 1;
    width: auto;
  }
  .rationale-panel.minimized .rat-toolbar,
  .rationale-panel.minimized .rat-body,
  .rationale-panel.minimized .rat-grip {
    display: none;
  }
  .rat-titlebar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 34px;
    background: var(--navy-chrome);
    padding: 0 6px;
    border-bottom: 2px solid var(--navy-shadow);
    flex-shrink: 0;
  }
  .rat-title {
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chrome-highlight);
    padding: 0 6px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .rat-stripes {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 2px;
    padding: 8px 0;
  }
  .rat-stripes span {
    height: 1px;
    background: var(--chrome-highlight);
  }
  .rat-stripes span.dark {
    background: var(--navy-shadow);
  }
  .rat-ctls {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }
  .rat-ctl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    padding: 0;
    cursor: pointer;
  }
  .rat-bar { width: 10px; height: 2px; background: var(--ink); margin-top: 8px; }
  .rat-box { width: 11px; height: 9px; background: transparent; border: 2px solid var(--ink); }
  .rat-x { font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--ink); }

  .rat-toolbar {
    display: flex;
    justify-content: flex-end;
    height: 42px;
    padding: 0 10px;
    align-items: center;
    background: var(--window-body);
    border-bottom: 1px solid var(--chrome-shadow);
    box-shadow: inset 0 -2px 0 var(--chrome-highlight);
    flex-shrink: 0;
  }

  .rat-body {
    flex: 1;
    padding: 12px;
    overflow: auto;
  }

  .rat-feature {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rat-section {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rat-empty {
    font-family: var(--font-wordmark);
    font-style: italic;
    font-size: 16px;
    color: var(--chrome-shadow);
    margin: 0;
  }

  .section-heading,
  .note-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--font-chrome);
    font-size: 11px;
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    font-weight: 700;
  }

  .note-line {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
  }

  .excerpt-text {
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.5;
    color: var(--ink);
    font-style: italic;
    margin: 0;
  }

  .rationale-text,
  .note-card p {
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.5;
    color: var(--ink);
    margin: 0;
  }

  .stale-card {
    border: 1px solid var(--chip-red-border);
    background: var(--chip-red-bg);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .stale-badge {
    font-family: var(--font-chrome);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--chip-red-text);
    font-weight: 700;
  }

  .note-stack {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .annotation-actions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .annotation-primary,
  .annotation-secondary {
    padding: 5px 10px;
    font-family: var(--font-chrome);
    font-size: 12px;
    font-weight: 700;
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    background: var(--button-face);
    color: var(--ink);
    cursor: pointer;
  }
  .annotation-primary:active,
  .annotation-secondary:active {
    box-shadow: var(--bevel-sunken-1);
  }
  .annotation-primary {
    background: var(--navy-chrome);
    color: var(--chrome-highlight);
  }
  .annotation-secondary.destructive {
    color: var(--chip-red-text);
  }

  .note-card {
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    border: 1px solid var(--chrome-shadow);
    background: var(--window-body);
    box-shadow: var(--bevel-raised-1);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .note-card:hover {
    background: var(--chrome-highlight);
  }
  .note-card.selected {
    box-shadow: var(--bevel-sunken-1);
    background: var(--chrome-highlight);
  }
  .note-card.stale {
    border-color: var(--chip-red-border);
    background: var(--chip-red-bg);
  }
  .note-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .rat-grip {
    position: absolute;
    right: 3px;
    bottom: 3px;
    display: grid;
    grid-template-columns: repeat(3, 2px);
    gap: 2px;
    pointer-events: none;
  }
  .rat-grip span {
    width: 2px;
    height: 2px;
    background: var(--ink);
  }
  .rat-grip span.off { background: transparent; }
</style>
