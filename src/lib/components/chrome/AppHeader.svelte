<script>
  /** @type {{
   *   breadcrumb: Array<{ label: string, active?: boolean }>,
   *   onHelp?: () => void,
   *   onPreferences?: () => void
   * }} */
  let { breadcrumb, onHelp, onPreferences } = $props();
</script>

<div class="header">
  <div class="wordmark">
    <span>Marginalia</span>
  </div>
  <nav class="crumbs" aria-label="Breadcrumb">
    {#each breadcrumb as item, i}
      {#if i > 0}<span class="sep">›</span>{/if}
      <span class="crumb" class:active={item.active}>{item.label}</span>
    {/each}
  </nav>
  <div class="nav">
    <button type="button" class="nav-link" onclick={onHelp}>Help</button>
    <span class="pipe">|</span>
    <button type="button" class="nav-link" onclick={onPreferences}>Preferences</button>
  </div>
</div>

<style>
  .header {
    display: flex;
    align-items: stretch;
    height: var(--appheader-h);
    background: var(--window-body);
    border-bottom: 2px solid var(--chrome-shadow);
    box-shadow: inset 0 -1px 0 var(--chrome-highlight);
    flex-shrink: 0;
  }
  .wordmark {
    display: flex;
    align-items: center;
    width: 212px;
    padding: 0 18px;
    background: var(--wordmark-teal);
    border: 1px solid #0B3A32;
    box-shadow:
      inset 1px 1px 0 rgba(255, 255, 255, 0.22),
      inset -1px -1px 0 rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }
  .wordmark span {
    font-family: var(--font-wordmark);
    font-style: italic;
    font-weight: 700;
    font-size: 28px;
    letter-spacing: -0.01em;
    color: var(--chrome-highlight);
  }
  .crumbs {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 0 24px;
    gap: 12px;
  }
  .crumb {
    font-family: var(--font-chrome);
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }
  .crumb.active {
    color: var(--ink);
    font-weight: 700;
  }
  .sep {
    font-family: var(--font-chrome);
    font-size: 12px;
    color: var(--chrome-shadow);
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 24px;
    flex-shrink: 0;
  }
  .nav-link {
    background: transparent;
    border: 0;
    padding: 0;
    font-family: var(--font-chrome);
    font-size: 13px;
    font-weight: 500;
    color: var(--link);
    cursor: pointer;
  }
  .nav-link:hover {
    text-decoration: underline;
  }
  .pipe {
    color: var(--chrome-shadow);
  }
</style>
