#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createToneMatchers } from '../src/lib/utils/tone-lint.js';
import { createViolationMatchers } from '../src/lib/utils/writing-rules.js';
import { collectLintFindings } from '../src/lib/utils/lint.js';

function testToneMatcherIds() {
  const toneMatchers = createToneMatchers();
  assert.ok(toneMatchers.length > 0, 'expected tone matchers');
  const ids = toneMatchers.map((matcher) => matcher.id);
  assert.ok(ids.every((id) => typeof id === 'string' && id.startsWith('tone.')), 'tone matchers must have stable tone.* ids');
  assert.equal(new Set(ids).size, ids.length, 'tone matcher ids must be unique');
}

function testWritingMatcherIds() {
  const rules = [
    '## Style',
    '### Banned Words',
    'very, really, leverage',
    '### Banned Punctuation',
    'em-dash',
  ].join('\n');

  const writingMatchers = createViolationMatchers(rules);
  assert.ok(writingMatchers.length > 0, 'expected writing matchers');
  assert.ok(
    writingMatchers.every((matcher) => typeof matcher.id === 'string' && matcher.id.startsWith('writing.')),
    'writing matchers must have stable writing.* ids'
  );
}

function testLintFindingsIncludeExplainabilityFields() {
  const text = 'I think we should leverage this approach.';
  const findings = collectLintFindings(text, createToneMatchers(), {
    maxPerRule: 2,
    maxTotal: 5,
  });

  assert.ok(findings.length > 0, 'expected lint findings');
  const first = findings[0];
  assert.ok(typeof first.rule_id === 'string' && first.rule_id.length > 0, 'finding must include rule_id');
  assert.ok(typeof first.pattern === 'string' && first.pattern.length > 0, 'finding must include pattern');
  assert.ok(typeof first.match === 'string' && first.match.length > 0, 'finding must include matched text');
}

function main() {
  testToneMatcherIds();
  testWritingMatcherIds();
  testLintFindingsIncludeExplainabilityFields();
  console.log('lint-model: all checks passed');
}

main();
