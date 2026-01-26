const TONE_RULES = [
  {
    label: 'Overly formal opener',
    pattern: "\\bI hope (you are|you're|you|this finds you) well\\b",
    flags: 'gi',
    suggestion: 'Open with the specific reason or context.',
  },
  {
    label: 'Generic enthusiasm',
    pattern: "\\b(I\\'m|We\\'re|We are) (thrilled|excited|delighted) to\\b",
    flags: 'gi',
    suggestion: 'Replace with a concrete reason or drop the enthusiasm.',
  },
  {
    label: 'Reach out cliché',
    pattern: '\\b(I|We) wanted to reach out\\b',
    flags: 'gi',
    suggestion: 'Say what you want directly.',
  },
  {
    label: 'Generic follow-up',
    pattern: '\\b(I|We) wanted to (follow up|touch base)\\b',
    flags: 'gi',
    suggestion: 'State the update or question directly.',
  },
  {
    label: 'Corporate filler',
    pattern: '\\b(circle back|touch base|move forward|leverage|synergy|bandwidth)\\b',
    flags: 'gi',
    suggestion: 'Use plain verbs and concrete nouns.',
  },
  {
    label: 'Overly formal connector',
    pattern: '\\b(Additionally|Moreover|Furthermore)\\b',
    flags: 'g',
    suggestion: 'Use a direct transition or cut the word.',
  },
  {
    label: 'Hedging',
    pattern: '\\b(I think|I believe|we believe|we think|seems to|appears to)\\b',
    flags: 'gi',
    suggestion: 'State the claim directly or add evidence.',
  },
  {
    label: 'Vague intensifier',
    pattern: '\\b(very|really|significant|substantial|remarkable)\\b',
    flags: 'gi',
    suggestion: 'Use a specific fact or remove.',
  },
  {
    label: 'Wordy phrase',
    pattern: '\\b(in order to|with regard to|at this time|as well as)\\b',
    flags: 'gi',
    suggestion: 'Shorten the phrase.',
  },
  {
    label: 'Empty closing',
    pattern: '\\b(looking forward to|thanks in advance)\\b',
    flags: 'gi',
    suggestion: 'End with a concrete next step or question.',
  },
  {
    label: 'Generic superlative',
    pattern:
      '\\b(best[- ]in[- ]class|world[- ]class|state[- ]of[- ]the[- ]art|cutting[- ]edge|groundbreaking|innovative)\\b',
    flags: 'gi',
    suggestion: 'Replace with specific proof.',
  },
];

export function createToneMatchers() {
  return TONE_RULES.map((rule) => ({
    label: rule.label,
    pattern: rule.pattern,
    flags: rule.flags || 'gi',
    suggestion: rule.suggestion || null,
    category: 'tone',
  }));
}

export default {
  createToneMatchers,
};
