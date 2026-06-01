import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOpenAiInstagramCardNewsPayload } from '../src/channel/openai.js';

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

const channel = {
  id: 'instagram',
  format: 'card_news',
  template: 'instagram-card-news-v1'
};

test('creates Instagram payload from OpenAI channel adaptation', async () => {
  const responsePayload = {
    slides: [
      { role: 'hook', label: '', headline: 'Hook headline', body: 'Hook body', emphasis: 'Structure' },
      { role: 'problem', label: 'Problem', headline: 'Problem headline', body: 'Problem body', emphasis: '' },
      { role: 'insight', label: 'Insight', headline: 'Insight headline', body: 'Insight body', emphasis: '' },
      { role: 'solution', label: 'GrowthLine', headline: 'Solution headline', body: 'Solution body', emphasis: '' },
      { role: 'closing', label: 'GrowthLine', headline: 'Closing headline', body: 'Closing body', emphasis: '' }
    ],
    caption: 'Caption without links',
    hashtags: ['branding', '#marketing'],
    visual_notes: 'Keep the dark card-news style.'
  };
  const payload = await createOpenAiInstagramCardNewsPayload({
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.openai.test/v1',
      openaiModel: 'gpt-test'
    },
    brand,
    item,
    channel,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.text.format.name, 'brand_pilot_instagram_channel');
      return Response.json({
        output_text: JSON.stringify(responsePayload)
      });
    }
  });

  assert.equal(payload.brandName, 'GrowthLine');
  assert.equal(payload.slides.length, 5);
  assert.equal(payload.slides[0].headline, 'Hook headline');
  assert.equal(payload.slides[4].role, 'closing');
  assert.equal(payload.slides[4].qrTargetUrl, undefined);
  assert.equal(payload.caption, 'Caption without links');
  assert.deepEqual(payload.hashtags, ['#branding', '#marketing']);
  assert.equal(payload.generation.mode, 'openai-channel-adaptation');
});

test('requires OpenAI key for real channel adaptation', async () => {
  await assert.rejects(
    () =>
      createOpenAiInstagramCardNewsPayload({
        config: {
          openaiApiKey: '',
          openaiBaseUrl: 'https://api.openai.test/v1',
          openaiModel: 'gpt-test'
        },
        brand,
        item,
        channel
      }),
    /OPENAI_API_KEY/
  );
});
