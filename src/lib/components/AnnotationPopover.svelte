<script>
  import AnnotationEditor from './AnnotationEditor.svelte';

  /** @type {{ changeId?: string, text?: string, draft?: string, x?: number, y?: number, visible?: boolean, canRemove?: boolean, onDraftInput?: (value: string) => void, onSave?: (data: {changeId: string, rationale: string}) => void, onRemove?: (data: {changeId: string}) => void, onClose?: () => void }} */
  let {
    changeId = '',
    text = '',
    draft = '',
    x = 0,
    y = 0,
    visible = false,
    canRemove = false,
    onDraftInput = () => {},
    onSave = () => {},
    onRemove = () => {},
    onClose = () => {},
  } = $props();

  function close() {
    onClose();
  }

  function handleSave() {
    const rationale = draft.trim();
    if (!changeId || !rationale) return;
    onSave({ changeId, rationale });
    close();
  }

  function handleRemove() {
    if (!changeId) return;
    onRemove({ changeId });
    close();
  }
</script>

{#if visible}
  <div
    class="popover-backdrop"
    onclick={close}
    onkeydown={(event) => event.key === 'Escape' && close()}
    role="button"
    tabindex="-1"
  ></div>

  <div
    class="popover glass-surface glass-surface-focal"
    style="left: {x}px; top: {y}px;"
    role="dialog"
    aria-label="Add annotation"
  >
    <div class="popover-header">
      <div>
        <span class="popover-kicker">Rationale</span>
        <h2>Add context</h2>
      </div>
      <button type="button" class="close-btn control-motion control-focus" onclick={close} aria-label="Close rationale editor">
        ×
      </button>
    </div>

    <AnnotationEditor
      excerpt={text}
      value={draft}
      autofocus={visible}
      canRemove={canRemove}
      saveLabel={canRemove ? 'Update rationale' : 'Save rationale'}
      onInput={onDraftInput}
      onSave={handleSave}
      onCancel={close}
      onRemove={handleRemove}
    />
  </div>
{/if}

<style>
  .popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
  }

  .popover {
    position: fixed;
    z-index: 201;
    width: min(24rem, calc(100vw - 2rem));
    border-radius: var(--radius-xl);
    border: 1px solid color-mix(in srgb, var(--chrome-border) 98%, transparent);
    box-shadow: var(--shadow-note);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: color-mix(in srgb, var(--paper-bright) 78%, transparent);
  }

  .popover-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .popover-kicker {
    font-family: var(--font-ui);
    font-size: var(--text-ui-small);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--delete-ink);
    font-weight: 600;
  }

  .popover-header h2 {
    margin-top: 0.4rem;
    font-family: var(--font-display);
    font-size: 1.1rem;
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .close-btn {
    border: none;
    background: transparent;
    color: var(--ink-ghost);
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    cursor: pointer;
  }

  .close-btn:hover {
    color: var(--ink);
    background: color-mix(in srgb, var(--paper-matte) 82%, transparent);
  }
</style>
