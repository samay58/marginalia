<script>
  import { preferences } from '$lib/stores/preferences.js';

  /** @type {{ open: boolean, onClose: () => void }} */
  let { open, onClose } = $props();

  /** @param {Event & { currentTarget: HTMLInputElement }} e */
  function toggleDialkit(e) {
    const checked = e.currentTarget.checked;
    preferences.update((p) => ({ ...p, showDialkitHandle: checked }));
  }
</script>

{#if open}
  <div
    class="backdrop"
    role="button"
    tabindex="0"
    aria-label="Close preferences"
    onclick={onClose}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
  >
    <div
      class="modal"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="prefs-title"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="titlebar">
        <span class="title" id="prefs-title">Preferences</span>
        <button class="close" type="button" aria-label="Close" onclick={onClose}>✕</button>
      </div>
      <div class="body">
        <label>
          <input
            type="checkbox"
            checked={$preferences.showDialkitHandle}
            onchange={toggleDialkit}
          />
          Show design tuning handle (DialKit)
        </label>
        <p class="note">Shows the live CSS-token tuning handle in the top-right of the desktop. Useful for design iteration.</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    width: 420px;
    background: var(--window-body);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-window-2);
    display: flex;
    flex-direction: column;
  }
  .titlebar {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 34px;
    background: var(--navy-chrome);
    padding: 0 10px;
    border-bottom: 2px solid var(--navy-shadow);
  }
  .title {
    flex: 1;
    font-family: var(--font-chrome);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--chrome-highlight);
  }
  .close {
    background: var(--button-face);
    border: 1px solid var(--navy-shadow);
    box-shadow: var(--bevel-raised-1);
    width: 22px;
    height: 22px;
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .close:active { box-shadow: var(--bevel-sunken-1); }
  .body {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-chrome);
    font-size: 13px;
    color: var(--ink);
  }
  .note {
    margin: 0;
    padding-left: 24px;
    font-family: var(--font-chrome);
    font-size: 11px;
    color: var(--muted);
  }
</style>
