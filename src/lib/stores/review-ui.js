// Ephemeral review-surface UI state. Session-scoped: reset on page reload.
import { writable } from 'svelte/store';

/** @type {import('svelte/store').Writable<'review' | 'manuscript'>} */
export const tabMode = writable('review');

/** @type {import('svelte/store').Writable<'open' | 'minimized' | 'maximized' | 'closed'>} */
export const rationaleState = writable('open');

export function toggleRationaleClosed() {
  rationaleState.update((s) => (s === 'closed' ? 'open' : 'closed'));
}

export function toggleRationaleMinimized() {
  rationaleState.update((s) => (s === 'minimized' ? 'open' : 'minimized'));
}

export function toggleRationaleMaximized() {
  rationaleState.update((s) => (s === 'maximized' ? 'open' : 'maximized'));
}
