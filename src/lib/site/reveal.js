/**
 * IntersectionObserver-powered reveal action.
 * Adds `reveal` + `is-visible` classes for progressive section animation.
 * @param {HTMLElement} node
 * @param {{ rootMargin?: string, threshold?: number, once?: boolean }} [opts]
 */
export function reveal(node, opts = {}) {
  const { rootMargin = '0px 0px -12% 0px', threshold = 0.12, once = true } = opts;

  node.classList.add('reveal');

  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    node.classList.add('is-visible');
    return { destroy() {} };
  }

  const reduceMotion = (() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  })();

  if (reduceMotion) {
    node.classList.add('is-visible');
    return { destroy() {} };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        node.classList.add('is-visible');
        if (once) observer.disconnect();
      }
    },
    { rootMargin, threshold }
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    },
  };
}
