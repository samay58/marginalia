<script>
  // Plex Sans ships inside the app bundle so the review surface renders the same offline.
  import '@fontsource/ibm-plex-sans/latin-400.css';
  import '@fontsource/ibm-plex-sans/latin-400-italic.css';
  import '@fontsource/ibm-plex-sans/latin-500.css';
  import '@fontsource/ibm-plex-sans/latin-600.css';
  import '@fontsource/ibm-plex-sans/latin-600-italic.css';
  import '../app.css';
  import { page } from '$app/stores';

  const REVIEW_PREFIX = '/review';

  let { children } = $props();

  $effect(() => {
    if (typeof document === 'undefined') return;
    const pathname = $page?.url?.pathname || '/';
    const isReview = pathname === REVIEW_PREFIX || pathname.startsWith(`${REVIEW_PREFIX}/`);
    document.documentElement.dataset.marginaliaMode = isReview ? 'review' : 'site';
  });
</script>

{@render children()}
