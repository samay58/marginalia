import { $prose } from '@milkdown/utils';
import { history, redo, undo } from '@milkdown/prose/history';
import { keymap } from '@milkdown/prose/keymap';

export const historyPlugin = $prose(() => history());

export const historyKeymapPlugin = $prose(() =>
  keymap({
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
  })
);

export default { historyPlugin, historyKeymapPlugin };
