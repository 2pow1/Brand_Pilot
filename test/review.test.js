import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReviewComponents, buildReviewContent, buildReviewPayload } from '../src/review/message.js';
import { createMockReviewRequest } from '../src/review/discord.js';

const item = {
  id: 'content_123',
  source_name: 'Source A',
  source_title: 'Source title',
  source_url: 'https://example.com/article',
  draft_title: 'Draft title',
  draft_body: 'Draft body'
};

test('builds a Discord review message with approval controls', () => {
  const payload = buildReviewPayload(item);
  const components = buildReviewComponents(item.id);

  assert.match(buildReviewContent(item), /콘텐츠 ID: content_123/);
  assert.equal(payload.allowed_mentions.parse.length, 0);
  assert.equal(components[0].components[0].custom_id, 'brandpilot:approve:content_123');
  assert.equal(components[0].components[1].custom_id, 'brandpilot:reject:content_123');
});

test('creates deterministic mock review request metadata', () => {
  const review = createMockReviewRequest(item);

  assert.equal(review.messageId, 'mock_review_content_123');
  assert.equal(review.channelId, 'mock');
});
