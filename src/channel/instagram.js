/**
 * Collapses arbitrary whitespace so slide and caption text fits predictable card layouts.
 */
function normalizeWhitespace(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Shortens text for fixed-size Instagram slide regions while preserving a readable suffix.
 */
function truncate(value, maxLength) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

/**
 * Splits the approved draft body into sentence-like parts used by the card-news template.
 */
function splitDraftBody(body) {
  return normalizeWhitespace(body)
    .split(/(?<=[.!?。！？])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Returns true only when a real CTA URL is configured for the operating brand.
 */
function hasVisibleCta(brand) {
  return Boolean(brand.cta?.enabled && normalizeWhitespace(brand.cta?.url));
}

/**
 * Chooses the problem, insight, solution, and closing copy blocks for the five-slide carousel.
 */
function pickBodyLines(item, companyName) {
  const sentences = splitDraftBody(item.draft_body);

  return {
    problem: truncate(sentences[0] || item.draft_body, 72),
    insight: truncate(sentences[1] || item.source_title, 82),
    solution: truncate(sentences[2] || item.draft_body, 92),
    closing: truncate(
      sentences[3] ||
        `${companyName}은 작은 사업의 브랜딩과 홍보 메시지를 고객이 이해하는 구조로 정리합니다.`,
      86
    )
  };
}

/**
 * Builds the Instagram caption from the draft and optional brand CTA settings.
 */
function buildCaption({ brand, item, lines }) {
  const parts = [
    `${item.draft_title || item.source_title}`,
    '',
    lines.problem,
    lines.solution
  ];

  if (hasVisibleCta(brand)) {
    const ctaLabel = brand.cta?.label || '상담 채널 확인하기';
    parts.push('', `${ctaLabel}: ${brand.cta.url}`);
  }

  return parts.join('\n');
}

/**
 * Converts an approved content item into the Instagram card-news payload stored in channel_outputs.
 */
export function createInstagramCardNewsPayload({ brand, item, channel }) {
  const companyName = brand.companyName || 'GrowthLine';
  const lines = pickBodyLines(item, companyName);
  const visibleCta = hasVisibleCta(brand);
  const ctaLabel = brand.cta?.label || '상담 채널 확인하기';

  const finalSlide = visibleCta
    ? {
        index: 5,
        role: 'cta',
        headline: ctaLabel,
        body: lines.closing,
        qrTargetUrl: brand.cta.url
      }
    : {
        index: 5,
        role: 'closing',
        label: companyName,
        headline: '홍보는 더 자주가 아니라 더 선명하게',
        body: lines.closing
      };

  return {
    channelId: 'instagram',
    brandName: companyName,
    format: channel.format,
    template: channel.template,
    dimensions: {
      width: 1080,
      height: 1080
    },
    design: {
      background: '#181818',
      foreground: '#f8fafc',
      muted: '#a3a3a3',
      accent: '#f15a24',
      logoPosition: 'top-center',
      pageIndicator: true
    },
    slides: [
      {
        index: 1,
        role: 'hook',
        headline: truncate(item.draft_title || item.source_title, 42),
        body: '대표님이 먼저 줄여야 할 것은 더 많은 홍보가 아닙니다.',
        emphasis: '홍보 구조'
      },
      {
        index: 2,
        role: 'problem',
        label: '문제',
        headline: '노력이 부족한 게 아니라 구조가 흐릿한 겁니다',
        body: lines.problem
      },
      {
        index: 3,
        role: 'insight',
        label: '인사이트',
        headline: '고객은 설명보다 느낌으로 먼저 판단합니다',
        body: lines.insight
      },
      {
        index: 4,
        role: 'solution',
        label: companyName,
        headline: '채널보다 먼저 메시지 구조를 만듭니다',
        body: lines.solution
      },
      finalSlide
    ],
    caption: buildCaption({ brand, item, lines }),
    hashtags: ['#브랜딩', '#마케팅', '#사업홍보', '#인스타그램마케팅', '#대표님콘텐츠'],
    source: {
      title: item.source_title,
      url: item.source_url
    }
  };
}

/**
 * Adds a leading hash mark to model-provided hashtag text and drops unusable values.
 */
function normalizeHashtag(value) {
  const normalized = normalizeWhitespace(value).replace(/\s+/g, '');
  if (!normalized) return '';
  return normalized.startsWith('#') ? normalized : `#${normalized}`;
}

/**
 * Prevents inactive CTA URLs from leaking into generated captions.
 */
function captionWithoutInactiveCta(caption) {
  return normalizeWhitespace(caption).replace(/https?:\/\/\S+/gi, '').trim();
}

/**
 * Applies GPT-written Instagram copy while preserving renderer-critical template fields.
 */
export function applyInstagramCardNewsAdaptation({ brand, item, channel, adaptation }) {
  const base = createInstagramCardNewsPayload({ brand, item, channel });
  const adaptedSlides = Array.isArray(adaptation?.slides) ? adaptation.slides : [];
  const visibleCta = hasVisibleCta(brand);
  const slides = base.slides.map((baseSlide, index) => {
    const adapted = adaptedSlides[index] || {};
    const slide = {
      ...baseSlide,
      label: normalizeWhitespace(adapted.label) || baseSlide.label,
      headline: normalizeWhitespace(adapted.headline) || baseSlide.headline,
      body: normalizeWhitespace(adapted.body) || baseSlide.body,
      emphasis: normalizeWhitespace(adapted.emphasis) || baseSlide.emphasis
    };

    if (!visibleCta) {
      delete slide.qrTargetUrl;
    }

    return slide;
  });
  const caption = normalizeWhitespace(adaptation?.caption);
  const hashtags = Array.isArray(adaptation?.hashtags)
    ? adaptation.hashtags.map(normalizeHashtag).filter(Boolean)
    : [];

  return {
    ...base,
    slides,
    caption: visibleCta ? caption || base.caption : captionWithoutInactiveCta(caption || base.caption),
    hashtags: hashtags.length > 0 ? [...new Set(hashtags)] : base.hashtags,
    generation: {
      mode: 'openai-channel-adaptation',
      visualNotes: normalizeWhitespace(adaptation?.visual_notes)
    }
  };
}

/**
 * Trims card text while preserving intentional line breaks for HTML layouts.
 */
function normalizeSketchText(value) {
  return (value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const SKETCH_TITLE_FIELDS = Object.freeze({
  '02': 'question'
});

const SKETCH_TITLE_BUDGETS = Object.freeze({
  '01': { normal: 28, tight: 38, maxLines: 2, maxLineLength: 16 },
  '02': { normal: 26, tight: 36, maxLines: 2, maxLineLength: 16 },
  '03': { normal: 26, tight: 36, maxLines: 2, maxLineLength: 16 },
  '04': { normal: 26, tight: 36, maxLines: 2, maxLineLength: 16 },
  '05': { normal: 24, tight: 34, maxLines: 2, maxLineLength: 15 },
  '06': { normal: 24, tight: 32, maxLines: 2, maxLineLength: 14 },
  '07': { normal: 30, tight: 42, maxLines: 2, maxLineLength: 17 },
  '08': { normal: 24, tight: 34, maxLines: 2, maxLineLength: 15 },
  '09': { normal: 28, tight: 40, maxLines: 2, maxLineLength: 16 }
});

function countVisibleCharacters(value) {
  return Array.from(normalizeSketchText(value).replace(/\s+/g, '')).length;
}

function analyzeSketchTitle(value) {
  const lines = normalizeSketchText(value).split('\n').filter(Boolean);
  const measuredLines = lines.length > 0 ? lines : [''];

  return {
    length: countVisibleCharacters(value),
    lineCount: measuredLines.length,
    maxLineLength: Math.max(...measuredLines.map(countVisibleCharacters))
  };
}

function classifySketchTitleFit({ layout, value }) {
  const budget = SKETCH_TITLE_BUDGETS[layout] || { normal: 26, tight: 36, maxLines: 2, maxLineLength: 16 };
  const metrics = analyzeSketchTitle(value);
  const level =
    metrics.length > budget.tight ||
    metrics.maxLineLength > budget.maxLineLength + 6 ||
    metrics.lineCount > budget.maxLines + 1
      ? 'compressed'
      : metrics.length > budget.normal ||
          metrics.maxLineLength > budget.maxLineLength ||
          metrics.lineCount > budget.maxLines
        ? 'tight'
        : 'normal';

  return {
    level,
    length: metrics.length,
    lineCount: metrics.lineCount,
    maxLineLength: metrics.maxLineLength,
    budget
  };
}

const SKETCH_CONTENT_FIELDS = Object.freeze({
  '02': ['answer'],
  '03': ['problem', 'solution'],
  '04': ['steps'],
  '05': ['items'],
  '06': ['before', 'after'],
  '07': ['description'],
  '08': ['items'],
  '09': ['description', 'cta']
});

const SKETCH_CONTENT_BUDGETS = Object.freeze({
  '02': { normal: 90, tight: 125, normalLines: 5, tightLines: 7, maxLineLength: 18 },
  '03': { normal: 95, tight: 130, normalLines: 8, tightLines: 11, maxLineLength: 18 },
  '04': { normal: 120, tight: 160, normalLines: 9, tightLines: 12, maxLineLength: 18 },
  '05': { normal: 110, tight: 150, normalLines: 8, tightLines: 11, maxLineLength: 18 },
  '06': { normal: 95, tight: 120, normalLines: 7, tightLines: 9, maxLineLength: 17 },
  '07': { normal: 90, tight: 125, normalLines: 4, tightLines: 6, maxLineLength: 20 },
  '08': { normal: 110, tight: 150, normalLines: 8, tightLines: 11, maxLineLength: 18 },
  '09': { normal: 100, tight: 140, normalLines: 6, tightLines: 8, maxLineLength: 18 }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripLeadingSectionLabel(value, labels) {
  const normalized = normalizeSketchText(value);
  const choices = labels.map(normalizeSketchText).filter(Boolean);
  if (!normalized || choices.length === 0) return normalized;

  const pattern = new RegExp(
    `^(?:${choices.map(escapeRegExp).join('|')})(?:\\s*[:：\\-–—]\\s*|\\s*\\n+)`,
    'i'
  );

  return normalized.replace(pattern, '').trim();
}

function textPartsFromSketchValue(value) {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textPartsFromSketchValue);
  if (typeof value === 'object') {
    return Object.values(value).flatMap(textPartsFromSketchValue);
  }
  return [];
}

function analyzeSketchContent({ layout, card, budget }) {
  const fields = SKETCH_CONTENT_FIELDS[layout] || [];
  const parts = fields.flatMap((field) => textPartsFromSketchValue(card[field]));
  const lines = parts
    .flatMap((part) => normalizeSketchText(part).split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      length: 0,
      lineCount: 0,
      estimatedLineCount: 0,
      maxLineLength: 0,
      fields
    };
  }

  return {
    length: countVisibleCharacters(parts.join('\n')),
    lineCount: lines.length,
    estimatedLineCount: lines.reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(countVisibleCharacters(line) / budget.maxLineLength)),
      0
    ),
    maxLineLength: Math.max(...lines.map(countVisibleCharacters)),
    fields
  };
}

function classifySketchContentFit({ layout, card }) {
  const budget = SKETCH_CONTENT_BUDGETS[layout] || {
    normal: 110,
    tight: 150,
    normalLines: 8,
    tightLines: 11,
    maxLineLength: 18
  };
  const metrics = analyzeSketchContent({ layout, card, budget });
  const level =
    metrics.length > budget.tight ||
    metrics.estimatedLineCount > budget.tightLines ||
    metrics.maxLineLength > budget.maxLineLength + 8
      ? 'compressed'
      : metrics.length > budget.normal ||
          metrics.estimatedLineCount > budget.normalLines ||
          metrics.maxLineLength > budget.maxLineLength
        ? 'tight'
        : 'normal';

  return {
    level,
    length: metrics.length,
    lineCount: metrics.lineCount,
    estimatedLineCount: metrics.estimatedLineCount,
    maxLineLength: metrics.maxLineLength,
    fields: metrics.fields,
    budget
  };
}

/**
 * Creates deterministic sketch-template content for mock generation and fallback tests.
 */
function createDefaultSketchAdaptation({ brand, item }) {
  const companyName = brand.companyName || 'GrowthLine';
  const title = item.draft_title || item.source_title;
  const body = item.draft_body || item.raw_excerpt || item.source_title;

  return {
    content_title: title,
    content_angle: '작은 사업자가 홍보가 막히는 이유를 메시지 구조 관점에서 점검한다.',
    recommended_layout_flow: ['01', '03', '05', '09'],
    cover_image_prompt:
      'A hand-drawn Korean brand strategy sketch note background for a small business marketing insight, warm paper texture, black ink lines, lime accent, no readable text.',
    caption: `${title}\n\n${truncate(body, 220)}`,
    hashtags: ['GrowthLine', '브랜딩', '작은사업홍보'],
    cards: [
      {
        layout: '01',
        layout_name: 'Cover',
        usage_reason: '콘텐츠의 핵심 문제를 첫 장에서 바로 보여주기 위해 사용한다.',
        series: 'GrowthLine Note',
        kicker: 'BRAND NOTE',
        title,
        subtitle: '홍보가 많아도 고객이 이해하지 못하면 문의로 이어지지 않습니다.'
      },
      {
        layout: '03',
        layout_name: 'Problem / Solution',
        usage_reason: '문제와 해결 방향이 명확한 흐름이기 때문에 사용한다.',
        title: '홍보가 쌓여도\n반응이 약한 이유',
        problem_title: 'Problem',
        problem: truncate(body, 120),
        solution_title: 'Solution',
        solution: '채널을 늘리기 전에\n고객이 이해할 메시지 구조부터 정리해야 합니다.'
      },
      {
        layout: '05',
        layout_name: 'Checklist',
        usage_reason: '실무자가 바로 점검할 수 있는 항목으로 전환하기 위해 사용한다.',
        title: '먼저 점검할 4가지',
        items: [
          '고객이 누구인지 바로 보이는가',
          '고객의 문제가 구체적으로 드러나는가',
          '해결 방식이 어렵지 않게 설명되는가',
          '다음 행동이 자연스럽게 이어지는가'
        ]
      },
      {
        layout: '09',
        layout_name: 'Closing',
        usage_reason: '과한 판매 문구 없이 저장하고 다시 보게 만들기 위해 사용한다.',
        title: '홍보는 더 많이보다\n더 선명하게',
        description: `${companyName}은 작은 사업의 메시지와 홍보 구조를 고객이 이해하기 쉬운 흐름으로 정리합니다.`,
        cta: '이 기준은 저장해두고 다시 점검해보세요.'
      }
    ]
  };
}

/**
 * Normalizes layout-specific card fields without losing the selected layout shape.
 */
function normalizeSketchCard(card, index, total) {
  const layout = normalizeSketchText(card.layout);
  const layoutName = normalizeSketchText(card.layout_name);
  const titleField = SKETCH_TITLE_FIELDS[layout] || 'title';
  const normalized = {
    index,
    page: `${index}/${total}`,
    ...card,
    layout,
    layout_name: layoutName,
    usage_reason: normalizeSketchText(card.usage_reason)
  };

  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === 'string') {
      normalized[key] = normalizeSketchText(value);
    }
  }

  if (Array.isArray(card.steps)) {
    normalized.steps = card.steps.map((step) => ({
      title: normalizeSketchText(step.title),
      description: normalizeSketchText(step.description)
    }));
  }

  if (Array.isArray(card.items)) {
    normalized.items = card.items.map((item) => {
      if (typeof item === 'string') return normalizeSketchText(item);
      return {
        number: normalizeSketchText(item.number),
        text: normalizeSketchText(item.text)
      };
    });
  }

  if (layout === '03') {
    normalized.problem = stripLeadingSectionLabel(normalized.problem, [
      normalized.problem_title,
      'Problem',
      '문제'
    ]);
    normalized.solution = stripLeadingSectionLabel(normalized.solution, [
      normalized.solution_title,
      'Solution',
      '해결',
      '해결 방향',
      '방향'
    ]);
  }

  if (layout === '06') {
    normalized.before = stripLeadingSectionLabel(normalized.before, ['Before', '비포']);
    normalized.after = stripLeadingSectionLabel(normalized.after, ['After', '애프터']);
  }

  const titleFit = classifySketchTitleFit({
    layout,
    value: normalized[titleField]
  });
  const contentFit = classifySketchContentFit({
    layout,
    card: normalized
  });

  return {
    ...normalized,
    titleFit: {
      field: titleField,
      ...titleFit
    },
    contentFit: {
      ...contentFit
    }
  };
}

/**
 * Enforces the v2 card flow contract before a payload is stored.
 */
function assertSketchCardFlow(cards) {
  if (!Array.isArray(cards) || cards.length < 2 || cards.length > 8) {
    throw new Error('Instagram sketch card-news requires 2 to 8 cards.');
  }

  if (cards[0].layout !== '01') {
    throw new Error('Instagram sketch card-news must start with layout 01 Cover.');
  }

  if (cards.at(-1).layout !== '09') {
    throw new Error('Instagram sketch card-news must end with layout 09 Closing.');
  }
}

/**
 * Applies GPT-written sketch-template content while preserving pipeline-critical fields.
 */
export function applyInstagramSketchCardNewsAdaptation({ brand, item, channel, adaptation }) {
  const companyName = brand.companyName || 'GrowthLine';
  const selected = adaptation || createDefaultSketchAdaptation({ brand, item });
  const rawCards = Array.isArray(selected.cards) ? selected.cards.slice(0, 8) : [];
  const cards = rawCards.map((card, index) => normalizeSketchCard(card, index + 1, rawCards.length));
  assertSketchCardFlow(cards);

  const hashtags = Array.isArray(selected.hashtags)
    ? selected.hashtags.map(normalizeHashtag).filter(Boolean)
    : [];
  const caption = normalizeSketchText(selected.caption);

  return {
    channelId: 'instagram',
    brandName: companyName,
    format: channel.format,
    template: channel.template,
    dimensions: {
      width: 1080,
      height: 1350
    },
    design: {
      background: '#f7f1e3',
      foreground: '#151515',
      muted: '#706b61',
      accent: '#c9f24d',
      border: '#1c1c1c',
      templateStyle: 'sketch-note'
    },
    contentTitle: normalizeSketchText(selected.content_title || item.draft_title || item.source_title),
    contentAngle: normalizeSketchText(selected.content_angle),
    recommendedLayoutFlow: Array.isArray(selected.recommended_layout_flow)
      ? selected.recommended_layout_flow.map(normalizeSketchText).filter(Boolean)
      : cards.map((card) => card.layout),
    coverImagePrompt: normalizeSketchText(selected.cover_image_prompt),
    cards,
    caption: captionWithoutInactiveCta(caption || `${item.draft_title || item.source_title}`),
    hashtags: hashtags.length > 0 ? [...new Set(hashtags)] : ['#GrowthLine', '#브랜딩', '#작은사업홍보'],
    source: {
      title: item.source_title,
      url: item.source_url
    },
    generation: {
      mode: adaptation ? 'openai-sketch-channel-adaptation' : 'template-sketch-channel',
      schema: 'instagram-sketch-card-news-v2'
    }
  };
}

/**
 * Creates a mock GrowthLine sketch-template payload without calling OpenAI.
 */
export function createInstagramSketchCardNewsPayload({ brand, item, channel }) {
  return applyInstagramSketchCardNewsAdaptation({
    brand,
    item,
    channel,
    adaptation: createDefaultSketchAdaptation({ brand, item })
  });
}
