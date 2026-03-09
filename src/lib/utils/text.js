/**
 * Normalize and truncate text for UI previews.
 * @param {string} text
 * @param {number} [limit]
 * @param {string} [emptyLabel]
 * @returns {string}
 */
export function summarizeText(text, limit = 48, emptyLabel = '') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return emptyLabel;
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit)}…`;
}
