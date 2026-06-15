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

const sketchChannel = {
  ...channel,
  template: 'instagram-sketch-card-news-v2'
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

test('creates sketch-template Instagram payloads from OpenAI channel adaptation', async () => {
  const responsePayload = {
    content_title: 'Sketch content title',
    content_angle: 'Show why promotion needs clearer structure.',
    recommended_layout_flow: ['01', '03', '05', '09'],
    cover_image_prompt: 'Sketch note background with warm paper texture and lime accents, no readable text.',
    caption: 'Caption without links',
    hashtags: ['GrowthLine', 'branding'],
    cards: [
      {
        layout: '01',
        layout_name: 'Cover',
        usage_reason: 'Start with a strong cover.',
        series: 'GrowthLine Note',
        kicker: 'BRAND NOTE',
        title: 'Why promotion\nfeels unclear',
        subtitle: 'A short practical note'
      },
      {
        layout: '03',
        layout_name: 'Problem / Solution',
        usage_reason: 'The source suggests a clear problem and direction.',
        title: 'Problem and direction',
        problem_title: 'Problem',
        problem: 'Customers do not understand the difference.',
        solution_title: 'Solution',
        solution: 'Clarify the message before adding more channels.'
      },
      {
        layout: '05',
        layout_name: 'Checklist',
        usage_reason: 'Give the reader a practical check.',
        title: 'Check this first',
        items: ['Audience is clear', 'Problem is specific', 'Solution is simple', 'Next action is natural']
      },
      {
        layout: '09',
        layout_name: 'Closing',
        usage_reason: 'End with a save-worthy note.',
        title: 'More posts are not always the answer',
        description: 'Make the message easier to understand first.',
        cta: 'Save this and check your content again.'
      }
    ]
  };

  const payload = await createOpenAiInstagramCardNewsPayload({
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.openai.test/v1',
      openaiModel: 'gpt-test'
    },
    brand,
    item,
    channel: sketchChannel,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.text.format.name, 'brand_pilot_instagram_sketch_channel');
      const schemaVariants = body.text.format.schema.properties.cards.items.anyOf;
      const beforeAfterSchema = schemaVariants.find((variant) =>
        variant.properties.layout.enum.includes('06')
      );
      assert.equal(beforeAfterSchema.properties.title.maxLength, 32);
      assert.match(body.input[0].content[0].text, /본문 우선 규칙/);
      assert.match(body.input[0].content[0].text, /이미지 안에는 텍스트를 넣지 않는다/);
      assert.match(body.input[0].content[0].text, /LAYOUT 06\. Before \/ After/);
      assert.match(body.input[1].content[0].text, /Approved master draft/);
      return Response.json({
        output_text: JSON.stringify(responsePayload)
      });
    }
  });

  assert.equal(payload.template, 'instagram-sketch-card-news-v2');
  assert.equal(payload.cards.length, 4);
  assert.equal(payload.cards[0].layout, '01');
  assert.equal(payload.cards.at(-1).layout, '09');
  assert.equal(payload.coverImagePrompt, responsePayload.cover_image_prompt);
  assert.deepEqual(payload.hashtags, ['#GrowthLine', '#branding']);
  assert.equal(payload.generation.mode, 'openai-sketch-channel-adaptation');
});
