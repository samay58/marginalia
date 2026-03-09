<script>
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
