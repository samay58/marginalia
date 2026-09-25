<script>
  // Fonts ship inside the app bundle so the review surface renders the same offline.
  import '@fontsource/eb-garamond/latin-400-italic.css';
  import '@fontsource/eb-garamond/latin-700-italic.css';
  import '@fontsource/old-standard-tt/latin-400.css';
  import '@fontsource/old-standard-tt/latin-400-italic.css';
  import '@fontsource/old-standard-tt/latin-700.css';
  import '@fontsource/im-fell-english/latin-400.css';
  import '@fontsource/im-fell-english/latin-400-italic.css';
  import '@fontsource/ibm-plex-sans/latin-400.css';
  import '@fontsource/ibm-plex-sans/latin-400-italic.css';
  import '@fontsource/ibm-plex-sans/latin-500.css';
  import '@fontsource/ibm-plex-sans/latin-600.css';
  import '@fontsource/ibm-plex-sans/latin-700.css';
  import '@fontsource/ibm-plex-mono/latin-400.css';
  import '@fontsource/ibm-plex-mono/latin-700.css';
  import '../app.css';
  import 'dialkit/styles.css';
  import { DialRoot } from 'dialkit/svelte';
  import { page } from '$app/stores';
  import { preferences } from '$lib/stores/preferences.js';

  const REVIEW_PREFIX = '/review';
  const VITE_DIALKIT = import.meta.env.VITE_DIALKIT === '1';

  let { children } = $props();

  const showDialkit = $derived(VITE_DIALKIT || $preferences.showDialkitHandle);

  $effect(() => {
    if (typeof document === 'undefined') return;
    const pathname = $page?.url?.pathname || '/';
    const isReview = pathname === REVIEW_PREFIX || pathname.startsWith(`${REVIEW_PREFIX}/`);
    document.documentElement.dataset.marginaliaMode = isReview ? 'review' : 'site';
  });
</script>

{@render children()}
{#if showDialkit}
  <DialRoot defaultOpen={false} />
{/if}
