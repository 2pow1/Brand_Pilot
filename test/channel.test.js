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

test('adds content fit metadata and strips repeated section labels from dense sketch cards', () => {
  const payload = applyInstagramSketchCardNewsAdaptation({
    brand,
    item,
    channel: instagramSketchChannel,
    adaptation: {
      content_title: 'Dense body fit test',
      content_angle: 'Check that dense comparison cards are marked before rendering.',
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
          title: '같은 내용도\n읽히는 방식이 다릅니다',
          before: 'Before\n\n“우리 서비스를 소개합니다”\n“성공 사례를 공개합니다”\n\n브랜드가 하고 싶은 말에서\n출발합니다.',
          after:
            'After\n\n“소규모 B2B 브랜드가\n제안서에서 자주 놓치는 3가지”\n\n“고객이 가격을 걱정하다가\n신뢰를 느낀 지점”\n\n고객의 고민에서\n출발합니다.'
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

  assert.doesNotMatch(beforeAfterCard.before, /^Before/i);
  assert.doesNotMatch(beforeAfterCard.after, /^After/i);
  assert.equal(beforeAfterCard.contentFit.level, 'normal');
  assert.equal(beforeAfterCard.contentFit.fields.includes('before'), true);
  assert.equal(beforeAfterCard.contentFit.fields.includes('after'), true);
});

test('does not compress short before-after copy just because it has many lines', () => {
  const payload = applyInstagramSketchCardNewsAdaptation({
    brand,
    item,
    channel: instagramSketchChannel,
    adaptation: {
      content_title: 'Short line fit test',
      content_angle: 'Check that short comparison copy is not over-compressed.',
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
          title: '짧은 비교 테스트',
          subtitle: '짧은 줄이 많은 경우'
        },
        {
          layout: '06',
          layout_name: 'Before / After',
          usage_reason: 'Compare the change.',
          title: '회사 게시판에서 벗어나기',
          before: '출시 소식\n행사 참여\n제휴 발표\n우리 이야기만\n계속 쌓입니다.',
          after: '고객의 걱정\n결정 기준\n해결 과정\n상대가 궁금한 쪽으로\n방향을 바꿉니다.'
        },
        {
          layout: '09',
          layout_name: 'Closing',
          usage_reason: 'Close the flow.',
          title: '다시 점검하기',
          description: '메시지 구조를 다시 확인합니다.',
          cta: '다음 콘텐츠 전에 확인하세요.'
        }
      ]
    }
  });

  const beforeAfterCard = payload.cards[1];

  assert.equal(beforeAfterCard.contentFit.level, 'tight');
  assert.equal(beforeAfterCard.contentFit.length < beforeAfterCard.contentFit.budget.normal, true);
  assert.equal(beforeAfterCard.contentFit.maxLineLength > beforeAfterCard.contentFit.budget.maxLineLength, true);
});

test('joins short sketch body lines when they fit naturally', () => {
  const payload = applyInstagramSketchCardNewsAdaptation({
    brand,
    item,
    channel: instagramSketchChannel,
    adaptation: {
      content_title: 'Short body line join test',
      content_angle: 'Check that short body copy is not over-broken.',
      recommended_layout_flow: ['01', '03', '04', '05', '06', '09'],
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
          title: '본문 줄 확인',
          subtitle: '짧은 줄을 합칩니다'
        },
        {
          layout: '03',
          layout_name: 'Problem / Solution',
          usage_reason: 'Compare the change.',
          title: '반응 없는 이유',
          problem_title: 'Problem',
          problem: '소식은 많지만\n고객 질문에는\n답이 없습니다.',
          solution_title: 'Solution',
          solution: '누구의 어떤 문제를\n반복해서 풀어왔는지\n보여줘야 합니다.'
        },
        {
          layout: '04',
          layout_name: 'Customer Flow',
          usage_reason: 'Show the flow.',
          title: '신뢰 흐름',
          steps: [
            { title: '상황 포착', description: '고객이 이미 겪는\n문제에서 시작' },
            { title: '관점 제시', description: '우리는 어떻게 보는지\n짧게 설명' },
            { title: '단서 축적', description: '사례와 과정을\n반복해서 남김' }
          ]
        },
        {
          layout: '05',
          layout_name: 'Checklist',
          usage_reason: 'Check the message.',
          title: '먼저 볼 것',
          items: [
            '프로필과 페이지가\n같은 말을 하는가',
            '한 문장으로\n대상이 보이는가',
            '고객 상황에서\n글이 시작되는가',
            '성과보다 과정과\n기준을 보여주는가'
          ]
        },
        {
          layout: '06',
          layout_name: 'Before / After',
          usage_reason: 'Compare before and after.',
          title: '회사 소식만 올릴 때',
          before: '출시 소식\n행사 참여\n제휴 뉴스\n채용 공고만\n쌓입니다.',
          after: '고객의 고민\n대표의 관점\n해결 과정\n자주 받는 질문이\n쌓입니다.'
        },
        {
          layout: '09',
          layout_name: 'Closing',
          usage_reason: 'Close the flow.',
          title: '다시 점검하기',
          description: '메시지 구조를 다시 확인합니다.',
          cta: '다음 콘텐츠 전에 확인하세요.'
        }
      ]
    }
  });

  const problemCard = payload.cards[1];
  const flowCard = payload.cards[2];
  const checklistCard = payload.cards[3];
  const beforeAfterCard = payload.cards[4];

  assert.equal(problemCard.problem, '소식은 많지만 고객 질문에는\n답이 없습니다.');
  assert.equal(flowCard.steps[0].description, '고객이 이미 겪는 문제에서 시작');
  assert.equal(checklistCard.items[0], '프로필과 페이지가 같은 말을 하는가');
  assert.equal(beforeAfterCard.before, '출시 소식 행사 참여 제휴 뉴스 채용 공고만\n쌓입니다.');
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
