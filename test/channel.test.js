import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateChannelOutputs } from '../src/channel/index.js';
import { createInstagramCardNewsPayload } from '../src/channel/instagram.js';

const brand = {
  companyName: 'Brand Pilot Co.',
  brandVoice: 'clear and practical',
  serviceSummary: 'Branding support',
  cta: {
    label: '오픈채팅 참여하기',
    url: 'https://example.com/open-chat'
  }
};

const item = {
  id: 'content_123',
  source_title: 'Source title',
  source_url: 'https://example.com/article',
  draft_title: '대표님이 먼저 줄여야 할 홍보 고민',
  draft_body:
    '작은 사업을 운영하는 대표님에게 필요한 것은 더 많은 홍보물이 아니라 반복해서 쓸 수 있는 구조입니다. 외부 인사이트는 우리 브랜드 메시지로 바꿀 때 힘이 생깁니다. Brand Pilot Co.은 채널별 콘텐츠 흐름을 정리해 대표님이 본업에 집중하게 돕습니다. 지금 홍보 방향을 점검해보세요.'
};

const instagramChannel = {
  id: 'instagram',
  name: 'Instagram',
  enabled: true,
  format: 'card_news',
  template: 'instagram-card-news-v1'
};

test('creates a five-slide Instagram card news payload', () => {
  const payload = createInstagramCardNewsPayload({
    brand,
    item,
    channel: instagramChannel
  });

  assert.equal(payload.channelId, 'instagram');
  assert.equal(payload.template, 'instagram-card-news-v1');
  assert.equal(payload.dimensions.width, 1080);
  assert.equal(payload.slides.length, 5);
  assert.equal(payload.slides[4].qrTargetUrl, 'https://example.com/open-chat');
  assert.ok(payload.caption.includes('오픈채팅 참여하기'));
});

test('generates outputs for enabled channels only', () => {
  const outputs = generateChannelOutputs({
    brand,
    item,
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

test('requires at least one enabled channel', () => {
  assert.throws(
    () =>
      generateChannelOutputs({
        brand,
        item,
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
