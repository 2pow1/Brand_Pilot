import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateChannelOutputs } from '../src/channel/index.js';
import { createInstagramCardNewsPayload } from '../src/channel/instagram.js';

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
