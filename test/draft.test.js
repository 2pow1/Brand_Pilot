import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockDraft } from '../src/draft/mock.js';
import { createOpenAiDraft, extractResponseText } from '../src/draft/openai.js';

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
  assert.equal(draft.angle, 'problem-awareness');
  assert.equal(draft.cta, '오픈채팅 참여하기');
  assert.equal(draft.ctaUrl, 'https://example.com');
  assert.equal(draft.keyPoints.length, 3);
  assert.equal(draft.suggestedRepurpose.instagram, '문제 인식 중심의 5장 카드뉴스로 확장');
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

test('normalizes the client draft schema into the app draft shape', async () => {
  const responseDraft = {
    title: '홍보가 계속 흔들리는 이유',
    hook: '홍보가 매번 새로 시작되는 느낌이라면 기준이 부족한 상태일 수 있습니다.',
    body: '작은 사업의 브랜딩은 큰 슬로건보다 고객이 반복해서 이해할 수 있는 문장부터 정리해야 합니다.',
    cta: {
      label: '오픈채팅 참여하기',
      url: 'https://example.com/open-chat'
    },
    keywords: ['홍보 구조', '브랜딩 기준'],
    content_angle: 'problem-awareness',
    suggested_repurpose: {
      instagram: '5장 카드뉴스',
      blog: '문제 진단형 블로그',
      linkedin: '실무 인사이트'
    }
  };

  const draft = await createOpenAiDraft({
    config: {
      openaiApiKey: 'test-key',
      openaiBaseUrl: 'https://api.openai.test/v1',
      openaiModel: 'gpt-test'
    },
    prompt: {
      system: 'system',
      user: 'user'
    },
    fetchImpl: async () => Response.json({
      output_text: JSON.stringify(responseDraft)
    })
  });

  assert.equal(draft.title, responseDraft.title);
  assert.equal(draft.hook, responseDraft.hook);
  assert.match(draft.body, /홍보가 매번 새로 시작되는 느낌/);
  assert.match(draft.body, /작은 사업의 브랜딩/);
  assert.equal(draft.angle, 'problem-awareness');
  assert.deepEqual(draft.keyPoints, ['홍보 구조', '브랜딩 기준']);
  assert.equal(draft.cta, '오픈채팅 참여하기');
  assert.equal(draft.ctaUrl, 'https://example.com/open-chat');
  assert.deepEqual(draft.suggestedRepurpose, responseDraft.suggested_repurpose);
});
