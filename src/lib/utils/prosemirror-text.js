export function buildTextMap(doc) {
  let text = '';
  const offsets = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        text += node.text[i];
        offsets.push(pos + i);
      }
    } else if (node.isBlock) {
      if (text.length > 0 && !text.endsWith('\n')) {
        text += '\n';
        offsets.push(pos);
      }
    }
    return true;
  });

  // Add sentinel for end-of-document position lookups
  // This allows offsetToPos(text.length) to return the correct end position
  offsets.push(doc.content.size);

  return { text, offsets, docSize: doc.content.size };
}
