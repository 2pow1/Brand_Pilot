import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildFreeformCardNewsPrompt,
  buildFreeformInputTextFromItem,
  CLIENT_CARD_NEWS_PROMPT
} from '../src/prompts/instagram/freeform-card-news-v3/prompt.js';

test('builds a freeform card news prompt from client instructions and item text', () => {
  const prompt = buildFreeformCardNewsPrompt({
    brand: {
      companyName: 'GrowthLine',
      brandVoice: 'clear and practical',
      serviceSummary: 'Branding support'
    },
    item: {
      source_title: 'Source title',
      source_url: 'https://example.com/source',
      draft_title: 'LinkedIn trust',
      draft_body: 'Small brands should show reasons to trust before promotion.'
    },
    cardCount: 4
  });

  assert.match(prompt, /인스타그램용 카드뉴스/);
  assert.match(prompt, /총 4장의 인스타그램 4:5 세로 카드뉴스 이미지를 생성한다/);
  assert.match(prompt, /각 장은 하나의 개별 이미지/);
  assert.match(prompt, /브랜드명: GrowthLine/);
  assert.match(prompt, /초안 제목: LinkedIn trust/);
  assert.match(prompt, /Small brands should show reasons/);
  assert.equal(CLIENT_CARD_NEWS_PROMPT.includes('카드뉴스 여러 장을 하나의 시리즈로 제작한다'), true);
});

test('builds freeform input text from available item fields', () => {
  const inputText = buildFreeformInputTextFromItem({
    source_title: 'Original',
    draft_title: 'Draft',
    draft_body: 'Body',
    raw_excerpt: 'Excerpt'
  });

  assert.match(inputText, /원문 제목: Original/);
  assert.match(inputText, /초안 제목: Draft/);
  assert.match(inputText, /초안 본문: Body/);
  assert.match(inputText, /원문 요약: Excerpt/);
});

test('requires input text for freeform card news previews', () => {
  assert.throws(() => buildFreeformCardNewsPrompt(), /requires input text/);
});

