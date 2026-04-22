<script>
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

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@1,700&family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@500;700&family=IM+Fell+English&family=Old+Standard+TT:wght@400;700&display=swap"
  />
</svelte:head>

{@render children()}
{#if showDialkit}
  <DialRoot />
{/if}
