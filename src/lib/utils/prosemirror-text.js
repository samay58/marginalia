/**
 * @param {import('@milkdown/prose/model').Node} doc
 */
export function buildTextMap(doc) {
  /** @type {string[]} */
  const parts = [];
  const offsets = [];

  doc.descendants(
    /** @param {import('@milkdown/prose/model').Node} node @param {number} pos */
    (node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        parts.push(node.text[i]);
        offsets.push(pos + i);
      }
    } else if (node.isTextblock) {
      if (parts.length > 0 && parts[parts.length - 1] !== '\n') {
        parts.push('\n');
        offsets.push(pos + 1);
      }
    }
    return true;
    }
  );

  offsets.push(doc.content.size);

  return { text: parts.join(''), offsets, docSize: doc.content.size };
}
