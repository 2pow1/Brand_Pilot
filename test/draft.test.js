import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockDraft } from '../src/draft/mock.js';
import { extractResponseText } from '../src/draft/openai.js';

const brand = {
  companyName: 'Brand Pilot Co.',
  brandVoice: 'clear and practical',
  serviceSummary: 'Branding support',
  cta: {
    label: '오픈채팅 참여하기',
    url: 'https://example.com'
  }
};

const item = {
  source_name: 'Source',
  source_title: 'Small business marketing signals',
  source_url: 'https://example.com/article',
  raw_excerpt: 'A short excerpt'
};

test('creates a deterministic mock draft', () => {
  const draft = createMockDraft({ brand, item });

  assert.equal(draft.title, '[검수 초안] Small business marketing signals');
  assert.match(draft.body, /Brand Pilot Co\./);
  assert.equal(draft.cta, '오픈채팅 참여하기');
  assert.equal(draft.keyPoints.length, 3);
});

test('extracts output text from a Responses API payload', () => {
  const payload = {
    output: [
      {
        content: [
          {
            type: 'output_text',
            text: '{"title":"Draft"}'
          }
        ]
      }
    ]
  };

  assert.equal(extractResponseText(payload), '{"title":"Draft"}');
});
