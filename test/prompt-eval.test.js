import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyInstagramSketchCardNewsAdaptation } from '../src/channel/instagram.js';
import { INSTAGRAM_SKETCH_CARD_NEWS_PROMPT_SPEC } from '../src/prompts/instagram/sketch-card-news-v2/index.js';
import { instagramSketchCardNewsV2EvalFixture } from '../test-fixtures/prompt-evals/instagram-sketch-card-news-v2.js';

const fitRank = Object.freeze({
  normal: 0,
  tight: 1,
  compressed: 2
});

function assertFitAtMost(actual, expected, context) {
  assert.ok(actual in fitRank, `${context} has unknown fit level: ${actual}`);
  assert.ok(expected in fitRank, `${context} has unknown expected fit level: ${expected}`);
  assert.equal(
    fitRank[actual] <= fitRank[expected],
    true,
    `${context} expected at most ${expected}, got ${actual}`
  );
}

function textValues(value) {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (typeof value === 'object') return Object.values(value).flatMap(textValues);
  return [];
}

function assertNoRepeatedSectionLabels(card) {
  const repeatedLabelPattern = /^(Before|After|Problem|Solution|문제|해결|방향)\s*[:：-]?\s*\n/i;
  const fieldsByLayout = {
    '03': ['problem', 'solution'],
    '06': ['before', 'after']
  };
  const fields = fieldsByLayout[card.layout] || [];

  for (const field of fields) {
    assert.doesNotMatch(card[field] || '', repeatedLabelPattern, `${card.layout}.${field}`);
  }
}

test('sketch v2 prompt keeps eval-critical text fit instructions', () => {
  const [evalCase] = instagramSketchCardNewsV2EvalFixture.cases;
  const prompt = INSTAGRAM_SKETCH_CARD_NEWS_PROMPT_SPEC.buildPrompt({
    config: {},
    brand: evalCase.brand,
    item: evalCase.item,
    channel: evalCase.channel
  });
  const combinedPrompt = `${prompt.system}\n${prompt.user}`;

  for (const snippet of instagramSketchCardNewsV2EvalFixture.requiredPromptSnippets) {
    assert.match(combinedPrompt, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('sketch v2 representative prompt outputs stay within fit budgets', () => {
  for (const evalCase of instagramSketchCardNewsV2EvalFixture.cases) {
    const payload = applyInstagramSketchCardNewsAdaptation({
      brand: evalCase.brand,
      item: evalCase.item,
      channel: evalCase.channel,
      adaptation: evalCase.adaptation
    });

    assert.equal(payload.template, 'instagram-sketch-card-news-v2', evalCase.name);
    assert.deepEqual(
      payload.cards.map((card) => card.layout),
      evalCase.expectations.expectedLayouts,
      evalCase.name
    );
    assert.deepEqual(payload.recommendedLayoutFlow, evalCase.expectations.expectedLayouts, evalCase.name);
    assert.match(payload.coverImagePrompt, new RegExp(evalCase.expectations.coverPromptPattern, 'i'));

    for (const card of payload.cards) {
      assertFitAtMost(card.titleFit.level, evalCase.expectations.maxTitleFit, `${evalCase.name}.${card.layout}.title`);
      assertFitAtMost(
        card.contentFit.level,
        evalCase.expectations.maxContentFit,
        `${evalCase.name}.${card.layout}.content`
      );
      assertNoRepeatedSectionLabels(card);

      for (const value of textValues(card)) {
        assert.doesNotMatch(value, /\bundefined\b|\bnull\b/i, `${evalCase.name}.${card.layout}`);
      }
    }
  }
});
