<script>
  /** @type {{ label?: string, value: string, hint?: string }} */
  let { label = '', value, hint = '' } = $props();

  let copied = $state(false);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let copiedTimeout = $state(null);

  async function copy() {
    const text = value || '';

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }

    copied = true;
    if (copiedTimeout) clearTimeout(copiedTimeout);
    copiedTimeout = setTimeout(() => {
      copied = false;
      copiedTimeout = null;
    }, 1200);
  }
</script>

<div class="copy-block">
  <div class="copy-top">
    <div class="copy-label">
      {#if label}
        <span class="copy-label-text">{label}</span>
      {/if}
      {#if hint}
        <span class="copy-hint">{hint}</span>
      {/if}
    </div>
    <button class="copy-btn" type="button" onclick={copy} aria-label="Copy to clipboard">
      {copied ? 'Copied' : 'Copy'}
    </button>
  </div>
  <pre class="copy-pre"><code>{value}</code></pre>
</div>
