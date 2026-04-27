/**
 * Conservative source-level projection used to seed or repair the original
 * plain-text baseline. The live editor still owns current rendered plain text
 * so decoration offsets stay tied to ProseMirror.
 */

/**
 * @param {string} line
 * @returns {string}
 */
export function markdownLineToPlainText(line) {
  let text = line || '';
  text = text.replace(/^\s{0,3}#{1,6}\s+/, '');
  text = text.replace(/^\s*([-*+]|\d+\.)\s+/, '');
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');
  text = text.replace(/(^|[^_])_([^_\n]+)_/g, '$1$2');
  text = text.replace(/~~([^~\n]+)~~/g, '$1');
  text = text.replace(/`([^`\n]+)`/g, '$1');
  text = text.replace(/\|/g, ' ');
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToPlainText(markdown) {
  const withoutComments = String(markdown || '').replace(/<!--[\s\S]*?-->/g, '');
  const lines = withoutComments.split(/\r?\n/);
  const projected = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (/^\s{0,3}```/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }

    const plain = inCodeFence
      ? line.replace(/\u00a0/g, ' ').replace(/\s+$/g, '')
      : markdownLineToPlainText(line);
    if (plain.trim()) {
      projected.push(plain);
    }
  }

  return projected.join('\n');
}
