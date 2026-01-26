/**
 * @param {import('@milkdown/prose/model').Node} doc
 */
export function buildTextMap(doc) {
  let text = '';
  const offsets = [];

  doc.descendants(
    /** @param {import('@milkdown/prose/model').Node} node @param {number} pos */
    (node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        text += node.text[i];
        offsets.push(pos + i);
      }
    } else if (node.isTextblock) {
      if (text.length > 0 && !text.endsWith('\n')) {
        text += '\n';
        offsets.push(pos + 1);
      }
    }
    return true;
    }
  );

  // Add sentinel for end-of-document position lookups
  // This allows offsetToPos(text.length) to return the correct end position
  offsets.push(doc.content.size);

  return { text, offsets, docSize: doc.content.size };
}
