// Persistent preferences. Backed by localStorage in dev; Tauri fs in prod is a follow-up.
import { writable } from 'svelte/store';

const KEY = 'marginalia.preferences.v1';

/**
 * @typedef {{ showDialkitHandle: boolean }} Preferences
 */

/** @type {Preferences} */
const defaults = {
  showDialkitHandle: false
};

/** @returns {Preferences} */
function load() {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

/** @param {Preferences} value */
function save(value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}

function createPreferences() {
  const { subscribe, set, update } = writable(load());
  return {
    subscribe,
    /** @param {Preferences} value */
    set: (value) => {
      save(value);
      set(value);
    },
    /** @param {(current: Preferences) => Preferences} fn */
    update: (fn) => {
      update((current) => {
        const next = fn(current);
        save(next);
        return next;
      });
    }
  };
}

export const preferences = createPreferences();
