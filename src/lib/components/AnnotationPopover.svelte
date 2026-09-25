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

  // Keep the 320px card inside the window when the edit sits near an edge.
  const left = $derived(Math.max(16, Math.min(x, (typeof window === 'undefined' ? x : window.innerWidth) - 336)));
  const top = $derived(Math.max(16, Math.min(y, (typeof window === 'undefined' ? y : window.innerHeight) - 280)));

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
  <div class="popover-backdrop" role="presentation" onclick={close}></div>

  <div class="popover" style="left: {left}px; top: {top}px;" role="dialog" aria-label="Rationale">
    <AnnotationEditor
      excerpt={text}
      value={draft}
      autofocus={visible}
      canRemove={canRemove}
      saveLabel={canRemove ? 'Update' : 'Save'}
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
    z-index: 30;
  }

  .popover {
    position: fixed;
    width: 320px;
    padding: var(--space-4);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow-pop);
    z-index: 31;
    animation: rise var(--dur) var(--ease);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
</style>
