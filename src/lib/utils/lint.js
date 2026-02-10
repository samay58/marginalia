/**
 * @typedef {{ id?: string, label: string, pattern: string, flags?: string, category?: string | null, suggestion?: string | null }} LintMatcher
 * @typedef {{ maxPerRule?: number, maxTotal?: number }} LintOptions
 * @typedef {{ rule_id: string, label: string, line: number, match: string, snippet: string, pattern: string, category?: string | null, suggestion?: string | null }} LintFinding
 */

/**
 * @param {string} pattern
 * @param {string} [flags]
 */
function buildRegex(pattern, flags) {
  if (!pattern) return null;
  const safeFlags = flags || 'g';
  const finalFlags = safeFlags.includes('g') ? safeFlags : `${safeFlags}g`;
  try {
    return new RegExp(pattern, finalFlags);
  } catch (e) {
    return null;
  }
}

/**
 * @param {LintMatcher} matcher
 */
function resolveRuleId(matcher) {
  if (matcher.id) return matcher.id;
  const label = (matcher.label || 'unnamed')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const category = (matcher.category || 'lint').toLowerCase();
  return `${category}.${label || 'rule'}`;
}

/**
 * @param {string} text
 * @param {LintMatcher[]} matchers
 * @param {LintOptions} [options]
 * @returns {LintFinding[]}
 */
export function collectLintFindings(text, matchers, options = {}) {
  if (!text || !matchers || matchers.length === 0) return [];

  const maxPerRule = options.maxPerRule ?? 2;
  const maxTotal = options.maxTotal ?? 8;
  const lines = text.split(/\r?\n/);

  const compiled = matchers
    .filter((matcher) => matcher?.pattern)
    .map((matcher) => ({
      ...matcher,
      regex: buildRegex(matcher.pattern, matcher.flags),
    }))
    .filter((matcher) => matcher.regex);

  const findings = [];
  const perRuleCount = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const matcher of compiled) {
      const regex = matcher.regex;
      if (!regex) continue;
      regex.lastIndex = 0;
      const match = regex.exec(line);
      if (!match) continue;

      const seen = perRuleCount.get(matcher.label) || 0;
      if (seen >= maxPerRule) continue;

      findings.push({
        rule_id: resolveRuleId(matcher),
        label: matcher.label,
        line: i + 1,
        match: match[0],
        snippet: line.trim().slice(0, 160),
        pattern: matcher.pattern,
        category: matcher.category || null,
        suggestion: matcher.suggestion || null,
      });

      perRuleCount.set(matcher.label, seen + 1);

      if (findings.length >= maxTotal) {
        return findings;
      }
    }
  }

  return findings;
}

export default {
  collectLintFindings,
};
