<script>
  import '../app.css';
  import 'dialkit/styles.css';
  import { DialRoot } from 'dialkit/svelte';
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

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@1,700&family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@500;700&family=IM+Fell+English&family=Old+Standard+TT:wght@400;700&display=swap"
  />
</svelte:head>

{@render children()}
<DialRoot />
