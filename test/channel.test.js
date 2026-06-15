import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateChannelOutputs } from '../src/channel/index.js';
import { applyInstagramSketchCardNewsAdaptation, createInstagramCardNewsPayload } from '../src/channel/instagram.js';

const brand = {
  companyName: 'GrowthLine',
  brandVoice: 'clear and practical',
  serviceSummary: 'Branding support',
  cta: {
    enabled: true,
    label: '상담 채널 확인하기',
    url: 'https://example.com/open-chat'
  }
};

const item = {
  id: 'content_123',
  source_title: 'Source title',
  source_url: 'https://example.com/article',
  draft_title: '대표님이 먼저 줄여야 할 홍보 고민',
  draft_body:
    '작은 사업을 운영하는 대표님에게 필요한 것은 더 많은 홍보물이 아니라 반복해서 설명할 수 있는 구조입니다. 좋은 인사이트도 우리 브랜드 메시지로 바뀌어야 성과가 생깁니다. GrowthLine은 채널별 콘텐츠 흐름을 정리해 대표가 본업에 집중할 수 있게 돕습니다. 지금 홍보 방향을 점검해보세요.'
};

const instagramChannel = {
  id: 'instagram',
  name: 'Instagram',
  enabled: true,
  format: 'card_news',
  template: 'instagram-card-news-v1'
};

const instagramSketchChannel = {
  ...instagramChannel,
  template: 'instagram-sketch-card-news-v2'
};

test('creates a five-slide Instagram card news payload with configured CTA', () => {
  const payload = createInstagramCardNewsPayload({
    brand,
    item,
    channel: instagramChannel
  });

  assert.equal(payload.channelId, 'instagram');
  assert.equal(payload.brandName, 'GrowthLine');
  assert.equal(payload.template, 'instagram-card-news-v1');
  assert.equal(payload.dimensions.width, 1080);
  assert.equal(payload.slides.length, 5);
  assert.equal(payload.slides[4].role, 'cta');
  assert.equal(payload.slides[4].qrTargetUrl, 'https://example.com/open-chat');
  assert.ok(payload.caption.includes('상담 채널 확인하기'));
});

test('hides CTA and QR data when no CTA URL is configured', () => {
  const payload = createInstagramCardNewsPayload({
    brand: {
      ...brand,
      cta: {
        enabled: false,
        label: '',
        url: ''
      }
    },
    item,
    channel: instagramChannel
  });

  assert.equal(payload.brandName, 'GrowthLine');
  assert.equal(payload.slides[4].role, 'closing');
  assert.equal(payload.slides[4].label, 'GrowthLine');
  assert.equal(payload.slides[4].qrTargetUrl, undefined);
  assert.doesNotMatch(payload.caption, /open-chat|상담 채널 확인하기/);
});

test('generates outputs for enabled channels only', async () => {
  const outputs = await generateChannelOutputs({
    config: {},
    brand,
    item,
    mock: true,
    channels: [
      instagramChannel,
      {
        id: 'blog',
        enabled: false,
        format: 'article',
        template: 'blog-article-v1'
      }
    ]
  });

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].channelId, 'instagram');
});

test('generates sketch-template Instagram payloads when v2 template is configured', async () => {
  const outputs = await generateChannelOutputs({
    config: {},
    brand,
    item,
    mock: true,
    channels: [instagramSketchChannel]
  });

  const payload = outputs[0].payload;

  assert.equal(payload.template, 'instagram-sketch-card-news-v2');
  assert.equal(payload.dimensions.width, 1080);
  assert.equal(payload.dimensions.height, 1350);
  assert.equal(payload.cards[0].layout, '01');
  assert.equal(payload.cards.at(-1).layout, '09');
  assert.ok(payload.cards.length <= 8);
  assert.equal(payload.coverImagePrompt.length > 0, true);
  assert.equal(payload.generation.schema, 'instagram-sketch-card-news-v2');
});

test('adds title fit metadata to long sketch-template card titles', () => {
  const payload = applyInstagramSketchCardNewsAdaptation({
    brand,
    item,
    channel: instagramSketchChannel,
    adaptation: {
      content_title: 'Long title fit test',
      content_angle: 'Check that long card titles are marked before rendering.',
      recommended_layout_flow: ['01', '06', '09'],
      cover_image_prompt: 'Warm paper background with no readable text.',
      caption: 'Caption',
      hashtags: ['GrowthLine'],
      cards: [
        {
          layout: '01',
          layout_name: 'Cover',
          usage_reason: 'Open the flow.',
          series: 'GrowthLine Note',
          kicker: 'BRAND NOTE',
          title: '짧은 커버 제목',
          subtitle: '짧은 부제'
        },
        {
          layout: '06',
          layout_name: 'Before / After',
          usage_reason: 'Compare the change.',
          title: '어째서 가격 표현이 고객의 신뢰를 잃히는 이유를 계속 만듭니다',
          before: '서비스를 소개합니다.',
          after: '고객이 신뢰를 느끼는 지점을 먼저 보여줍니다.'
        },
        {
          layout: '09',
          layout_name: 'Closing',
          usage_reason: 'Close the flow.',
          title: '저장해두고 다시 보기',
          description: '메시지 구조를 다시 점검합니다.',
          cta: '다음 콘텐츠 전에 확인하세요.'
        }
      ]
    }
  });

  const beforeAfterCard = payload.cards[1];

  assert.equal(beforeAfterCard.titleFit.field, 'title');
  assert.equal(beforeAfterCard.titleFit.level, 'compressed');
  assert.equal(beforeAfterCard.titleFit.length > beforeAfterCard.titleFit.budget.normal, true);
});

test('requires at least one enabled channel', async () => {
  await assert.rejects(
    () =>
      generateChannelOutputs({
        config: {},
        brand,
        item,
        mock: true,
        channels: [
          {
            id: 'instagram',
            enabled: false,
            format: 'card_news',
            template: 'instagram-card-news-v1'
          }
        ]
      }),
    /No enabled channels/
  );
});
