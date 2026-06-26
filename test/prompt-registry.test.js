import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPromptSpec, listPromptSpecs, PROMPT_REGISTRY } from '../src/prompts/registry.js';

const brand = {
  companyName: 'GrowthLine',
  brandVoice: 'clear and practical',
  serviceSummary: 'Branding support',
  cta: {
    enabled: false,
    label: '',
    url: ''
  }
};

const item = {
  source_title: 'Source title',
  source_url: 'https://example.com/article',
  draft_title: 'Approved master draft',
  draft_body: 'The approved draft explains why small businesses need clearer promotion structure.'
};

test('lists prompt specs in the prompt registry', () => {
  const ids = listPromptSpecs().map((spec) => spec.id);

  assert.deepEqual(ids, [
    'draft.master.v1',
    'instagram.card-news.v1',
    'instagram.sketch-card-news.v2',
    'instagram.freeform-card-news.v3',
    'instagram.cover-image.v1'
  ]);
  assert.equal(PROMPT_REGISTRY['draft.master.v1'].title, 'Master draft generation');
});

test('returns null for unknown prompt spec ids', () => {
  assert.equal(getPromptSpec('missing.prompt'), null);
});

test('exposes runnable prompt builders and schemas', () => {
  const draftSpec = getPromptSpec('draft.master.v1');
  const draftPrompt = draftSpec.buildPrompt({ brand, item });
  assert.equal(typeof draftPrompt.system, 'string');
  assert.equal(typeof draftPrompt.user, 'string');
  assert.equal(draftSpec.schema.type, 'object');

  const cardSpec = getPromptSpec('instagram.card-news.v1');
  const cardPrompt = cardSpec.buildPrompt({
    brand,
    item,
    channel: {
      id: 'instagram',
      format: 'card_news',
      template: 'instagram-card-news-v1'
    }
  });
  assert.equal(typeof cardPrompt.system, 'string');
  assert.equal(typeof cardPrompt.user, 'string');
  assert.equal(cardSpec.schema.type, 'object');

  const sketchSpec = getPromptSpec('instagram.sketch-card-news.v2');
  const sketchPrompt = sketchSpec.buildPrompt({
    config: {},
    brand,
    item,
    channel: {
      id: 'instagram',
      format: 'card_news',
      template: 'instagram-sketch-card-news-v2'
    }
  });
  assert.equal(typeof sketchPrompt.system, 'string');
  assert.equal(typeof sketchPrompt.user, 'string');
  assert.equal(sketchSpec.schema.type, 'object');
  assert.equal(sketchSpec.responseName, 'brand_pilot_instagram_sketch_channel');
  assert.equal(sketchSpec.sourceFiles.includes('src/prompts/instagram/sketch-card-news-v2/prompt.js'), true);
  assert.equal(sketchSpec.verification.includes('node --no-warnings=ExperimentalWarning --test test/prompt-eval.test.js'), true);
  assert.equal(typeof sketchSpec.textFitPolicy.joinShortBodyLines, 'function');

  const freeformSpec = getPromptSpec('instagram.freeform-card-news.v3');
  const freeformPrompt = freeformSpec.buildPrompt({
    brand,
    item,
    cardCount: 3
  });
  assert.equal(typeof freeformPrompt, 'string');
  assert.equal(freeformSpec.schema, null);
  assert.equal(freeformSpec.responseName, undefined);
  assert.equal(freeformSpec.sourceFiles.includes('src/prompts/instagram/freeform-card-news-v3/prompt.js'), true);
  assert.equal(freeformSpec.verification.includes('node --no-warnings=ExperimentalWarning --test test/freeform-card-news-prompt.test.js'), true);

  const imageSpec = getPromptSpec('instagram.cover-image.v1');
  const imagePrompt = imageSpec.buildPrompt('Sketch-note background');
  assert.match(imagePrompt, /No readable text/);
  assert.equal(imageSpec.schema, null);
});

test('keeps maintenance metadata on every prompt spec', () => {
  for (const spec of listPromptSpecs()) {
    assert.equal(spec.sourceFiles.length > 0, true, `${spec.id} sourceFiles`);
    assert.equal(spec.verification.length > 0, true, `${spec.id} verification`);
    assert.equal(Object.isFrozen(spec), true, `${spec.id} frozen`);
    assert.equal(Object.isFrozen(spec.sourceFiles), true, `${spec.id} sourceFiles frozen`);
  }
});
