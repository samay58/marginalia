// One table for the help sheet and the status bar hints. The bindings
// themselves live in handleKeydown in src/routes/review/+page.svelte.
export const SHORTCUTS = [
  { id: 'rationale', keys: '⌘/', label: 'Rationale', help: 'Explain the edit nearest the cursor' },
  { id: 'notes', keys: '⌘G', label: 'Notes', help: 'Session notes for the whole draft' },
  { id: 'references', keys: '⌘⇧O', label: 'References', help: 'Show references, or add one' },
  { id: 'undo', keys: '⌘Z', label: 'Undo', help: 'Undo. ⌘⇧Z redoes.' },
  { id: 'rationalePanel', keys: '⌘⇧R', label: 'Panel', help: 'Show or hide the rationale panel' },
  { id: 'open', keys: '⌘O', label: 'Open', help: 'Open another draft' },
  { id: 'done', keys: '⌘↩', label: 'Done', help: 'Finish the review and send it to the agent' },
  { id: 'escape', keys: 'Esc', label: 'Close', help: 'Close the open panel. With nothing open, finish the review.' },
];

/** @param {string[]} ids */
export function pickShortcuts(ids) {
  return SHORTCUTS.filter((shortcut) => ids.includes(shortcut.id));
}
