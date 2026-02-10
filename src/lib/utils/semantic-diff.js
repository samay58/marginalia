/**
 * Semantic/structural diff for markdown source.
 * Captures meaningful non-textual edits that plain text diff can miss.
 */

/**
 * @typedef {'block_type' | 'heading_level' | 'list_nesting' | 'list_kind' | 'link_target' | 'formatting' | 'code_fence_language' | 'table_structure'} SemanticChangeType
 */

/**
 * @typedef {{ bold: number, italic: number, inlineCode: number, strikethrough: number }} FormattingSummary
 */

/**
 * @typedef {{ lineNumber: number, raw: string, blockType: 'blank' | 'paragraph' | 'heading' | 'list_item' | 'code_fence_open' | 'code_line' | 'table_row', headingLevel: number | null, listKind: 'ordered' | 'unordered' | null, listIndent: number | null, codeFenceLang: string | null, tableColumnCount: number | null, plainText: string, links: Array<{ text: string, url: string }>, formatting: FormattingSummary }} SemanticLine
 */

/**
 * @typedef {{ id: string, type: SemanticChangeType, line: number, context: string, before: any, after: any }} SemanticChange
 */

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * @param {string} value
 * @returns {number}
 */
function simpleHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * @param {SemanticChangeType} type
 * @param {number} line
 * @param {string} context
 * @param {any} before
 * @param {any} after
 * @returns {string}
 */
function makeSemanticChangeId(type, line, context, before, after) {
  const input = `${type}|${line}|${context}|${JSON.stringify(before)}|${JSON.stringify(after)}`;
  return `s_${simpleHash(input).toString(36)}`;
}

/**
 * @param {string} line
 * @returns {Array<{ text: string, url: string }>}
 */
function extractLinks(line) {
  /** @type {Array<{ text: string, url: string }>} */
  const links = [];
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const index = match.index;
    if (index > 0 && line[index - 1] === '!') continue; // ignore image links
    links.push({
      text: (match[1] || '').trim(),
      url: (match[2] || '').trim(),
    });
  }
  return links;
}

/**
 * @param {string} line
 * @returns {FormattingSummary}
 */
function extractFormatting(line) {
  const bold = (line.match(/\*\*[^*\n]+\*\*/g) || []).length +
    (line.match(/__[^_\n]+__/g) || []).length;
  const strike = (line.match(/~~[^~\n]+~~/g) || []).length;
  const code = (line.match(/`[^`\n]+`/g) || []).length;

  const italicSource = line
    .replace(/\*\*[^*\n]+\*\*/g, '')
    .replace(/__[^_\n]+__/g, '')
    .replace(/~~[^~\n]+~~/g, '');

  const italic = (italicSource.match(/\*[^*\n]+\*/g) || []).length +
    (italicSource.match(/_[^_\n]+_/g) || []).length;

  return {
    bold,
    italic,
    inlineCode: code,
    strikethrough: strike,
  };
}

/**
 * @param {string} line
 * @returns {string}
 */
function toPlainText(line) {
  let text = line;
  text = text.replace(/^\s{0,3}#{1,6}\s+/, '');
  text = text.replace(/^\s*([-*+]|\d+\.)\s+/, '');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2');
  text = text.replace(/(^|[^_])_([^_\n]+)_/g, '$1$2');
  text = text.replace(/~~([^~\n]+)~~/g, '$1');
  text = text.replace(/`([^`\n]+)`/g, '$1');
  text = text.replace(/\|/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} markdown
 * @returns {SemanticLine[]}
 */
function parseSemanticLines(markdown) {
  const lines = markdown.split(/\r?\n/);
  /** @type {SemanticLine[]} */
  const parsed = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNumber = i + 1;
    const trimmed = raw.trim();

    const fenceMatch = raw.match(/^\s{0,3}```\s*([A-Za-z0-9_-]+)?\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] ? fenceMatch[1].trim().toLowerCase() : '';
      parsed.push({
        lineNumber,
        raw,
        blockType: 'code_fence_open',
        headingLevel: null,
        listKind: null,
        listIndent: null,
        codeFenceLang: inCodeBlock ? null : (lang || null),
        tableColumnCount: null,
        plainText: '',
        links: [],
        formatting: { bold: 0, italic: 0, inlineCode: 0, strikethrough: 0 },
      });
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      parsed.push({
        lineNumber,
        raw,
        blockType: 'code_line',
        headingLevel: null,
        listKind: null,
        listIndent: null,
        codeFenceLang: null,
        tableColumnCount: null,
        plainText: '',
        links: [],
        formatting: { bold: 0, italic: 0, inlineCode: 0, strikethrough: 0 },
      });
      continue;
    }

    const headingMatch = raw.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    const listMatch = raw.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    const isTableRow = trimmed.includes('|') && /\|/.test(trimmed);

    /** @type {SemanticLine['blockType']} */
    let blockType = 'paragraph';
    let headingLevel = null;
    /** @type {'ordered' | 'unordered' | null} */
    let listKind = null;
    let listIndent = null;
    let tableColumnCount = null;

    if (!trimmed) {
      blockType = 'blank';
    } else if (headingMatch) {
      blockType = 'heading';
      headingLevel = headingMatch[1].length;
    } else if (listMatch) {
      blockType = 'list_item';
      listIndent = (listMatch[1] || '').length;
      listKind = /\d+\./.test(listMatch[2]) ? 'ordered' : 'unordered';
    } else if (isTableRow) {
      blockType = 'table_row';
      tableColumnCount = raw
        .split('|')
        .map((part) => part.trim())
        .filter((part) => part.length > 0).length;
    }

    parsed.push({
      lineNumber,
      raw,
      blockType,
      headingLevel,
      listKind,
      listIndent,
      codeFenceLang: null,
      tableColumnCount,
      plainText: toPlainText(raw),
      links: extractLinks(raw),
      formatting: extractFormatting(raw),
    });
  }

  return parsed;
}

/**
 * @param {SemanticLine[]} original
 * @param {SemanticLine[]} edited
 * @returns {Array<{ original: SemanticLine, edited: SemanticLine }>}
 */
function pairByPlainText(original, edited) {
  /** @type {Map<string, number[]>} */
  const editedBuckets = new Map();
  for (let i = 0; i < edited.length; i++) {
    const line = edited[i];
    const key = normalizeText(line.plainText);
    if (!key) continue;
    const bucket = editedBuckets.get(key) || [];
    bucket.push(i);
    editedBuckets.set(key, bucket);
  }

  const usedEdited = new Set();
  /** @type {Array<{ original: SemanticLine, edited: SemanticLine }>} */
  const pairs = [];

  for (const originalLine of original) {
    const key = normalizeText(originalLine.plainText);
    if (!key) continue;
    const candidates = editedBuckets.get(key);
    if (!candidates || candidates.length === 0) continue;

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const editedIndex of candidates) {
      if (usedEdited.has(editedIndex)) continue;
      const candidate = edited[editedIndex];
      const distance = Math.abs(candidate.lineNumber - originalLine.lineNumber);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = editedIndex;
      }
    }

    if (bestIndex < 0) continue;
    usedEdited.add(bestIndex);
    pairs.push({
      original: originalLine,
      edited: edited[bestIndex],
    });
  }

  return pairs;
}

/**
 * @param {Array<{ text: string, url: string }>} links
 * @returns {Map<string, string>}
 */
function linkMap(links) {
  const map = new Map();
  for (const link of links) {
    if (!link.text) continue;
    map.set(link.text.toLowerCase(), link.url);
  }
  return map;
}

/**
 * @param {FormattingSummary} original
 * @param {FormattingSummary} edited
 * @returns {boolean}
 */
function formattingChanged(original, edited) {
  return (
    original.bold !== edited.bold ||
    original.italic !== edited.italic ||
    original.inlineCode !== edited.inlineCode ||
    original.strikethrough !== edited.strikethrough
  );
}

/**
 * @param {string} originalMarkdown
 * @param {string} editedMarkdown
 * @returns {SemanticChange[]}
 */
export function computeSemanticChanges(originalMarkdown, editedMarkdown) {
  const originalLines = parseSemanticLines(originalMarkdown || '');
  const editedLines = parseSemanticLines(editedMarkdown || '');
  const pairs = pairByPlainText(originalLines, editedLines);

  /** @type {SemanticChange[]} */
  const changes = [];
  const dedupe = new Set();

  /**
   * @param {SemanticChangeType} type
   * @param {number} line
   * @param {string} context
   * @param {any} before
   * @param {any} after
   */
  const pushChange = (type, line, context, before, after) => {
    const id = makeSemanticChangeId(type, line, context, before, after);
    if (dedupe.has(id)) return;
    dedupe.add(id);
    changes.push({
      id,
      type,
      line,
      context,
      before,
      after,
    });
  };

  for (const pair of pairs) {
    const before = pair.original;
    const after = pair.edited;
    const context = after.plainText || before.plainText || after.raw.trim() || before.raw.trim();
    const line = after.lineNumber || before.lineNumber;

    if (before.blockType !== after.blockType) {
      pushChange(
        'block_type',
        line,
        context,
        { block_type: before.blockType },
        { block_type: after.blockType }
      );
    }

    if (
      before.blockType === 'heading' &&
      after.blockType === 'heading' &&
      before.headingLevel !== after.headingLevel
    ) {
      pushChange(
        'heading_level',
        line,
        context,
        { level: before.headingLevel },
        { level: after.headingLevel }
      );
    }

    if (
      before.blockType === 'list_item' &&
      after.blockType === 'list_item' &&
      before.listIndent !== after.listIndent
    ) {
      pushChange(
        'list_nesting',
        line,
        context,
        { indent: before.listIndent },
        { indent: after.listIndent }
      );
    }

    if (
      before.blockType === 'list_item' &&
      after.blockType === 'list_item' &&
      before.listKind !== after.listKind
    ) {
      pushChange(
        'list_kind',
        line,
        context,
        { list_kind: before.listKind },
        { list_kind: after.listKind }
      );
    }

    if (
      before.blockType === 'table_row' &&
      after.blockType === 'table_row' &&
      before.tableColumnCount !== after.tableColumnCount
    ) {
      pushChange(
        'table_structure',
        line,
        context,
        { columns: before.tableColumnCount },
        { columns: after.tableColumnCount }
      );
    }

    const beforeLinks = linkMap(before.links);
    const afterLinks = linkMap(after.links);
    for (const [text, beforeUrl] of beforeLinks) {
      if (!afterLinks.has(text)) continue;
      const afterUrl = afterLinks.get(text);
      if (beforeUrl !== afterUrl) {
        pushChange(
          'link_target',
          line,
          context,
          { link_text: text, url: beforeUrl },
          { link_text: text, url: afterUrl }
        );
      }
    }

    if (formattingChanged(before.formatting, after.formatting)) {
      pushChange(
        'formatting',
        line,
        context,
        before.formatting,
        after.formatting
      );
    }
  }

  const originalFences = originalLines.filter((line) => line.blockType === 'code_fence_open');
  const editedFences = editedLines.filter((line) => line.blockType === 'code_fence_open');
  const count = Math.min(originalFences.length, editedFences.length);
  for (let i = 0; i < count; i++) {
    const beforeFence = originalFences[i];
    const afterFence = editedFences[i];
    const beforeLang = beforeFence.codeFenceLang || '';
    const afterLang = afterFence.codeFenceLang || '';
    if (beforeLang !== afterLang) {
      pushChange(
        'code_fence_language',
        afterFence.lineNumber,
        `code fence #${i + 1}`,
        { language: beforeLang || null },
        { language: afterLang || null }
      );
    }
  }

  return changes.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.type.localeCompare(b.type);
  });
}

export default {
  computeSemanticChanges,
};
