const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'in',
  'is',
  'it',
  'no',
  'not',
  'of',
  'on',
  'or',
  'so',
  'the',
  'to',
  'with',
]);

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const normalized = normalize(text);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function buildTitleKeywords(title) {
  const raw = title.trim();
  const keywords = new Set();
  if (!raw) return [];

  const lower = raw.toLowerCase();
  keywords.add(normalize(lower));
  keywords.add(normalize(lower.replace(/-/g, ' ')));
  keywords.add(normalize(lower.replace(/-/g, '')));

  const tokens = tokenize(lower).filter((token) => token.length > 2 && !STOP_WORDS.has(token));
  tokens.forEach((token) => keywords.add(token));
  if (tokens.length > 1) {
    keywords.add(tokens.join(' '));
  }

  return Array.from(keywords).filter(Boolean);
}

function parseBannedList(line) {
  return line
    .split(',')
    .map((item) => item.replace(/\(.*?\)/g, '').trim())
    .filter(Boolean);
}

export function parseWritingRules(text) {
  const rules = [];
  const lines = text.split(/\r?\n/);
  let currentBannedSection = null;
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.slice(3).trim();
      currentBannedSection = null;
      continue;
    }

    if (trimmed.startsWith('### ')) {
      const heading = trimmed.slice(4).trim();
      currentBannedSection = heading.startsWith('Banned ') ? heading : null;
      continue;
    }

    const numberedRule = trimmed.match(/^\d+\.\s+\*\*(.+?)\*\*/);
    if (numberedRule) {
      const title = numberedRule[1].trim();
      rules.push({
        label: title,
        keywords: buildTitleKeywords(title),
        section: currentSection,
      });
      continue;
    }

    if (currentBannedSection) {
      const items = parseBannedList(trimmed);
      for (const item of items) {
        const keyword = normalize(item);
        if (!keyword) continue;
        rules.push({
          label: `${currentBannedSection}: ${item}`,
          keywords: [keyword],
          section: currentBannedSection,
        });
      }
    }
  }

  return rules;
}

export function createWritingRuleMatcher(text) {
  const rules = parseWritingRules(text);
  const index = [];

  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      const normalized = normalize(keyword);
      if (normalized.length < 3) continue;
      index.push({
        keyword: normalized,
        label: rule.label,
        isPhrase: normalized.includes(' '),
      });
    }
  }

  index.sort((a, b) => b.keyword.length - a.keyword.length);

  return {
    rules,
    match(rationale) {
      const normalized = normalize(rationale);
      if (!normalized) return null;
      const tokens = new Set(normalized.split(' ').filter(Boolean));
      for (const entry of index) {
        if (entry.isPhrase) {
          if (normalized.includes(entry.keyword)) return entry.label;
        } else if (tokens.has(entry.keyword)) {
          return entry.label;
        }
      }
      return null;
    },
  };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createViolationMatchers(text) {
  const rules = parseWritingRules(text);
  const matchers = [];

  for (const rule of rules) {
    if (rule.section && rule.section.startsWith('Banned ')) {
      const parts = rule.label.split(':');
      const word = parts.length > 1 ? parts.slice(1).join(':').trim() : rule.label;
      if (!word) continue;
      matchers.push({
        label: rule.label,
        pattern: `\\b${escapeRegExp(word)}\\b`,
        flags: 'g',
      });
    }
  }

  const hasEmDashRule = rules.some((rule) => rule.label.toLowerCase().includes('em-dash'));
  if (hasEmDashRule) {
    matchers.push({
      label: 'No Em-Dashes',
      pattern: '—|--',
      flags: 'g',
    });
  }

  return matchers;
}
